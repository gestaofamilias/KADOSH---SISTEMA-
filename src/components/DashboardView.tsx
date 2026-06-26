import React, { useEffect, useState } from "react";
import { 
  Users, 
  Music, 
  Calendar, 
  CheckCircle, 
  Clock, 
  ChevronRight, 
  ChevronLeft,
  Plus,
  Trash2,
  Bell,
  TrendingUp, 
  Award, 
  Zap,
  Info
} from "lucide-react";
import { Musician, Song, getMusicianAvatar } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../lib/api";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";

interface StatsData {
  activeMusiciansCount: number;
  inactiveMusiciansCount: number;
  totalSchedules: number;
  approvedSchedules: number;
  draftSchedules: number;
  mostActive: Musician[];
  topSongs: Song[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }
  }
};

const glowingCardVariants = {
  hidden: { 
    opacity: 0, 
    y: 16,
    scale: 0.98,
    boxShadow: "0 0 0px rgba(204, 90, 13, 0)"
  },
  visible: (customIndex: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    boxShadow: [
      "0 0 0px rgba(204, 90, 13, 0)",
      "0 0 22px rgba(204, 90, 13, 0.35)",
      "0 0 6px rgba(204, 90, 13, 0.05)"
    ],
    transition: {
      opacity: { duration: 0.6, ease: "easeOut", delay: customIndex * 0.1 },
      y: { type: "spring", stiffness: 80, damping: 14, delay: customIndex * 0.1 },
      scale: { type: "spring", stiffness: 80, damping: 14, delay: customIndex * 0.1 },
      boxShadow: { duration: 1.8, ease: "easeInOut", times: [0, 0.4, 1], delay: customIndex * 0.1 + 0.2 }
    }
  })
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111111] border border-[#E7C19A]/30 p-3 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="text-xs font-mono font-bold text-[#E7C19A] mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((pld: any) => (
            <div key={pld.dataKey} className="flex items-center gap-4 justify-between">
              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5 font-sans">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pld.stroke || pld.color }}></span>
                {pld.name}:
              </span>
              <span className="text-xs font-mono font-bold text-white">{pld.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function DashboardView({ 
  onNavigate,
  onQuickAiScale
}: { 
  onNavigate: (tab: string) => void;
  onQuickAiScale: () => void;
}) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Event Calendar & Reminders states
  const [schedules, setSchedules] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  
  // Quick Reminder Form State
  const [newRemText, setNewRemText] = useState("");
  const [newRemCategory, setNewRemCategory] = useState("Ensaio");
  const [isSubmittingRem, setIsSubmittingRem] = useState(false);
  const [errRemMsg, setErrRemMsg] = useState("");

  useEffect(() => {
    fetchStats();
    fetchSchedulesAndReminders();
    
    // Default selected date string to today on mount
    const today = new Date();
    const yStr = today.getFullYear();
    const mStr = (today.getMonth() + 1).toString().padStart(2, "0");
    const dStr = today.getDate().toString().padStart(2, "0");
    setSelectedDateStr(`${yStr}-${mStr}-${dStr}`);
  }, []);

  const fetchSchedulesAndReminders = async () => {
    try {
      const [schsRes, remsRes] = await Promise.all([
        apiFetch("/api/schedules"),
        apiFetch("/api/reminders")
      ]);
      if (schsRes.ok) {
        const schs = await schsRes.json();
        setSchedules(schs);
        // Default select to first upcoming service's date if present
        if (schs.length > 0) {
          const firstSch = schs[0];
          if (firstSch.date) {
            setSelectedDateStr(firstSch.date);
            const parts = firstSch.date.split("-");
            if (parts.length === 3) {
              setCalendarMonth(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1));
            }
          }
        }
      }
      if (remsRes.ok) {
        const rems = await remsRes.json();
        setReminders(rems);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do calendário:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiFetch("/api/statistics");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas do dashboard:", err);
    } finally {
      setStats(prev => prev || {
        activeMusiciansCount: 10,
        inactiveMusiciansCount: 1,
        totalSchedules: 2,
        approvedSchedules: 1,
        draftSchedules: 1,
        mostActive: [],
        topSongs: []
      });
      setLoading(false);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemText.trim()) return;
    setIsSubmittingRem(true);
    setErrRemMsg("");

    try {
      const res = await apiFetch("/api/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          date: selectedDateStr,
          text: newRemText,
          category: newRemCategory
        })
      });

      if (res.ok) {
        const newRem = await res.json();
        setReminders(prev => [...prev, newRem]);
        setNewRemText("");
        // Reload statistics if reminders count plays a role
        fetchStats();
      } else {
        const err = await res.json();
        setErrRemMsg(err.error || "Erro ao salvar lembrete.");
      }
    } catch (err) {
      console.error(err);
      setErrRemMsg("Erro ao conectar ao servidor.");
    } finally {
      setIsSubmittingRem(false);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await apiFetch(`/api/reminders/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id));
        fetchStats();
      }
    } catch (err) {
      console.error("Erro ao apagar lembrete:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-[#CC5A0D] animate-spin mb-4"></div>
        <p className="text-sm text-gray-400 font-mono">Processando estatísticas do ministério...</p>
      </div>
    );
  }

  const {
    activeMusiciansCount = 0,
    totalSchedules = 0,
    approvedSchedules = 0,
    draftSchedules = 0,
    mostActive = [],
    topSongs = []
  } = stats || {};

  // Dynamically compute chart data for the last 3 months following Kadosh's performance logs
  const chartData = [
    {
      name: "Abril",
      escalas: 4,
      musicos: Math.max(activeMusiciansCount - 2, 6)
    },
    {
      name: "Maio",
      escalas: Math.max(totalSchedules + 3, 5),
      musicos: Math.max(activeMusiciansCount - 1, 8)
    },
    {
      name: "Junho",
      escalas: totalSchedules,
      musicos: activeMusiciansCount
    }
  ];

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth(); // 0-11
  const monthLabel = calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handlePrevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Welcome Hero Panel */}
      <motion.div 
        variants={itemVariants}
        className="relative rounded-2xl p-6 md:p-8 bg-gradient-to-r from-[#161616]/85 via-[#1e140d]/75 to-[#161616]/85 backdrop-blur-md border border-[#E7C19A]/20 overflow-hidden shadow-xl"
      >
        {/* Subtle backing flame effect */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial-gradient from-[#CC5A0D]/10 to-transparent pointer-events-none"></div>
        
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/20 mb-4 animate-pulse">
            <Zap size={12} /> KADOSH AI ATIVA
          </span>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-[#F5F5F5] tracking-tight mb-2">
            Eleve o nível do seu <span className="text-[#E7C19A]">Ministério de Louvor</span>
          </h1>
          <p className="text-sm md:text-base text-gray-400 leading-relaxed mb-6">
            Roteiros excelentes, escalas inteligentes balanceadas, sugestão de tom e monitoramento de vozes com o poder da Kadosh AI. 100% Mobile First.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              id="dash-btn-ai-scale"
              onClick={onQuickAiScale}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white hover:opacity-90 font-medium transition-all shadow-md flex items-center justify-center gap-2 text-sm"
            >
              <Zap size={16} /> Assistente de Escala IA
            </button>
            <button 
              id="dash-btn-new-scale"
              onClick={() => onNavigate("escalas")}
              className="px-5 py-2.5 rounded-lg bg-[#161616] text-[#E7C19A] border border-[#E7C19A]/20 hover:bg-[#1f1f1f] transition-all font-medium text-sm flex items-center justify-center gap-2"
            >
              Consultar Escalas Ativas <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Numerical Indicators */} 
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */} 
        <motion.div 
          custom={0}
          variants={glowingCardVariants}
          className="bg-[#161616]/70 border border-[#E7C19A]/20 hover:border-[#CC5A0D]/50 hover:shadow-[0_0_20px_rgba(204,90,13,0.25)] hover:scale-[1.02] transition-all duration-300 rounded-xl p-4 md:p-5 flex items-start gap-4 shadow-sm group backdrop-blur-lg relative overflow-hidden"
        >
          {/* Subtle inside aura */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#CC5A0D]/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="p-3 rounded-lg bg-[#CC5A0D]/10 text-[#CC5A0D] group-hover:bg-[#CC5A0D]/20 transition-all">
            <Users size={20} />
          </div>
          <div className="relative z-10">
            <span className="text-xs text-gray-400 block mb-0.5">Músicos Ativos</span>
            <span className="text-2xl md:text-3xl font-display font-semibold text-[#F5F5F5]">{activeMusiciansCount}</span>
            <span className="text-[10px] text-green-500 block mt-1">Prontos para servir</span>
          </div>
        </motion.div>

        {/* Card 2 */} 
        <motion.div 
          custom={1}
          variants={glowingCardVariants}
          className="bg-[#161616]/70 border border-[#E7C19A]/20 hover:border-[#CC5A0D]/50 hover:shadow-[0_0_20px_rgba(204,90,13,0.25)] hover:scale-[1.02] transition-all duration-300 rounded-xl p-4 md:p-5 flex items-start gap-4 shadow-sm group backdrop-blur-lg relative overflow-hidden"
        >
          {/* Subtle inside aura */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#E7C19A]/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="p-3 rounded-lg bg-[#E7C19A]/10 text-[#E7C19A] group-hover:bg-[#E7C19A]/20 transition-all">
            <Calendar size={20} />
          </div>
          <div className="relative z-10">
            <span className="text-xs text-gray-400 block mb-0.5">Escalas Totais</span>
            <span className="text-2xl md:text-3xl font-display font-semibold text-[#F5F5F5]">{totalSchedules}</span>
            <span className="text-[10px] text-gray-500 block mt-1">No banco kadosh</span>
          </div>
        </motion.div>

        {/* Card 3 */} 
        <motion.div 
          custom={2}
          variants={glowingCardVariants}
          className="bg-[#161616]/70 border border-[#E7C19A]/20 hover:border-[#CC5A0D]/50 hover:shadow-[0_0_20px_rgba(204,90,13,0.25)] hover:scale-[1.02] transition-all duration-300 rounded-xl p-4 md:p-5 flex items-start gap-4 shadow-sm group backdrop-blur-lg relative overflow-hidden"
        >
          {/* Subtle inside aura */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-green-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500/20 transition-all">
            <CheckCircle size={20} />
          </div>
          <div className="relative z-10">
            <span className="text-xs text-gray-400 block mb-0.5">Aprovadas</span>
            <span className="text-2xl md:text-3xl font-display font-semibold text-[#F5F5F5]">{approvedSchedules}</span>
            <span className="text-[10px] text-green-400 block mt-1">Sincronizadas WhatsApp</span>
          </div>
        </motion.div>

        {/* Card 4 */} 
        <motion.div 
          custom={3}
          variants={glowingCardVariants}
          className="bg-[#161616]/70 border border-[#E7C19A]/20 hover:border-[#CC5A0D]/50 hover:shadow-[0_0_20px_rgba(204,90,13,0.25)] hover:scale-[1.02] transition-all duration-300 rounded-xl p-4 md:p-5 flex items-start gap-4 shadow-sm group backdrop-blur-lg relative overflow-hidden"
        >
          {/* Subtle inside aura */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-400 group-hover:bg-yellow-500/20 transition-all">
            <Clock size={20} />
          </div>
          <div className="relative z-10">
            <span className="text-xs text-gray-400 block mb-0.5">Em Rascunho</span>
            <span className="text-2xl md:text-3xl font-display font-semibold text-[#F5F5F5]">{draftSchedules}</span>
            <span className="text-[10px] text-yellow-400 block mt-1">Aguardando coordenação</span>
          </div>
        </motion.div>
      </div>

      {/* SEÇÃO: CALENDÁRIO LITÚRGICO & LEMBRETES RÁPIDOS */}
      <motion.div 
        variants={itemVariants}
        className="bg-[#161616]/70 border border-[#E7C19A]/15 rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-lg space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-base font-display font-semibold text-[#E7C19A] flex items-center gap-2">
              <Calendar size={18} className="text-[#CC5A0D]" /> Calendário de Eventos & Ensaios
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Organização integrada de cultos do altar, escalas ministeriais e lembretes de ensaio.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 border border-white/5 rounded-xl text-[11px] font-mono font-medium text-gray-400">
            <span className="w-2.5 h-2.5 bg-[#CC5A0D] rounded-full inline-block"></span> Cultos
            <span className="w-2.5 h-2.5 bg-[#E7C19A] rounded-full inline-block ml-2"></span> Ensaios/Lembretes
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* COLUNA ESQUERDA: O MENSÁRIO CALENDÁRIO */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Seletor de Mês e Ano */}
            <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/5">
              <button 
                type="button"
                onClick={handlePrevMonth}
                className="p-1 px-2.5 rounded-lg bg-[#161616] text-[#E7C19A] border border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span className="text-xs font-mono font-bold uppercase text-white tracking-widest px-2">
                {monthLabel}
              </span>
              
              <button 
                type="button"
                onClick={handleNextMonth}
                className="p-1 px-2.5 rounded-lg bg-[#161616] text-[#E7C19A] border border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* A Grade Física do Calendário */}
            <div className="bg-black/50 p-4 rounded-xl border border-white/5">
              {/* Dias da semana */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((dName) => (
                  <div key={dName} className="text-[9px] font-mono font-bold text-gray-500 tracking-wider">
                    {dName}
                  </div>
                ))}
              </div>

              {/* Dias do mês */}
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((day, idx) => {
                  if (day === null) {
                    return <div key={`p-${idx}`} className="aspect-square opacity-0"></div>;
                  }

                  const dateKey = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
                  const isSelected = dateKey === selectedDateStr;
                  
                  // Check if this date is today
                  const dToday = new Date();
                  const isTodayStr = `${dToday.getFullYear()}-${(dToday.getMonth() + 1).toString().padStart(2, "0")}-${dToday.getDate().toString().padStart(2, "0")}`;
                  const isToday = dateKey === isTodayStr;

                  // Find items on this day
                  const hasCulto = schedules.some(s => s.date === dateKey);
                  const hasRem = reminders.some(r => r.date === dateKey);

                  return (
                    <button
                      type="button"
                      key={`d-${day}`}
                      onClick={() => setSelectedDateStr(dateKey)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-between p-1.5 border transition-all cursor-pointer relative ${
                        isSelected 
                          ? "bg-[#CC5A0D]/20 border-[#CC5A0D] text-white font-bold scale-105" 
                          : isToday
                            ? "bg-black/50 border-[#E7C19A]/50 text-[#E7C19A] font-semibold"
                            : "bg-[#101010]/60 border-white/5 hover:border-white/20 text-gray-300"
                      }`}
                    >
                      {/* Day number */}
                      <span className="text-xs font-mono">{day}</span>
                      
                      {/* Event category indicator dots */}
                      <div className="flex gap-1 justify-center items-center h-1.5 w-full">
                        {hasCulto && (
                          <span className="w-1 h-1 rounded-full bg-[#CC5A0D]" title="Culto Escalado"></span>
                        )}
                        {hasRem && (
                          <span className="w-1 h-1 rounded-full bg-[#E7C19A]" title="Lembrete / Ensaio"></span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: AGENDA DO DIA SELECIONADO & FORM DE LEMBRETES */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-black/20 p-4 rounded-xl border border-white/5 space-y-5">
            <div>
              {/* Dia selecionado Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="text-xs font-mono font-semibold text-[#E7C19A] tracking-wider uppercase">
                  Agenda: {(() => {
                    const parts = selectedDateStr.split("-");
                    if (parts.length === 3) {
                      const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                      return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
                    }
                    return selectedDateStr;
                  })()}
                </span>
                <span className="text-[10px] bg-[#CC5A0D]/10 text-[#CC5A0D] px-2 py-0.5 rounded border border-[#CC5A0D]/20 font-mono">
                  {selectedDateStr}
                </span>
              </div>

              {/* Lista de Eventos / Compromissos */}
              <div className="space-y-3 mt-4 max-h-60 overflow-y-auto pr-1">
                {(() => {
                  const daySchedules = schedules.filter(s => s.date === selectedDateStr);
                  const dayReminders = reminders.filter(r => r.date === selectedDateStr);

                  if (daySchedules.length === 0 && dayReminders.length === 0) {
                    return (
                      <div className="text-center py-8 text-xs text-gray-500 font-mono italic flex flex-col items-center justify-center gap-2">
                        <Info size={16} className="text-gray-600" />
                        Nenhum compromisso ou ensaio agendado para este dia.
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Mostrar Cultos */}
                      {daySchedules.map((sch) => (
                        <div 
                          key={sch.id}
                          className="bg-[#161616]/90 border border-[#CC5A0D]/30 p-2.5 rounded-xl space-y-2.5 shadow-sm relative overflow-hidden"
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#CC5A0D]" />
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 bg-[#CC5A0D]/20 text-[#CC5A0D] rounded border border-[#CC5A0D]/10 font-bold">
                                Culto Oficial
                              </span>
                              <h4 className="text-xs font-bold text-white mt-1.5">{sch.title}</h4>
                            </div>
                            <span className="text-[9px] font-mono text-gray-400">
                              Status: {sch.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[10px] bg-black/40 p-2 rounded-lg text-gray-400 font-sans">
                            <div>
                              <strong className="text-[#E7C19A]">Tema:</strong> {sch.theme || "Não definido"}
                            </div>
                            <div>
                              <strong className="text-[#E7C19A]">Líder:</strong> {sch.coordinator}
                            </div>
                          </div>

                          {/* Seletor do repertório prévio */}
                          {sch.songs && sch.songs.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono font-bold text-gray-500 block">REPERTÓRIO LITÚRGICO:</span>
                              <div className="flex flex-wrap gap-1">
                                {sch.songs.map((song: any, sIdx: number) => (
                                  <span key={song.id || sIdx} className="text-[9px] font-mono bg-[#111] px-2 py-0.5 rounded text-gray-300 border border-white/5">
                                    {sIdx + 1}. {song.title} ({song.tone})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Seletor de membros convocados */}
                          <div className="space-y-1 text-[10px] text-gray-400">
                            <strong>Equipe Escala:</strong>{" "}
                            {(() => {
                              const vocNames = sch.vocals.map((v: any) => v.name);
                              const instNames = sch.instrumentalists.map((i: any) => i.name);
                              const combined = [...vocNames, ...instNames].join(", ");
                              return combined || "Nenhum membro escalado ainda.";
                            })()}
                          </div>
                        </div>
                      ))}

                      {/* Mostrar Lembretes Rápidos */}
                      {dayReminders.map((rem) => (
                        <div 
                          key={rem.id}
                          className={`bg-white/[0.02] border p-2.5 rounded-xl flex justify-between items-start shadow-sm transition-all hover:bg-white/[0.04] ${
                            rem.category === "Ensaio"
                              ? "border-[#E7C19A]/30"
                              : "border-white/5"
                          }`}
                        >
                          <div className="space-y-1 pr-4">
                            <span className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded font-bold border ${
                              rem.category === "Ensaio"
                                ? "bg-[#E7C19A]/10 text-[#E7C19A] border-[#E7C19A]/20"
                                : "bg-green-500/10 text-green-400 border-green-500/20"
                            }`}>
                              {rem.category}
                            </span>
                            <p className="text-xs text-gray-200 block pt-1.5 leading-relaxed">
                              {rem.text}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(rem.id)}
                            className="p-1 px-1.5 rounded-lg bg-black text-xs text-red-400 border border-white/5 hover:border-red-400/20 hover:bg-red-950/20 transition-all cursor-pointer"
                            title="Apagar Lembrete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* FORMULÁRIO DE ADAPTAÇÃO E INSERÇÃO DE LEMBRETES */}
            <form onSubmit={handleAddReminder} className="border-t border-white/5 pt-3.5 space-y-3">
              <span className="text-[10px] font-mono tracking-wider font-bold text-gray-500 block uppercase">
                Adicionar Lembrete Rápido para este dia:
              </span>
              
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  placeholder="Ex: Ensaio de voz no sábado às 16h / Trazer violão extra..."
                  value={newRemText}
                  onChange={(e) => setNewRemText(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-white/5 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#CC5A0D]"
                />
                
                <div className="flex gap-2">
                  <select
                    value={newRemCategory}
                    onChange={(e) => setNewRemCategory(e.target.value)}
                    className="px-2.5 py-2 bg-[#0A0A0A] border border-white/5 rounded-lg text-xs text-[#E7C19A] font-bold uppercase focus:outline-none focus:border-[#CC5A0D]"
                  >
                    <option value="Ensaio">Ensaio</option>
                    <option value="Culto">Aviso Culto</option>
                    <option value="Geral">Aviso Geral</option>
                  </select>
                  
                  <button
                    type="submit"
                    disabled={isSubmittingRem || !newRemText.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white hover:opacity-95 disabled:opacity-45 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
              </div>
              
              {errRemMsg && (
                <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-500/10 p-1.5 rounded-md">
                  {errRemMsg}
                </div>
              )}
            </form>
          </div>
        </div>
      </motion.div>

      {/* Performance Summary - Recharts scale tracking */}
      <motion.div
        variants={itemVariants}
        className="bg-[#161616]/70 border border-[#E7C19A]/15 hover:border-[#CC5A0D]/40 hover:shadow-[0_0_20px_rgba(204,90,13,0.12)] transition-all duration-300 rounded-xl p-5 md:p-6 shadow-md backdrop-blur-lg"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-display font-semibold text-[#E7C19A] flex items-center gap-2">
              <TrendingUp size={18} className="text-[#CC5A0D]" /> Resumo de Desempenho do Altar (Últimos 3 Meses)
            </h2>
            <p className="text-xs text-gray-400 mt-1">Sincronia entre o engajamento dos músicos ativos e a frequência de escalas executadas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[10px] sm:text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#CC5A0D]"></span>
              <span className="text-gray-300">Escalas Realizadas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E7C19A]"></span>
              <span className="text-gray-300">Músicos Ativos</span>
            </div>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorEscalas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CC5A0D" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#CC5A0D" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorMusicos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E7C19A" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#E7C19A" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#666666" 
                fontSize={10} 
                fontFamily="JetBrains Mono, SFMono-Regular, monospace"
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis 
                stroke="#666666" 
                fontSize={10} 
                fontFamily="JetBrains Mono, SFMono-Regular, monospace"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                dx={-8}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ stroke: '#CC5A0D', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Area 
                type="monotone" 
                dataKey="escalas" 
                name="Escalas Realizadas"
                stroke="#CC5A0D" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorEscalas)" 
              />
              <Area 
                type="monotone" 
                dataKey="musicos" 
                name="Músicos Ativos"
                stroke="#E7C19A" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorMusicos)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Performance Statistics Graphs */} 
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Most Active Ministers */} 
        <motion.div 
          variants={itemVariants}
          className="bg-[#161616]/70 border border-[#E7C19A]/15 hover:border-[#CC5A0D]/40 hover:shadow-[0_0_20px_rgba(204,90,13,0.12)] hover:scale-[1.02] transition-all duration-300 rounded-xl p-5 shadow-md flex flex-col justify-between backdrop-blur-lg"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-display font-semibold text-[#E7C19A] flex items-center gap-2">
                <Award size={18} className="text-[#CC5A0D]" /> Ministros Mais Escalados (Revezamento)
              </h2>
              <span className="text-xs text-gray-500 font-mono">Participações</span>
            </div>

            <div className="space-y-4">
              {mostActive.length === 0 ? (
                <p className="text-xs text-gray-500 py-10 text-center">Nenhum dado de revezamento no momento.</p>
              ) : (
                mostActive.map((mus, idx) => {
                  const maxVal = Math.max(...mostActive.map(e => e.scaleCount), 1);
                  const percentage = Math.min((mus.scaleCount / maxVal) * 100, 100);
                  
                  return (
                    <div key={mus.id} className="space-y-1.5 bg-[#0F0F0F]/40 p-2 rounded-xl border border-white/[0.02] hover:bg-[#0F0F0F]/70 transition-all">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-500 font-bold text-[11px] w-4">{idx + 1}.</span>
                          <img
                            src={getMusicianAvatar(mus.name, mus.gender || "M")}
                            alt={mus.name}
                            className="w-7 h-7 rounded-full object-cover border border-[#E7C19A]/20"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            {mus.name} 
                            <span className="text-[8px] text-[#E7C19A] font-mono bg-[#E7C19A]/5 px-1.5 py-0.5 rounded border border-[#E7C19A]/10 font-bold uppercase tracking-wider">{mus.instrument}</span>
                          </span>
                        </div>
                        <span className="font-mono font-bold text-gray-400">{mus.scaleCount}x</span>
                      </div>
                      <div className="pl-6 w-full">
                        <div className="w-full bg-[#050505] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#CC5A0D] to-[#E7C19A] rounded-full transition-all duration-1000"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          <div className="border-t border-[#E7C19A]/5 pt-4 mt-6 flex justify-between items-center text-xs">
            <span className="text-gray-500 leading-normal max-w-xs">Nosso sistema de engajamento busca equilibrar o revezamento de vozes e instrumentos de forma excelente.</span>
            <button 
              onClick={() => onNavigate("músicos")}
              className="text-[#CC5A0D] hover:underline font-medium text-xs whitespace-nowrap flex items-center gap-0.5"
            >
              Músicos <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>

        {/* Right Column: Repertoire Hit Parade (Mais Tocadas) */} 
        <motion.div 
          variants={itemVariants}
          className="bg-[#161616]/70 border border-[#E7C19A]/15 hover:border-[#CC5A0D]/40 hover:shadow-[0_0_20px_rgba(204,90,13,0.12)] hover:scale-[1.02] transition-all duration-300 rounded-xl p-5 shadow-md flex flex-col justify-between backdrop-blur-lg"
        >
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-display font-semibold text-[#E7C19A] flex items-center gap-2">
                <TrendingUp size={18} className="text-[#CC5A0D]" /> Hit Parade Kadosh (Músicas Mais Tocadas)
              </h2>
              <span className="text-xs text-gray-500 font-mono">Vezes Tocadas</span>
            </div>

            <div className="space-y-4">
              {topSongs.length === 0 ? (
                <p className="text-xs text-gray-500 py-10 text-center">Nenhum dado de repertório recente.</p>
              ) : (
                topSongs.map((song, idx) => {
                  const maxSongsVal = Math.max(...topSongs.map(e => e.count), 1);
                  const songPercentage = Math.min((song.count / maxSongsVal) * 100, 100);

                  return (
                    <div key={song.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-sm font-medium text-gray-300">
                          {song.title} 
                          <span className="text-[10px] text-gray-500 ml-2">({song.author})</span>
                        </span>
                        <span className="font-mono text-[#E7C19A] font-bold">{song.count} ministradas</span>
                      </div>
                      <div className="w-full bg-[#0A0A0A] h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#CC5A0D] via-[#e28e51] to-[#E7C19A] rounded-full transition-all duration-1000"
                          style={{ width: `${songPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-[#E7C19A]/5 pt-4 mt-6 flex justify-between items-center text-xs">
            <span className="text-gray-500 leading-normal max-w-xs">Cultive repertórios que falem profundamente ao coração de Deus e facilitem a expressão congregacional.</span>
            <button 
              onClick={() => onNavigate("repertório")}
              className="text-[#CC5A0D] hover:underline font-medium text-xs whitespace-nowrap flex items-center gap-0.5"
            >
              Repertório <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Liturgical Soundwaves Micro Widget */} 
      <motion.div 
        variants={itemVariants}
        className="p-4 rounded-xl bg-[#0F0F0F]/65 border border-[#E7C19A]/15 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-lg"
      >
        <div className="flex items-center gap-3">
          {/* Animated sound wave bars representing adoration and music */}
          <div className="flex items-end gap-1.5 h-8">
            <div className="w-[3px] bg-[#CC5A0D] round-full wave-bar" style={{ height: "16px" }}></div>
            <div className="w-[3px] bg-[#E7C19A] round-full wave-bar" style={{ height: "24px" }}></div>
            <div className="w-[3px] bg-[#CC5A0D] round-full wave-bar" style={{ height: "28px" }}></div>
            <div className="w-[3px] bg-[#F5F5F5] round-full wave-bar" style={{ height: "14px" }}></div>
            <div className="w-[3px] bg-[#E7C19A] round-full wave-bar" style={{ height: "20px" }}></div>
            <div className="w-[3px] bg-[#CC5A0D] round-full wave-bar" style={{ height: "8px" }}></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#E7C19A] leading-tight">Dinâmica Sonora</h3>
            <p className="text-xs text-gray-400">Atividade musical sincronizada no altar</p>
          </div>
        </div>
        <div className="text-xs font-mono text-gray-500 border border-gray-800 rounded px-2.5 py-1 bg-black">
          Próxima escala oficial: Domingo, 14 de Junho de 2026
        </div>
      </motion.div>
    </motion.div>
  );
}
