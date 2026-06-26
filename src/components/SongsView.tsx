import React, { useState, useEffect } from "react";
import { Plus, Search, Sparkles, Filter, Music, ArrowRight, BookOpen, Clock, RefreshCw, ExternalLink, Flame, Link2, Heart, Smile, Activity, Check } from "lucide-react";
import { Song, AISuggestedSong } from "../types";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }
  }
};

export function SongsView() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTheme, setFilterTheme] = useState("todos");
  const [filterTone, setFilterTone] = useState("todos");
  const [filterDifficulty, setFilterDifficulty] = useState("todos");

  // Add new manual song state
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [tone, setTone] = useState("G");
  const [bpm, setBpm] = useState(70);
  const [theme, setTheme] = useState("Adoração");
  const [link, setLink] = useState("");
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [difficulty, setDifficulty] = useState<"Fácil" | "Média" | "Difícil">("Média");
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Kadosh AI Sugerir Repertório State
  const [aiThemePrompt, setAiThemePrompt] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestedSong[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/songs");
      if (res.ok) {
        const data = await res.json();
        setSongs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleCreateSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) {
      setErrorMessage("Por favor, preencha Título e Autor.");
      return;
    }

    try {
      const res = await apiFetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          tone,
          bpm,
          theme,
          link,
          timeSignature,
          difficulty
        })
      });

      if (res.ok) {
        setShowAddForm(false);
        setTitle("");
        setAuthor("");
        setTone("G");
        setBpm(70);
        setTheme("Adoração");
        setLink("");
        setTimeSignature("4/4");
        setDifficulty("Média");
        setErrorMessage("");
        fetchSongs();
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Erro ao criar música.");
      }
    } catch (err) {
      setErrorMessage("Erro de rede.");
    }
  };

  const handleAskRepertoireSuggestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiThemePrompt.trim()) {
      setAiError("Por favor escreva o tema ou sentimento para que a IA sugira.");
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiSuggestions([]);

    try {
      const res = await apiFetch("/api/ai/suggest-repertoire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: aiThemePrompt })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.suggestions) {
          setAiSuggestions(data.suggestions);
        } else {
          setAiError("Retorno incompatível. Tente novamente.");
        }
      } else {
        setAiError("Falha ao comunicar com os servidores Kadosh AI.");
      }
    } catch (err) {
      setAiError("Erro na conexão ministerial.");
    } finally {
      setAiLoading(false);
    }
  };

  const addAiSongToRepertoire = async (aiSong: AISuggestedSong) => {
    try {
      const res = await apiFetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: aiSong.title,
          author: aiSong.author,
          tone: aiSong.idealTone,
          bpm: aiSong.bpm || 70,
          theme: aiSong.liturgicalMoment || "Adoração"
        })
      });

      if (res.ok) {
        alert(`Sucesso! "${aiSong.title}" foi acoplada ao repertório Kadosh.`);
        fetchSongs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const themesList = Array.from(new Set(songs.map(s => s.theme || "Geral")));
  const tonesList = Array.from(new Set(songs.map(s => s.tone || "G"))).sort();

  const filteredSongs = songs.filter(s => {
    const cleanSearch = search.trim().toLowerCase();
    const matchesSearch = !cleanSearch ||
                          s.title.toLowerCase().includes(cleanSearch) || 
                          s.author.toLowerCase().includes(cleanSearch) ||
                          s.tone.toLowerCase().includes(cleanSearch);
    const matchesTheme = filterTheme === "todos" || s.theme === filterTheme;
    const matchesTone = filterTone === "todos" || s.tone === filterTone;
    const matchesDifficulty = filterDifficulty === "todos" || (s.difficulty || "Média") === filterDifficulty;
    return matchesSearch && matchesTheme && matchesTone && matchesDifficulty;
  });

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Editorial Header */}
      <motion.div 
        variants={itemVariants}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6"
      >
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#E7C19A]">Kadosh Manager</span>
          <h1 className="text-3xl font-display font-bold text-white mt-1">Repertório Musical e Hinário</h1>
          <p className="text-xs text-gray-400 mt-1">Acervo central de arranjos, BPM de ensaio e tonalidades oficiais.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#161616] text-[#E7C19A] border border-[#E7C19A]/20 hover:bg-[#202020] transition-all font-bold text-xs uppercase tracking-widest self-stretch sm:self-auto justify-center"
        >
          <Plus size={16} /> Cadastrar Nova Canção
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left or Main: Repertoire List */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-8 space-y-6"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#161616]/70 backdrop-blur-md border border-[#E7C19A]/15 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por título, artista ou tom (ex: G, C#m)..."
                  className="w-full pl-9 pr-4 py-2 bg-[#0A0A0A] border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-[#CC5A0D]"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter size={14} className="text-gray-500" />
                <select
                  value={filterTheme}
                  onChange={(e) => setFilterTheme(e.target.value)}
                  className="px-3 py-2 bg-[#0A0A0A] border border-white/5 rounded-lg text-xs text-gray-400 focus:outline-none focus:border-[#CC5A0D] flex-1 md:flex-none uppercase tracking-wide animate-fadeIn"
                >
                  <option value="todos">Todos os Gêneros</option>
                  {themesList.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Premium Animated Quick Filters panel */}
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="p-4 rounded-xl bg-[#161616]/40 border border-[#E7C19A]/10 space-y-3.5"
            >
              {/* Difficulty Panel */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 font-mono">Dificuldade:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterDifficulty("todos")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      filterDifficulty === "todos"
                        ? "bg-[#CC5A0D] text-white border border-[#CC5A0D]/50 shadow-md scale-105"
                        : "bg-[#0A0A0A] text-gray-400 border border-white/5 hover:text-white"
                    }`}
                  >
                    Todos
                  </button>
                  {["Fácil", "Média", "Difícil"].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setFilterDifficulty(diff)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                        filterDifficulty === diff
                          ? diff === "Fácil"
                            ? "bg-green-600 text-white border border-transparent shadow-md scale-105"
                            : diff === "Difícil"
                              ? "bg-red-600 text-white border border-transparent shadow-md scale-105"
                              : "bg-[#E7C19A] text-black border border-transparent shadow-md scale-105"
                          : "bg-[#0A0A0A] text-gray-400 border border-white/5 hover:text-white"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        diff === "Fácil"
                          ? "bg-green-300 animate-pulse"
                          : diff === "Difícil"
                            ? "bg-red-200 animate-pulse"
                            : "bg-amber-300 animate-pulse"
                      }`} />
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tonals Panel */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-3 border-t border-white/[0.03]">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 font-mono mt-1">Tom Oficial:</span>
                <div className="flex flex-wrap gap-1.5 max-w-xl">
                  <button
                    onClick={() => setFilterTone("todos")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono border uppercase transition-all cursor-pointer ${
                      filterTone === "todos"
                        ? "bg-[#CC5A0D]/20 text-[#CC5A0D] border-[#CC5A0D]/50 shadow-sm"
                        : "bg-[#101010] text-gray-400 border-white/5 hover:text-white hover:border-white/20"
                    }`}
                  >
                    Todos
                  </button>
                  {tonesList.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterTone(t)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono border transition-all cursor-pointer ${
                        filterTone === t
                          ? "bg-[#E7C19A] text-black border-transparent shadow-md scale-105"
                          : "bg-[#101010] text-gray-400 border-white/5 hover:text-white hover:border-white/20"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="bg-[#161616]/75 backdrop-blur-md border border-[#E7C19A]/15 overflow-hidden">
            <div className="hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] tracking-widest uppercase font-bold text-[#E7C19A] bg-[#0F0F0F]">
                    <th className="px-5 py-4">Música</th>
                    <th className="px-5 py-4">Origem / Artista</th>
                    <th className="px-5 py-4 text-center">Tom Oficial</th>
                    <th className="px-5 py-4 text-center">BPM do Ensaio</th>
                    <th className="px-5 py-4">Assunto Litúrgico</th>
                    <th className="px-5 py-4 text-center">Dificuldade</th>
                    <th className="px-5 py-4 text-center">Vezes Tocada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredSongs.map((s) => (
                    <motion.tr 
                      key={s.id} 
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{s.title}</span>
                          {s.link && (
                            <a
                              href={s.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded bg-[#CC5A0D]/15 text-[#CC5A0D] hover:bg-[#CC5A0D]/30 transition-all cursor-pointer"
                              title="Ver Link de Apoio (Slid/Cifra/Vídeo)"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-300">
                        {s.author}
                      </td>
                      <td className="px-5 py-4 text-center font-mono">
                        <span className="bg-[#CC5A0D]/10 text-[#CC5A0D] px-2.5 py-0.5 rounded font-bold text-xs font-mono">
                          {s.tone}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-gray-300">
                        <div className="flex flex-col items-center">
                          <span>{s.bpm} bpm</span>
                          {s.timeSignature && (
                            <span className="text-[10px] text-gray-500 font-medium">({s.timeSignature})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs bg-white/5 text-[#E7C19A] border border-white/5 px-2 py-0.5 rounded-full font-medium">
                          {s.theme}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          (s.difficulty || "Média") === "Fácil"
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : (s.difficulty || "Média") === "Difícil"
                              ? "bg-red-500/10 text-red-500 border border-red-500/20"
                              : "bg-[#E7C19A]/10 text-[#E7C19A] border border-[#E7C19A]/20"
                        }`}>
                          {s.difficulty || "Média"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-gray-400 font-bold">
                        {s.count}x
                      </td>
                    </motion.tr>
                  ))}
                  {filteredSongs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-xs text-gray-500 font-mono">
                        Nenhuma música encontrada neste tema ou filtro rápido.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View responsive List */}
            <div className="block md:hidden divide-y divide-white/5">
              {filteredSongs.map((s) => (
                <motion.div 
                  key={s.id} 
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 flex justify-between items-center bg-white/[0.01]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base leading-tight">{s.title}</h4>
                      {s.link && (
                        <a
                          href={s.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-[#CC5A0D]/15 text-[#CC5A0D]"
                        >
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{s.author} • <span className="text-[#E7C19A]">{s.theme}</span></p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="bg-[#CC5A0D]/15 text-[#CC5A0D] px-2 py-0.5 rounded text-xs font-mono font-bold border border-[#CC5A0D]/25 font-mono">
                      Tom: {s.tone}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      (s.difficulty || "Média") === "Fácil"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : (s.difficulty || "Média") === "Difícil"
                          ? "bg-red-500/10 text-red-500 border border-red-500/20"
                          : "bg-[#E7C19A]/10 text-[#E7C19A] border border-[#E7C19A]/20"
                    }`}>
                      {s.difficulty || "Média"}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {s.bpm} bpm {s.timeSignature ? `(${s.timeSignature})` : ""}
                    </span>
                  </div>
                </motion.div>
              ))}
              {filteredSongs.length === 0 && (
                <p className="p-8 text-center text-xs text-gray-500 font-mono">
                  Nenhuma música encontrada no repertório com estes filtros.
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right Side Column: Kadosh AI Sugerir Repertório */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-4 space-y-6"
        >
          <div className="bg-[#161616]/70 backdrop-blur-md border border-[#E7C19A]/20 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#CC5A0D]/10 blur-xl rounded-full pointer-events-none"></div>
            
            <div className="flex items-center gap-1.5 mb-4 border-b border-[#CC5A0D]/10 pb-3">
              <span className="p-1 px-2.5 rounded-full text-[10px] font-mono font-bold bg-[#CC5A0D]/15 text-[#CC5A0D]">Kadosh AI</span>
              <h2 className="text-sm font-display font-medium text-white uppercase tracking-wider">Sugerir Repertório Inteligente</h2>
            </div>
            
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Escreva o tema pastoral ou o sentimento estético que gostaria de evocar no culto. A Kadosh AI recomendará uma seleção inspirada.
            </p>

            <form onSubmit={handleAskRepertoireSuggestions} className="space-y-3 mb-6">
              <textarea
                id="ai-repertoire-input"
                rows={3}
                value={aiThemePrompt}
                onChange={(e) => setAiThemePrompt(e.target.value)}
                placeholder="Ex e.g. 'Restauração de casamentos sob o arre arrependimento sagrado e esperança'"
                className="w-full text-xs p-3 bg-black border border-white/5 rounded-xl text-white focus:outline-none focus:border-[#CC5A0D] placeholder-gray-600 resize-none"
                required
              />
              <button
                id="ai-repertoire-btn-suggest"
                type="submit"
                disabled={aiLoading}
                className="w-full py-2.5 bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white hover:opacity-90 font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                {aiLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Processando Revelação...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Recomendar Repertório
                  </>
                )}
              </button>
            </form>

            {aiError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-mono">
                {aiError}
              </div>
            )}

            {/* Suggestions list */}
            <div className="space-y-4">
              {aiSuggestions.map((sg, idx) => (
                <div key={idx} className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2 hover:border-[#CC5A0D]/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-white leading-tight">{sg.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">{sg.author}</p>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-[#E7C19A]/15 text-[#E7C19A] px-1.5 py-0.5 rounded">
                      Tom: {sg.idealTone}
                    </span>
                  </div>
                  
                  <div className="text-[10px] text-gray-500 italic bg-white/[0.02] p-1.5 rounded leading-normal">
                    &ldquo;{sg.spiritConnection}&rdquo;
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="text-[#CC5A0D] font-bold font-mono">Momento: {sg.liturgicalMoment || "Adoração"}</span>
                    <button
                      onClick={() => addAiSongToRepertoire(sg)}
                      className="text-[#E7C19A] hover:underline flex items-center gap-0.5 font-bold uppercase tracking-wide"
                    >
                      Adicionar ao Repertório <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Manual Creation Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#161616]/95 backdrop-blur-xl rounded-2xl border border-[#E7C19A]/25 overflow-hidden shadow-2xl p-6 md:p-8 relative my-8">
            <button 
              onClick={() => setShowAddForm(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 px-2 rounded font-mono text-[9px] font-bold bg-[#CC5A0D]/15 text-[#CC5A0D] uppercase tracking-wider">Acervo Geral</span>
              <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-[#E7C19A]">Biblioteca Histórica</span>
            </div>
            <h3 className="text-xl font-display font-semibold text-white mt-1 mb-6">Fichar Nova Música</h3>

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-mono">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateSong} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* COLUNA ESQUERDA: Identidade & Metadados */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-[#E7C19A] tracking-wider border-b border-white/[0.05] pb-2 mb-4 flex items-center gap-1.5">
                      <Music size={12} className="text-[#CC5A0D]" /> Identificação Geral
                    </h4>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Título da Música</label>
                        <input
                          id="song-form-title"
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Ex: Teu Santo Nome"
                          className="w-full px-3.5 py-2.5 bg-[#000] border border-white/5 focus:border-[#CC5A0D] focus:shadow-[0_0_10px_rgba(204,90,13,0.1)] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none transition-all"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Artistas / Ministérios Comuns</label>
                        <input
                          id="song-form-author"
                          type="text"
                          value={author}
                          onChange={(e) => setAuthor(e.target.value)}
                          placeholder="Ex: Gabriela Rocha"
                          className="w-full px-3.5 py-2.5 bg-[#000] border border-white/5 focus:border-[#CC5A0D] focus:shadow-[0_0_10px_rgba(204,90,13,0.1)] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none transition-all"
                          required
                        />
                        {/* Chips com Artistas Frequentes */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {["Gabriela Rocha", "Fernandinho", "Casa Worship", "Morada", "Alessandro V.", "Hillsong"].map(artist => (
                            <button
                              key={artist}
                              type="button"
                              onClick={() => setAuthor(artist === "Alessandro V." ? "Alessandro Vilas Boas" : artist)}
                              className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${
                                author === artist || (artist === "Alessandro V." && author === "Alessandro Vilas Boas")
                                  ? "bg-[#CC5A0D]/20 text-[#CC5A0D] border border-[#CC5A0D]/30"
                                  : "bg-white/5 text-gray-400 border border-white/5 hover:text-white"
                              }`}
                            >
                              {artist}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block flex items-center justify-between">
                          <span>Link de Apoio</span>
                          <span className="text-[8px] text-gray-500 font-mono normal-case">Dica: Cifra Club ou YouTube</span>
                        </label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                          <input
                            type="url"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full pl-9 pr-3.5 py-2.5 bg-[#000] border border-white/5 focus:border-[#CC5A0D] rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Compasso Rítmico</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {["4/4", "3/4", "6/8", "12/8"].map(sig => (
                            <button
                              key={sig}
                              type="button"
                              onClick={() => setTimeSignature(sig)}
                              className={`py-1.5 rounded-lg font-mono text-[10px] font-bold border transition-all ${
                                timeSignature === sig
                                  ? "bg-[#E7C19A]/10 text-[#E7C19A] border-[#E7C19A]/30 shadow-inner"
                                  : "bg-black border-white/5 text-gray-400 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              {sig}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUNA DIREITA: Harmonia (Tom) & Rítmica (BPM) */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-[#E7C19A] tracking-wider border-b border-white/[0.05] pb-2 mb-4 flex items-center gap-1.5">
                      <Activity size={12} className="text-[#CC5A0D]" /> Harmonia & Rítmica Kadosh
                    </h4>

                    <div className="space-y-4">
                      {/* Tonalidade */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Tom Altar Oficial</label>
                          <span className="text-[9px] font-mono text-[#CC5A0D] font-bold">Tom selecionado: {tone}</span>
                        </div>
                        <input
                          id="song-form-tone"
                          type="text"
                          value={tone}
                          onChange={(e) => setTone(e.target.value)}
                          placeholder="Ex: G"
                          className="w-full px-3.5 py-2 bg-[#000] border border-white/5 focus:border-[#CC5A0D] rounded-xl text-xs text-center font-mono font-bold text-[#E7C19A] focus:outline-none transition-all uppercase"
                          required
                        />

                        {/* Tone Selector Wizard */}
                        <div className="p-2.5 bg-[#0A0A0A]/80 border border-white/5 rounded-xl space-y-2 mt-1.5">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-gray-500 font-mono block">Assistente de Tonalidades:</span>
                          
                          {/* Notas Base */}
                          <div className="grid grid-cols-7 gap-1">
                            {["C", "D", "E", "F", "G", "A", "B"].map(n => {
                              const match = tone.match(/^([A-G])/);
                              const isSel = match && match[1] === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => {
                                    // parse components
                                    let acc = "";
                                    let mode = "";
                                    const m = tone.match(/^([A-G])(#|b)?(m)?/);
                                    if (m) {
                                      acc = m[2] || "";
                                      mode = m[3] || "";
                                    }
                                    setTone(`${n}${acc}${mode}`);
                                  }}
                                  className={`py-1 rounded text-[10px] font-bold font-mono transition-all ${
                                    isSel
                                      ? "bg-[#CC5A0D] text-white"
                                      : "bg-white/5 text-gray-400 hover:text-white"
                                  }`}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>

                          {/* Acidentes e Modos */}
                          <div className="grid grid-cols-5 gap-1 pt-1 border-t border-white/[0.03]">
                            {/* Acidentes */}
                            {["none", "#", "b"].map(accVal => {
                              const match = tone.match(/^([A-G])(#|b)?(m)?/);
                              const activeAcc = (match && match[2]) || "";
                              const isSel = (accVal === "none" && activeAcc === "") || (accVal === activeAcc);
                              return (
                                <button
                                  key={accVal}
                                  type="button"
                                  onClick={() => {
                                    let pitch = "C";
                                    let mode = "";
                                    const m = tone.match(/^([A-G])(#|b)?(m)?/);
                                    if (m) {
                                      pitch = m[1];
                                      mode = m[3] || "";
                                    }
                                    setTone(`${pitch}${accVal === "none" ? "" : accVal}${mode}`);
                                  }}
                                  className={`py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                                    isSel
                                      ? "bg-[#E7C19A] text-black"
                                      : "bg-white/5 text-gray-400 hover:text-white"
                                  }`}
                                >
                                  {accVal === "none" ? "Nat" : accVal}
                                </button>
                              );
                            })}
                            {/* Modos */}
                            {["Maior", "m"].map(mVal => {
                              const match = tone.match(/^([A-G])(#|b)?(m)?/);
                              const activeMode = (match && match[3]) || "";
                              const isSel = (mVal === "Maior" && activeMode === "") || (mVal === "m" && activeMode === "m");
                              return (
                                <button
                                  key={mVal}
                                  type="button"
                                  onClick={() => {
                                    let pitch = "C";
                                    let acc = "";
                                    const m = tone.match(/^([A-G])(#|b)?(m)?/);
                                    if (m) {
                                      pitch = m[1];
                                      acc = m[2] || "";
                                    }
                                    setTone(`${pitch}${acc}${mVal === "m" ? "m" : ""}`);
                                  }}
                                  className={`py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                                    isSel
                                      ? "bg-[#E7C19A]/30 text-[#E7C19A] border border-[#E7C19A]/40"
                                      : "bg-white/5 text-gray-400 hover:text-white"
                                  }`}
                                >
                                  {mVal === "m" ? "menor" : "Maior"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* BPM & Tap Tempo */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">BPM Sugerido</label>
                          <span className="text-[9px] font-mono text-gray-500">{bpm} batidas por minuto</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <input
                            id="song-form-bpm"
                            type="number"
                            value={bpm}
                            onChange={(e) => setBpm(Number(e.target.value))}
                            className="w-1/3 px-3.5 py-2.5 bg-[#000] border border-white/5 focus:border-[#CC5A0D] rounded-xl text-xs text-center font-mono font-bold text-white focus:outline-none"
                            min={40}
                            max={240}
                          />

                          {/* TAP TEMPO REAL BUTTON */}
                          <button
                            type="button"
                            onClick={() => {
                              const now = Date.now();
                              const newTapTimes = [...tapTimes, now].filter(t => now - t < 3000);
                              setTapTimes(newTapTimes);
                              if (newTapTimes.length > 1) {
                                const intervals = [];
                                for (let i = 1; i < newTapTimes.length; i++) {
                                  intervals.push(newTapTimes[i] - newTapTimes[i - 1]);
                                }
                                const avgInterval = intervals.reduce((sum, item) => sum + item, 0) / intervals.length;
                                const computedBpm = Math.round(60000 / avgInterval);
                                if (computedBpm >= 40 && computedBpm <= 240) {
                                  setBpm(computedBpm);
                                }
                              }
                            }}
                            className="flex-1 px-3.5 bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/15 active:scale-95 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 focus:outline-none"
                          >
                            <Activity size={12} className="text-[#CC5A0D] animate-pulse" /> Tap Tempo
                          </button>
                        </div>

                        {/* BPM Presets */}
                        <div className="flex justify-between gap-1 mt-1.5">
                          {[
                            { label: "Lento", val: 62 },
                            { label: "Adoração", val: 72 },
                            { label: "Moderado", val: 85 },
                            { label: "Rápido", val: 115 }
                          ].map(preset => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setBpm(preset.val)}
                              className={`flex-1 py-1 rounded text-[9px] font-mono transition-all font-medium ${
                                bpm === preset.val
                                  ? "bg-[#CC5A0D]/20 text-[#CC5A0D] border border-[#CC5A0D]/30"
                                  : "bg-white/5 text-gray-500 border border-white/5 hover:text-white hover:bg-white/10"
                              }`}
                            >
                              {preset.label} ({preset.val})
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Difficulty Selection */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Nível de Dificuldade</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {["Fácil", "Média", "Difícil"].map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setDifficulty(level as "Fácil" | "Média" | "Difícil")}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                difficulty === level
                                  ? level === "Fácil"
                                    ? "bg-green-500/15 border-green-500/40 text-green-400"
                                    : level === "Difícil"
                                      ? "bg-red-500/15 border-red-500/40 text-red-500"
                                      : "bg-[#E7C19A]/15 border-[#E7C19A]/40 text-[#E7C19A]"
                                  : "bg-black border-white/5 text-gray-500 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tópico Assunto Litúrgico (Visual Selection Cards) */}
              <div className="space-y-2 pt-4 border-t border-white/5">
                <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block mb-2">Tópico Assunto Litúrgico (Momento de Culto)</label>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { val: "Abertura", name: "Abertura", desc: "Celebração alegre", icon: Smile },
                    { val: "Adoração", name: "Adoração", desc: "Clamor íntimo/profundo", icon: Heart },
                    { val: "Espírito Santo", name: "Avivamento", desc: "Clamor do mover e fogo", icon: Flame },
                    { val: "Restauração", name: "Restauração", desc: "Cura, Ceia ou Palavra", icon: BookOpen },
                    { val: "Agradecimento", name: "Agradecimento", desc: "Graças e Louvor Geral", icon: Check }
                  ].map(item => {
                    const isSel = theme === item.val;
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setTheme(item.val)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSel
                            ? "bg-[#CC5A0D]/10 border-[#CC5A0D] shadow-[0_0_15px_rgba(204,90,13,0.15)] text-[#CC5A0D]"
                            : "bg-black/30 border-white/15 text-gray-400 hover:border-white/35 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <IconComp size={14} className={isSel ? "text-[#CC5A0D]" : "text-gray-500"} />
                          <span className="text-[11px] font-bold tracking-wide">{item.name}</span>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-1 font-mono leading-tight">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/[0.05] hover:text-white text-xs font-bold uppercase tracking-wider text-gray-400 transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] hover:opacity-90 active:scale-95 text-white font-bold text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(204,90,13,0.3)] transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Fichar Canção Kadosh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
const X = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
