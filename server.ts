import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import * as ollama from "./services/ollama";
import * as db from "./services/supabase";
import { supabase } from "./services/supabase";

dotenv.config();

// Rede de segurança: sem isso, qualquer erro não tratado numa rota (ex: falha
// no Supabase) derruba o processo Node inteiro e tira o sistema do ar para
// todo mundo. Loga o erro real e mantém o servidor no ar.
process.on("unhandledRejection", (reason: any) => {
  console.error("Erro não tratado (unhandledRejection):", reason?.message || reason, reason?.stack || "");
});
process.on("uncaughtException", (err: any) => {
  console.error("Erro não tratado (uncaughtException):", err?.message || err, err?.stack || "");
});

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Envolve um handler async para sempre responder com erro 500 em vez de
// derrubar o servidor quando algo dá errado (ex: violação de constraint no banco).
function asyncHandler(fn: (req: express.Request, res: express.Response) => Promise<any>) {
  return (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err: any) => {
      console.error(`Erro em ${req.method} ${req.path}:`, err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Erro interno do servidor." });
      }
    });
  };
}

// Requires a valid Supabase Auth session on every /api/* request.
// Table-level RLS is intentionally permissive (see supabase/schema.sql) because
// Express is the only database client; this middleware is what actually gates access.
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Não autenticado. Faça login para continuar." });
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
  }
  next();
}

// Interpreta a resposta livre de WhatsApp (ex: "confirmo", "não posso") em um status fixo.
const CONFIRMED_WORDS = ["confirmado", "confirmo", "sim", "ok", "estarei"];
const DECLINED_WORDS = ["não", "nao", "não posso", "nao posso", "recusado"];
function interpretN8nResponse(resposta: string, fallback: "Pendente" | "Confirmado" | "Recusado") {
  const normalized = (resposta || "").trim().toLowerCase();
  if (CONFIRMED_WORDS.some((w) => normalized === w || normalized.includes(w))) return "Confirmado";
  if (DECLINED_WORDS.some((w) => normalized === w || normalized.includes(w))) return "Recusado";
  return fallback;
}

// Rota pública chamada pelo n8n (sem sessão Supabase) — protegida só pelo header x-kadosh-secret.
// Precisa ficar registrada ANTES do middleware requireAuth abaixo.
app.post("/api/n8n/confirmacao", async (req, res) => {
  const secret = process.env.N8N_CONFIRMATION_SECRET;
  const headerSecret = req.headers["x-kadosh-secret"];
  const headerSecretStr = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;
  if (!secret || !headerSecretStr || headerSecretStr !== secret) {
    return res.status(401).json({ error: "Não autorizado: token inválido." });
  }

  const { schedule_id, member_id, telefone, resposta, mensagem_recebida } = req.body || {};
  if (!schedule_id || !member_id || !resposta) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes: schedule_id, member_id, resposta." });
  }

  try {
    const schedule = await db.getSchedule(schedule_id);
    if (!schedule) {
      return res.status(404).json({ error: "Escala não encontrada." });
    }

    let found = false;
    const updateArray = (arr: any[]) =>
      arr.map((m) => {
        if (m.id === member_id) {
          found = true;
          return { ...m, status: interpretN8nResponse(resposta, m.status) };
        }
        return m;
      });

    const vocals = updateArray(schedule.vocals);
    const instrumentalists = updateArray(schedule.instrumentalists);
    const technicians = updateArray(schedule.technicians);

    if (!found) {
      return res.status(404).json({ error: "Esta pessoa não está escalada nesta escala." });
    }

    await db.upsertSchedule({ ...schedule, id: schedule_id, vocals, instrumentalists, technicians });

    const mappedStatus = interpretN8nResponse(resposta, "Pendente");
    if (mappedStatus !== "Pendente") {
      await db.updateConfirmationStatus(schedule_id, member_id, mappedStatus as "Confirmado" | "Recusado", mensagem_recebida || resposta, telefone || null);
    }

    res.json({ ok: true, confirmation_status: mappedStatus });
  } catch (error: any) {
    console.error("Erro ao processar confirmação do n8n:", error);
    res.status(500).json({ error: error.message || "Erro interno." });
  }
});

app.use("/api", requireAuth);

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.log("Aviso: GEMINI_API_KEY não encontrada no ambiente. Kadosh AI usará modo de contingência local.");
}

// Kadosh AI provider state (in-memory, defaults to local Ollama)
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
let aiProvider: "ollama" | "gemini" = "ollama";
let ollamaState: { connected: boolean; models: ollama.OllamaModel[]; currentModel: string | null } = {
  connected: false,
  models: [],
  currentModel: null,
};

async function initOllama() {
  ollamaState.connected = await ollama.checkConnection(OLLAMA_BASE_URL);
  if (ollamaState.connected) {
    ollamaState.models = await ollama.listModels(OLLAMA_BASE_URL);
    ollamaState.currentModel = ollama.pickDefaultModel(ollamaState.models);
    console.log(`Kadosh AI conectada ao Ollama em ${OLLAMA_BASE_URL}. Modelo padrão: ${ollamaState.currentModel || "nenhum modelo instalado"}.`);
  } else {
    console.log("Não foi possível conectar ao Ollama. Verifique se o serviço está em execução.");
  }
}

// Tolerates local models that wrap JSON in markdown code fences or leftover <think> blocks
function extractJson(text: string): any {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json|```/g, "")
    .trim();
  return JSON.parse(cleaned);
}

async function helpGenerateScheduleNotifications(oldSch: any, newSch: any) {
  const isApprovedNow = newSch.status === "Aprovado";
  const wasApprovedBefore = oldSch && oldSch.status === "Aprovado";

  if (isApprovedNow && (!oldSch || !wasApprovedBefore)) {
    // Escala publicada oficialmente
    await db.createNotification({
      type: "publish",
      title: "Escala Publicada 📅",
      message: `A escala para o culto '${newSch.title}' (${newSch.date}) foi publicada oficialmente pelo ministério!`,
      targetMusicianId: "all",
    });

    const addedSet = new Set<string>();
    const notifyUser = (m: any) => {
      if (!m.id || addedSet.has(m.id)) return;
      addedSet.add(m.id);
      return db.createNotification({
        type: "added",
        title: "Escalado(a) no Altar! ✨",
        message: `Você foi escalado(a) como '${m.instrument}' para o culto oficial '${newSch.title}' no dia ${newSch.date}.`,
        targetMusicianId: m.id,
      });
    };

    await Promise.all([...(newSch.vocals || []), ...(newSch.instrumentalists || []), ...(newSch.technicians || [])].map(notifyUser));
  } else {
    // Diferenciar quem foi adicionado (seja em rascunho ou atualização)
    const oldVocSet = oldSch ? new Set((oldSch.vocals || []).map((v: any) => v.id)) : new Set();
    const oldInstSet = oldSch ? new Set((oldSch.instrumentalists || []).map((i: any) => i.id)) : new Set();
    const oldTechSet = oldSch ? new Set((oldSch.technicians || []).map((t: any) => t.id)) : new Set();

    const addedVocals = (newSch.vocals || []).filter((v: any) => v.id && !oldVocSet.has(v.id));
    const addedInsts = (newSch.instrumentalists || []).filter((i: any) => i.id && !oldInstSet.has(i.id));
    const addedTechs = (newSch.technicians || []).filter((t: any) => t.id && !oldTechSet.has(t.id));

    await Promise.all([
      ...addedVocals.map((v: any) => db.createNotification({
        type: "added",
        title: "Adicionado(a) à Escala 🎙️",
        message: `Você foi adicionado(a) como '${v.instrument}' à escala do culto '${newSch.title}' no dia ${newSch.date}.`,
        targetMusicianId: v.id,
      })),
      ...addedInsts.map((i: any) => db.createNotification({
        type: "added",
        title: "Adicionado(a) à Escala 🎸",
        message: `Você foi adicionado(a) como '${i.instrument}' à escala do culto '${newSch.title}' no dia ${newSch.date}.`,
        targetMusicianId: i.id,
      })),
      ...addedTechs.map((t: any) => db.createNotification({
        type: "added",
        title: "Adicionado(a) à Escala Técnica 🎚️",
        message: `Você foi adicionado(a) como '${t.instrument}' à escala técnica do culto '${newSch.title}' no dia ${newSch.date}.`,
        targetMusicianId: t.id,
      })),
    ]);
  }
}

// Helper: recompute and persist scaleCount/count whenever schedules change
async function updateStatisticsHeuristics() {
  const [musicians, songs, schedules] = await Promise.all([db.listMusicians(), db.listSongs(), db.listSchedules()]);

  const musicianCounts: Record<string, number> = {};
  musicians.forEach(m => { musicianCounts[m.id] = 0; });
  const songCounts: Record<string, number> = {};
  songs.forEach(s => { songCounts[s.id] = 5; }); // offset base

  schedules.forEach(sch => {
    sch.vocals.forEach((v: any) => { if (musicianCounts[v.id] !== undefined) musicianCounts[v.id] += 1; });
    sch.instrumentalists.forEach((inst: any) => { if (musicianCounts[inst.id] !== undefined) musicianCounts[inst.id] += 1; });
    (sch.technicians || []).forEach((t: any) => { if (musicianCounts[t.id] !== undefined) musicianCounts[t.id] += 1; });
    sch.songs.forEach((sRef: any) => { if (songCounts[sRef.id] !== undefined) songCounts[sRef.id] += 1; });
  });

  await Promise.all([db.setMusicianScaleCounts(musicianCounts), db.setSongCounts(songCounts)]);
}

// API ROUTES
app.get("/api/musicians", asyncHandler(async (req, res) => {
  res.json(await db.listMusicians());
}));

app.post("/api/musicians", asyncHandler(async (req, res) => {
  const { name, role, instrument, active, gender, phone, photo, birthday, secondaryRoles, secondaryInstrument } = req.body;
  if (!name || !role || !instrument) {
    return res.status(400).json({ error: "Nome, Função (Vocal/Instrumento/Técnico de som/Datashow) e Instrumento específico são obrigatórios." });
  }
  const newMusician = await db.createMusician({ name, role, instrument, active, gender, phone, photo, birthday, secondaryRoles, secondaryInstrument });
  res.json(newMusician);
}));

app.put("/api/musicians/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, role, instrument, active, gender, phone, photo, birthday, secondaryRoles, secondaryInstrument } = req.body;
  const patch: any = {};
  if (name !== undefined) patch.name = name;
  if (role !== undefined) patch.role = role;
  if (instrument !== undefined) patch.instrument = instrument;
  if (active !== undefined) patch.active = active;
  if (gender !== undefined) patch.gender = gender;
  if (phone !== undefined) patch.phone = phone;
  if (photo !== undefined) patch.photo = photo;
  if (birthday !== undefined) patch.birthday = birthday;
  if (secondaryRoles !== undefined) patch.secondaryRoles = secondaryRoles;
  if (secondaryInstrument !== undefined) patch.secondaryInstrument = secondaryInstrument;

  const updated = await db.updateMusician(id, patch);
  if (!updated) {
    return res.status(404).json({ error: "Músico não encontrado" });
  }
  res.json(updated);
}));

app.get("/api/songs", asyncHandler(async (req, res) => {
  res.json(await db.listSongs());
}));

app.post("/api/songs", asyncHandler(async (req, res) => {
  const { title, author, tone, bpm, theme, link, timeSignature, difficulty } = req.body;
  if (!title || !author || !toneObjToText(tone)) {
    return res.status(400).json({ error: "Título, Autor e Tom são obrigatórios." });
  }
  const newSong = await db.createSong({ title, author, tone: toneObjToText(tone), bpm, theme, link, timeSignature, difficulty });
  res.json(newSong);
}));

function toneObjToText(tone: any) {
  if (typeof tone === "string") return tone;
  if (tone && typeof tone === "object" && tone.text) return tone.text;
  return tone;
}

app.get("/api/schedules", asyncHandler(async (req, res) => {
  res.json(await db.listSchedules());
}));

app.post("/api/schedules", asyncHandler(async (req, res) => {
  const { id, date, time, title, theme, coordinator, status, vocals, instrumentalists, technicians, songs: schSongs, notes, aiGenerated } = req.body;
  if (!date || !title) {
    return res.status(400).json({ error: "Data e Título são obrigatórios do culto." });
  }

  const oldSchedule = id ? await db.getSchedule(id) : null;
  const saved = await db.upsertSchedule({ id, date, time, title, theme, coordinator, status, vocals, instrumentalists, technicians, songs: schSongs, notes, aiGenerated });

  await updateStatisticsHeuristics();
  try {
    await helpGenerateScheduleNotifications(oldSchedule, saved);
  } catch (err) {
    console.error("Erro ao gerar notificações de escala:", err);
  }
  res.json(saved);
}));

app.delete("/api/schedules/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.deleteSchedule(id);
  await updateStatisticsHeuristics();
  res.json({ success: true });
}));

// QUICK REMINDERS ENDPOINTS
app.get("/api/reminders", asyncHandler(async (req, res) => {
  res.json(await db.listReminders());
}));

app.post("/api/reminders", asyncHandler(async (req, res) => {
  const { date, text, category } = req.body;
  if (!date || !text) {
    return res.status(400).json({ error: "Data e texto/descrição do lembrete funcionam obrigatoriamente." });
  }
  const newRem = await db.createReminder({ date, text, category });

  // also trigger notification for all musicians
  try {
    await db.createNotification({
      type: "reminder",
      title: `Aviso: ${newRem.category} 🔔`,
      message: `Novo lembrete da coordenação para o dia ${newRem.date}: "${newRem.text}"`,
      targetMusicianId: "all",
    });
  } catch (err) {
    console.warn("Erro ao gerar notificação de lembrete:", err);
  }

  res.json(newRem);
}));

app.delete("/api/reminders/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.deleteReminder(id);
  res.json({ success: true });
}));

// NOTIFICATIONS ENDPOINTS
app.get("/api/notifications", asyncHandler(async (req, res) => {
  res.json(await db.listNotifications());
}));

app.post("/api/notifications/:id/read", asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.markNotificationRead(id);
  res.json({ success: true });
}));

app.post("/api/notifications/read-all", asyncHandler(async (req, res) => {
  const { musicianId } = req.body;
  await db.markAllNotificationsRead(musicianId);
  res.json({ success: true });
}));

app.delete("/api/notifications/clear", asyncHandler(async (req, res) => {
  await db.clearNotifications();
  res.json({ success: true });
}));

// STATS ENDPOINT
app.get("/api/statistics", asyncHandler(async (req, res) => {
  const [musicians, songs, schedules] = await Promise.all([db.listMusicians(), db.listSongs(), db.listSchedules()]);

  const activeMusiciansCount = musicians.filter(m => m.active).length;
  const inactiveMusiciansCount = musicians.filter(m => !m.active).length;
  const totalSchedules = schedules.length;
  const approvedSchedules = schedules.filter(s => s.status === "Aprovado").length;
  const draftSchedules = schedules.filter(s => s.status === "Rascunho").length;

  // Most active musicians
  const sortedMusicians = [...musicians].sort((a, b) => b.scaleCount - a.scaleCount);
  const mostActive = sortedMusicians.slice(0, 4);

  // Most sung songs
  const sortedSongs = [...songs].sort((a, b) => b.count - a.count);
  const topSongs = sortedSongs.slice(0, 4);

  res.json({
    activeMusiciansCount,
    inactiveMusiciansCount,
    totalSchedules,
    approvedSchedules,
    draftSchedules,
    mostActive,
    topSongs
  });
}));

// ---------------------------------------------------------------------
// SONOPLASTIA / INTEGRAÇÃO N8N
// ---------------------------------------------------------------------
const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
function getWeekdayName(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function buildScheduleMessage(sch: any, musiciansById: Record<string, any>) {
  const soundTechs = (sch.technicians || []).filter((t: any) => musiciansById[t.id]?.role === "Técnico de som");
  const datashowTechs = (sch.technicians || []).filter((t: any) => musiciansById[t.id]?.role === "Datashow");

  const lines: string[] = [];
  lines.push(`🔥 ESCALA KADOSH — ${sch.date} (${getWeekdayName(sch.date)})`);
  lines.push("");
  lines.push(`📍 Culto: ${sch.title}`);
  lines.push(`🕖 Horário: ${sch.time || "19:30"}`);
  lines.push("");
  lines.push("🎤 Cantores:");
  lines.push(sch.vocals.length ? sch.vocals.map((v: any) => `${v.name} — ${v.instrument}`).join("\n") : "—");
  lines.push("");
  lines.push("🎸 Músicos:");
  lines.push(sch.instrumentalists.length ? sch.instrumentalists.map((i: any) => `${i.name} — ${i.instrument}`).join("\n") : "—");
  lines.push("");
  lines.push("🎚️ Técnica:");
  lines.push(`Som: ${soundTechs.map((t: any) => t.name).join(", ") || "—"}`);
  lines.push(`Datashow: ${datashowTechs.map((t: any) => t.name).join(", ") || "—"}`);
  lines.push("");
  lines.push("🎵 Hinos:");
  lines.push(
    sch.songs.length
      ? [...sch.songs].sort((a: any, b: any) => a.order - b.order).map((s: any) => `${s.order}. ${s.title}${s.tone ? ` — Tom: ${s.tone}` : ""}`).join("\n")
      : "—"
  );
  lines.push("");
  lines.push("⚠️ Observações:");
  lines.push(sch.notes?.trim() ? sch.notes.trim() : "—");
  lines.push("");
  lines.push("Por favor, confirme sua presença. 🙌🔥");
  return lines.join("\n");
}

function buildTechnicalMessage(sch: any, musiciansById: Record<string, any>) {
  const soundTechs = (sch.technicians || []).filter((t: any) => musiciansById[t.id]?.role === "Técnico de som");
  const datashowTechs = (sch.technicians || []).filter((t: any) => musiciansById[t.id]?.role === "Datashow");

  const lines: string[] = [];
  lines.push(`🎚️ ESCALA TÉCNICA KADOSH — ${sch.date} (${getWeekdayName(sch.date)})`);
  lines.push("");
  lines.push(`📍 Culto: ${sch.title}`);
  lines.push(`🕖 Horário: ${sch.time || "19:30"}`);
  lines.push("");
  lines.push("🔊 Técnico de som:");
  lines.push(soundTechs.map((t: any) => t.name).join(", ") || "—");
  lines.push("");
  lines.push("🖥️ Datashow:");
  lines.push(datashowTechs.map((t: any) => t.name).join(", ") || "—");
  lines.push("");
  lines.push("🎵 Hinos do culto:");
  lines.push("");
  lines.push(
    sch.songs.length
      ? [...sch.songs].sort((a: any, b: any) => a.order - b.order).map((s: any) => `${s.order}. ${s.title}${s.tone ? ` — Tom: ${s.tone}` : ""}`).join("\n")
      : "—"
  );
  lines.push("");
  lines.push("⚠️ Observações técnicas:");
  lines.push(sch.notes?.trim() ? sch.notes.trim() : "—");
  lines.push("");
  lines.push("Por favor, confirme sua presença na escala técnica. 🙌🔥");
  return lines.join("\n");
}

async function sendToWebhook(webhookUrl: string, payload: any) {
  let status: "Enviado" | "Erro" = "Erro";
  let responseText: string | null = null;
  let errorMessage: string | null = null;
  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    responseText = await r.text().catch(() => null);
    status = r.ok ? "Enviado" : "Erro";
    if (!r.ok) errorMessage = `Webhook respondeu com status ${r.status}`;
  } catch (e: any) {
    errorMessage = e.message || "Falha ao chamar o webhook.";
  }
  return { status, responseText, errorMessage };
}

app.get("/api/n8n/settings", asyncHandler(async (req, res) => {
  const webhookUrl = await db.getAppSetting("n8n_webhook_url");
  res.json({ webhookUrl });
}));

app.post("/api/n8n/settings", asyncHandler(async (req, res) => {
  const { webhookUrl } = req.body;
  await db.setAppSetting("n8n_webhook_url", webhookUrl || "");
  res.json({ webhookUrl: webhookUrl || "" });
}));

app.post("/api/n8n/send/:scheduleId", async (req, res) => {
  const { scheduleId } = req.params;
  try {
    const schedule = await db.getSchedule(scheduleId);
    if (!schedule) return res.status(404).json({ error: "Escala não encontrada." });

    const allMusicians = await db.listMusicians();
    const musiciansById: Record<string, any> = {};
    allMusicians.forEach((m) => { musiciansById[m.id] = m; });

    const message = buildScheduleMessage(schedule, musiciansById);
    const allPeople = [...schedule.vocals, ...schedule.instrumentalists, ...schedule.technicians];

    const payload = {
      tipo: "escala_completa",
      culto: { id: schedule.id, nome: schedule.title, data: schedule.date, horario: schedule.time || "19:30", dia_semana: getWeekdayName(schedule.date) },
      escala: { id: schedule.id, status: schedule.status, observacoes: schedule.notes || "" },
      pessoas: allPeople.map((p: any) => ({
        member_id: p.id,
        nome: p.name,
        telefone: musiciansById[p.id]?.phone || "",
        funcao: musiciansById[p.id]?.role || "",
        tipo_voz: musiciansById[p.id]?.role === "Vocal" ? p.instrument : null,
        instrumento: musiciansById[p.id]?.role === "Instrumento" ? p.instrument : null,
        status_confirmacao: p.status || "Pendente",
      })),
      hinos: schedule.songs.map((s: any) => ({ ordem: s.order, nome: s.title, tom: s.tone })),
      mensagem: message,
    };

    const webhookUrl = await db.getAppSetting("n8n_webhook_url");
    if (!webhookUrl) {
      await db.createAutomationLog({ scheduleId, automationType: "n8n_webhook", webhookUrl: null, payload, status: "Erro", errorMessage: "Nenhuma URL de webhook configurada." });
      return res.status(400).json({ error: "Nenhuma URL de webhook do n8n configurada em Configurações." });
    }

    const { status, responseText, errorMessage } = await sendToWebhook(webhookUrl, payload);
    await db.createAutomationLog({ scheduleId, automationType: "n8n_webhook", webhookUrl, payload, status, response: responseText, errorMessage });
    await Promise.all(allPeople.map((p: any) => db.createConfirmationLog({ scheduleId, memberId: p.id, phone: musiciansById[p.id]?.phone || null, messageSent: message })));

    if (status === "Erro") return res.status(502).json({ error: errorMessage || "Erro ao enviar para o n8n." });
    res.json({ message });
  } catch (error: any) {
    console.error("Erro ao enviar escala completa para o n8n:", error);
    res.status(500).json({ error: error.message || "Erro interno." });
  }
});

app.post("/api/n8n/send-technical/:scheduleId", async (req, res) => {
  const { scheduleId } = req.params;
  try {
    const schedule = await db.getSchedule(scheduleId);
    if (!schedule) return res.status(404).json({ error: "Escala não encontrada." });
    if (!schedule.technicians || schedule.technicians.length === 0) {
      return res.status(400).json({ error: "Nenhum técnico (Som/Datashow) escalado nesta escala." });
    }

    const allMusicians = await db.listMusicians();
    const musiciansById: Record<string, any> = {};
    allMusicians.forEach((m) => { musiciansById[m.id] = m; });

    const message = buildTechnicalMessage(schedule, musiciansById);

    const payload = {
      tipo: "escala_tecnica",
      culto: { id: schedule.id, nome: schedule.title, data: schedule.date, horario: schedule.time || "19:30", dia_semana: getWeekdayName(schedule.date) },
      escala: { id: schedule.id, status: schedule.status, observacoes_tecnicas: schedule.notes || "" },
      tecnica: schedule.technicians.map((t: any) => ({
        member_id: t.id,
        nome: t.name,
        telefone: musiciansById[t.id]?.phone || "",
        funcao: musiciansById[t.id]?.role || "",
        status_confirmacao: t.status || "Pendente",
      })),
      mensagem: message,
    };

    const webhookUrl = await db.getAppSetting("n8n_webhook_url");
    if (!webhookUrl) {
      await db.createAutomationLog({ scheduleId, automationType: "n8n_webhook_technical", webhookUrl: null, payload, status: "Erro", errorMessage: "Nenhuma URL de webhook configurada." });
      return res.status(400).json({ error: "Nenhuma URL de webhook do n8n configurada em Configurações." });
    }

    const { status, responseText, errorMessage } = await sendToWebhook(webhookUrl, payload);
    await db.createAutomationLog({ scheduleId, automationType: "n8n_webhook_technical", webhookUrl, payload, status, response: responseText, errorMessage });
    await Promise.all(schedule.technicians.map((t: any) => db.createConfirmationLog({ scheduleId, memberId: t.id, phone: musiciansById[t.id]?.phone || null, messageSent: message })));

    if (status === "Erro") return res.status(502).json({ error: errorMessage || "Erro ao enviar para o n8n." });
    res.json({ message });
  } catch (error: any) {
    console.error("Erro ao enviar escala técnica para o n8n:", error);
    res.status(500).json({ error: error.message || "Erro interno." });
  }
});

app.get("/api/automations", asyncHandler(async (req, res) => {
  const [confirmationLogs, automationLogs] = await Promise.all([db.listConfirmationLogs(), db.listAutomationLogs()]);
  res.json({ confirmationLogs, automationLogs });
}));

// KADOSH AI ENDPOINTS
// 1. AUTO GENERATE OPTIMIZED SCALE (Escala Automática Inteligente)
app.post("/api/ai/generate-schedule", async (req, res) => {
  const { theme, date, title, coordinator } = req.body;
  if (!theme) {
    return res.status(400).json({ error: "Informe o Tema para que a Kadosh AI crie a escala ideal." });
  }

  // List of active musicians and song bank for the prompt context
  const [allMusicians, allSongs] = await Promise.all([db.listMusicians(), db.listSongs()]);
  const activeMusicians = allMusicians.filter(m => m.active);
  const songBankSummary = allSongs.map(s => `${s.title} (${s.author}) [Tom: ${s.tone}, Gênero: ${s.theme}]`).join(", ");
  const activeMusList = activeMusicians.map(m => `${m.id}: ${m.name} [${m.role} - ${m.instrument}, Escalas recentes: ${m.scaleCount}]`).join("; ");

  const prompt = `Você é o Kadosh AI, a inteligência oficial do Grupo de Louvor Kadosh. 
Sua tarefa é gerar uma escala musical perfeita de forma inteligente e equilibrada para o culto sob o tema: "${theme}".
Temos os seguintes integrantes ativos disponíveis: ${activeMusList}
Temos este banco de músicas: ${songBankSummary}

Regras Cruciais:
1. Monte um grupo de Louvor completo com Vocalistas (Soprano, Contralto, Tenor - selecione pelo menos 2 vocais) e Instrumentistas (é essencial ter Teclado, Bateria, Baixo e opcionalmente Guitarra/Violão).
2. Tente equilibrar as participações. Escolha prioritariamente os músicos que tenham MENOS escalas recentes ("Escalas recentes" baixas) para balancear.
3. Escolha 3 ou 4 músicas coerentes com o Tema do culto ("${theme}") a partir do nosso banco.
4. Identifique se sobrou alguma ausência evidente (ex: se falta algum instrumento crucial ou voz).
5. Forneça o resultado formatado em JSON estrito com o seguinte esquema JSON, sem marcações markdown de preferência, ou que seja um JSON válido que possamos converter:
{
  "theme": "Tema do Culto",
  "recommendedVocals": [{"id": "id_do_músico", "name": "Nome", "instrument": "Função/Vocal"}],
  "recommendedInstrumentalists": [{"id": "id_do_músico", "name": "Nome", "instrument": "Instrumento"}],
  "recommendedSongs": [{"id": "id_da_música", "title": "Título", "tone": "Tom Sugerido"}],
  "justification": "Explicação espiritual e técnica para escolhas sob a luz do tema",
  "alerts": ["Alertas de voz ausente, instrumento, ou fadiga de músico se houver"]
}
Retorne exclusivamente o JSON estruturado.`;

  try {
    let resultJson: any = null;
    if (aiProvider === "gemini" && ai) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      resultJson = JSON.parse(responseText);
    } else if (aiProvider === "ollama" && ollamaState.connected && ollamaState.currentModel) {
      const responseText = await ollama.generate(OLLAMA_BASE_URL, ollamaState.currentModel, prompt, { json: true });
      resultJson = extractJson(responseText);
    } else {
      // Contingency mock logic
      resultJson = fallbackGenerateHeuristics(theme, allMusicians, allSongs);
    }

    // Attach target setup info
    resultJson.date = date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    resultJson.title = title || "Culto Temático - Kadosh AI";
    resultJson.coordinator = coordinator || "Kadosh AI Generator";

    res.json(resultJson);
  } catch (error: any) {
    console.error("Erro no Kadosh AI Generator:", error);
    // Return graceful fallback so user doesn't crash
    const fakeData: any = fallbackGenerateHeuristics(theme, allMusicians, allSongs);
    fakeData.error = "Conectado via gerador inteligente interno (modo offline)";
    fakeData.date = date || new Date().toISOString().split("T")[0];
    fakeData.title = title || "Culto Temático - Kadosh AI";
    fakeData.coordinator = coordinator || "Kadosh AI Generator";
    res.json(fakeData);
  }
});

// 2. ANALYZE AND QUALITY ASSURE AN EXISTING SCHEDULE (Detect vocal/instrument presence or fatigue)
app.post("/api/ai/analyze-schedule", async (req, res) => {
  const { scheduleId, vocals, instrumentalists, songs: selectedSongs, theme } = req.body;

  const vocText = vocals.map((v: any) => `${v.name || 'Músico'} (${v.instrument})`).join(", ");
  const instText = instrumentalists.map((i: any) => `${i.name || 'Músico'} (${i.instrument})`).join(", ");
  const songsText = selectedSongs.map((s: any) => `${s.title} (${s.tone || 'G'})`).join(", ");

  const prompt = `Você é o Kadosh AI. Analise a escala atual de louvor e forneça um relatório crítico profissional e solene.
Tema do Culto: "${theme || "Geral"}"
Vocais Escalados: ${vocText || "Nenhum vocalista escalado!"}
Instrumentistas Escalados: ${instText || "Nenhum instrumentista escalado!"}
Repertório Escolhido: ${songsText || "Nenhuma música selecionada!"}

Avalie o seguinte em detalhes estruturados e retorne em formato JSON válido:
1. "ausenciaVozes": Há falta de vozes cruciais (Ex: soprano, contralto ou tenor)? Como isso afeta a harmonia das partes de vozes?
2. "ausenciaInstrumentos": Falta sustentação harmônica ou rítmica indispensável (ex: falta teclado, teclado é a espinha dorsal; falta contrabaixo ou bateria)?
3. "balanceamentoMembros": Algum músico está com carga muito alta ou há desequilíbrio?
4. "analiseRepertorio": As tonalidades e dinâmicas das músicas são ideais para as vozes escaladas e o tema?
5. "pontuacaoSeguranca": Um número de 0 a 100 avaliando se a escala está pronta e segura para a ministração acadêmica e pastoral excelente.
6. "conselhosProcuctor": Dicas curtas para o ensaio técnico com base nessa formação de banda.

Exemplo de estrutura de retorno JSON:
{
  "ausenciaVozes": "Mensagem detalhada...",
  "ausenciaInstrumentos": "Mensagem detalhada...",
  "balanceamentoMembros": "Feedback sobre os músicos...",
  "analiseRepertorio": "Conectividade do repertório com o tema...",
  "pontuacaoSeguranca": 85,
  "conselhosProcuctor": "Revisar transição da música A para B..."
}`;

  try {
    let resultJson: any = null;
    if (aiProvider === "gemini" && ai) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      resultJson = JSON.parse(response.text || "{}");
    } else if (aiProvider === "ollama" && ollamaState.connected && ollamaState.currentModel) {
      const responseText = await ollama.generate(OLLAMA_BASE_URL, ollamaState.currentModel, prompt, { json: true });
      resultJson = extractJson(responseText);
    } else {
      resultJson = fallbackAnalyzeHeuristics(vocals, instrumentalists, selectedSongs, theme);
    }
    res.json(resultJson);
  } catch (error: any) {
    console.error("Erro na análise Kadosh AI:", error);
    res.json(fallbackAnalyzeHeuristics(vocals, instrumentalists, selectedSongs, theme));
  }
});

// 3. RECOMMEND REPERTOIRE (Sugerir Repertório Inteligente)
app.post("/api/ai/suggest-repertoire", async (req, res) => {
  const { theme } = req.body;
  if (!theme) {
    return res.status(400).json({ error: "Escreva o sentimento/tema para que as sugestões de repertório do Kadosh AI sejam acionadas." });
  }

  const prompt = `Você é o Kadosh AI. Sugira uma lista de 4 músicas consagradas no cenário de louvor e adoração cristã contemporânea (ex: Gabriela Rocha, Casa Worship, Morada worship, Diante do Trono, Nívea Soares) que casem perfeitamente com o tema ou sensação espiritual: "${theme}".
Retorne obrigatoriamente um formato JSON estruturado com esta chave principal:
{
  "suggestions": [
     {
       "title": "Nome da Música",
       "author": "Ministério/Artista original",
       "idealTone": "Tom apropriado para homem/mulher cantar",
       "liturgicalMoment": "Abertura, Adoração Profunda, Celebração ou Envio",
       "spiritConnection": "Breve justificativa poética que liga ao tema da pregação",
       "bpm": 70
     }
  ]
}
Apenas preencha com músicas reais e ricas espiritualmente.`;

  try {
    let resultJson: any = null;
    if (aiProvider === "gemini" && ai) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      resultJson = JSON.parse(response.text || "{}");
    } else if (aiProvider === "ollama" && ollamaState.connected && ollamaState.currentModel) {
      const responseText = await ollama.generate(OLLAMA_BASE_URL, ollamaState.currentModel, prompt, { json: true });
      resultJson = extractJson(responseText);
    } else {
      resultJson = fallbackRepertoireSuggestions(theme);
    }
    res.json(resultJson);
  } catch (error: any) {
    console.error("Erro ao sugerir repertório pelo Kadosh AI:", error);
    res.json(fallbackRepertoireSuggestions(theme));
  }
});

// 4. AI SETTINGS - read current provider/model state and Ollama health
app.get("/api/ai/settings", async (req, res) => {
  const runningModels = ollamaState.connected ? await ollama.listRunningModels(OLLAMA_BASE_URL) : [];
  res.json({
    provider: aiProvider,
    geminiConfigured: !!ai,
    ollama: {
      baseUrl: OLLAMA_BASE_URL,
      connected: ollamaState.connected,
      models: ollamaState.models,
      currentModel: ollamaState.currentModel,
      running: runningModels,
    },
  });
});

// 5. AI SETTINGS - update provider and/or current model
app.post("/api/ai/settings", (req, res) => {
  const { provider, model } = req.body;
  if (provider === "ollama" || provider === "gemini") {
    aiProvider = provider;
  }
  if (typeof model === "string" && ollamaState.models.some(m => m.name === model)) {
    ollamaState.currentModel = model;
  }
  res.json({
    provider: aiProvider,
    ollama: {
      connected: ollamaState.connected,
      currentModel: ollamaState.currentModel,
    },
  });
});

// 6. TEST CONNECTION - re-check Ollama availability on demand
app.post("/api/ai/test-connection", async (req, res) => {
  await initOllama();
  res.json({
    connected: ollamaState.connected,
    models: ollamaState.models,
    currentModel: ollamaState.currentModel,
    message: ollamaState.connected
      ? "Conexão com o Ollama estabelecida com sucesso."
      : "Não foi possível conectar ao Ollama. Verifique se o serviço está em execução.",
  });
});

// 7. KADOSH AI CHAT - streaming conversational assistant grounded in ministry data
app.post("/api/ai/chat", async (req, res) => {
  const { messages } = req.body as { messages: ollama.OllamaChatMessage[] };

  if (!ollamaState.connected || !ollamaState.currentModel) {
    res.status(503).json({ error: "Não foi possível conectar ao Ollama. Verifique se o serviço está em execução." });
    return;
  }

  const [allMusicians, allSongs, allSchedules] = await Promise.all([db.listMusicians(), db.listSongs(), db.listSchedules()]);
  const activeMusicians = allMusicians.filter(m => m.active);
  const musicianSummary = activeMusicians
    .map(m => `${m.name} (${m.role} - ${m.instrument}, ${m.scaleCount} escalas recentes)`)
    .join("; ");
  const topSongs = [...allSongs].sort((a, b) => b.count - a.count).slice(0, 5).map(s => s.title).join(", ");
  const recentSchedules = allSchedules
    .slice(-5)
    .map(s => `${s.date} - "${s.title}" (${s.theme}, status: ${s.status})`)
    .join("; ");

  const systemPrompt = `Você é o Kadosh AI, assistente especialista em gestão de ministérios de louvor (escalas de músicos e cantores, repertório, harmonia vocal e organização ministerial) do Grupo de Louvor Kadosh.
Contexto atual do ministério:
Integrantes ativos: ${musicianSummary || "nenhum"}
Músicas mais usadas: ${topSongs || "nenhuma"}
Últimas escalas: ${recentSchedules || "nenhuma"}
Responda sempre em português, de forma objetiva e pastoralmente cuidadosa.`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    await ollama.chatStream(
      OLLAMA_BASE_URL,
      ollamaState.currentModel,
      [{ role: "system", content: systemPrompt }, ...(messages || [])],
      (token) => res.write(token)
    );
    res.end();
  } catch (error: any) {
    console.error("Erro no streaming do Kadosh AI Chat:", error);
    if (!res.headersSent) {
      res.status(503);
    }
    res.end("\n[Erro: a conexão com o Kadosh AI foi interrompida. Verifique se o Ollama está em execução.]");
  }
});

// HEURISTIC FALLBACKS (If Gemini API key is not present or yields an error)
function fallbackGenerateHeuristics(theme: string, musicians: any[], songs: any[]) {
  // Balanced assignment using scales count priority
  const sortedVoc = [...musicians].filter(m => m.role === "Vocal" && m.active).sort((a,b) => a.scaleCount - b.scaleCount);
  const sortedInst = [...musicians].filter(m => m.role === "Instrumento" && m.active).sort((a,b) => a.scaleCount - b.scaleCount);

  // Pick vocs
  const recommendedVocals = sortedVoc.slice(0, 3).map(v => ({ id: v.id, name: v.name, instrument: v.instrument }));
  // Ensure keyboard and drums are represented if possible
  const keyboard = sortedInst.find(i => i.instrument === "Teclado") || sortedInst[0];
  const drums = sortedInst.find(i => i.instrument === "Bateria") || sortedInst[1];
  const bass = sortedInst.find(i => i.instrument === "Contrabaixo") || sortedInst[2];
  const guitar = sortedInst.find(i => i.instrument === "Guitarra" || i.instrument === "Violão") || sortedInst[3];

  const recommendedInstrumentalists = [keyboard, drums, bass, guitar].filter(Boolean).map(i => ({
    id: i.id,
    name: i.name,
    instrument: i.instrument
  }));

  // Match default songs related vaguely to themes or first 3 elements
  const chosenSongs = songs.slice(0, 3).map(s => ({ id: s.id, title: s.title, tone: s.tone }));

  return {
    theme,
    recommendedVocals,
    recommendedInstrumentalists,
    recommendedSongs: chosenSongs,
    justification: `A Kadosh AI distribuiu os ministros com base menor de escalas acumuladas nesta semana para evitar estafa física. As canções foram selecionadas no banco para expressar adoração genuína ligada a "${theme}".`,
    alerts: recommendedVocals.length < 2 ? ["Alerta: Poucos vocalistas para fazer aberturas harmônicas de vozes."] : []
  };
}

function fallbackAnalyzeHeuristics(vocals: any[], instrumentalists: any[], selectedSongs: any[], theme: string) {
  const hasKeyboard = instrumentalists.some(i => i.instrument.toLowerCase().includes("teclado") || i.instrument.toLowerCase().includes("piano"));
  const hasDrums = instrumentalists.some(i => i.instrument.toLowerCase().includes("bateria") || i.instrument.toLowerCase().includes("percussão"));
  const hasBass = instrumentalists.some(i => i.instrument.toLowerCase().includes("baixo") || i.instrument.toLowerCase().includes("contrabaixo"));

  const hasSoprano = vocals.some(v => v.instrument.toLowerCase().includes("soprano"));
  const hasContralto = vocals.some(v => v.instrument.toLowerCase().includes("contralto"));
  const hasTenor = vocals.some(v => v.instrument.toLowerCase().includes("tenor"));

  let alertsVoz = "Painel de vozes balanceado e coerente.";
  if (!hasSoprano || !hasContralto) {
    alertsVoz = "Falta preenchimento de vozes agudas/médias femininas para abertura do coro Kadosh.";
  }

  let alertsInst = "Sustentação harmônica ideal.";
  if (!hasKeyboard) {
    alertsInst = "⚠️ Atenção Crucial: Falta tecladista! O teclado preenche as frequências de ambiência pastoral fundamentais.";
  } else if (!hasBass || !hasDrums) {
    alertsInst = "⚠️ Cozinha incompleta: Falta de Baixo ou Bateria pode comprometer a estabilidade rítmica.";
  }

  // Calculate generic check score
  let score = 95;
  if (!hasKeyboard) score -= 25;
  if (!hasDrums) score -= 15;
  if (vocals.length < 2) score -= 15;

  return {
    ausenciaVozes: alertsVoz,
    ausenciaInstrumentos: alertsInst,
    balanceamentoMembros: "Excelente revezamento. Os ministros desta escala estão descansados e prontos para ministrar.",
    analiseRepertorio: `As canções escolhidas estão dentro da tessitura confortável para os vocalistas. Coerência satisfatória com o tema "${theme}".`,
    pontuacaoSeguranca: score,
    conselhosProcuctor: "Pratiquem bastante a marcação de tempo (BPM) das canções e deem espaço para o momento espontâneo de adoração profética."
  };
}

function fallbackRepertoireSuggestions(theme: string) {
  return {
    suggestions: [
      {
         title: "A Casa É Sua",
         author: "Casa Worship",
         idealTone: "F (Feminino-Médio/Masculino-Alto)",
         liturgicalMoment: "Adoração Principal",
         spiritConnection: `Ideal para quebrar a frieza e convidar o Espírito Santo, alinhado à busca de ${theme}.`,
         bpm: 72
      },
      {
         title: "Rei Do Meu Coração",
         author: "Be One Music",
         idealTone: "G (Universal)",
         liturgicalMoment: "Abertura / Celebração",
         spiritConnection: `Declaração de louvor alegre para engajar a congregação no sentimento de ${theme}.`,
         bpm: 82
      },
      {
         title: "Vem Me Buscar",
         author: "Gabriela Rocha",
         idealTone: "E (Excelente para soprano liderar)",
         liturgicalMoment: "Adoração Intensa",
         spiritConnection: `Música de entrega total sobre o arrebatamento e a glória divina, encaixando na reflexão de ${theme}.`,
         bpm: 68
      },
      {
         title: "Bondade de Deus",
         author: "Isaías Saad",
         idealTone: "A",
         liturgicalMoment: "Envio / Testemunho",
         spiritConnection: `Lembrança reconfortante sobre o cuidado do Pai, ideal para preenchimento final.`,
         bpm: 64
      }
    ]
  };
}

// Verifica diariamente quem está de aniversário e cria uma notificação no sistema.
async function checkBirthdaysAndNotify() {
  try {
    const musicians = await db.listMusicians();
    const notifications = await db.listNotifications();
    const today = new Date();
    const todayKey = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const todayDateStr = today.toISOString().slice(0, 10);

    for (const mus of musicians) {
      if (!mus.active || !mus.birthday) continue;
      const birthdayKey = mus.birthday.slice(5, 10);
      if (birthdayKey !== todayKey) continue;

      const alreadyNotified = notifications.some(
        (n: any) => n.type === "birthday" && n.date.slice(0, 10) === todayDateStr && n.message.includes(mus.name)
      );
      if (alreadyNotified) continue;

      await db.createNotification({
        type: "birthday",
        title: "Aniversário no Ministério! 🎂",
        message: `Hoje é aniversário de ${mus.name}! Que tal mandar uma mensagem de carinho?`,
        targetMusicianId: "all",
      });
    }
  } catch (error: any) {
    console.error("Erro ao verificar aniversários:", error.message || error);
  }
}

// Tarefas de inicialização (IA local, lembrete de aniversário, estatísticas).
// Roda fora da Vercel: lá o app é importado como função serverless por
// requisição (ver api/[...path].ts) e não há um processo de longa duração
// para manter o setInterval ou justificar checagens só de "boot".
export async function runStartupTasks() {
  await initOllama();

  try {
    await checkBirthdaysAndNotify();
  } catch (error: any) {
    console.error("Aviso: não foi possível verificar aniversários no início:", error.message || error);
  }
  setInterval(checkBirthdaysAndNotify, 60 * 60 * 1000);

  try {
    await updateStatisticsHeuristics();
  } catch (error: any) {
    console.error("Aviso: não foi possível conectar ao Supabase para recalcular estatísticas no início. O servidor continuará no ar, mas as rotas de dados podem falhar até a conexão voltar:", error.message || error);
  }
}

export const PORT_NUMBER = PORT;

if (!process.env.VERCEL) {
  runStartupTasks();
}
