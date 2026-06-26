import React, { useState, useEffect } from "react";
import {
  Calendar, Users, CheckCircle, Clock, Trash2, Edit, Plus,
  Send, Sparkles, AlertTriangle, ShieldCheck, HeartPulse, Clipboard,
  ArrowRight, FileText, X, Check, Eye, HelpCircle, Save, BookOpen,
  Copy, Share2, History, Search, ArrowUpRight, Award, Music, Mic,
  Sliders, MonitorPlay
} from "lucide-react";
import { Schedule, Musician, Song, AIAnalysis } from "../types";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";

export function SchedulesView({ forceAiInit = false }: { forceAiInit?: boolean }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  // Switch between scales grid and complete historical timeline/rotation
  const [activeTab, setActiveTab] = useState<"scales" | "history" | "compare">("scales");
  const [historySearch, setHistorySearch] = useState("");
  const [timelineFilter, setTimelineFilter] = useState<"all" | "vocal" | "instrumental">("all");

  // Comparison State and Helpers
  const [monthA, setMonthA] = useState<string>("");
  const [monthB, setMonthB] = useState<string>("");

  const getYearMonth = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}`; // e.g., "2026-06"
    }
    return "";
  };

  const formatYearMonthPt = (ym: string) => {
    if (!ym) return "";
    const parts = ym.split("-");
    if (parts.length < 2) return ym;
    const [year, month] = parts;
    const monthsPt: Record<string, string> = {
      "01": "Janeiro",
      "02": "Fevereiro",
      "03": "Março",
      "04": "Abril",
      "05": "Maio",
      "06": "Junho",
      "07": "Julho",
      "08": "Agosto",
      "09": "Setembro",
      "10": "Outubro",
      "11": "Novembro",
      "12": "Dezembro"
    };
    return `${monthsPt[month] || month} de ${year}`;
  };

  const availableMonths: string[] = Array.from(
    new Set(schedules.map(s => getYearMonth(s.date)).filter(Boolean))
  ).sort().reverse() as string[];

  useEffect(() => {
    if (availableMonths.length > 0) {
      if (!monthA) {
        setMonthA(availableMonths[0]);
      }
      if (!monthB) {
        if (availableMonths.length > 1) {
          setMonthB(availableMonths[1]);
        } else {
          setMonthB(availableMonths[0]);
        }
      }
    }
  }, [schedules, availableMonths, monthA, monthB]);

  const getMonthStatsHelper = (monthSchedules: Schedule[]) => {
    const memberCounts: Record<string, { name: string, instrument: string, count: number, isVocal: boolean }> = {};
    const songCounts: Record<string, { title: string, count: number, tones: string[] }> = {};
    const coordinators = new Set<string>();

    monthSchedules.forEach(s => {
      coordinators.add(s.coordinator);
      
      // Count members
      s.vocals.forEach(v => {
        if (!memberCounts[v.id]) {
          memberCounts[v.id] = { name: v.name, instrument: v.instrument, count: 0, isVocal: true };
        }
        memberCounts[v.id].count += 1;
      });

      s.instrumentalists.forEach(inst => {
        if (!memberCounts[inst.id]) {
          memberCounts[inst.id] = { name: inst.name, instrument: inst.instrument, count: 0, isVocal: false };
        }
        memberCounts[inst.id].count += 1;
      });

      (s.technicians || []).forEach(tech => {
        if (!memberCounts[tech.id]) {
          memberCounts[tech.id] = { name: tech.name, instrument: tech.instrument, count: 0, isVocal: false };
        }
        memberCounts[tech.id].count += 1;
      });

      // Count songs
      s.songs.forEach(song => {
        const key = song.title.toLowerCase().trim();
        if (!songCounts[key]) {
          songCounts[key] = { title: song.title, count: 0, tones: [] };
        }
        songCounts[key].count += 1;
        if (song.tone && !songCounts[key].tones.includes(song.tone)) {
          songCounts[key].tones.push(song.tone);
        }
      });
    });

    const uniqueMusiciansCount = Object.keys(memberCounts).length;
    const sortedSongs = Object.values(songCounts).sort((a, b) => b.count - a.count);
    const sortedMembers = Object.values(memberCounts).sort((a, b) => b.count - a.count);

    return {
      totalScales: monthSchedules.length,
      approvedSchedules: monthSchedules.filter(s => s.status === "Aprovado").length,
      draftSchedules: monthSchedules.filter(s => s.status === "Rascunho").length,
      uniqueMusiciansCount,
      sortedSongs,
      sortedMembers,
      coordinators: Array.from(coordinators)
    };
  };

  const scalesA = schedules.filter(s => getYearMonth(s.date) === monthA).sort((a,b) => a.date.localeCompare(b.date));
  const scalesB = schedules.filter(s => getYearMonth(s.date) === monthB).sort((a,b) => a.date.localeCompare(b.date));

  // Active Schedule Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:30");
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [coordinator, setCoordinator] = useState("");
  const [status, setStatus] = useState<"Rascunho" | "Aprovado">("Rascunho");
  const [notes, setNotes] = useState("");

  // Custom temporary lists for local editing
  const [selectedVocals, setSelectedVocals] = useState<any[]>([]);
  const [selectedInst, setSelectedInst] = useState<any[]>([]);
  const [selectedTech, setSelectedTech] = useState<any[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<any[]>([]);

  // AI Generation Workspace State
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiThemePrompt, setAiThemePrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);

  // AI Quality Check / Analysis results
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysisPane, setShowAnalysisPane] = useState(false);

  // Share Scale State
  const [sharingSchedule, setSharingSchedule] = useState<Schedule | null>(null);
  const [shareText, setShareText] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("kadosh");
  const [copiedText, setCopiedText] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingN8nId, setSendingN8nId] = useState<string | null>(null);

  const handleCopyScaleToClipboard = (sch: Schedule) => {
    const formatted = generateShareText(sch, "kadosh");
    navigator.clipboard.writeText(formatted);
    setCopiedId(sch.id || null);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    fetchSchedulesData();
    if (forceAiInit) {
      setShowAiGenerator(true);
    }
  }, [forceAiInit]);

  const fetchSchedulesData = async () => {
    setLoading(true);
    try {
      const [schRes, musRes, songRes] = await Promise.all([
        apiFetch("/api/schedules"),
        apiFetch("/api/musicians"),
        apiFetch("/api/songs")
      ]);
      
      if (schRes.ok) setSchedules(await schRes.json());
      if (musRes.ok) setMusicians(await musRes.json());
      if (songRes.ok) setSongs(await songRes.json());
    } catch (e) {
      console.error("Erro ao carregar dados de escalas:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateNew = () => {
    setEditId(null);
    setDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    setTime("19:30");
    setTitle("");
    setTheme("");
    setCoordinator("Coordenador Kadosh");
    setStatus("Rascunho");
    setNotes("");
    setSelectedVocals([]);
    setSelectedInst([]);
    setSelectedTech([]);
    setSelectedSongs([]);
    setCurrentAnalysis(null);
    setShowAnalysisPane(false);
    setIsEditing(true);
  };

  const handleOpenEdit = (sch: Schedule) => {
    setEditId(sch.id || null);
    setDate(sch.date);
    setTime(sch.time || "19:30");
    setTitle(sch.title);
    setTheme(sch.theme);
    setCoordinator(sch.coordinator);
    setStatus(sch.status);
    setNotes(sch.notes || "");
    setSelectedVocals([...sch.vocals]);
    setSelectedInst([...sch.instrumentalists]);
    setSelectedTech([...(sch.technicians || [])]);
    setSelectedSongs([...sch.songs]);
    setCurrentAnalysis(null);
    setShowAnalysisPane(false);
    setIsEditing(true);
  };

  // A pessoa é elegível para uma função se ela for sua função principal OU uma das secundárias
  const hasRole = (mus: Musician, r: Musician["role"]) => mus.role === r || (mus.secondaryRoles || []).includes(r);
  const isEligibleForCategory = (mus: Musician, category: "vocal" | "instrument" | "technician") =>
    category === "vocal" ? hasRole(mus, "Vocal")
    : category === "instrument" ? hasRole(mus, "Instrumento")
    : hasRole(mus, "Técnico de som") || hasRole(mus, "Datashow");

  // Add a vocalist, instrumentalist or technician (Som/Datashow) ref to current scale
  const handleToggleMusicianRef = (mus: Musician, category: "vocal" | "instrument" | "technician") => {
    const list = category === "vocal" ? selectedVocals : category === "instrument" ? selectedInst : selectedTech;
    const setList = category === "vocal" ? setSelectedVocals : category === "instrument" ? setSelectedInst : setSelectedTech;
    const exists = list.some(v => v.id === mus.id);
    if (exists) {
      setList(list.filter(v => v.id !== mus.id));
    } else {
      // Se a pessoa está sendo escalada pela função SECUNDÁRIA, usa a voz/instrumento secundário cadastrado.
      const isMainRoleMatch = category === "technician"
        ? (mus.role === "Técnico de som" || mus.role === "Datashow")
        : mus.role === (category === "vocal" ? "Vocal" : "Instrumento");
      const instrumentLabel = isMainRoleMatch ? mus.instrument : (mus.secondaryInstrument || mus.instrument);
      setList([...list, { id: mus.id, name: mus.name, instrument: instrumentLabel, status: "Pendente" }]);
    }
  };

  // Change individual status of a musician in active scale (Confirmado, Recusado, Pendente)
  const handleChangeMusicianStatus = (id: string, category: "vocal" | "instrument" | "technician", newStatus: string) => {
    if (category === "vocal") {
      setSelectedVocals(selectedVocals.map(v => v.id === id ? { ...v, status: newStatus } : v));
    } else if (category === "instrument") {
      setSelectedInst(selectedInst.map(i => i.id === id ? { ...i, status: newStatus } : i));
    } else {
      setSelectedTech(selectedTech.map(t => t.id === id ? { ...t, status: newStatus } : t));
    }
  };

  // Add/remove a song to the active scale
  const handleToggleSongRef = (song: Song) => {
    const exists = selectedSongs.some(s => s.id === song.id);
    if (exists) {
      setSelectedSongs(selectedSongs.filter(s => s.id !== song.id));
    } else {
      const nextOrder = selectedSongs.length + 1;
      setSelectedSongs([...selectedSongs, { id: song.id, title: song.title, tone: song.tone, order: nextOrder }]);
    }
  };

  const handleUpdateSongTone = (songId: string, newTone: string) => {
    setSelectedSongs(selectedSongs.map(s => s.id === songId ? { ...s, tone: newTone } : s));
  };

  // Trigger server-side Kadosh AI to auto populate vocals/instrumentalists/songs
  const handleTriggerAiGenerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiThemePrompt.trim()) return;
    
    setAiGenerating(true);
    setAiResult(null);

    try {
      const res = await apiFetch("/api/ai/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: aiThemePrompt,
          date,
          title,
          coordinator
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiResult(data);
      } else {
        alert("Erro ao contatar o Kadosh AI.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiGenerating(false);
    }
  };

  // Apply Kadosh AI generated results into current form draft
  const handleApplyAiGenerated = () => {
    if (!aiResult) return;
    
    setTheme(aiResult.theme || theme);
    setSelectedVocals(aiResult.recommendedVocals.map((v: any) => ({ ...v, status: "Pendente" })));
    setSelectedInst(aiResult.recommendedInstrumentalists.map((i: any) => ({ ...i, status: "Pendente" })));
    setSelectedSongs(aiResult.recommendedSongs.map((s: any, idx: number) => ({ ...s, order: idx + 1 })));
    setNotes(aiResult.justification || "");
    
    // Auto populate alerts in notes
    if (aiResult.alerts && aiResult.alerts.length > 0) {
      setNotes(prev => prev + "\n\n⚠️ ALERTA IA: " + aiResult.alerts.join("; "));
    }

    setShowAiGenerator(false);
    setAiResult(null);
    setAiThemePrompt("");
    alert("Kadosh AI: Escala gerada e preenchida com sucesso na planilha de rascunho!");
  };

  // Analyze current scale via Gemini and detect missing pieces
  const handleAnalyzeScale = async () => {
    setAnalyzing(true);
    setCurrentAnalysis(null);
    try {
      const res = await apiFetch("/api/ai/analyze-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vocals: selectedVocals,
          instrumentalists: selectedInst,
          songs: selectedSongs,
          theme: theme
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentAnalysis(data);
        setShowAnalysisPane(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Save changes to database
  const handleSaveSchedule = async () => {
    if (!date || !title) {
      alert("Por favor, informe pelo menos Data e Título do culto.");
      return;
    }

    const payload = {
      id: editId || undefined,
      date,
      time,
      title,
      theme,
      coordinator,
      status,
      vocals: selectedVocals,
      instrumentalists: selectedInst,
      technicians: selectedTech,
      songs: selectedSongs,
      notes
    };

    try {
      const res = await apiFetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsEditing(false);
        fetchSchedulesData();
      } else {
        alert("Problema ao gravar escala.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Firme sobre a exclusão definitiva dessa escala de culto?")) return;
    try {
      const res = await apiFetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchSchedulesData();
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // Sincronizar/Mudar status no ato diretamente sem abrir edição
  const handleQuickApprove = async (sch: Schedule) => {
    try {
      const res = await apiFetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sch,
          status: "Aprovado"
        })
      });
      if (res.ok) {
        fetchSchedulesData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Enviar escala (completa ou somente técnica) para o webhook do n8n
  const handleSendToN8n = async (scheduleId: string, technicalOnly: boolean) => {
    setSendingN8nId(scheduleId + (technicalOnly ? "-tech" : ""));
    try {
      const res = await apiFetch(`/api/n8n/${technicalOnly ? "send-technical" : "send"}/${scheduleId}`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Escala ${technicalOnly ? "técnica" : "completa"} enviada para o n8n com sucesso!`);
      } else {
        alert(data.error || "Erro ao enviar para o n8n.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de rede ao enviar para o n8n.");
    } finally {
      setSendingN8nId(null);
    }
  };

  // Create highly beautiful styled text to export to WhatsApp
  const generateShareText = (sch: Schedule, formatType: string = "kadosh") => {
    const vocsText = sch.vocals.map(v => {
      const statusIcon = v.status === "Confirmado" ? '✅ Conf' : v.status === "Recusado" ? '❌ Rec' : '⏳ Pend';
      return `• *${v.name}* (${v.instrument}) [${statusIcon}]`;
    }).join("\n");
    
    const instsText = sch.instrumentalists.map(i => {
      const statusIcon = i.status === "Confirmado" ? '✅ Conf' : i.status === "Recusado" ? '❌ Rec' : '⏳ Pend';
      return `• *${i.name}* (${i.instrument}) [${statusIcon}]`;
    }).join("\n");

    const techsText = (sch.technicians || []).map(t => {
      const statusIcon = t.status === "Confirmado" ? '✅ Conf' : t.status === "Recusado" ? '❌ Rec' : '⏳ Pend';
      return `• *${t.name}* (${t.instrument}) [${statusIcon}]`;
    }).join("\n");

    const sgsText = sch.songs.map((s, idx) => `  ${idx + 1}️⃣ *${s.title}* (Tom: ${s.tone})`).join("\n");

    if (formatType === "compact") {
      return `📅 *ESCALA ${sch.date} - ${sch.title}*
🎤 *Coord:* ${sch.coordinator}
🎶 *Tema:* ${sch.theme || "Geral"}

🎙️ *Vocal:* ${sch.vocals.map(v => v.name).join(", ") || "Nenhum"}
🎸 *Banda:* ${sch.instrumentalists.map(i => `${i.name} (${i.instrument})`).join(", ") || "Nenhum"}
🎚️ *Técnica:* ${(sch.technicians || []).map(t => `${t.name} (${t.instrument})`).join(", ") || "Nenhum"}

🎵 *Músicas:*
${sch.songs.map((s, idx) => `${idx + 1}. ${s.title} (Tom: ${s.tone})`).join("\n") || "Nenhuma"}

📋 _Kadosh Altar System_`;
    }

    if (formatType === "full") {
      return `🌟 *MINISTÉRIO DE LOUVOR KADOSH* 🌟
━━━━━━━━━━━━━━━━━━━━━━━━
📅 *DATA DO ALTAR:* ${sch.date}${sch.time ? ` às ${sch.time}` : ""}
⛪ *AÇÃO / CULTO:* ${sch.title}
👑 *COORDENADOR:* ${sch.coordinator}
📖 *REVELAÇÃO DO ALTAR (TEMA):* ${sch.theme || "Padrão de Adoração"}

🎙️ *EQUIPE DE VOCAL:*
${vocsText || "_Nenhum ministro de vocal escalado_"}

🎸 *EQUIPE DE INSTRUMENTOS:*
${instsText || "_Nenhum instrumentista escalado_"}

🎚️ *EQUIPE TÉCNICA (SOM/DATASHOW):*
${techsText || "_Nenhum técnico escalado_"}

🎵 *REPERTÓRIO SAGRADO SELECIONADO:*
${sgsText || "_Grade de repertório vazia_"}

━━━━━━━━━━━━━━━━━━━━━━━━
📝 *INSTRUÇÕES E OBSERVAÇÕES:*
${sch.notes || "Foco no ensaio programado. Estudem as canções!"}

⚠️ *Atenção:* Por favor, confirmem suas presenças respondendo diretamente a esta escala ou para a coordenação. Que o Senhor nos use!`;
    }

    return `🔥 *KADOSH MANAGER - ESCALA DE LOUVOR* 🔥
━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Data:* ${sch.date}${sch.time ? ` às ${sch.time}` : ""}
⛪ *Culto:* ${sch.title}
📖 *Tema:* ${sch.theme || "Geral"}
👑 *Coordenação:* ${sch.coordinator}
📣 *Status:* ${sch.status.toUpperCase()}

🎙️ *VOCAL:*
${vocsText || "_Nenhum vocal escalado_"}

🎸 *BANDA & MINISTROS:*
${instsText || "_Nenhum músico escalado_"}

🎚️ *TÉCNICA (SOM/DATASHOW):*
${techsText || "_Nenhum técnico escalado_"}

🎵 *REPERTÓRIO SELECIONADO:*
${sgsText || "_Nenhum repertório selecionado_"}

━━━━━━━━━━━━━━━━━━━━━━━━
📝 *Notas do Altar:* ${sch.notes || "Foco no ensaio programado."}
⚠️ _Obedeçam com submissão e zelo ministerial. Estude as canções e tons._`;
  };

  const shareOnWhatsApp = (sch: Schedule) => {
    setSharingSchedule(sch);
    setSelectedFormat("kadosh");
    setShareText(generateShareText(sch, "kadosh"));
    setCopiedText(false);
  };

  const getRotationStats = () => {
    const statsMap: Record<string, { count: number; lastDate: string; daysSince: number | null }> = {};
    
    // Initialize statsMap with all registered musicians
    musicians.forEach(m => {
      statsMap[m.id] = { count: 0, lastDate: "", daysSince: null };
    });

    // Parse all scales chronologically
    const sortedSchedules = [...schedules].sort((a, b) => a.date.localeCompare(b.date));
    const today = new Date();

    sortedSchedules.forEach(sch => {
      const schDate = new Date(sch.date);
      const items = [...sch.vocals, ...sch.instrumentalists, ...(sch.technicians || [])];
      
      items.forEach(item => {
        if (statsMap[item.id]) {
          statsMap[item.id].count += 1;
          statsMap[item.id].lastDate = sch.date;
          
          const diffTime = today.getTime() - schDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          statsMap[item.id].daysSince = diffDays;
        }
      });
    });

    return statsMap;
  };

  const rotationStats = getRotationStats();

  const filteredTimelineSchedules = [...schedules]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(sch => {
      if (!historySearch.trim()) return true;
      const searchLower = historySearch.toLowerCase();
      
      const matchTitle = sch.title.toLowerCase().includes(searchLower);
      const matchTheme = (sch.theme || "").toLowerCase().includes(searchLower);
      const matchNotes = (sch.notes || "").toLowerCase().includes(searchLower);
      const matchCoordinator = sch.coordinator.toLowerCase().includes(searchLower);
      
      const matchVocal = sch.vocals.some(v => v.name.toLowerCase().includes(searchLower) || v.instrument.toLowerCase().includes(searchLower));
      const matchInst = sch.instrumentalists.some(i => i.name.toLowerCase().includes(searchLower) || i.instrument.toLowerCase().includes(searchLower));
      const matchSong = sch.songs.some(s => s.title.toLowerCase().includes(searchLower));
      
      return matchTitle || matchTheme || matchNotes || matchCoordinator || matchVocal || matchInst || matchSong;
    });

  const filteredMusiciansList = musicians
    .filter(m => m.active)
    .filter(m => {
      if (!historySearch.trim()) return true;
      const searchLower = historySearch.toLowerCase();
      return m.name.toLowerCase().includes(searchLower) || m.instrument.toLowerCase().includes(searchLower);
    });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#E7C19A]">Kadosh Manager</span>
          <h1 className="text-3xl font-display font-bold text-white mt-1">Escalas de Adoração</h1>
          <p className="text-xs text-gray-400 mt-1 font-sans">Gerencie os cultos de altar com suporte a rodízio inteligente de integrantes.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            id="schedules-btn-ai"
            onClick={() => {
              handleOpenCreateNew();
              setShowAiGenerator(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white hover:opacity-90 font-bold text-xs uppercase tracking-widest transition-all shadow-md cursor-pointer"
          >
            <Sparkles size={14} /> Ativar IA de Escala
          </button>
          <button
            id="schedules-btn-add-manual"
            onClick={handleOpenCreateNew}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#161616] text-[#E7C19A] border border-[#E7C19A]/25 hover:bg-[#202020] transition-all font-bold text-xs uppercase tracking-widest cursor-pointer"
          >
            <Plus size={14} /> Montar Manualmente
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-white/5 pb-1 gap-6">
        <button
          onClick={() => {
            setActiveTab("scales");
            setHistorySearch("");
          }}
          className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all relative cursor-pointer flex items-center gap-2 ${
            activeTab === "scales" 
              ? "text-[#E7C19A]" 
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <Calendar size={13} />
          <span>Escalas Ativas ({schedules.length})</span>
          {activeTab === "scales" && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#CC5A0D]" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all relative flex items-center gap-2 cursor-pointer ${
            activeTab === "history" 
              ? "text-[#E7C19A]" 
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <History size={13} />
          <span>Histórico Completo & Rodízio</span>
          {activeTab === "history" && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#CC5A0D]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("compare")}
          className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all relative flex items-center gap-2 cursor-pointer ${
            activeTab === "compare" 
              ? "text-[#E7C19A]" 
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <BookOpen size={13} />
          <span>Comparativo Mensal</span>
          {activeTab === "compare" && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#CC5A0D]" />
          )}
        </button>
      </div>

      {activeTab === "scales" && (
        loading ? (
          <div className="text-center py-20 text-gray-500 font-mono text-xs animate-pulse">
            Sincronizando calendário do Altar Kadosh...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {schedules.map((sch) => {
              const hasDraft = sch.status === "Rascunho";
              return (
                <div key={sch.id} className="bg-[#161616]/75 backdrop-blur-md border border-[#E7C19A]/15 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between hover:border-[#CC5A0D]/30 transition-all relative overflow-hidden group">
                  {/* Visual marker */}
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${hasDraft ? "bg-yellow-500/60" : "bg-green-500/80"}`}></div>

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <span className="text-[10px] uppercase font-mono font-bold text-gray-400">{sch.date}</span>
                        <h3 className="text-lg font-display font-semibold text-white mt-1 leading-tight">{sch.title}</h3>
                        <p className="text-xs text-gray-500 font-medium italic mt-0.5">Coordenação: {sch.coordinator}</p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        hasDraft ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"
                      }`}>
                        {sch.status}
                      </span>
                    </div>

                    {sch.theme && (
                      <div className="bg-[#0A0A0A] p-2.5 rounded-lg border border-white/5 text-xs text-gray-300 leading-relaxed mb-4">
                        <span className="text-[9px] uppercase font-bold text-[#E7C19A] tracking-wider font-mono block mb-0.5">Sensibilidade do Altar:</span>
                        &ldquo;{sch.theme}&rdquo;
                      </div>
                    )}

                    {/* Summary of members */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono mb-4 text-gray-400 border-b border-white/[0.02] pb-4">
                      <div>
                        <span className="text-[9px] font-bold text-gray-500 block uppercase mb-1">Vocais:</span>
                        {sch.vocals.length === 0 ? (
                          <span className="text-red-400 text-[10px]">Sem vozes!</span>
                        ) : (
                          <span className="text-[#F5F5F5] font-sans">{sch.vocals.map(v => v.name.split(" ")[0]).join(", ")}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-gray-500 block uppercase mb-1">Banda:</span>
                        {sch.instrumentalists.length === 0 ? (
                          <span className="text-red-400 text-[10px]">Sem instrumentos!</span>
                        ) : (
                          <span className="text-[#F5F5F5] font-sans">{sch.instrumentalists.map(i => i.name.split(" ")[0]).join(", ")}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-gray-500 block uppercase mb-1">Técnica:</span>
                        {(sch.technicians || []).length === 0 ? (
                          <span className="text-yellow-500 text-[10px]">Sem técnica!</span>
                        ) : (
                          <span className="text-[#F5F5F5] font-sans">{(sch.technicians || []).map(t => t.name.split(" ")[0]).join(", ")}</span>
                        )}
                      </div>
                    </div>

                    {/* Short playlist display */}
                    <div className="mb-6 space-y-1">
                      <span className="text-[9px] font-bold text-gray-500 font-mono block uppercase">Canções:</span>
                      {sch.songs.length === 0 ? (
                        <p className="text-xs text-gray-600 italic">Vazia.</p>
                      ) : (
                        sch.songs.map((song, idx) => (
                          <div key={song.id} className="flex justify-between items-center text-xs bg-[#0A0A0A] px-2.5 py-1.5 rounded border border-white/5">
                            <span className="text-[#F5F5F5] truncate">{idx + 1}. {song.title}</span>
                            <span className="text-[#CC5A0D] font-mono text-[10px] font-bold">Tom: {song.tone}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                    <button
                      onClick={() => handleOpenEdit(sch)}
                      className="p-2 border border-white/5 text-[#E7C19A] hover:bg-[#000] rounded-xl transition-all cursor-pointer"
                      title="Editar Escala"
                    >
                      <Edit size={14} />
                    </button>

                    <button
                      onClick={() => handleDeleteSchedule(sch.id!)}
                      className="p-2 border border-white/5 text-red-400 hover:bg-black rounded-xl transition-all cursor-pointer"
                      title="Deletar Escala"
                    >
                      <Trash2 size={14} />
                    </button>

                    {hasDraft && (
                      <button
                        onClick={() => handleQuickApprove(sch)}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 rounded-lg transition-all cursor-pointer"
                      >
                        Aprovar
                      </button>
                    )}

                    <button
                      onClick={() => handleCopyScaleToClipboard(sch)}
                      className="ml-auto px-3.5 py-2 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Copiar Texto Formatado para WhatsApp"
                    >
                      {copiedId === sch.id ? (
                        <>
                          <Check size={12} className="text-green-400" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copiar para WhatsApp
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => shareOnWhatsApp(sch)}
                      className="px-3.5 py-2 bg-[#CC5A0D]/10 text-white hover:bg-[#CC5A0D]/20 border border-[#CC5A0D]/20 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Compartilhar Escala (Visualizar Opções)"
                    >
                      <Send size={12} className="text-[#CC5A0D]" /> Compartilhar
                    </button>

                    <button
                      onClick={() => handleSendToN8n(sch.id!, false)}
                      disabled={sendingN8nId === sch.id}
                      className="px-3.5 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                      title="Enviar escala completa para o n8n"
                    >
                      <Send size={12} /> {sendingN8nId === sch.id ? "Enviando..." : "Enviar n8n"}
                    </button>

                    <button
                      onClick={() => handleSendToN8n(sch.id!, true)}
                      disabled={sendingN8nId === sch.id + "-tech"}
                      className="px-3.5 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                      title="Enviar somente a escala técnica (Som/Datashow) para o n8n"
                    >
                      <Sliders size={12} /> {sendingN8nId === sch.id + "-tech" ? "Enviando..." : "Enviar Técnica n8n"}
                    </button>
                  </div>
                </div>
              );
            })}

            {schedules.length === 0 && (
              <div className="col-span-2 text-center py-16 bg-[#161616]/75 backdrop-blur-md rounded-2xl border border-[#E7C19A]/15">
                <Calendar size={36} className="text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-mono">Nenhuma escala cadastrada no momento.</p>
                <button 
                  onClick={handleOpenCreateNew} 
                  className="mt-4 text-xs font-bold uppercase text-[#CC5A0D] underline"
                >
                  Criar seu primeiro rascunho de altar
                </button>
              </div>
            )}
          </div>
        )
      )}

      {activeTab === "history" && (
        /* TIMELINE AND ROTATION ANALYTICS SECTION */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Panel: Ledger of Rotation and fatigue (Col Span 4) */}
          <div className="lg:col-span-4 bg-[#161616]/75 border border-[#E7C19A]/15 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
            <div className="border-b border-white/5 pb-3">
              <span className="text-[9px] font-mono font-bold uppercase text-[#CC5A0D] tracking-wider block">Indicadores do Altar</span>
              <h3 className="text-sm font-semibold text-white">Análise de Revezamento & Fadiga</h3>
              <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                Verifique quem está descansado ou sem escalas recentes para equilibrar a escala. Toque em qualquer ministro para filtrar a linha do tempo!
              </p>
            </div>

            {/* Inner search box */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
              <input 
                type="text"
                placeholder="Buscar por integrante ou naipe..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-black border border-white/10 hover:border-white/20 pl-9 pr-8 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-[#CC5A0D] transition-all"
              />
              {historySearch && (
                <button 
                  onClick={() => setHistorySearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-[10px] font-mono"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Rotation Ledger List */}
            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest block font-mono">Quadro de Cobertura</span>
              
              {filteredMusiciansList.map((m) => {
                const stat = rotationStats[m.id] || { count: 0, lastDate: "", daysSince: null };
                
                // Color codes for fatigue
                let statusLabel = "Sem registros";
                let badgeStyle = "bg-yellow-500/10 text-yellow-500 border border-yellow-500/10";
                
                if (stat.count > 0 && stat.daysSince !== null) {
                  if (stat.daysSince >= 15) {
                    statusLabel = `Livre há ${stat.daysSince}d`;
                    badgeStyle = "bg-green-500/10 text-green-400 border border-green-500/20";
                  } else if (stat.daysSince >= 7) {
                    statusLabel = `Descansado ${stat.daysSince}d`;
                    badgeStyle = "bg-[#E7C19A]/10 text-[#E7C19A] border border-[#E7C19A]/20";
                  } else {
                    statusLabel = `Escalado há ${stat.daysSince}d`;
                    badgeStyle = "bg-red-500/10 text-red-400 border border-red-500/20";
                  }
                }

                const parsedName = m.name;
                const isMatchingSelection = historySearch && parsedName.toLowerCase().includes(historySearch.toLowerCase());

                return (
                  <button
                    key={m.id}
                    onClick={() => setHistorySearch(m.name)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 group relative cursor-pointer ${
                      isMatchingSelection
                        ? "bg-[#CC5A0D]/10 border-[#CC5A0D] shadow-[0_0_12px_rgba(204,90,13,0.1)]"
                        : "bg-black/30 border-white/5 hover:bg-black/50 hover:border-white/10"
                    }`}
                  >
                    <div className="truncate">
                      <span className="text-xs font-bold text-[#F5F5F5] block truncate group-hover:text-white">{m.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="p-0.5 rounded text-[8px] font-bold bg-white/5 border border-white/10 text-gray-400 uppercase tracking-widest font-mono">
                          {m.instrument}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">• {stat.count} esc.</span>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold block ${badgeStyle}`}>
                        {statusLabel}
                      </span>
                      {stat.lastDate && (
                        <span className="text-[9px] text-gray-600 block mt-1 font-mono">Última: {stat.lastDate}</span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredMusiciansList.length === 0 && (
                <p className="text-xs text-gray-600 italic text-center py-4">Nenhum integrante correspondente.</p>
              )}
            </div>
          </div>

          {/* Right Panel: Vertical Timeline of altar scales (Col Span 8) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Header info bar */}
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 px-1">
              <span>ORDENAÇÃO CRONOLÓGICA DAS MINISTRAÇÕES</span>
              {historySearch && (
                <div className="flex items-center gap-1 bg-[#CC5A0D]/15 text-[#E7C19A] px-2 py-0.5 rounded border border-[#CC5A0D]/20">
                  <span>Filtrado: &ldquo;{historySearch}&rdquo;</span>
                  <button onClick={() => setHistorySearch("")} className="font-bold hover:text-white ml-1 font-sans">×</button>
                </div>
              )}
            </div>

            {/* Main Timeline Card List */}
            <div className="relative border-l-2 border-[#E7C19A]/15 ml-3 pl-6 space-y-6 md:pl-8 py-2">
              
              {filteredTimelineSchedules.map((sch) => {
                const isDraft = sch.status === "Rascunho";
                
                return (
                  <div key={sch.id} className="relative group">
                    
                    {/* Time indicator Dot */}
                    <div className="absolute -left-[31px] md:-left-[39px] top-6 w-3.5 h-3.5 rounded-full border-2 border-[#CC5A0D] bg-black group-hover:scale-125 transition-transform shadow-[0_0_8px_rgba(204,90,13,0.5)] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E7C19A]" />
                    </div>

                    {/* Timeline card body */}
                    <motion.div 
                      layout
                      className="bg-[#161616]/75 backdrop-blur-md border border-[#E7C19A]/15 rounded-2xl p-5 md:p-6 shadow-md transition-all hover:border-[#CC5A0D]/25"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-white/5 pb-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-mono font-bold text-[#E7C19A] bg-white/5 px-2 py-0.5 rounded border border-white/5">
                              {sch.date}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                              isDraft 
                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" 
                                : "bg-green-500/10 text-green-400 border-green-500/25"
                            }`}>
                              {sch.status}
                            </span>
                          </div>
                          
                          <h4 className="text-lg font-display font-semibold text-white mt-1.5 leading-tight">{sch.title}</h4>
                          <p className="text-xs text-gray-400 mt-1">Coordenação: <strong className="text-gray-300">{sch.coordinator}</strong></p>
                        </div>

                        {sch.theme && (
                          <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/[0.04] max-w-xs text-right">
                            <span className="text-[8px] uppercase tracking-wider font-bold text-gray-500 block">Estratégia do Mote</span>
                            <span className="text-xs font-medium text-[#E7C19A] italic">&ldquo;{sch.theme}&rdquo;</span>
                          </div>
                        )}
                      </div>

                      {/* Members layout split: Vocal vs Instrumental vs Técnica */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        {/* Vocals */}
                        <div className="space-y-1.5 bg-black/20 p-3 rounded-xl border border-white/[0.03]">
                          <span className="text-[9px] uppercase font-bold text-gray-500 font-mono flex items-center gap-1">
                            <Mic size={10} className="text-[#CC5A0D]" /> Vozerio do Altar ({sch.vocals.length})
                          </span>
                          
                          <div className="space-y-1">
                            {sch.vocals.length === 0 ? (
                              <p className="text-[10px] text-gray-600 italic">Nenhum ministro de voz escalado.</p>
                            ) : (
                              sch.vocals.map((v) => {
                                const isSearched = historySearch && v.name.toLowerCase().includes(historySearch.toLowerCase());
                                return (
                                  <div key={v.id} className={`flex items-center justify-between text-xs py-1 px-1.5 rounded transition-all ${
                                    isSearched ? "bg-[#CC5A0D]/10 border border-[#CC5A0D]/20" : ""
                                  }`}>
                                    <div className="truncate">
                                      <span className={`font-semibold ${isSearched ? "text-[#E7C19A]" : "text-[#F5F5F5]"}`}>{v.name}</span>
                                      <span className="text-[9px] text-gray-500 font-mono ml-1.5">({v.instrument})</span>
                                    </div>
                                    <span className={`text-[8px] font-mono font-bold uppercase rounded px-1 py-[1px] ${
                                      v.status === "Confirmado" 
                                        ? "bg-green-500/10 text-green-400" 
                                        : v.status === "Recusado" 
                                          ? "bg-red-500/10 text-red-400" 
                                          : "bg-yellow-500/10 text-yellow-500"
                                    }`}>
                                      {v.status || "Pendente"}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Instrumentalists */}
                        <div className="space-y-1.5 bg-black/20 p-3 rounded-xl border border-white/[0.03]">
                          <span className="text-[9px] uppercase font-bold text-gray-500 font-mono flex items-center gap-1">
                            <Music size={10} className="text-[#CC5A0D]" /> Harmônicos & Banda ({sch.instrumentalists.length})
                          </span>
                          
                          <div className="space-y-1">
                            {sch.instrumentalists.length === 0 ? (
                              <p className="text-[10px] text-gray-600 italic">Nenhum instrumentista escalado.</p>
                            ) : (
                              sch.instrumentalists.map((i) => {
                                const isSearched = historySearch && i.name.toLowerCase().includes(historySearch.toLowerCase());
                                return (
                                  <div key={i.id} className={`flex items-center justify-between text-xs py-1 px-1.5 rounded transition-all ${
                                    isSearched ? "bg-[#CC5A0D]/10 border border-[#CC5A0D]/20" : ""
                                  }`}>
                                    <div className="truncate">
                                      <span className={`font-semibold ${isSearched ? "text-[#E7C19A]" : "text-[#F5F5F5]"}`}>{i.name}</span>
                                      <span className="text-[9px] text-gray-500 font-mono ml-1.5">({i.instrument})</span>
                                    </div>
                                    <span className={`text-[8px] font-mono font-bold uppercase rounded px-1 py-[1px] ${
                                      i.status === "Confirmado" 
                                        ? "bg-green-500/10 text-green-400" 
                                        : i.status === "Recusado" 
                                          ? "bg-red-500/10 text-red-300" 
                                          : "bg-yellow-500/10 text-yellow-500"
                                    }`}>
                                      {i.status || "Pendente"}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Technicians */}
                        <div className="space-y-1.5 bg-black/20 p-3 rounded-xl border border-white/[0.03]">
                          <span className="text-[9px] uppercase font-bold text-gray-500 font-mono flex items-center gap-1">
                            <Sliders size={10} className="text-[#CC5A0D]" /> Equipe Técnica ({(sch.technicians || []).length})
                          </span>

                          <div className="space-y-1">
                            {(sch.technicians || []).length === 0 ? (
                              <p className="text-[10px] text-gray-600 italic">Nenhum técnico escalado.</p>
                            ) : (
                              (sch.technicians || []).map((t) => {
                                const isSearched = historySearch && t.name.toLowerCase().includes(historySearch.toLowerCase());
                                return (
                                  <div key={t.id} className={`flex items-center justify-between text-xs py-1 px-1.5 rounded transition-all ${
                                    isSearched ? "bg-[#CC5A0D]/10 border border-[#CC5A0D]/20" : ""
                                  }`}>
                                    <div className="truncate">
                                      <span className={`font-semibold ${isSearched ? "text-[#E7C19A]" : "text-[#F5F5F5]"}`}>{t.name}</span>
                                      <span className="text-[9px] text-gray-500 font-mono ml-1.5">({t.instrument})</span>
                                    </div>
                                    <span className={`text-[8px] font-mono font-bold uppercase rounded px-1 py-[1px] ${
                                      t.status === "Confirmado"
                                        ? "bg-green-500/10 text-green-400"
                                        : t.status === "Recusado"
                                          ? "bg-red-500/10 text-red-300"
                                          : "bg-yellow-500/10 text-yellow-500"
                                    }`}>
                                      {t.status || "Pendente"}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Timeline Card Footer - Repetório & Actions */}
                      <div className="mt-4 pt-4 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-3">
                        
                        {/* Playlist pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest block">Canções:</span>
                          {sch.songs.length === 0 ? (
                            <span className="text-[10px] text-gray-600 italic">Nenhuma registrada</span>
                          ) : (
                            sch.songs.map((song) => {
                              const isSearched = historySearch && song.title.toLowerCase().includes(historySearch.toLowerCase());
                              return (
                                <span 
                                  key={song.id} 
                                  className={`px-2 py-0.5 rounded-lg text-[9px] font-mono border transition-all ${
                                    isSearched 
                                      ? "bg-[#CC5A0D]/20 border-[#CC5A0D] text-[#E7C19A] font-bold" 
                                      : "bg-black/30 border-white/5 text-gray-400"
                                  }`}
                                >
                                  {song.title} <span className="text-[#CC5A0D] font-bold">({song.tone})</span>
                                </span>
                              );
                            })
                          )}
                        </div>

                        {/* Interactive Scale action copy/share or direct edit */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(sch)}
                            className="p-1 px-2.5 rounded-lg border border-white/5 text-[10px] text-[#E7C19A] hover:bg-black font-semibold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Edit size={10} /> Ajustar Escala
                          </button>
                          <button
                            onClick={() => handleCopyScaleToClipboard(sch)}
                            className="p-1 px-2.5 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
                            title="Copiar Texto para WhatsApp"
                          >
                            {copiedId === sch.id ? (
                              <>
                                <Check size={10} /> Copiado!
                              </>
                            ) : (
                              <>
                                <Copy size={10} /> Copiar Texto
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => shareOnWhatsApp(sch)}
                            className="p-1 px-2.5 rounded-lg bg-[#CC5A0D]/10 text-white hover:bg-[#CC5A0D]/20 border border-[#CC5A0D]/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            title="Visualizar Opções de Envio"
                          >
                            <Send size={10} className="text-[#CC5A0D]" /> Compartilhar
                          </button>
                        </div>

                      </div>

                      {sch.notes && (
                        <div className="mt-3 p-2 bg-black/40 rounded-xl border border-white/[0.02] text-[10px] text-gray-500 font-sans italic">
                          💡 <strong>Diretrizes:</strong> {sch.notes}
                        </div>
                      )}

                    </motion.div>
                  </div>
                );
              })}

              {filteredTimelineSchedules.length === 0 && (
                <div className="text-center py-12 bg-[#161616]/40 rounded-2xl border border-white/5">
                  <Calendar size={28} className="text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-mono">Nenhum culto atende ao termo pesquisado.</p>
                  <button onClick={() => setHistorySearch("")} className="mt-2 text-[10px] font-bold uppercase text-[#CC5A0D] hover:underline">
                    Redefinir Filtros
                  </button>
                </div>
              )}
              
            </div>
          </div>

        </div>
      )}

      {activeTab === "compare" && (
        <div className="space-y-6">
          {/* Controls Panel */}
          <div className="bg-[#161616]/75 border border-[#E7C19A]/15 rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-display font-semibold text-white flex items-center gap-2">
                  <History className="text-[#CC5A0D]" size={18} />
                  Comparador de Escalas Mensais
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Selecione dois meses anteriores para correlacionar o repertório de canções, a frequência de coordenadores e a rotação de integrantes.
                </p>
              </div>

              {/* Month Selectors */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:flex-initial">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1 font-mono">Mês de Referência (A)</label>
                  <select
                    value={monthA}
                    onChange={(e) => setMonthA(e.target.value)}
                    className="w-full sm:w-44 bg-black border border-white/10 hover:border-white/20 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-[#CC5A0D] transition-all cursor-pointer"
                  >
                    {availableMonths.map(ym => (
                      <option key={ym} value={ym}>{formatYearMonthPt(ym)}</option>
                    ))}
                  </select>
                </div>

                <div className="text-gray-500 font-mono text-xs pt-4 flex shrink-0 items-center justify-center">
                  <ArrowRight size={14} className="text-[#CC5A0D]" />
                </div>

                <div className="flex-1 sm:flex-initial">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500 block mb-1 font-mono">Mês de Comparação (B)</label>
                  <select
                    value={monthB}
                    onChange={(e) => setMonthB(e.target.value)}
                    className="w-full sm:w-44 bg-black border border-white/10 hover:border-white/20 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-[#CC5A0D] transition-all cursor-pointer"
                  >
                    {availableMonths.map(ym => (
                      <option key={ym} value={ym}>{formatYearMonthPt(ym)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Column Month A */}
            <div className="bg-[#161616]/75 border border-[#E7C19A]/10 rounded-2xl p-5 md:p-6 space-y-6">
              <div className="border-b border-white/5 pb-3">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#CC5A0D] font-bold">Mês A</span>
                <h4 className="text-xl font-display font-semibold text-white mt-1">
                  {formatYearMonthPt(monthA) || "Carregando..."}
                </h4>
              </div>

              {/* Monthly Summary indicators */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                  <span className="text-2xl font-display font-bold text-[#E7C19A] block">{getMonthStatsHelper(scalesA).totalScales}</span>
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-500">Cultos Roteados</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                  <span className="text-2xl font-display font-bold text-[#E7C19A] block">{getMonthStatsHelper(scalesA).uniqueMusiciansCount}</span>
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-500">Músicos Atuando</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                  <span className="text-2xl font-display font-bold text-[#E7C19A] block">{getMonthStatsHelper(scalesA).sortedSongs.length}</span>
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-500">Canções Ativas</span>
                </div>
              </div>

              {/* Cultos list (timeline summary) */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Detalhamento dos Cultos</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {scalesA.map(s => (
                    <div key={s.id} className="bg-black/20 border border-white/[0.03] hover:border-white/5 p-3 rounded-xl flex items-start justify-between gap-3 text-xs transition-all">
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 font-sans">
                          <span className="font-mono text-[9px] text-[#E7C19A] bg-white/5 px-1.5 py-0.5 rounded font-bold">{s.date}</span>
                          <span className="text-gray-400 font-semibold truncate">{s.title}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 truncate italic font-sans">
                          Mote: {s.theme || "Padrão de Adoração"}
                        </p>
                      </div>
                      <span className="text-[9px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded font-mono shrink-0">
                        {s.songs.length} mscs
                      </span>
                    </div>
                  ))}
                  {scalesA.length === 0 && (
                    <p className="text-xs text-gray-600 italic py-2">Nenhuma escala cadastrada.</p>
                  )}
                </div>
              </div>

              {/* Top Songs */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Músicas do Altar</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 font-sans">
                  {getMonthStatsHelper(scalesA).sortedSongs.map((sg, index) => (
                    <div key={index} className="flex justify-between items-center text-xs bg-[#0A0A0A] border border-white/5 px-3 py-2 rounded-xl">
                      <div className="truncate flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 font-mono font-bold">#{index + 1}</span>
                        <span className="font-medium text-gray-300 truncate">{sg.title}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
                        <span className="text-gray-500 text-[9px]">Tom: [{sg.tones.join(", ")}]</span>
                        <span className="bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/20 px-2 py-0.5 rounded font-bold">
                          {sg.count}x
                        </span>
                      </div>
                    </div>
                  ))}
                  {getMonthStatsHelper(scalesA).sortedSongs.length === 0 && (
                    <p className="text-xs text-gray-600 italic py-3">Nenhum repertório registrado.</p>
                  )}
                </div>
              </div>

              {/* Active Members rotation count */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Membros de Escala</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {getMonthStatsHelper(scalesA).sortedMembers.map((m, index) => (
                    <div key={index} className="flex justify-between items-center text-xs bg-[#0A0A0A] border border-white/5 px-3 py-2 rounded-xl">
                      <div className="truncate flex items-center gap-2 font-sans overflow-x-hidden">
                        <span className="text-gray-300 font-semibold truncate">{m.name}</span>
                        <span className="p-0.5 rounded text-[8px] font-mono font-bold bg-white/5 text-gray-500 uppercase shrink-0">
                          {m.instrument}
                        </span>
                      </div>
                      <span className="bg-white/5 text-gray-400 border border-white/5 px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0">
                        {m.count}x no altar
                      </span>
                    </div>
                  ))}
                  {getMonthStatsHelper(scalesA).sortedMembers.length === 0 && (
                    <p className="text-xs text-gray-600 italic py-2 font-sans">Nenhum integrante escalado.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Column Month B */}
            <div className="bg-[#161616]/75 border border-[#E7C19A]/10 rounded-2xl p-5 md:p-6 space-y-6">
              <div className="border-b border-white/5 pb-3">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#CC5A0D] font-bold">Mês B</span>
                <h4 className="text-xl font-display font-semibold text-white mt-1">
                  {formatYearMonthPt(monthB) || "Carregando..."}
                </h4>
              </div>

              {/* Monthly Summary indicators */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                  <span className="text-2xl font-display font-bold text-[#E7C19A] block">{getMonthStatsHelper(scalesB).totalScales}</span>
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-500 font-sans">Cultos Roteados</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                  <span className="text-2xl font-display font-bold text-[#E7C19A] block">{getMonthStatsHelper(scalesB).uniqueMusiciansCount}</span>
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-500 font-sans">Músicos Atuando</span>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                  <span className="text-2xl font-display font-bold text-[#E7C19A] block">{getMonthStatsHelper(scalesB).sortedSongs.length}</span>
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-500 font-sans">Canções Ativas</span>
                </div>
              </div>

              {/* Cultos list (timeline summary) */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Detalhamento dos Cultos</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {scalesB.map(s => (
                    <div key={s.id} className="bg-black/20 border border-white/[0.03] hover:border-white/5 p-3 rounded-xl flex items-start justify-between gap-3 text-xs transition-all">
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 font-sans">
                          <span className="font-mono text-[9px] text-[#E7C19A] bg-white/5 px-1.5 py-0.5 rounded font-bold">{s.date}</span>
                          <span className="text-gray-400 font-semibold truncate">{s.title}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 truncate italic font-sans">
                          Mote: {s.theme || "Padrão de Adoração"}
                        </p>
                      </div>
                      <span className="text-[9px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded font-mono shrink-0">
                        {s.songs.length} mscs
                      </span>
                    </div>
                  ))}
                  {scalesB.length === 0 && (
                    <p className="text-xs text-gray-600 italic py-2 font-sans">Nenhuma escala cadastrada.</p>
                  )}
                </div>
              </div>

              {/* Top Songs */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Músicas do Altar</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 font-sans">
                  {getMonthStatsHelper(scalesB).sortedSongs.map((sg, index) => (
                    <div key={index} className="flex justify-between items-center text-xs bg-[#0A0A0A] border border-white/5 px-3 py-2 rounded-xl">
                      <div className="truncate flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 font-mono font-bold">#{index + 1}</span>
                        <span className="font-medium text-gray-300 truncate">{sg.title}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
                        <span className="text-gray-500 text-[9px]">Tom: [{sg.tones.join(", ")}]</span>
                        <span className="bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/20 px-2 py-0.5 rounded font-bold">
                          {sg.count}x
                        </span>
                      </div>
                    </div>
                  ))}
                  {getMonthStatsHelper(scalesB).sortedSongs.length === 0 && (
                    <p className="text-xs text-gray-600 italic py-3 font-sans">Nenhum repertório registrado.</p>
                  )}
                </div>
              </div>

              {/* Active Members rotation count */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Membros de Escala</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {getMonthStatsHelper(scalesB).sortedMembers.map((m, index) => (
                    <div key={index} className="flex justify-between items-center text-xs bg-[#0A0A0A] border border-white/5 px-3 py-2 rounded-xl">
                      <div className="truncate flex items-center gap-2 font-sans overflow-x-hidden">
                        <span className="text-gray-300 font-semibold truncate">{m.name}</span>
                        <span className="p-0.5 rounded text-[8px] font-mono font-bold bg-white/5 text-gray-500 uppercase shrink-0">
                          {m.instrument}
                        </span>
                      </div>
                      <span className="bg-white/5 text-gray-400 border border-white/5 px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0">
                        {m.count}x no altar
                      </span>
                    </div>
                  ))}
                  {getMonthStatsHelper(scalesB).sortedMembers.length === 0 && (
                    <p className="text-xs text-gray-600 italic py-2 font-sans">Nenhum integrante escalado.</p>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Core Overlaps & Cross-Month Analysis */}
          {monthA && monthB && monthA !== monthB && (
            <div className="bg-[#161616]/75 border border-[#E7C19A]/15 rounded-2xl p-5 md:p-6 space-y-6">
              <div>
                <h4 className="text-base font-display font-semibold text-white flex items-center gap-2 font-sans">
                  <AlertTriangle className="text-yellow-500" size={16} />
                  Análise Cruzada e Recomendações
                </h4>
                <p className="text-xs text-gray-400 mt-1 font-sans">
                  Alertas preventivos do Altar Kadosh para otimizar rotações e canções entre os períodos de estudo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Songs overlap */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-[#E7C19A] block uppercase font-mono">Canções Comunais Encontradas</span>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 font-sans">
                    {(() => {
                      const songTitlesA = getMonthStatsHelper(scalesA).sortedSongs.map(s => s.title.toLowerCase().trim());
                      const commonSongs = getMonthStatsHelper(scalesB).sortedSongs.filter(s => songTitlesA.includes(s.title.toLowerCase().trim()));

                      if (commonSongs.length === 0) {
                        return (
                          <div className="p-3.5 bg-green-500/5 border border-green-500/10 text-green-400 text-xs rounded-xl flex items-center gap-2.5">
                            <CheckCircle size={15} />
                            <span>Variabilidade excelente! Nenhuma canção escalada se repete entre ambos os meses.</span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-1.5 font-sans">
                          <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 text-yellow-500 text-[11px] rounded-xl leading-normal mb-2 flex items-start gap-2">
                            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-yellow-400" />
                            <span>Canções listadas abaixo estiveram no Altar de Adoração de ambos os meses. Considere mesclar o repertório nos próximos ciclos.</span>
                          </div>
                          {commonSongs.map((s, idx) => {
                            const countA = getMonthStatsHelper(scalesA).sortedSongs.find(sa => sa.title.toLowerCase().trim() === s.title.toLowerCase().trim())?.count || 0;
                            const countB = s.count;
                            return (
                              <div key={idx} className="flex justify-between items-center text-xs bg-black/30 border border-white/5 p-2.5 rounded-xl">
                                <span className="text-gray-300 font-medium">{s.title}</span>
                                <span className="text-[10px] font-mono text-[#E7C19A] font-bold">
                                  {countA}x no Mês A e {countB}x no Mês B
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Team fatigue overlap */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-[#E7C19A] block uppercase font-mono">Índice de Rotação e Recorrência de Roster</span>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(() => {
                      const commonMembers = getMonthStatsHelper(scalesB).sortedMembers.filter(m => 
                        getMonthStatsHelper(scalesA).sortedMembers.some(sm => sm.name === m.name)
                      );

                      const highDemand = commonMembers.filter(m => {
                        const countInA = getMonthStatsHelper(scalesA).sortedMembers.find(sm => sm.name === m.name)?.count || 0;
                        const countInB = m.count;
                        return (countInA + countInB) >= 4;
                      });

                      if (highDemand.length === 0) {
                        return (
                          <div className="p-3.5 bg-green-500/5 border border-green-500/10 text-green-400 text-xs rounded-xl flex items-center gap-2.5 font-sans">
                            <CheckCircle size={15} />
                            <span>Sustentabilidade saudável. Integrantes equilibrados entre os períodos de folga de palco.</span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-1.5 font-sans">
                          <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-400 text-[11px] rounded-xl leading-normal mb-2 flex items-start gap-2">
                            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-500" />
                            <span>Membros com alto escalamento contínuo (somando 4 ou mais atuações). Ideal dar folga rotativa para manter o zelo.</span>
                          </div>
                          {highDemand.map((m, idx) => {
                            const countA = getMonthStatsHelper(scalesA).sortedMembers.find(sm => sm.name === m.name)?.count || 0;
                            const countB = m.count;
                            return (
                              <div key={idx} className="flex justify-between items-center text-xs bg-black/30 border border-[#CC5A0D]/20 p-2.5 rounded-xl">
                                <span className="text-gray-300 font-semibold">{m.name}</span>
                                <span className="text-[10px] font-mono text-red-400 font-bold shrink-0">
                                  {countA + countB}x Atuante ({countA}x no A + {countB}x no B)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* SCALE CREATION / EDITOR FRAME */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-4xl bg-[#161616]/95 backdrop-blur-xl rounded-2xl border border-[#E7C19A]/25 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0F0F0F]">
              <div>
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#CC5A0D]">Espaço do Altar Kadosh</span>
                <h3 className="text-lg font-display font-semibold text-white mt-0.5">
                  {editId ? `Editar Escala: ${title || "Iniciando"}` : "Roteirar Nova Planilha de Altar"}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAnalyzeScale}
                  disabled={analyzing}
                  className="px-4 py-1.5 bg-[#CC5A0D]/10 text-[#CC5A0D] border border--[#CC5A0D]/20 hover:bg-[#CC5A0D]/20 rounded-lg text-xs font-bold uppercase tracking-tight flex items-center gap-1 transition-all"
                >
                  <Sparkles size={12} /> {analyzing ? "Avaliando..." : "Analisar Escala (IA)"}
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Split Panels */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Form general */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-[#0A0A0A]/60 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15 space-y-4">
                  <h4 className="text-xs font-bold uppercase text-[#E7C19A] tracking-wider border-b border-white/5 pb-2">Informações Gerais</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Data do Culto</label>
                      <input
                        id="sch-form-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-black border border-white/5 rounded-lg text-white font-mono focus:outline-none focus:border-[#CC5A0D]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Horário</label>
                      <input
                        id="sch-form-time"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-black border border-white/5 rounded-lg text-white font-mono focus:outline-none focus:border-[#CC5A0D]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Nome / Tipo do Culto</label>
                    <input
                      id="sch-form-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Culto de Jovens Kadosh"
                      className="w-full text-xs px-3 py-2 bg-black border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#CC5A0D]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Sensibilidade do Altar / Tema</label>
                    <input
                      id="sch-form-theme"
                      type="text"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      placeholder="Ex: Arrependimento e Intimidade"
                      className="w-full text-xs px-3 py-2 bg-black border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#CC5A0D]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Coordenador do Altar</label>
                    <input
                      id="sch-form-coordinator"
                      type="text"
                      value={coordinator}
                      onChange={(e) => setCoordinator(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-black border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#CC5A0D]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Estado de Homologação</label>
                    <select
                      id="sch-form-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "Rascunho" | "Aprovado")}
                      className="w-full text-xs px-3 py-2 bg-black border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#CC5A0D]"
                    >
                      <option value="Rascunho">Rascunho (Em Configuração)</option>
                      <option value="Aprovado">Aprovado (Publicidade WhatsApp)</option>
                    </select>
                  </div>
                </div>

                {/* AI Generation prompt button */}
                <div className="bg-gradient-to-tr from-[#161616]/85 to-[#1d120a]/75 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/20 space-y-3">
                  <div className="flex items-center gap-1 bg-[#CC5A0D]/10 px-2 py-0.5 rounded text-[9px] font-bold text-[#CC5A0D] w-max font-mono">
                    <Sparkles size={10} /> KADOSH AI ASSIST
                  </div>
                  <h4 className="text-xs font-semibold text-[#E7C19A] leading-tight">Geração Automática de Escalas</h4>
                  <p className="text-[10px] text-gray-400">Insira um mote e deixe a IA de contingência Kadosh selecionar as melhores vozes, instrumentos e tons para equilibrar o revezamento.</p>
                  <button
                    id="sch-btn-open-ai-generator"
                    type="button"
                    onClick={() => setShowAiGenerator(true)}
                    className="w-full py-2 bg-[#CC5A0D] text-black text-[10px] font-bold rounded-lg uppercase tracking-wider hover:brightness-105"
                  >
                    Gerar via Kadosh AI
                  </button>
                </div>
              </div>

              {/* Right Column: Interactive lists selector */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* AI quality analysis output if verified */}
                {showAnalysisPane && currentAnalysis && (
                  <div className="bg-[#121212] border-2 border-[#CC5A0D]/30 rounded-xl p-4 md:p-5 space-y-3 relative shrink-0">
                    <button 
                      onClick={() => setShowAnalysisPane(false)}
                      className="absolute right-3 top-3 text-gray-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>

                    <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      <ShieldCheck className="text-green-500" size={18} /> Homologação de Altar Kadosh AI
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">Déficit Vocal Coro</span>
                        <p className="text-gray-300 mt-0.5 leading-relaxed bg-black/30 p-2 border border-white/5 rounded">{currentAnalysis.ausenciaVozes}</p>
                      </div>

                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">Ausência Instrumental</span>
                        <p className="text-gray-300 mt-0.5 leading-relaxed bg-black/30 p-2 border border-white/5 rounded">{currentAnalysis.ausenciaInstrumentos}</p>
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block font-mono">Compatibilidade e Repertório litúrgico</span>
                        <p className="text-gray-300 mt-0.5 leading-relaxed bg-black/30 p-2 border border-white/5 rounded">{currentAnalysis.analiseRepertorio}</p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full border-4 border-[#CC5A0D] flex items-center justify-center font-bold text-sm bg-black text-[#E7C19A]">
                          {currentAnalysis.pontuacaoSeguranca}%
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-gray-400 block font-mono">Escore de Sucesso Executivo</span>
                          <span className="text-xs font-semibold text-white">Análise de fadiga & estabilidade musical</span>
                        </div>
                      </div>

                      <div className="max-w-xs text-[10px] text-[#E7C19A] italic p-2 bg-[#CC5A0D]/5 rounded border border-[#CC5A0D]/10">
                        <strong>Dica Técnico-Pastoral:</strong> {currentAnalysis.conselhosProcuctor}
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid Pick members */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Select Vocal */}
                  <div className="bg-[#0A0A0A]/60 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15 flex flex-col h-80">
                    <h4 className="text-xs font-bold uppercase text-[#E7C19A] tracking-wider border-b border-white/5 pb-2 flex justify-between items-center">
                      <span>Equipe de Vozes (Soprano, Tenor, Alto)</span>
                      <span className="font-mono text-[9px] text-[#CC5A0D]">({selectedVocals.length} escalados)</span>
                    </h4>

                    <div className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
                      {musicians.filter(m => isEligibleForCategory(m, "vocal") && m.active).map(m => {
                        const isScheduled = selectedVocals.some(v => v.id === m.id);
                        const refObj = selectedVocals.find(v => v.id === m.id);
                        return (
                          <div key={m.id} className="p-2.5 bg-[#161616] rounded-lg border border-white/5 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold text-white block leading-tight">{m.name}</span>
                                <span className="text-[9px] font-mono text-gray-500">{m.instrument} • {m.scaleCount} esc.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleMusicianRef(m, "vocal")}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                                  isScheduled 
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                    : "bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/20 hover:bg-[#CC5A0D]/20"
                                }`}
                              >
                                {isScheduled ? "Remover" : "Escalar"}
                              </button>
                            </div>

                            {isScheduled && refObj && (
                              <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/[0.02]">
                                <span className="text-[9px] text-gray-500 uppercase font-mono">Status:</span>
                                <div className="flex gap-1 ml-auto">
                                  {["Pendente", "Confirmado", "Recusado"].map(st => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => handleChangeMusicianStatus(m.id, "vocal", st)}
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono ${
                                        refObj.status === st 
                                          ? "bg-[#CC5A0D] text-black" 
                                          : "bg-black text-gray-500 hover:text-white"
                                      }`}
                                    >
                                      {st.slice(0, 4)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Select Instrumentalists */}
                  <div className="bg-[#0A0A0A]/60 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15 flex flex-col h-80">
                    <h4 className="text-xs font-bold uppercase text-[#E7C19A] tracking-wider border-b border-white/5 pb-2 flex justify-between items-center">
                      <span>Equipe Instrumental (Geral)</span>
                      <span className="font-mono text-[9px] text-[#CC5A0D]">({selectedInst.length} escalados)</span>
                    </h4>

                    <div className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
                      {musicians.filter(m => isEligibleForCategory(m, "instrument") && m.active).map(m => {
                        const isScheduled = selectedInst.some(i => i.id === m.id);
                        const refObj = selectedInst.find(i => i.id === m.id);
                        return (
                          <div key={m.id} className="p-2.5 bg-[#161616] rounded-lg border border-white/5 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold text-white block leading-tight">{m.name}</span>
                                <span className="text-[9px] font-mono text-gray-500">{m.instrument} • {m.scaleCount} esc.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleMusicianRef(m, "instrument")}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                                  isScheduled 
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                    : "bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/20 hover:bg-[#CC5A0D]/20"
                                }`}
                              >
                                {isScheduled ? "Remover" : "Escalar"}
                              </button>
                            </div>

                            {isScheduled && refObj && (
                              <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/[0.02]">
                                <span className="text-[9px] text-gray-500 uppercase font-mono">Status:</span>
                                <div className="flex gap-1 ml-auto">
                                  {["Pendente", "Confirmado", "Recusado"].map(st => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => handleChangeMusicianStatus(m.id, "instrument", st)}
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono ${
                                        refObj.status === st 
                                          ? "bg-[#CC5A0D] text-black" 
                                          : "bg-black text-gray-500 hover:text-white"
                                      }`}
                                    >
                                      {st.slice(0, 4)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Select Technicians (Som / Datashow) */}
                  <div className="bg-[#0A0A0A]/60 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15 flex flex-col h-80">
                    <h4 className="text-xs font-bold uppercase text-[#E7C19A] tracking-wider border-b border-white/5 pb-2 flex justify-between items-center">
                      <span>Equipe Técnica (Som / Datashow)</span>
                      <span className="font-mono text-[9px] text-[#CC5A0D]">({selectedTech.length} escalados)</span>
                    </h4>

                    <div className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
                      {musicians.filter(m => isEligibleForCategory(m, "technician") && m.active).map(m => {
                        const isScheduled = selectedTech.some(t => t.id === m.id);
                        const refObj = selectedTech.find(t => t.id === m.id);
                        return (
                          <div key={m.id} className="p-2.5 bg-[#161616] rounded-lg border border-white/5 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold text-white block leading-tight">{m.name}</span>
                                <span className="text-[9px] font-mono text-gray-500">{m.role} • {m.instrument} • {m.scaleCount} esc.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleMusicianRef(m, "technician")}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                                  isScheduled
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/20 hover:bg-[#CC5A0D]/20"
                                }`}
                              >
                                {isScheduled ? "Remover" : "Escalar"}
                              </button>
                            </div>

                            {isScheduled && refObj && (
                              <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/[0.02]">
                                <span className="text-[9px] text-gray-500 uppercase font-mono">Status:</span>
                                <div className="flex gap-1 ml-auto">
                                  {["Pendente", "Confirmado", "Recusado"].map(st => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => handleChangeMusicianStatus(m.id, "technician", st)}
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono ${
                                        refObj.status === st
                                          ? "bg-[#CC5A0D] text-black"
                                          : "bg-black text-gray-500 hover:text-white"
                                      }`}
                                    >
                                      {st.slice(0, 4)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {musicians.filter(m => isEligibleForCategory(m, "technician") && m.active).length === 0 && (
                        <p className="text-[10px] text-gray-500 font-mono text-center py-6">
                          Nenhum Técnico de Som ou Datashow cadastrado ainda em Equipe.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Song repertoire selector */}
                <div className="bg-[#0A0A0A]/60 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15 flex flex-col">
                  <h4 className="text-xs font-bold uppercase text-[#E7C19A] tracking-wider border-b border-white/5 pb-2 flex justify-between items-center">
                    <span>Repertório da Ministração</span>
                    <span className="font-mono text-[9px] text-[#CC5A0D]">({selectedSongs.length} músicas)</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      <span className="text-[9px] uppercase font-mono text-gray-500 font-bold block sticky top-0 bg-[#0A0A0A] py-1">Catálogo Kadosh:</span>
                      {songs.map(sg => {
                        const isChosen = selectedSongs.some(s => s.id === sg.id);
                        return (
                          <div key={sg.id} className="flex items-center justify-between p-2 bg-[#161616] rounded-lg border border-white/5 text-xs">
                            <div>
                              <p className="font-semibold text-white">{sg.title}</p>
                              <p className="text-[10px] text-gray-500">{sg.author}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSongRef(sg)}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                                isChosen 
                                  ? "bg-red-500/15 text-red-400 border border-red-500/20" 
                                  : "bg-[#E7C19A]/15 text-[#E7C19A] border border-[#E7C19A]/20"
                              }`}
                            >
                              {isChosen ? "Tirar" : "Escolher"}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1 bg-black/40 backdrop-blur-sm p-2.5 border border-[#E7C19A]/10 rounded-xl">
                      <span className="text-[9px] uppercase font-mono text-[#E7C19A] font-bold block">Ordem Litúrgica Escolhida:</span>
                      {selectedSongs.length === 0 ? (
                        <p className="text-[10px] text-gray-600 italic py-6 text-center">Nenhuma canção escalada.</p>
                      ) : (
                        selectedSongs.map((s, index) => (
                          <div key={s.id} className="p-2 bg-[#161616] rounded-xl border border-white/5 flex items-center justify-between text-xs">
                            <span className="font-mono text-[#CC5A0D] font-bold">{index + 1}.</span>
                            <div className="flex-1 ml-2">
                              <p className="font-semibold text-white">{s.title}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500 mr-1">Tom:</span>
                              <input
                                type="text"
                                value={s.tone}
                                onChange={(e) => handleUpdateSongTone(s.id, e.target.value)}
                                className="w-10 text-center font-mono font-bold text-xs bg-black border border-white/10 rounded focus:border-[#CC5A0D]"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes and observation panel */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">Observações do Altar / Instruções de Ensaio</span>
                  <textarea
                    id="sch-form-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instruções para o dia do ensaio..."
                    className="w-full text-xs p-3 bg-black border border-white/5 rounded-xl text-white focus:outline-none focus:border-[#CC5A0D] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer Form Action Buttons */}
            <div className="p-4 border-t border-white/5 bg-[#0F0F0F] flex justify-between items-center">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 rounded-lg border border-white/10 hover:bg-white/[0.05] text-xs font-bold uppercase text-gray-400"
              >
                Descartar Rascunho
              </button>

              <button
                type="button"
                id="sch-btn-save-central"
                onClick={handleSaveSchedule}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white font-bold text-xs uppercase tracking-wider hover:opacity-90 flex items-center gap-1.5"
              >
                <Save size={14} /> Guardar Escala Oficial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED KADOSH AI SCALE GENERATOR MODAL VIEW */}
      {showAiGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#161616]/95 backdrop-blur-xl rounded-2xl border border-[#E7C19A]/25 overflow-hidden shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowAiGenerator(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <span className="text-[9px] font-mono uppercase bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/20 px-2.5 py-0.5 rounded-full font-bold">
              Kadosh AI Escala Inteligente
            </span>
            <h3 className="text-xl font-display font-semibold text-white mt-2 mb-4">Gerar Escala de Louvor Automática</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Diga o tema teológico ou o momento exegético. A Kadosh AI cruzará o banco de dados contra a fadiga dos membros, vocais disponíveis e afinidades de tons no hinário.
            </p>

            <form onSubmit={handleTriggerAiGenerator} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-[#E7C19A] block font-mono">Sensibilidade Pastoral / Tema</label>
                <textarea
                  id="ai-prompt-scale"
                  rows={3}
                  value={aiThemePrompt}
                  onChange={(e) => setAiThemePrompt(e.target.value)}
                  placeholder="Ex: 'Celebração pentecostal alegre mas com momento de entrega profunda no altar e renovação espiritual'"
                  className="w-full text-xs p-3 bg-black border border-white/5 rounded-xl text-white focus:outline-none focus:border-[#CC5A0D] placeholder-gray-600 resize-none"
                  required
                />
              </div>

              <button
                id="ai-prompt-scale-submit"
                type="submit"
                disabled={aiGenerating}
                className="w-full py-3 bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
              >
                {aiGenerating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Processando Heurísticas...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Ativar Kadosh AI
                  </>
                )}
              </button>
            </form>

            {/* AI Result Review Inside Generator */}
            {aiResult && (
              <div className="mt-6 border-t border-white/5 pt-5 space-y-4 max-h-[45vh] overflow-y-auto pr-1">
                <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-2 text-xs">
                  <p className="text-[#E7C19A] font-bold font-display">TEMA GERADO: &ldquo;{aiResult.theme}&rdquo;</p>
                  
                  <div>
                    <span className="text-[9px] font-bold text-gray-500 font-mono uppercase">Vozes Selecionadas:</span>
                    <p className="text-white mt-0.5">{aiResult.recommendedVocals?.map((v: any) => `${v.name} (${v.instrument})`).join(", ")}</p>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-gray-500 font-mono uppercase">Banda Escalada:</span>
                    <p className="text-white mt-0.5">{aiResult.recommendedInstrumentalists?.map((i: any) => `${i.name} (${i.instrument})`).join(", ")}</p>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-gray-500 font-mono uppercase">Repertório Congruente:</span>
                    <p className="text-[#CC5A0D] mt-0.5 font-bold font-mono">{aiResult.recommendedSongs?.map((s: any) => `${s.title} [${s.tone}]`).join(" → ")}</p>
                  </div>

                  <div className="p-2 border-l-2 border-[#CC5A0D] bg-[#CC5A0D]/5 text-[10px] text-gray-300 leading-normal italic mt-2">
                    &ldquo;{aiResult.justification}&rdquo;
                  </div>

                  {aiResult.alerts && aiResult.alerts.length > 0 && (
                    <div className="flex gap-1 items-start text-[10px] text-yellow-400 bg-yellow-500/5 p-2 rounded border border-yellow-500/10 mt-2 font-mono">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <div>
                        {aiResult.alerts.map((al: string, i: number) => <p key={i}>{al}</p>)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAiResult(null)}
                    className="flex-1 py-2 text-xs border border-white/5 text-gray-400 rounded-lg hover:bg-white/5"
                  >
                    Mudar Tema
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyAiGenerated}
                    className="flex-1 py-2 text-xs bg-gradient-to-r from-[#CC5A0D] to-[#E7C19A] text-black font-bold uppercase tracking-wider rounded-lg hover:opacity-90"
                  >
                    Aplicar Escala
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WHATSAPP SHARE & PREVIEW MODAL */}
      {sharingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#161616]/95 backdrop-blur-xl rounded-2xl border border-[#E7C19A]/25 overflow-hidden shadow-2xl p-6 md:p-8 relative my-8">
            <button 
              onClick={() => setSharingSchedule(null)}
              className="absolute right-5 top-5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 px-2 rounded font-mono text-[9px] font-bold bg-[#25D366]/15 text-[#25D366] uppercase tracking-wider flex items-center gap-1">
                <Send size={10} /> Canal WhatsApp
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-[#E7C19A]">Kadosh Multi-Share</span>
            </div>
            <h3 className="text-xl font-display font-semibold text-white mt-1 mb-6">Compartilhar Escala de Altar</h3>

            {/* Template Selection Cards */}
            <div className="mb-6 space-y-2">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Estilo do Texto / Layout da Escala</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: "kadosh", name: "Padrão Kadosh", desc: "Formatado com moldura rítmica e avisos básicos" },
                  { id: "compact", name: "Versão Compacta", desc: "Linhas diretas e concisas" },
                  { id: "full", name: "Completo Litúrgico", desc: "Com revelação e instruções completas de altar" }
                ].map(formatOpt => {
                  const isSel = selectedFormat === formatOpt.id;
                  return (
                    <button
                      key={formatOpt.id}
                      type="button"
                      onClick={() => {
                        setSelectedFormat(formatOpt.id);
                        setShareText(generateShareText(sharingSchedule, formatOpt.id));
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? "bg-[#CC5A0D]/10 border-[#CC5A0D] shadow-[0_0_15px_rgba(204,90,13,0.15)] text-[#CC5A0D]"
                          : "bg-black/30 border-white/10 text-gray-400 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      <span className="text-xs font-bold block">{formatOpt.name}</span>
                      <p className="text-[10px] text-gray-500 mt-1 leading-tight">{formatOpt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Text Area Box */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                <span>Edição & Visualização Prévia do Texto</span>
                <span className="text-gray-600 font-normal">Símbolos como * e _ funcionam no WhatsApp</span>
              </div>
              <textarea
                value={shareText}
                onChange={(e) => setShareText(e.target.value)}
                className="w-full h-72 bg-black font-mono text-xs text-[#25D366] p-4 rounded-xl border border-white/5 focus:border-[#25D366]/40 focus:outline-none leading-relaxed resize-none shadow-inner"
              />
            </div>

            {/* Micro warning about popups */}
            <p className="text-[10px] text-gray-500 block mt-2 text-center">
              Se o WhatsApp não abrir por bloqueio de popups do navegador, você pode usar o botão <strong>Copiar Texto</strong> e colar manualmente!
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t border-white/5 mt-6">
              <button
                type="button"
                onClick={() => setSharingSchedule(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/[0.05] text-xs font-bold uppercase tracking-wider text-gray-400 transition-colors"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareText);
                  setCopiedText(true);
                  setTimeout(() => setCopiedText(false), 2000);
                }}
                className={`flex-1 py-3 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                  copiedText
                    ? "bg-green-500/20 border-green-500/40 text-green-400"
                    : "border-[#E7C19A]/35 text-[#E7C19A] hover:bg-white/5"
                }`}
              >
                {copiedText ? (
                  <>
                    <Check size={14} className="text-green-400" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copiar Texto
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const encoded = encodeURIComponent(shareText);
                  const url = `https://api.whatsapp.com/send?text=${encoded}`;
                  window.open(url, "_blank");
                }}
                className="flex-1 py-3 bg-[#25D366] hover:bg-[#20ba59] text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(37,211,102,0.3)] transition-all flex items-center justify-center gap-1.5"
              >
                <Share2 size={14} /> Enviar WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const RefreshCw = ({ size, className }: { size: number; className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
);
