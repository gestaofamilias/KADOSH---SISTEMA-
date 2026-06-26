import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AuthView } from "./components/AuthView";
import { DashboardView } from "./components/DashboardView";
import { SchedulesView } from "./components/SchedulesView";
import { SongsView } from "./components/SongsView";
import { MusiciansView } from "./components/MusiciansView";
import { ReportsView } from "./components/ReportsView";
import { KadoshLogo } from "./components/KadoshLogo";
import { NotificationCenter } from "./components/NotificationCenter";
import { KadoshAIChat } from "./components/KadoshAIChat";
import { SettingsView } from "./components/SettingsView";
import { AutomationsView } from "./components/AutomationsView";
import { supabase } from "./lib/supabaseClient";
import {
  Sparkles, LayoutDashboard, Calendar, Music, Users,
  FileText, Menu, X, LogOut, Info, ShieldCheck, MessageCircle, Settings, Workflow
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [forceScaleAiTrigger, setForceScaleAiTrigger] = useState(false);
  const [currentUtcClock, setCurrentUtcClock] = useState("");

  useEffect(() => {
    // Elegant clock header
    const updateTime = () => {
      const now = new Date();
      setCurrentUtcClock(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user.email || null);
      setSessionLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user.email || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = (email: string) => {
    setUser(email);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    supabase.auth.signOut();
    setUser(null);
  };

  if (!sessionLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-gray-500 text-sm font-mono">
        Carregando sessão...
      </div>
    );
  }

  const handleQuickScaleWithAi = () => {
    setForceScaleAiTrigger(true);
    setActiveTab("escalas");
    setTimeout(() => setForceScaleAiTrigger(false), 200);
  };

  if (!user) {
    return <AuthView onLogin={handleLogin} />;
  }

  // Navigation Links Matching Editorial Aesthetic
  const navItems = [
    { id: "dashboard", label: "Dashboard Principal", icon: <LayoutDashboard size={18} /> },
    { id: "escalas", label: "Escalas Mensais", icon: <Calendar size={18} /> },
    { id: "repertório", label: "Repertório Musical", icon: <Music size={18} /> },
    { id: "músicos", label: "Gestão de Membros", icon: <Users size={18} /> },
    { id: "relatorios", label: "Relatórios PDF", icon: <FileText size={18} /> },
    { id: "automacoes", label: "Automações n8n", icon: <Workflow size={18} /> },
    { id: "kadosh-ai-chat", label: "Kadosh AI Chat", icon: <MessageCircle size={18} /> },
    { id: "configuracoes", label: "Configurações", icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans flex flex-col md:flex-row relative overflow-x-hidden">
      
      {/* Absolute flame background glow element */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#CC5A0D]/5 blur-[120px] rounded-full pointer-events-none -mr-48 -mt-48 z-0"></div>

      {/* MOBILE HEADER BAR */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#161616] border-b border-[#CC5A0D]/10 relative z-40">
        <KadoshLogo className="h-8" showText={true} />
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-gray-400 hover:text-[#CC5A0D] transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* RESPONSIVE MOBILE OVERLAY SIDEBAR */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-30 flex flex-col animate-fadeIn md:hidden">
          <div className="w-80 max-w-full bg-[#161616] h-full p-6 flex flex-col justify-between border-r border-[#CC5A0D]/20">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <KadoshLogo showText={true} />
                <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="w-12 h-1 bg-[#CC5A0D] rounded-full"></div>

              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm transition-all text-left font-semibold ${
                        isActive
                          ? "bg-gradient-to-r from-[#CC5A0D]/20 to-transparent text-[#CC5A0D] border-l-2 border-[#CC5A0D]"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {item.icon} {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                <ShieldCheck size={12} className="text-[#CC5A0D]" /> Coordenador: {user}
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-950/20 text-red-400 border border-red-500/10 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-900/30"
              >
                <LogOut size={12} /> Encerrar Seção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP PERSISTENT ASIDE SIDEBAR */}
      <aside className="hidden md:flex w-72 bg-[#161616] border-r border-[#CC5A0D]/10 flex-col justify-between shrink-0 h-screen sticky top-0 z-20">
        <div className="p-8 space-y-6">
          <div className="flex flex-col gap-1">
            <div className="w-12 h-1 bg-[#CC5A0D] mb-4 rounded-full"></div>
            <h1 className="text-3xl font-black tracking-tighter text-white font-display">
              KADOSH<span className="text-[#CC5A0D]">.</span>
            </h1>
            <p className="text-[10px] text-[#E7C19A] uppercase tracking-[0.3em] font-bold opacity-80">Manager</p>
          </div>

          <nav className="space-y-2.5 pt-6">
            <p className="text-[#E7C19A] text-[9px] uppercase tracking-widest font-bold mb-4 opacity-40 font-mono">Navegação Geral</p>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-r-lg text-sm transition-all font-semibold text-left ${
                    isActive
                      ? "bg-gradient-to-r from-[#CC5A0D]/20 to-transparent text-[#CC5A0D] border-l-2 border-[#CC5A0D]"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dynamic bottom Kadosh AI alert panel from the Editorial Aesthetic */}
        <div className="p-6 space-y-4">
          <div className="bg-[#0A0A0A] p-4 rounded-2xl border border-[#CC5A0D]/20 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-[#CC5A0D] uppercase tracking-wider font-mono flex items-center gap-1">
                <Sparkles size={10} className="animate-pulse" /> Kadosh AI
              </span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
              Kadosh AI analisou o revezamento ministerial. <span className="text-[#E7C19A] font-bold">10 musicos</span> estão prontos para a escala semanal.
            </p>
            <button 
              onClick={handleQuickScaleWithAi}
              className="w-full bg-[#CC5A0D] text-black text-[9px] font-black py-2 rounded-lg uppercase tracking-widest hover:brightness-110 transition-all font-mono"
            >
              Ajustar Escala IA
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-gray-500 font-mono">
            <span>Operador: {user}</span>
            <button 
              onClick={handleLogout}
              className="hover:text-red-400 flex items-center gap-0.5"
              title="Sair"
            >
              Sair <LogOut size={10} />
            </button>
          </div>
        </div>
      </aside>

      {/* CORE CONTENT WORKSPACE */}
      <main className="flex-1 p-6 md:p-12 relative z-10 flex flex-col min-h-screen">
        
        {/* Editorial style top bar layout */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-white/5 pb-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl md:text-4xl font-light text-[#F5F5F5] tracking-tight italic font-display">
              Ministério <span className="font-black text-white not-italic">Kadosh</span>
            </h2>
            <p className="text-[#E7C19A] text-xs font-semibold tracking-wide uppercase">Gestão Inteligente de Louvor • Kadosh Manager</p>
          </div>

          <div className="flex items-center gap-6 md:gap-8 text-xs font-mono ml-auto md:ml-0">
            <NotificationCenter />

            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-[#E7C19A] font-bold uppercase tracking-widest">Relógio do Templo (UTC)</p>
              <p className="text-base font-bold text-white tracking-wide">{currentUtcClock || "00:00:00"}</p>
            </div>
            
            {/* Visual editorial profile circle */}
            <div className="w-12 h-12 bg-gradient-to-tr from-[#CC5A0D] to-[#E7C19A] rounded-full p-0.5 shadow-xl shadow-[#CC5A0D]/10">
              <div className="w-full h-full bg-[#0A0A0A] rounded-full flex items-center justify-center font-bold text-sm text-white italic">
                MK
              </div>
            </div>
          </div>
        </header>

        {/* COMPONENT TAB CONTROL */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="w-full h-full"
            >
              {activeTab === "dashboard" && (
                <DashboardView 
                  onNavigate={setActiveTab} 
                  onQuickAiScale={handleQuickScaleWithAi}
                />
              )}

              {activeTab === "escalas" && (
                <SchedulesView forceAiInit={forceScaleAiTrigger} />
              )}

              {activeTab === "repertório" && (
                <SongsView />
              )}

              {activeTab === "músicos" && (
                <MusiciansView />
              )}

              {activeTab === "relatorios" && (
                <ReportsView />
              )}

              {activeTab === "automacoes" && (
                <AutomationsView />
              )}

              {activeTab === "kadosh-ai-chat" && (
                <KadoshAIChat />
              )}

              {activeTab === "configuracoes" && (
                <SettingsView />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
