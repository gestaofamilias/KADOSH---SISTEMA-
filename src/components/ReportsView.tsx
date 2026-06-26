import React, { useState, useEffect } from "react";
import { FileText, Printer, Calendar, Users, Music, Award, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Schedule, Musician, Song } from "../types";
import { KadoshLogo } from "./KadoshLogo";
import { apiFetch } from "../lib/api";

export function ReportsView() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      const [schRes, musRes, songRes] = await Promise.all([
        apiFetch("/api/schedules"),
        apiFetch("/api/musicians"),
        apiFetch("/api/songs")
      ]);
      if (schRes.ok) setSchedules(await schRes.json());
      if (musRes.ok) setMusicians(await musRes.json());
      if (songRes.ok) setSongs(await songRes.json());
    } catch (err) {
      console.warn("Erro ao ler relatórios:", err);
    } finally {
      setLoading(false);
    }
  };

  // Find all unique months present in the schedules
  const getAvailableMonths = () => {
    const monthsMap = new Map<string, { year: number; month: number; label: string }>();
    schedules.forEach(s => {
      if (!s.date) return;
      const parts = s.date.split("-");
      if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const key = `${year}-${parts[1]}`;
        const dateObj = new Date(year, month - 1, 1);
        const label = dateObj.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        monthsMap.set(key, { year, month, label: label.charAt(0).toUpperCase() + label.slice(1) });
      }
    });

    const list = Array.from(monthsMap.values()).sort((a, b) => b.year - a.year || b.month - a.month);
    return list;
  };

  const availableMonths = getAvailableMonths();

  // Set the default selected month key on load if not set
  useEffect(() => {
    if (!selectedMonthKey && availableMonths.length > 0) {
      setSelectedMonthKey(`${availableMonths[0].year}-${availableMonths[0].month.toString().padStart(2, "0")}`);
    }
  }, [schedules, availableMonths, selectedMonthKey]);

  const filteredSchedules = schedules.filter(s => {
    if (!s.date) return false;
    const parts = s.date.split("-");
    const key = `${parts[0]}-${parts[1]}`;
    return key === selectedMonthKey;
  });

  const exportPDF = () => {
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const monthLabel = availableMonths.find(m => `${m.year}-${m.month.toString().padStart(2, "0")}` === selectedMonthKey)?.label || "Mês Selecionado";

      // Styling parameters
      const leftMargin = 15;
      const rightMargin = 195; // 210 - 15
      const contentWidth = 180;
      let currentY = 20;

      const checkNewPage = (neededHeight: number) => {
        if (currentY + neededHeight > 275) {
          doc.addPage();
          drawHeader(true);
          currentY = 40;
        }
      };

      const drawHeader = (isSubsequentPage = false) => {
        // Draw Kadosh Banner
        doc.setFillColor(22, 22, 22); // Deep charcoal
        doc.rect(leftMargin, isSubsequentPage ? 10 : 15, contentWidth, isSubsequentPage ? 18 : 28, "F");

        // Vertical Accent line in primary theme color (#CC5A0D)
        doc.setFillColor(204, 90, 13);
        doc.rect(leftMargin, isSubsequentPage ? 10 : 15, 3, isSubsequentPage ? 18 : 28, "F");

        // Text title
        doc.setTextColor(231, 193, 154); // Light beige (#E7C19A)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(isSubsequentPage ? 12 : 16);
        doc.text("KADOSH MUSIC MANAGER", leftMargin + 8, isSubsequentPage ? 17 : 24);

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(isSubsequentPage ? 8 : 10);
        doc.text(
          isSubsequentPage 
            ? `Relatório de Escala • ${monthLabel} • Folha Auxiliar`
            : "Gestão Litúrgica de Altar & Zelo Ministerial", 
          leftMargin + 8, 
          isSubsequentPage ? 23 : 31
        );

        if (!isSubsequentPage) {
          // Add subtitle with date below banner
          doc.setTextColor(110, 120, 135);
          doc.setFontSize(8);
          doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")} • Escala Consolidada`, leftMargin, 50);
          
          doc.setTextColor(22, 22, 22);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.text(`Calendário de Cultos e Escalas: ${monthLabel.toUpperCase()}`, leftMargin, 58);

          // Divider bar in orange
          doc.setDrawColor(204, 90, 13);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, 61, rightMargin, 61);
        }
      };

      // Draw original header
      drawHeader();
      currentY = 68;

      if (filteredSchedules.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(100, 110, 120);
        doc.text("Nenhuma escala agendada para o período selecionado.", leftMargin, currentY);
      } else {
        filteredSchedules.forEach((sch) => {
          const vocalsText = sch.vocals.map(v => `${v.name} (${v.instrument})`).join(", ") || "Nenhum escalado";
          const instrumentalistsText = sch.instrumentalists.map(i => `${i.name} (${i.instrument})`).join(", ") || "Nenhum escalado";
          
          const splitVocals = doc.splitTextToSize(vocalsText, contentWidth - 10);
          const splitInstruments = doc.splitTextToSize(instrumentalistsText, contentWidth - 10);
          
          const songsHeight = sch.songs.length * 6 + 10;
          const notesHeight = sch.notes ? doc.splitTextToSize(`Observações: ${sch.notes}`, contentWidth - 10).length * 5 + 5 : 0;
          const estimatedHeight = 25 + (splitVocals.length * 5) + (splitInstruments.length * 5) + songsHeight + notesHeight + 15;

          checkNewPage(estimatedHeight);

          // Draw Card Frame
          doc.setDrawColor(226, 232, 240); // Light slate border
          doc.setLineWidth(0.2);
          doc.setFillColor(248, 250, 252); // Very light slate background
          doc.rect(leftMargin, currentY, contentWidth, estimatedHeight - 5, "FD");

          // Draw minor left border accent in Orange
          doc.setFillColor(204, 90, 13);
          doc.rect(leftMargin, currentY, 1.5, estimatedHeight - 5, "F");

          // Header: Date & Status
          doc.setTextColor(204, 90, 13);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          
          let rawDate = sch.date;
          if (rawDate) {
            const dateParts = rawDate.split("-");
            if (dateParts.length === 3) {
              const d = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
              rawDate = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
            }
          }

          doc.text(`${rawDate} • ${sch.title}`, leftMargin + 5, currentY + 7);

          // Title/Theme of the Cult
          doc.setTextColor(74, 85, 104);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`Temática: ${sch.theme || "Livre"} | Coordenador: ${sch.coordinator}`, leftMargin + 5, currentY + 13);

          // Divider inside card
          doc.setDrawColor(241, 245, 249);
          doc.line(leftMargin + 5, currentY + 16, rightMargin - 5, currentY + 16);

          let innerY = currentY + 21;

          // Vocals list
          doc.setTextColor(26, 32, 44);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text("ALINHAMENTO DE VOCAL:", leftMargin + 5, innerY);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(45, 55, 72);
          doc.text(splitVocals, leftMargin + 5, innerY + 4.5);
          innerY += (splitVocals.length * 4.5) + 6;

          // Band list
          doc.setTextColor(26, 32, 44);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text("BANDA & RÍTMICA/HARMONIA:", leftMargin + 5, innerY);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(45, 55, 72);
          doc.text(splitInstruments, leftMargin + 5, innerY + 4.5);
          innerY += (splitInstruments.length * 4.5) + 6;

          // Songs list
          doc.setTextColor(26, 32, 44);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text("PLAYLIST LITÚRGICA:", leftMargin + 5, innerY);
          innerY += 4.5;

          if (sch.songs && sch.songs.length > 0) {
            sch.songs.forEach((s, sIdx) => {
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(241, 245, 249);
              doc.rect(leftMargin + 5, innerY - 3.5, contentWidth - 10, 5, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              doc.setTextColor(45, 55, 72);
              doc.text(`${sIdx + 1}. ${s.title}`, leftMargin + 7, innerY);

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              doc.setTextColor(204, 90, 13);
              doc.text(`Tom: ${s.tone}`, rightMargin - 22, innerY);

              innerY += 6;
            });
          } else {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(113, 128, 150);
            doc.text("Grade de repertório não definida.", leftMargin + 5, innerY);
            innerY += 6;
          }

          // Notes
          if (sch.notes) {
            innerY += 1.5;
            doc.setTextColor(26, 32, 44);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.text("DIRECIONAMENTO LITÚRGICO & ENSAIO:", leftMargin + 5, innerY);
            
            const splitNotes = doc.splitTextToSize(sch.notes, contentWidth - 10);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(74, 85, 104);
            doc.text(splitNotes, leftMargin + 5, innerY + 4);
            innerY += (splitNotes.length * 4) + 6;
          }

          currentY = innerY + 4;
        });
      }

      // Footer brand signature
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(leftMargin, 283, rightMargin, 283);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(160, 174, 192);
        doc.text("ZELE PELO ALTAR • EXCELÊNCIA LITÚRGICA • GRUPO KADOSH", leftMargin, 288);
        
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${pageCount}`, rightMargin - 18, 288);
      }

      doc.save(`escala-kadosh-${selectedMonthKey}.pdf`);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="text-center py-20 font-mono text-xs text-gray-500">
        Estruturando sumários de governança pastoral...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto pb-16">
      
      {/* Title & printer setup */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6 print:hidden">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#E7C19A]">Kadosh Manager Reports</span>
          <h1 className="text-3xl font-display font-bold text-white mt-1">Estatísticas e Relatórios de Altar</h1>
          <p className="text-xs text-gray-400 mt-1">Gere versões executivas impressas em PDF das escalas e catálogos.</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#161616] text-[#E7C19A] border border-[#E7C19A]/25 hover:bg-[#202020] transition-all font-bold text-xs uppercase tracking-widest self-stretch sm:self-auto justify-center"
        >
          <Printer size={16} /> Imprimir Relatório Geral
        </button>
      </div>

      {/* Month Selector and PDF Export Panel */}
      <div className="bg-[#161616]/70 backdrop-blur-md rounded-2xl border border-[#E7C19A]/15 p-5 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden animate-fadeIn">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Calendar className="text-[#E7C19A]" size={20} />
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Exportador de Escala Mensal</h3>
            <p className="text-[10px] text-gray-400">Gere e baixe relatórios PDF de escalas de qualquer mês.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto items-stretch sm:items-center">
          <select
            id="month-select"
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="px-3 py-2 bg-black border border-white/5 rounded-xl text-xs text-white uppercase font-bold tracking-wide focus:outline-none focus:border-[#CC5A0D]"
          >
            {availableMonths.map((m) => {
              const key = `${m.year}-${m.month.toString().padStart(2, "0")}`;
              return (
                <option key={key} value={key}>
                  {m.label}
                </option>
              );
            })}
          </select>
          <button
            id="btn-export-pdf"
            onClick={exportPDF}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#CC5A0D] to-[#e06b18] text-white hover:opacity-90 font-bold text-xs uppercase tracking-widest transition-all rounded-xl shadow-md cursor-pointer"
          >
            <FileText size={14} /> Exportar PDF da Escala
          </button>
        </div>
      </div>

      {/* Main printable report body */}
      <div className="bg-[#161616]/70 backdrop-blur-md rounded-3xl border border-[#E7C19A]/15 p-6 md:p-10 shadow-2xl space-y-12 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        
        {/* Header - Only visible on print or nicely matching inside the app */}
        <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:border-black/20">
          <div className="text-left">
            <KadoshLogo className="h-10" showText={true} />
            <p className="text-xs text-gray-400 mt-1 print:text-slate-600 font-mono">Gestão Inteligente de Louvor • Relatório Oficial Geral</p>
          </div>
          <div className="text-left md:text-right font-mono text-xs text-gray-500 print:text-slate-500">
            <p><strong>Emissão:</strong> {new Date().toLocaleDateString("pt-BR")}</p>
            <p><strong>Zelo Litúrgico:</strong> Grupo de Louvor Kadosh</p>
          </div>
        </div>

        {/* SECTION 1: MEMBERS SUMMARY */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#E7C19A] border-b border-white/5 pb-2 flex items-center gap-2 print:text-orange-700 print:border-black/10">
            <Users size={16} /> 1. Elenco de Ministros de Altar ({musicians.length} Cadastrados)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 text-xs">
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-mono block mb-1">Ministros de Voz (Vocalistas)</span>
              <ul className="space-y-1 bg-black/40 backdrop-blur-sm p-4 border border-[#E7C19A]/10 rounded-xl print:bg-slate-50 print:border-none print:text-slate-900">
                {musicians.filter(m => m.role === "Vocal").map(m => (
                  <li key={m.id} className="flex justify-between items-center py-1 border-b border-white/[0.03] print:border-black/5 last:border-none">
                    <span>{m.name} <strong className="text-gray-400 font-normal">({m.instrument})</strong></span>
                    <span className="font-mono text-gray-500 font-medium">{m.scaleCount} esc.</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-[10px] text-gray-500 uppercase font-mono block mb-1">Músicos da Banda (Instrumentos)</span>
              <ul className="space-y-1 bg-black/40 backdrop-blur-sm p-4 border border-[#E7C19A]/10 rounded-xl print:bg-slate-50 print:border-none print:text-slate-900">
                {musicians.filter(m => m.role === "Instrumento").map(m => (
                  <li key={m.id} className="flex justify-between items-center py-1 border-b border-white/[0.03] print:border-black/5 last:border-none">
                    <span>{m.name} <strong className="text-gray-400 font-normal">({m.instrument})</strong></span>
                    <span className="font-mono text-gray-500 font-medium">{m.scaleCount} esc.</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* SECTION 2: SONG HISTORY SUMMARY */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#E7C19A] border-b border-white/5 pb-2 flex items-center gap-2 print:text-orange-700 print:border-black/10">
            <Music size={16} /> 2. Inventário de Cânticos (Mais Ministrados)
          </h2>

          <div className="bg-[#0A0A0A]/55 backdrop-blur-sm rounded-2xl border border-[#E7C19A]/10 overflow-hidden print:bg-transparent print:border-collapse print:border-black/20">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0F0F0F] text-[#E7C19A] border-b border-white/5 font-bold uppercase tracking-wider print:bg-slate-100 print:text-slate-900 print:border-black/15">
                  <th className="px-4 py-3">Canção</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3 text-center">Tom</th>
                  <th className="px-4 py-3 text-center">BPM</th>
                  <th className="px-4 py-3">Gênero Litúrgico</th>
                  <th className="px-4 py-3 text-center">Execuções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-slate-200">
                {songs.slice(0, 7).map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.01] print:text-black">
                    <td className="px-4 py-3 font-semibold">{s.title}</td>
                    <td className="px-4 py-3 text-gray-400 print:text-slate-700">{s.author}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-[#CC5A0D] print:text-orange-800">{s.tone}</td>
                    <td className="px-4 py-3 text-center font-mono text-gray-400 print:text-slate-600">{s.bpm}</td>
                    <td className="px-4 py-3 text-gray-500 print:text-slate-600">{s.theme}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold">{s.count}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: RECENT AND COMING SCHEDULES */}
        <div className="space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#E7C19A] border-b border-white/5 pb-2 flex items-center gap-2 print:text-orange-700 print:border-black/10">
            <Calendar size={16} /> 3. Escalas e Roteiros Sincronizados ({filteredSchedules.length})
          </h2>

          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {filteredSchedules.map(sch => (
                <motion.div 
                  key={sch.id || sch.date}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="p-5 rounded-2xl bg-[#0A0A0A]/40 backdrop-blur-sm border border-[#E7C19A]/15 space-y-4 print:bg-transparent print:border-black/10 print:border print:p-4"
                >
                  <div className="flex justify-between items-start border-b border-white/5 pb-3 print:border-black/10">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-medium text-[#CC5A0D] print:text-orange-700">{sch.date}</span>
                      <h3 className="text-base font-bold text-white print:text-black mt-0.5">{sch.title}</h3>
                      <p className="text-[10px] text-gray-500 font-medium">Coordenador do Altar: {sch.coordinator}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider font-bold bg-[#CC5A0D]/10 text-[#CC5A0D] border border-[#CC5A0D]/20 print:border-none print:text-black">
                      {sch.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5 print:border-none print:bg-slate-50">
                      <span className="text-[9px] uppercase font-mono font-bold text-gray-500 block mb-1">Vocais em Alinhamento:</span>
                      <p className="text-gray-300 print:text-black leading-relaxed">{sch.vocals.map(v => `${v.name} (${v.instrument})`).join(", ") || "Nenhum vocal"}</p>
                    </div>

                    <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5 print:border-none print:bg-slate-50">
                      <span className="text-[9px] uppercase font-mono font-bold text-gray-500 block mb-1">Banda & Sustentação rítmica:</span>
                      <p className="text-gray-300 print:text-black leading-relaxed">{sch.instrumentalists.map(i => `${i.name} (${i.instrument})`).join(", ") || "Nenhum instrumentista"}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-mono font-bold text-gray-500 block">Repertório Litúrgico:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {sch.songs.map((s, idx) => (
                        <div key={s.id} className="p-2 bg-[#161616] rounded-lg border border-white/5 print:bg-slate-100 print:border-none flex justify-between items-center text-xs">
                          <span className="font-semibold text-white print:text-slate-800">{idx + 1}. {s.title}</span>
                          <span className="font-mono text-[#E7C19A] print:text-slate-700 font-bold">Tom: {s.tone}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {sch.notes && (
                    <div className="text-[10px] text-gray-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.02] print:text-slate-700 print:bg-slate-100 italic leading-relaxed">
                      <strong>Direcionamento:</strong> {sch.notes}
                    </div>
                  )}
                </motion.div>
              ))}
              {filteredSchedules.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-12 text-center text-xs text-gray-500 font-mono italic bg-black/20 rounded-2xl border border-white/5"
                >
                  Nenhuma escala litúrgica agendada para o período de {availableMonths.find(m => `${m.year}-${m.month.toString().padStart(2, "0")}` === selectedMonthKey)?.label || "mês selecionado"}.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer section of report */}
        <div className="border-t border-white/10 pt-6 text-center text-[10px] font-mono text-gray-500 uppercase tracking-widest print:text-slate-400 print:border-black/10">
          Zelo, Excelência, Reverência • Kadosh Manager Geral
        </div>
      </div>
    </div>
  );
}
