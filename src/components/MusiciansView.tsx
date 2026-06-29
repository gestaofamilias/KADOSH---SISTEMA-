import React, { useState, useEffect, useRef } from "react";
import { Plus, Edit2, CheckCircle2, XCircle, Search, Save, X, Award, Eye, UserCheck, User, Music, Mic, Check, Sliders, MonitorPlay, Phone, Camera, Loader2, Cake } from "lucide-react";
import { Musician, getMusicianAvatar } from "../types";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { resizeImageFile } from "../lib/imageResize";

const ALL_ROLES: Musician["role"][] = ["Vocal", "Instrumento", "Técnico de som", "Datashow"];
const PHOTOS_BUCKET = "musician-photos";

const vocalSuggestions = [
  "Soprano", "Contralto", "Tenor", "Soprano (Principal)", "Contralto (Principal)", "Tenor (Principal)", "Baixo", "Ministro de Louvor"
];

const instrumentSuggestions = [
  "Teclado", "Bateria", "Contrabaixo", "Guitarra", "Violão", "Saxofone", "Flauta", "Violino", "Percussão"
];

const soundTechSuggestions = ["Mesa de Som", "Monitor", "P.A.", "Operador de Som"];

const datashowSuggestions = ["Projeção de Slides", "Datashow", "Letras", "Transmissão"];

function suggestionsForRole(role: Musician["role"]) {
  if (role === "Vocal") return vocalSuggestions;
  if (role === "Instrumento") return instrumentSuggestions;
  if (role === "Técnico de som") return soundTechSuggestions;
  return datashowSuggestions;
}

function roleBadgeClass(role: Musician["role"]) {
  if (role === "Vocal") return "bg-[#CC5A0D]/10 text-[#CC5A0D]";
  if (role === "Instrumento") return "bg-[#E7C19A]/10 text-[#E7C19A]";
  if (role === "Técnico de som") return "bg-blue-500/10 text-blue-400";
  return "bg-emerald-500/10 text-emerald-400";
}

export function MusiciansView() {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("todos");
  const [filterInstrument, setFilterInstrument] = useState<string>("todos");
  
  // Create / Edit Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Musician["role"]>("Vocal");
  const [instrument, setInstrument] = useState("");
  const [active, setActive] = useState(true);
  const [gender, setGender] = useState<"M" | "F">("M");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState("");
  const [birthday, setBirthday] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [secondaryRoles, setSecondaryRoles] = useState<Musician["role"][]>([]);
  const [secondaryInstrument, setSecondaryInstrument] = useState("");
  const [otherInstruments, setOtherInstruments] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMusicians = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/musicians");
      if (res.ok) {
        const data = await res.json();
        setMusicians(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMusicians();
  }, []);

  const handleOpenCreate = () => {
    setEditId(null);
    setName("");
    setRole("Vocal");
    setInstrument("Soprano");
    setActive(true);
    setGender("F");
    setPhone("");
    setPhoto("");
    setBirthday("");
    setSecondaryRoles([]);
    setSecondaryInstrument("");
    setOtherInstruments([]);
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleOpenEdit = (mus: Musician) => {
    setEditId(mus.id);
    setName(mus.name);
    setRole(mus.role);
    setInstrument(mus.instrument);
    setActive(mus.active);
    setGender(mus.gender || "M");
    setPhone(mus.phone || "");
    setPhoto(mus.photo || "");
    setBirthday(mus.birthday || "");
    setSecondaryRoles(mus.secondaryRoles || []);
    setSecondaryInstrument(mus.secondaryInstrument || "");
    setOtherInstruments(mus.otherInstruments || []);
    setErrorMessage("");
    setIsEditing(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage("");
    setUploadingPhoto(true);
    try {
      const resized = await resizeImageFile(file, 400, 0.82);
      const fileName = `${editId || "novo"}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(fileName, resized, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(fileName);
      setPhoto(data.publicUrl);
    } catch (err) {
      setErrorMessage(err instanceof Error ? `Erro ao enviar foto: ${err.message}` : "Erro ao enviar foto.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleSecondaryRole = (r: Musician["role"]) => {
    setSecondaryRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const toggleOtherInstrument = (item: string) => {
    setOtherInstruments(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instrument.trim()) {
      setErrorMessage("Por favor, preencha o Nome e a Voz / Instrumento.");
      return;
    }

    const payload = {
      name,
      role,
      instrument,
      active,
      gender,
      phone,
      photo,
      birthday,
      secondaryRoles,
      secondaryInstrument,
      otherInstruments
    };

    try {
      let res;
      if (editId) {
        res = await apiFetch(`/api/musicians/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch("/api/musicians", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setIsEditing(false);
        fetchMusicians();
      } else {
        const errorData = await res.json();
        setErrorMessage(errorData.error || "Ocorreu um erro ao salvar o integrante.");
      }
    } catch (err) {
      setErrorMessage("Erro de rede.");
    }
  };

  const toggleStatus = async (mus: Musician) => {
    try {
      const res = await apiFetch(`/api/musicians/${mus.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: !mus.active
        })
      });
      if (res.ok) {
        fetchMusicians();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const matchesRoleFilter = (role: Musician["role"]) =>
    filterRole === "todos" ||
    (filterRole === "tecnica" ? (role === "Técnico de som" || role === "Datashow") : role === filterRole);

  const instrumentsList = Array.from(
    new Set(
      musicians
        .filter(m => matchesRoleFilter(m.role))
        .map(m => m.instrument)
    )
  ).sort();

  const filteredMusicians = musicians.filter(mus => {
    const matchesSearch = mus.name.toLowerCase().includes(search.toLowerCase()) ||
                          mus.instrument.toLowerCase().includes(search.toLowerCase());
    const matchesRole = matchesRoleFilter(mus.role);
    const matchesInstrument = filterInstrument === "todos" || mus.instrument === filterInstrument;
    return matchesSearch && matchesRole && matchesInstrument;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#E7C19A]">Kadosh Manager</span>
          <h1 className="text-3xl font-display font-bold text-white mt-1">Gestão de Membros e Escalas</h1>
          <p className="text-xs text-gray-400 mt-1">Gerencie a escala e os níveis de revezamento dos músicos.</p>
        </div>
        <button
          id="musicians-btn-add"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white hover:opacity-90 font-bold text-xs uppercase tracking-widest transition-all shadow-md self-stretch sm:self-auto justify-center"
        >
          <Plus size={16} /> Novo Integrante
        </button>
      </div>

      {/* Grid Dashboard Stats mini */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#161616]/70 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15">
          <span className="text-[9px] font-bold uppercase text-gray-500 tracking-wider font-mono">Total no Elenco</span>
          <p className="text-2xl font-bold mt-1 text-white">{musicians.length}</p>
        </div>
        <div className="bg-[#161616]/70 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15">
          <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wider font-mono">Vocais Ativos</span>
          <p className="text-2xl font-bold mt-1 text-[#E7C19A]">{musicians.filter(m => m.role === "Vocal" && m.active).length}</p>
        </div>
        <div className="bg-[#161616]/70 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15">
          <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wider font-mono">Banda Ativa</span>
          <p className="text-2xl font-bold mt-1 text-[#CC5A0D]">{musicians.filter(m => m.role === "Instrumento" && m.active).length}</p>
        </div>
        <div className="bg-[#161616]/70 backdrop-blur-md p-4 rounded-xl border border-[#E7C19A]/15">
          <span className="text-[9px] font-bold uppercase text-gray-500 tracking-wider font-mono">Afastados / Férias</span>
          <p className="text-2xl font-bold mt-1 text-red-400">{musicians.filter(m => !m.active).length}</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-[#161616]/70 backdrop-blur-md border border-[#E7C19A]/15 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Pesquisar por nome ou instrumento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#0A0A0A] border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-[#CC5A0D]"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                setFilterRole("todos");
                setFilterInstrument("todos");
              }}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all uppercase ${
                filterRole === "todos"
                  ? "bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/30"
                  : "bg-[#0A0A0A] text-gray-400 hover:text-white border border-transparent animate-fadeIn"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setFilterRole("Vocal");
                setFilterInstrument("todos");
              }}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all uppercase ${
                filterRole === "Vocal"
                  ? "bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/30"
                  : "bg-[#0A0A0A] text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              Vocais
            </button>
            <button
              onClick={() => {
                setFilterRole("Instrumento");
                setFilterInstrument("todos");
              }}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all uppercase ${
                filterRole === "Instrumento"
                  ? "bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/30"
                  : "bg-[#0A0A0A] text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              Instrumentos
            </button>
            <button
              onClick={() => {
                setFilterRole("tecnica");
                setFilterInstrument("todos");
              }}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all uppercase ${
                filterRole === "tecnica"
                  ? "bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/30"
                  : "bg-[#0A0A0A] text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              Técnica
            </button>
          </div>
        </div>

        {/* Premium Animated Quick Filters panel for Instruments/Voices */}
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 rounded-xl bg-[#161616]/40 border border-[#E7C19A]/10 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 font-mono mt-1">
              Filtro por {filterRole === "todos" ? "Voz/Instrumento" : filterRole === "Vocal" ? "Naipe de Voz" : "Instrumento"}:
            </span>
            <div className="flex flex-wrap gap-1.5 max-w-2xl">
              <button
                onClick={() => setFilterInstrument("todos")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono border uppercase transition-all cursor-pointer ${
                  filterInstrument === "todos"
                    ? "bg-[#CC5A0D]/20 text-[#CC5A0D] border-[#CC5A0D]/50 shadow-sm"
                    : "bg-[#101010] text-gray-400 border-white/5 hover:text-white hover:border-white/20"
                }`}
              >
                Todos
              </button>
              {instrumentsList.map((inst) => (
                <button
                  key={inst}
                  onClick={() => setFilterInstrument(inst)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono border transition-all cursor-pointer ${
                    filterInstrument === inst
                      ? "bg-[#E7C19A] text-black border-transparent shadow-md scale-105"
                      : "bg-[#101010] text-gray-400 border-white/5 hover:text-white hover:border-white/20"
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 font-mono text-sm">
          Acarretando banco de adoradores...
        </div>
      ) : (
        <div className="bg-[#161616]/75 backdrop-blur-md border border-[#E7C19A]/15 overflow-hidden shadow-lg">
          {/* Mobile responsive cards list / Desktop tables */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] tracking-widest uppercase font-bold text-[#E7C19A] bg-[#0F0F0F]">
                  <th className="px-6 py-4">Membro</th>
                  <th className="px-6 py-4">Função Kadosh</th>
                  <th className="px-6 py-4">Voz / Instrumento</th>
                  <th className="px-6 py-4">Telefone</th>
                  <th className="px-6 py-4">Gênero</th>
                  <th className="px-6 py-4 text-center">Frequência Semanal</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredMusicians.map((mus) => (
                  <tr key={mus.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={mus.photo || getMusicianAvatar(mus.name, mus.gender || "M")}
                          alt={mus.name}
                          className="w-9 h-9 rounded-full object-cover border border-[#E7C19A]/25"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="font-semibold text-white">{mus.name}</div>
                          <div className="text-[9px] text-gray-500 font-mono tracking-wider uppercase">Ministério Kadosh</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${roleBadgeClass(mus.role)}`}>
                          {mus.role}
                        </span>
                        {(mus.secondaryRoles || []).map(r => (
                          <span key={r} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider opacity-70 ${roleBadgeClass(r)}`}>
                            +{r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-300">
                      {mus.instrument}
                      {(mus.otherInstruments || []).length > 0 && (
                        <div className="text-[9px] text-gray-500 mt-0.5">+ {mus.otherInstruments!.join(", ")}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      {mus.phone || "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      {mus.gender || "M"}
                    </td>
                    <td className="px-6 py-4 text-center font-mono">
                      <div className="inline-flex items-center gap-1 bg-[#0A0A0A] px-2.5 py-1 rounded text-[#E7C19A] text-xs border border-white/5">
                        <Award size={12} className="text-[#CC5A0D]" /> {mus.scaleCount} escalas
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(mus)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                          mus.active 
                            ? "bg-green-500/15 text-green-400 border border-green-500/30" 
                            : "bg-red-500/15 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {mus.active ? (
                          <>
                            <CheckCircle2 size={12} /> Ativo
                          </>
                        ) : (
                          <>
                            <XCircle size={12} /> Afastado
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(mus)}
                        className="p-2 bg-[#0A0A0A] border border-white/5 hover:border-[#CC5A0D] text-gray-400 hover:text-white rounded-lg transition-all"
                        title="Editar Membro"
                      >
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredMusicians.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-xs text-gray-500 font-mono">
                      Nenhum integrante encontrado nesta busca ministerial.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards list for mobile-first */}
          <div className="block md:hidden divide-y divide-white/5">
            {filteredMusicians.map((mus) => (
              <div key={mus.id} className="p-4 space-y-3 hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <img
                      src={mus.photo || getMusicianAvatar(mus.name, mus.gender || "M")}
                      alt={mus.name}
                      className="w-10 h-10 rounded-full object-cover border border-[#E7C19A]/25"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="font-bold text-white text-base">{mus.name}</h4>
                      <span className="text-[10px] text-gray-400 font-mono block">{mus.instrument} • {mus.gender || "M"}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleStatus(mus)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all ${
                      mus.active 
                        ? "bg-green-500/15 text-green-400 border border-green-500/30" 
                        : "bg-red-500/15 text-red-500 border border-red-500/30"
                    }`}
                  >
                    {mus.active ? "Ativo" : "Afastado"}
                  </button>
                </div>

                <div className="flex justify-between items-center bg-[#0A0A0A] p-2.5 rounded-xl border border-white/5 text-xs">
                  <span className="text-gray-400">Função: <strong className="text-white">{mus.role}</strong></span>
                  <span className="flex items-center gap-1 font-mono text-[#E7C19A] bg-[#CC5A0D]/10 px-2 py-0.5 rounded font-bold">
                    <Award size={10} /> {mus.scaleCount} escalas
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-white/[0.02]">
                  <button
                    onClick={() => handleOpenEdit(mus)}
                    className="px-4 py-2 bg-[#0A0A0A] border border-white/5 text-[#E7C19A] text-xs font-semibold rounded-lg flex items-center gap-1"
                  >
                    <Edit2 size={12} /> Editar Dados
                  </button>
                </div>
              </div>
            ))}
            {filteredMusicians.length === 0 && (
              <p className="p-8 text-center text-xs text-gray-500 font-mono">
                Nenhum integrante encontrado nesta busca ministerial.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Slide-over or Modal Edit Form */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#111111]/95 backdrop-blur-2xl rounded-2xl border border-[#E7C19A]/30 shadow-2xl p-6 md:p-8 relative my-4 sm:my-8"
          >
            <button 
              onClick={() => setIsEditing(false)}
              className="absolute right-5 top-5 p-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Fechar"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 px-2 rounded font-mono text-[9px] font-bold bg-[#CC5A0D]/15 text-[#CC5A0D] uppercase tracking-wider">
                {editId ? "Modificação" : "Admissão Célula Altar"}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-gray-400">Ficha de Integrante</span>
            </div>
            
            <h3 className="text-2xl font-display font-semibold text-white mt-1 mb-6">
              {editId ? "Alterar Dados do Integrante" : "Cadastrar Novo Integrante"}
            </h3>

            {errorMessage && (
              <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">

              {/* Foto do Integrante */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <img
                    src={photo || getMusicianAvatar(name || "?", gender)}
                    alt="Foto do integrante"
                    className="w-16 h-16 rounded-full object-cover border border-[#E7C19A]/25"
                    referrerPolicy="no-referrer"
                  />
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                      <Loader2 size={18} className="text-[#CC5A0D] animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    id="mus-form-photo-input"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0A0A] border border-white/10 hover:border-[#CC5A0D] text-xs font-semibold text-gray-300 hover:text-white transition-all disabled:opacity-50"
                  >
                    <Camera size={13} /> {photo ? "Trocar Foto" : "Anexar Foto"}
                  </button>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => setPhoto("")}
                      className="block text-[10px] text-gray-500 hover:text-red-400"
                    >
                      Remover foto (usar avatar padrão)
                    </button>
                  )}
                </div>
              </div>

              {/* Nome Completo Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">Nome Completo</label>
                  {name.trim().length > 0 && name.trim().length < 3 && (
                    <span className="text-[10px] font-mono text-amber-500">Curto demais</span>
                  )}
                </div>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    id="mus-form-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Amanda Ferreira dos Santos"
                    className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 focus:border-[#CC5A0D] hover:border-white/20 rounded-xl text-sm focus:outline-none text-white transition-all shadow-inner focus:shadow-[0_0_15px_rgba(204,90,13,0.1)]"
                    required
                  />
                </div>
              </div>

              {/* Função Geral Segment Selector */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">Função no Altar</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "Vocal" as const, label: "Vocal / Voz", icon: Mic, defaultInstrument: "Soprano" },
                    { value: "Instrumento" as const, label: "Instrumentista", icon: Music, defaultInstrument: "Teclado" },
                    { value: "Técnico de som" as const, label: "Técnico de Som", icon: Sliders, defaultInstrument: "Mesa de Som" },
                    { value: "Datashow" as const, label: "Datashow", icon: MonitorPlay, defaultInstrument: "Projeção de Slides" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setRole(opt.value);
                        if (!suggestionsForRole(opt.value).includes(instrument)) {
                          setInstrument(opt.defaultInstrument);
                        }
                        setOtherInstruments([]);
                      }}
                      className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        role === opt.value
                          ? "bg-[#CC5A0D]/10 border-[#CC5A0D] text-white shadow-[0_0_15px_rgba(204,90,13,0.1)]"
                          : "bg-black/40 border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-200"
                      }`}
                    >
                      <opt.icon size={14} className={role === opt.value ? "text-[#CC5A0D]" : "text-gray-500"} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Funções Secundárias (pessoa que exerce mais de uma função) */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">
                  Funções Secundárias <span className="text-gray-500 font-normal">(opcional — ex: também canta, também toca)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.filter(r => r !== role).map((r) => {
                    const isSel = secondaryRoles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleSecondaryRole(r)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                          isSel
                            ? "bg-[#CC5A0D]/15 border-[#CC5A0D] text-[#E7C19A]"
                            : "bg-black/40 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
                        }`}
                      >
                        {isSel && <Check size={10} className="inline mr-1 -mt-0.5" />}
                        {r}
                      </button>
                    );
                  })}
                </div>
                {secondaryRoles.length > 0 && (
                  <div className="relative pt-1">
                    <input
                      id="mus-form-secondary-instrument"
                      type="text"
                      value={secondaryInstrument}
                      onChange={(e) => setSecondaryInstrument(e.target.value)}
                      placeholder={`Voz/instrumento quando escalado(a) como ${secondaryRoles.join(" ou ")} (ex: Violão, Tenor...)`}
                      className="w-full px-3.5 py-2.5 bg-black border border-white/10 focus:border-[#CC5A0D] hover:border-white/20 rounded-xl text-sm focus:outline-none text-white transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Telefone (WhatsApp) e Aniversário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">Telefone (WhatsApp)</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      id="mus-form-phone"
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: (11) 91234-5678"
                      className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 focus:border-[#CC5A0D] hover:border-white/20 rounded-xl text-sm focus:outline-none text-white transition-all shadow-inner focus:shadow-[0_0_15px_rgba(204,90,13,0.1)]"
                    />
                  </div>
                  <p className="text-[9px] text-gray-500">Usado para escalas via WhatsApp/n8n.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">Data de Aniversário</label>
                  <div className="relative">
                    <Cake className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      id="mus-form-birthday"
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 focus:border-[#CC5A0D] hover:border-white/20 rounded-xl text-sm focus:outline-none text-white transition-all shadow-inner focus:shadow-[0_0_15px_rgba(204,90,13,0.1)]"
                    />
                  </div>
                  <p className="text-[9px] text-gray-500">O sistema avisa no dia do aniversário.</p>
                </div>
              </div>

              {/* Gênero e Atrelado a sugestões */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Gênero Segment Select */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">Gênero</label>
                  <div className="flex bg-black p-1 rounded-xl border border-white/10 gap-1">
                    <button
                      type="button"
                      onClick={() => setGender("M")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        gender === "M"
                          ? "bg-white/10 text-white font-extrabold shadow-sm"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Masculino (M)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender("F")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        gender === "F"
                          ? "bg-white/10 text-white font-extrabold shadow-sm"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Feminino (F)
                    </button>
                  </div>
                </div>

                {/* Status Toggle Card instead of select element */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">Integração Escalas</label>
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? "bg-green-500/10 border-green-500/25 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.08)]"
                        : "bg-red-500/10 border-red-500/25 text-red-400"
                    }`}
                  >
                    <span className="pl-1 uppercase tracking-wider">{active ? "Ativo" : "Afastado / Pausa"}</span>
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                      active ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-red-500/15 border-red-500/30 text-red-400"
                    }`}>
                      {active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    </span>
                  </button>
                </div>

              </div>

              {/* Voz ou Instrumento Específico with suggestion chips */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">
                    {role === "Vocal" ? "Voz / Naipe de Canto" : role === "Instrumento" ? "Instrumento de Louvor" : role === "Técnico de som" ? "Função Técnica (Som)" : "Função Técnica (Datashow)"}
                  </label>
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">{instrument || "Padrão"}</span>
                </div>

                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    {role === "Vocal" ? <Mic size={14} /> : role === "Instrumento" ? <Music size={14} /> : role === "Técnico de som" ? <Sliders size={14} /> : <MonitorPlay size={14} />}
                  </div>
                  <input
                    id="mus-form-instrument"
                    type="text"
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                    placeholder={role === "Vocal" ? "Ex: Soprano, Contralto, Tenor" : role === "Instrumento" ? "Ex: Teclado, Bateria, Guitarra, Violão" : role === "Técnico de som" ? "Ex: Mesa de Som, Monitor" : "Ex: Projeção de Slides, Datashow"}
                    className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 focus:border-[#CC5A0D] hover:border-white/20 rounded-xl text-sm focus:outline-none text-white transition-all shadow-inner focus:shadow-[0_0_15px_rgba(204,90,13,0.1)]"
                    required
                  />
                </div>

                {/* SUGGESTION PILLS GROUP */}
                <div className="space-y-1 bg-black/30 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest block mb-1">Toque rápido para selecionar:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {suggestionsForRole(role).map((item) => {
                      const isSel = instrument.toLowerCase() === item.toLowerCase();
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setInstrument(item)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer border ${
                            isSel
                              ? "bg-[#CC5A0D]/20 border-[#CC5A0D] text-[#E7C19A] shadow-sm font-bold"
                              : "bg-[#0A0A0A] border-white/5 text-gray-400 hover:border-white/10 hover:text-white"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toca mais de um instrumento/função na MESMA categoria (ex: Teclado E Violão) */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] uppercase font-bold text-[#E7C19A] tracking-wider block">
                    Também toca/atua em <span className="text-gray-500 font-normal">(opcional — marque se essa pessoa se reveza em mais de um)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestionsForRole(role).filter(item => item.toLowerCase() !== instrument.toLowerCase()).map((item) => {
                      const isSel = otherInstruments.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleOtherInstrument(item)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer border ${
                            isSel
                              ? "bg-[#CC5A0D]/15 border-[#CC5A0D] text-[#E7C19A] font-bold"
                              : "bg-black/40 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
                          }`}
                        >
                          {isSel && <Check size={9} className="inline mr-1 -mt-0.5" />}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Informational guide card */}
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[10px] text-gray-500 leading-normal flex items-start gap-2.5">
                <span className="p-1 rounded bg-[#CC5A0D]/10 text-[#CC5A0D] mt-0.5"><Award size={10} /></span>
                <p>
                  Definir corretamente o gênero e o naipe assegura que a inteligência de escala da Kadosh equilibre a divisão vocal e a harmonia instrumental de cada altar sem redundâncias.
                </p>
              </div>

              {/* Actions Footer */}
              <div className="flex gap-3 pt-5 border-t border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/[0.05] text-xs font-bold uppercase tracking-wider text-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white font-bold text-xs uppercase tracking-widest hover:opacity-90 flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(204,90,13,0.2)] hover:shadow-[0_4px_24px_rgba(204,90,13,0.3)] transition-all"
                >
                  <Save size={14} /> Gravar Registro
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
