import React, { useState, useEffect } from "react";
import { KadoshLogo } from "./KadoshLogo";
import { Flame, Lock, Mail, Sparkles, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "../lib/supabaseClient";

const loginBg = "/src/assets/images/kadosh_login_bg_1781298872741.jpg";

export function AuthView({ onLogin }: { onLogin: (user: string) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMoved, setIsMoved] = useState(false);

  // Mouse interactive lighting
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      setIsMoved(true);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Set up randomized ascending sparks
  const sparks = Array.from({ length: 25 }).map((_, i) => {
    const randomVal = Math.sin(i * 91) * 41; // pseudo-random deterministic
    const randomVal2 = Math.cos(i * 13) * 19;
    return {
      id: i,
      size: Math.abs(randomVal % 4) + 2, // 2px to 6px
      left: Math.abs((randomVal * 123) % 100), // percentage from left
      delay: Math.abs(randomVal2 % 8), // animation delay in seconds
      duration: Math.abs((randomVal * 17) % 8) + 8, // 8s to 16s
      sway: (randomVal2 % 40), // horizontal offset path
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
        } else if (data.session) {
          onLogin(data.session.user.email || email);
        } else {
          setInfo("Conta criada! Verifique seu e-mail para confirmar o acesso antes de entrar.");
          setMode("login");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
        } else if (data.session) {
          onLogin(data.session.user.email || email);
        }
      }
    } catch (err) {
      setError("Erro de conexão com o Supabase. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#070707] relative overflow-hidden font-sans">
      
      {/* 0. Background Wallpaper image with subtle slow-motion zoom and parallax blur */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.img
          src={loginBg}
          alt="Altar de Adoração Kadosh Background"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover origin-center opacity-30 brightness-[0.35]"
          animate={{
            scale: [1.02, 1.07, 1.02],
            rotate: [0, 0.3, -0.3, 0],
          }}
          transition={{
            duration: 40,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Soft dark overlays to keep high contrast for login readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-[#070707]/30" />
        <div 
          className="absolute inset-0" 
          style={{ background: "radial-gradient(circle at 45% 50%, transparent 20%, #070707 88%)" }} 
        />
      </div>

      {/* 1. Structural Grid Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #CC5A0D 1px, transparent 1px),
            linear-gradient(to bottom, #CC5A0D 1px, transparent 1px)
          `,
          backgroundSize: "45px 45px",
        }}
      />

      {/* 2. Interactive Cursor Halo spotlight */}
      {isMoved && (
        <motion.div
          className="absolute pointer-events-none rounded-full blur-[130px] opacity-35"
          style={{
            width: "550px",
            height: "550px",
            background: "radial-gradient(circle, rgba(204,90,13,0.22) 0%, rgba(231,193,154,0.04) 50%, rgba(0,0,0,0) 70%)",
            top: 0,
            left: 0,
          }}
          animate={{
            x: mousePosition.x - 275,
            y: mousePosition.y - 275,
          }}
          transition={{ type: "spring", damping: 35, stiffness: 60, mass: 0.9 }}
        />
      )}

      {/* 3. Mystical Swirling Orbs (Ambient Light Clusters) */}
      {/* Orb A: Flame orange, top-left */}
      <motion.div
        className="absolute pointer-events-none rounded-full blur-[140px]"
        style={{
          width: "500px",
          height: "500px",
          background: "radial-gradient(circle, rgba(204,90,13,0.18) 0%, rgba(0,0,0,0) 70%)",
          top: "-5%",
          left: "-5%",
        }}
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 30, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Orb B: Royal gold, bottom-right */}
      <motion.div
        className="absolute pointer-events-none rounded-full blur-[160px]"
        style={{
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(231,193,154,0.14) 0%, rgba(0,0,0,0) 70%)",
          bottom: "-10%",
          right: "-10%",
        }}
        animate={{
          x: [0, -60, 40, 0],
          y: [0, 40, -40, 0],
          scale: [1, 0.92, 1.12, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Orb C: Deep crimson/maroon center glow */}
      <motion.div
        className="absolute pointer-events-none rounded-full blur-[180px]"
        style={{
          width: "450px",
          height: "450px",
          background: "radial-gradient(circle, rgba(158,42,43,0.14) 0%, rgba(0,0,0,0) 70%)",
          top: "40%",
          left: "30%",
        }}
        animate={{
          x: [0, 30, -40, 0],
          y: [0, 30, 40, 0],
          scale: [0.95, 1.1, 0.95, 0.95],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* 4. Elegant Celestial Orbit Ring behind the login card */}
      <motion.div
        className="absolute pointer-events-none rounded-full border border-dashed border-[#CC5A0D]/12"
        style={{
          width: "580px",
          height: "580px",
          top: "calc(50% - 290px)",
          left: "calc(50% - 290px)",
        }}
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 150,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      <motion.div
        className="absolute pointer-events-none rounded-full border border-[#E7C19A]/6"
        style={{
          width: "630px",
          height: "630px",
          top: "calc(50% - 315px)",
          left: "calc(50% - 315px)",
        }}
        animate={{
          rotate: [360, 0],
        }}
        transition={{
          duration: 220,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* 5. Ascending Holy Sparks (Flame Embers) */}
      <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden pointer-events-none">
        {sparks.map((spark) => (
          <motion.div
            key={spark.id}
            className="absolute bottom-0 rounded-full bg-gradient-to-t from-[#CC5A0D] to-[#E7C19A] pointer-events-none"
            style={{
              width: spark.size,
              height: spark.size,
              left: `${spark.left}%`,
              boxShadow: "0 0 6px rgba(204,90,13,0.8), 0 0 10px rgba(231,193,154,0.4)",
            }}
            animate={{
              y: [20, -1100],
              x: [0, spark.sway * 0.4, spark.sway],
              opacity: [0, 0.6, 0.35, 0],
              scale: [0.7, 1.15, 0.9, 0.4],
            }}
            transition={{
              duration: spark.duration,
              repeat: Infinity,
              delay: spark.delay,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* 6. Main Login Glassmorphism Card */}
      <motion.div 
        id="login-card"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md bg-[#161616]/80 backdrop-blur-xl rounded-3xl border border-[#E7C19A]/15 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.85),_0_0_30px_rgba(204,90,13,0.12)] relative z-10 p-8 flex flex-col md:p-10 hover:border-[#CC5A0D]/25 transition-all duration-500 group"
      >
        
        {/* Glowing Decorative Thin Line */}
        <div className="w-16 h-1 bg-gradient-to-r from-[#CC5A0D] to-[#E7C19A] mb-8 rounded-full shadow-[0_0_12px_rgba(204,90,13,0.5)]"></div>

        <div className="text-left mb-8">
          <KadoshLogo showText={true} />
          <h2 className="text-xl font-display font-light text-gray-400 mt-6 tracking-wide italic">
             Acesso à <span className="font-bold text-[#F5F5F5] not-italic">Governança</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {mode === "login"
              ? "Entre com sua conta para gerenciar escalas e ativar a inteligência Kadosh AI."
              : "Crie sua conta de coordenador para acessar o Kadosh Manager."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono">
              {error}
            </div>
          )}
          {info && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-mono">
              {info}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 focus-within:text-[#CC5A0D] transition-colors" size={16} />
              <input
                id="login-username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coordenador@kadosh.com"
                className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-[#CC5A0D] text-white tracking-wide placeholder-gray-600 transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 focus-within:text-[#CC5A0D] transition-colors" size={16} />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Insira sua senha"
                minLength={6}
                className="w-full pl-10 pr-10 py-3 bg-black/60 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-[#CC5A0D] text-white tracking-wide font-mono placeholder-gray-600 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#E7C19A] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="login-btn-submit"
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white font-bold text-xs uppercase tracking-widest hover:brightness-105 active:scale-[0.98] transition-all shadow-lg hover:shadow-[#CC5A0D]/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles size={14} /> {submitting ? "Processando..." : mode === "login" ? "Ativar Painel de Gestão" : "Criar Conta"}
          </button>

          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }}
            className="w-full text-center text-[10px] text-gray-500 hover:text-[#E7C19A] uppercase tracking-wider font-mono transition-colors"
          >
            {mode === "login" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </form>

        <div className="border-t border-[#CC5A0D]/5 group-hover:border-[#CC5A0D]/10 mt-8 pt-6 text-center text-[10px] text-gray-500 font-mono tracking-wider uppercase transition-colors">
          Kadosh Manager • Adoração com Excelência e Zelo
        </div>
      </motion.div>
    </div>
  );
}
