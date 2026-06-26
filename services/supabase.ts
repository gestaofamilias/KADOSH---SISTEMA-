import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Renomeada de "schedules" para conviver no mesmo projeto Supabase do
// sistema de Sonoplastia (Next.js), que tem sua própria tabela "schedules"
// (uuid) incompatível com esta (ids em texto).
const SCHEDULES_TABLE = "kadosh_manager_schedules";

// ---------- Musicians ----------
function fromDbMusician(row: any) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    instrument: row.instrument,
    active: row.active,
    scaleCount: row.scale_count,
    gender: row.gender,
    phone: row.phone || "",
    photo: row.photo || "",
    birthday: row.birthday || "",
    secondaryRoles: row.secondary_roles || [],
    secondaryInstrument: row.secondary_instrument || "",
  };
}

export async function listMusicians() {
  const { data, error } = await supabase.from("musicians").select("*").order("created_at");
  if (error) throw error;
  return (data || []).map(fromDbMusician);
}

export async function createMusician(input: {
  name: string; role: string; instrument: string; active?: boolean; gender?: string; phone?: string;
  photo?: string; birthday?: string; secondaryRoles?: string[]; secondaryInstrument?: string;
}) {
  const row = {
    id: randomUUID(),
    name: input.name,
    role: input.role,
    instrument: input.instrument,
    active: input.active !== undefined ? input.active : true,
    scale_count: 0,
    gender: input.gender || "M",
    phone: input.phone || null,
    photo: input.photo || null,
    birthday: input.birthday || null,
    secondary_roles: input.secondaryRoles || [],
    secondary_instrument: input.secondaryInstrument || null,
  };
  const { data, error } = await supabase.from("musicians").insert(row).select().single();
  if (error) throw error;
  return fromDbMusician(data);
}

export async function updateMusician(id: string, patch: Partial<{
  name: string; role: string; instrument: string; active: boolean; gender: string; phone: string;
  photo: string; birthday: string; secondaryRoles: string[]; secondaryInstrument: string;
}>) {
  const dbPatch: any = { ...patch };
  if ("secondaryRoles" in patch) {
    dbPatch.secondary_roles = patch.secondaryRoles;
    delete dbPatch.secondaryRoles;
  }
  if ("secondaryInstrument" in patch) {
    dbPatch.secondary_instrument = patch.secondaryInstrument;
    delete dbPatch.secondaryInstrument;
  }
  const { data, error } = await supabase.from("musicians").update(dbPatch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data ? fromDbMusician(data) : null;
}

export async function setMusicianScaleCounts(counts: Record<string, number>) {
  await Promise.all(
    Object.entries(counts).map(([id, scale_count]) =>
      supabase.from("musicians").update({ scale_count }).eq("id", id)
    )
  );
}

// ---------- Songs ----------
function fromDbSong(row: any) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    tone: row.tone,
    bpm: row.bpm,
    theme: row.theme,
    link: row.link || "",
    timeSignature: row.time_signature || "4/4",
    difficulty: row.difficulty || "Média",
    count: row.count,
  };
}

export async function listSongs() {
  const { data, error } = await supabase.from("songs").select("*").order("created_at");
  if (error) throw error;
  return (data || []).map(fromDbSong);
}

export async function createSong(input: { title: string; author: string; tone: string; bpm?: number; theme?: string; link?: string; timeSignature?: string; difficulty?: string }) {
  const row = {
    id: randomUUID(),
    title: input.title,
    author: input.author,
    tone: input.tone,
    bpm: Number(input.bpm) || 75,
    theme: input.theme || "Geral",
    link: input.link || "",
    time_signature: input.timeSignature || "4/4",
    difficulty: input.difficulty || "Média",
    count: 0,
  };
  const { data, error } = await supabase.from("songs").insert(row).select().single();
  if (error) throw error;
  return fromDbSong(data);
}

export async function setSongCounts(counts: Record<string, number>) {
  await Promise.all(
    Object.entries(counts).map(([id, count]) =>
      supabase.from("songs").update({ count }).eq("id", id)
    )
  );
}

// ---------- Schedules ----------
function fromDbSchedule(row: any) {
  return {
    id: row.id,
    date: row.date,
    time: row.time || "19:30",
    title: row.title,
    theme: row.theme || "",
    coordinator: row.coordinator || "Coordenador Kadosh",
    status: row.status,
    vocals: row.vocals || [],
    instrumentalists: row.instrumentalists || [],
    technicians: row.technicians || [],
    songs: row.songs || [],
    notes: row.notes || "",
    aiGenerated: row.ai_generated || false,
  };
}

export async function listSchedules() {
  const { data, error } = await supabase.from(SCHEDULES_TABLE).select("*").order("date");
  if (error) throw error;
  return (data || []).map(fromDbSchedule);
}

export async function getSchedule(id: string) {
  const { data, error } = await supabase.from(SCHEDULES_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromDbSchedule(data) : null;
}

export async function upsertSchedule(input: {
  id?: string; date: string; time?: string; title: string; theme?: string; coordinator?: string; status?: string;
  vocals?: any[]; instrumentalists?: any[]; technicians?: any[]; songs?: any[]; notes?: string; aiGenerated?: boolean;
}) {
  const payload = {
    date: input.date,
    time: input.time || "19:30",
    title: input.title,
    theme: input.theme || "",
    coordinator: input.coordinator || "Coordenador Kadosh",
    status: input.status || "Rascunho",
    vocals: input.vocals || [],
    instrumentalists: input.instrumentalists || [],
    technicians: input.technicians || [],
    songs: input.songs || [],
    notes: input.notes || "",
    ai_generated: input.aiGenerated || false,
  };

  if (input.id) {
    const { data, error } = await supabase.from(SCHEDULES_TABLE).update(payload).eq("id", input.id).select().maybeSingle();
    if (error) throw error;
    if (data) return fromDbSchedule(data);
  }

  const { data, error } = await supabase.from(SCHEDULES_TABLE).insert({ id: input.id || randomUUID(), ...payload }).select().single();
  if (error) throw error;
  return fromDbSchedule(data);
}

export async function deleteSchedule(id: string) {
  const { error } = await supabase.from(SCHEDULES_TABLE).delete().eq("id", id);
  if (error) throw error;
}

// ---------- Reminders ----------
function fromDbReminder(row: any) {
  return { id: row.id, date: row.date, text: row.text, category: row.category || "Outro" };
}

export async function listReminders() {
  const { data, error } = await supabase.from("reminders").select("*").order("date");
  if (error) throw error;
  return (data || []).map(fromDbReminder);
}

export async function createReminder(input: { date: string; text: string; category?: string }) {
  const row = { id: randomUUID(), date: input.date, text: input.text, category: input.category || "Outro" };
  const { data, error } = await supabase.from("reminders").insert(row).select().single();
  if (error) throw error;
  return fromDbReminder(data);
}

export async function deleteReminder(id: string) {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Notifications ----------
function fromDbNotification(row: any) {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    title: row.title,
    message: row.message,
    targetMusicianId: row.target_musician_id || "all",
    read: row.read,
  };
}

export async function listNotifications() {
  const { data, error } = await supabase.from("notifications").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDbNotification);
}

export async function createNotification(input: { date?: string; type: string; title: string; message: string; targetMusicianId?: string; read?: boolean }) {
  const row = {
    id: randomUUID(),
    date: input.date || new Date().toISOString(),
    type: input.type,
    title: input.title,
    message: input.message,
    target_musician_id: input.targetMusicianId || "all",
    read: input.read || false,
  };
  const { data, error } = await supabase.from("notifications").insert(row).select().single();
  if (error) throw error;
  return fromDbNotification(data);
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(musicianId?: string) {
  let query = supabase.from("notifications").update({ read: true });
  if (musicianId && musicianId !== "admin" && musicianId !== "all") {
    query = query.in("target_musician_id", ["all", musicianId]);
  }
  const { error } = await query.neq("id", "");
  if (error) throw error;
}

export async function clearNotifications() {
  const { error } = await supabase.from("notifications").delete().neq("id", "");
  if (error) throw error;
}

// ---------- App Settings (key/value) ----------
export async function getAppSetting(key: string): Promise<string> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.setting_value || "";
}

export async function setAppSetting(key: string, value: string) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: randomUUID(), setting_key: key, setting_value: value }, { onConflict: "setting_key" });
  if (error) throw error;
}

// ---------- Automation Logs (envios para o n8n) ----------
function fromDbAutomationLog(row: any) {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    automationType: row.automation_type,
    webhookUrl: row.webhook_url,
    status: row.status,
    response: row.response,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export async function createAutomationLog(input: {
  scheduleId: string; automationType: "n8n_webhook" | "n8n_webhook_technical";
  webhookUrl: string | null; payload: any; status: "Pendente" | "Enviado" | "Erro";
  response?: string | null; errorMessage?: string | null;
}) {
  const row = {
    id: randomUUID(),
    schedule_id: input.scheduleId,
    automation_type: input.automationType,
    webhook_url: input.webhookUrl,
    payload: input.payload,
    status: input.status,
    response: input.response || null,
    error_message: input.errorMessage || null,
  };
  const { error } = await supabase.from("automation_logs").insert(row);
  if (error) throw error;
}

export async function listAutomationLogs() {
  const { data, error } = await supabase.from("automation_logs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDbAutomationLog);
}

// ---------- Confirmation Logs (mensagens enviadas/recebidas por pessoa) ----------
function fromDbConfirmationLog(row: any) {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    memberId: row.member_id,
    phone: row.phone,
    messageSent: row.message_sent,
    confirmationStatus: row.confirmation_status,
    responseText: row.response_text,
    sentAt: row.sent_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    memberName: row.musicians?.name,
    scheduleTitle: row.kadosh_manager_schedules?.title,
    scheduleDate: row.kadosh_manager_schedules?.date,
  };
}

export async function createConfirmationLog(input: {
  scheduleId: string; memberId: string; phone: string | null; messageSent: string;
}) {
  const row = {
    id: randomUUID(),
    schedule_id: input.scheduleId,
    member_id: input.memberId,
    phone: input.phone,
    message_sent: input.messageSent,
    confirmation_status: "Pendente",
    sent_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("confirmation_logs").insert(row);
  if (error) throw error;
}

export async function listConfirmationLogs() {
  const { data, error } = await supabase
    .from("confirmation_logs")
    .select("*, musicians(name), kadosh_manager_schedules(title, date)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map(fromDbConfirmationLog);
}

/** Atualiza pelo log pendente mais recente daquela pessoa/escala; cria um novo se não houver nenhum pendente. */
export async function updateConfirmationStatus(scheduleId: string, memberId: string, status: "Confirmado" | "Recusado", responseText: string, phone: string | null) {
  const { data: pending } = await supabase
    .from("confirmation_logs")
    .select("id")
    .eq("schedule_id", scheduleId)
    .eq("member_id", memberId)
    .is("responded_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();

  if (pending) {
    const { error } = await supabase
      .from("confirmation_logs")
      .update({ confirmation_status: status, response_text: responseText, responded_at: now })
      .eq("id", pending.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("confirmation_logs").insert({
      id: randomUUID(),
      schedule_id: scheduleId,
      member_id: memberId,
      phone,
      confirmation_status: status,
      response_text: responseText,
      sent_at: now,
      responded_at: now,
    });
    if (error) throw error;
  }
}

