import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Trash2, 
  CheckCheck, 
  Calendar, 
  User, 
  Clock, 
  Info, 
  Music, 
  Mic, 
  HelpCircle, 
  Compass, 
  BellRing,
  Check,
  X,
  Cake
} from "lucide-react";
import { AppNotification, Musician } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../lib/api";

interface NotificationCenterProps {
  currentMusicianId?: string;
}

export function NotificationCenter({ currentMusicianId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [selectedAsUser, setSelectedAsUser] = useState<string>("all"); // "all" = Coordenador / Admin, or specific musician id
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchMusicians();
    
    // Periodical polling every 7 seconds to simulate real-time notification engine
    const interval = setInterval(() => {
      fetchNotifications();
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Erro ao carregar alertas:", err);
    }
  };

  const fetchMusicians = async () => {
    try {
      const res = await apiFetch("/api/musicians");
      if (res.ok) {
        const data = await res.json();
        setMusicians(data);
      }
    } catch (err) {
      console.error("Erro ao carregar músicos:", err);
    }
  };

  // Filter notifications based on simulated "View As" user
  const filteredNotifications = notifications.filter(notif => {
    if (selectedAsUser === "all") {
      // Admin sees ALL notifications
      return true;
    } else {
      // Specific musician sees general (all) or their personal ones
      return notif.targetMusicianId === "all" || notif.targetMusicianId === selectedAsUser;
    }
  });

  const unreadCount = filteredNotifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await apiFetch(`/api/notifications/${id}/read`, {
        method: "POST"
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await apiFetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicianId: selectedAsUser })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => {
          if (selectedAsUser === "all") {
            return { ...n, read: true };
          } else if (n.targetMusicianId === "all" || n.targetMusicianId === selectedAsUser) {
            return { ...n, read: true };
          }
          return n;
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Tem certeza que deseja limpar todo histórico de alertas ministerial?")) return;
    try {
      const res = await apiFetch("/api/notifications/clear", {
        method: "DELETE"
      });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Human date parser
  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      if (seconds < 60) return "Agora mesmo";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m atrás`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h atrás`;
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch (e) {
      return "";
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "publish":
        return <Calendar className="text-emerald-400" size={15} />;
      case "added":
        return <Music className="text-[#CC5A0D]" size={15} />;
      case "reminder":
        return <Bell className="text-[#E7C19A]" size={15} />;
      case "birthday":
        return <Cake className="text-pink-400" size={15} />;
      default:
        return <Info className="text-blue-400" size={15} />;
    }
  };

  return (
    <div className="relative">
      {/* BELL TRIGGER KEYBOARD TARGET */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-full border transition-all cursor-pointer ${
          isOpen 
            ? "bg-[#CC5A0D]/20 border-[#CC5A0D] text-white" 
            : "bg-white/[0.03] border-white/5 text-gray-400 hover:text-[#CC5A0D] hover:border-[#CC5A0D]/30"
        }`}
        title="Central de Alertas"
      >
        <Bell size={20} className={unreadCount > 0 ? "animate-wiggle" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-[#CC5A0D] text-white font-mono text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-[#0A0A0A]">
            {unreadCount}
          </span>
        )}
      </button>

      {/* DROPDOWN CONTAINER */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-out overlay */}
            <div 
              className="fixed inset-0 z-40 cursor-default" 
              onClick={() => setIsOpen(false)} 
            />

            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-2rem)] bg-[#161616] border border-[#E7C19A]/15 rounded-2xl shadow-2xl z-50 p-4 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-1.5 rounded-md bg-[#CC5A0D]/10 text-[#CC5A0D]">
                    <BellRing size={16} />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Alertas Ministeriais</h3>
                    <p className="text-[10px] text-gray-500 font-mono">Notificações em tempo real</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* SIMULATOR SWITCHER - EDITORIAL CRAFTSMANSHIP */}
              <div className="bg-[#0A0A0A] p-2.5 rounded-xl border border-[#CC5A0D]/10 space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[#E7C19A] block">
                  Simular Dispositivo do Músico:
                </span>
                <select
                  id="notif-role-simulator"
                  value={selectedAsUser}
                  onChange={(e) => setSelectedAsUser(e.target.value)}
                  className="w-full bg-[#161616] text-xs px-2.5 py-1.5 rounded-lg border border-white/5 text-gray-300 focus:outline-none focus:border-[#CC5A0D] uppercase font-mono tracking-wider"
                >
                  <option value="all">🛡️ Coordenador (Todos os Alertas)</option>
                  <optgroup label="Corpo Ministerial Voces / Banda">
                    {musicians.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.role === "Vocal" ? "🎙️" : "🎸"} {m.name} ({m.instrument})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[9px] text-gray-500 italic font-mono leading-tight pt-0.5">
                  Clique na aba <strong>&quot;Escalas Mensais&quot;</strong>, adicione/publique uma escala e mude este seletor para ver os músicos recebendo alertas instantâneos!
                </p>
              </div>

              {/* ACTION ROW */}
              {filteredNotifications.length > 0 && (
                <div className="flex justify-between items-center text-[10px] tracking-wider uppercase font-mono">
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 text-[#E7C19A]/80 hover:text-[#E7C19A] font-bold cursor-pointer"
                  >
                    <CheckCheck size={12} /> Marcar lidas
                  </button>
                  
                  {selectedAsUser === "all" && (
                    <button 
                      onClick={handleClearAll}
                      className="flex items-center gap-1 text-red-400/80 hover:text-red-400 font-bold cursor-pointer"
                    >
                      <Trash2 size={12} /> Limpar histórico
                    </button>
                  )}
                </div>
              )}

              {/* LIST ITEMS LIST */}
              <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <div className="w-9 h-9 bg-white/[0.02] text-gray-600 rounded-full flex items-center justify-center">
                      <Compass size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-400">Nenhum Alerta Pendente</h4>
                      <p className="text-[10px] text-gray-600 mt-1 max-w-xs leading-relaxed">
                        Nenhuma notificação encontrada para este perfil de simulação.
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`p-3 rounded-xl border flex gap-3 transition-colors relative group/item overflow-hidden ${
                        notif.read 
                          ? "bg-white/[0.01] border-white/5" 
                          : "bg-white/[0.03] border-[#CC5A0D]/20 shadow-sm shadow-[#CC5A0D]/5"
                      }`}
                    >
                      {/* Left indicator strip for unread */}
                      {!notif.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#CC5A0D]" />
                      )}

                      <div className="shrink-0 pt-0.5">
                        <span className="w-7 h-7 bg-black/40 rounded-lg flex items-center justify-center border border-white/5">
                          {getIconForType(notif.type)}
                        </span>
                      </div>

                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-white leading-snug tracking-tight">
                            {notif.title}
                          </h4>
                          <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap pt-0.5 flex items-center gap-1">
                            <Clock size={9} /> {formatTimeAgo(notif.date)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 leading-normal font-sans pt-0.5 break-words">
                          {notif.message}
                        </p>
                        
                        {!notif.read && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="mt-1.5 text-[9px] uppercase font-mono font-bold text-[#CC5A0D] hover:text-white transition-colors cursor-pointer flex items-center gap-0.5"
                          >
                            <Check size={10} /> Definir como lida
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
