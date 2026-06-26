import React, { useState, useEffect } from "react";
import { Workflow, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { AutomationLog, ConfirmationLog } from "../types";
import { apiFetch } from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  Pendente: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Enviado: "bg-green-500/10 text-green-400 border-green-500/20",
  Erro: "bg-red-500/10 text-red-400 border-red-500/20",
  Confirmado: "bg-green-500/10 text-green-400 border-green-500/20",
  Recusado: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function AutomationsView() {
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [confirmationLogs, setConfirmationLogs] = useState<ConfirmationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"todos" | "n8n_webhook" | "n8n_webhook_technical">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "Pendente" | "Enviado" | "Erro">("todos");
  const [confirmationFilter, setConfirmationFilter] = useState<"todos" | "Pendente" | "Confirmado" | "Recusado">("todos");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/automations");
      if (res.ok) {
        const data = await res.json();
        setAutomationLogs(data.automationLogs || []);
        setConfirmationLogs(data.confirmationLogs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAutomations = automationLogs.filter((log) => {
    if (typeFilter !== "todos" && log.automationType !== typeFilter) return false;
    if (statusFilter !== "todos" && log.status !== statusFilter) return false;
    return true;
  });

  const filteredConfirmations = confirmationLogs.filter((log) => {
    if (confirmationFilter !== "todos" && log.confirmationStatus !== confirmationFilter) return false;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#E7C19A]">Kadosh Manager</span>
          <h1 className="text-3xl font-display font-bold text-white mt-1 flex items-center gap-2">
            <Workflow size={24} className="text-[#CC5A0D]" /> Automações n8n
          </h1>
          <p className="text-xs text-gray-400 mt-1">Histórico de envios de escala e confirmações via WhatsApp/n8n.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#161616] border border-white/5 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {/* Automation Logs */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7C19A]">Envios para o n8n</h3>
        <div className="flex flex-wrap gap-2">
          {([
            { value: "todos", label: "Todos os tipos" },
            { value: "n8n_webhook", label: "Escala completa" },
            { value: "n8n_webhook_technical", label: "Somente técnica" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                typeFilter === opt.value
                  ? "bg-[#CC5A0D]/10 text-[#CC5A0D] border-[#CC5A0D]/30"
                  : "bg-[#0A0A0A] text-gray-400 border-white/5 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {(["todos", "Pendente", "Enviado", "Erro"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                statusFilter === opt
                  ? "bg-[#CC5A0D]/10 text-[#CC5A0D] border-[#CC5A0D]/30"
                  : "bg-[#0A0A0A] text-gray-400 border-white/5 hover:text-white"
              }`}
            >
              {opt === "todos" ? "Todos os status" : opt}
            </button>
          ))}
        </div>

        <div className="bg-[#161616]/75 backdrop-blur-md border border-[#E7C19A]/15 overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] tracking-widest uppercase font-bold text-[#E7C19A] bg-[#0F0F0F]">
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Enviado em</th>
                  <th className="px-5 py-3">Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredAutomations.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#E7C19A]/10 text-[#E7C19A]">
                        {log.automationType === "n8n_webhook_technical" ? "Técnica" : "Completa"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[log.status] || ""}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 font-mono">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 text-red-400 text-[11px]">{log.errorMessage || "—"}</td>
                  </tr>
                ))}
                {filteredAutomations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-xs text-gray-500 font-mono">
                      Nenhum envio registrado para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Confirmation Logs */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7C19A]">Confirmações por Pessoa</h3>
        <div className="flex flex-wrap gap-2">
          {(["todos", "Pendente", "Confirmado", "Recusado"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setConfirmationFilter(opt)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                confirmationFilter === opt
                  ? "bg-[#CC5A0D]/10 text-[#CC5A0D] border-[#CC5A0D]/30"
                  : "bg-[#0A0A0A] text-gray-400 border-white/5 hover:text-white"
              }`}
            >
              {opt === "todos" ? "Todos" : opt}
            </button>
          ))}
        </div>

        <div className="bg-[#161616]/75 backdrop-blur-md border border-[#E7C19A]/15 overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] tracking-widest uppercase font-bold text-[#E7C19A] bg-[#0F0F0F]">
                  <th className="px-5 py-3">Culto</th>
                  <th className="px-5 py-3">Pessoa</th>
                  <th className="px-5 py-3">Telefone</th>
                  <th className="px-5 py-3">Confirmação</th>
                  <th className="px-5 py-3">Resposta</th>
                  <th className="px-5 py-3">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredConfirmations.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-white">{log.scheduleTitle || "—"} {log.scheduleDate ? `(${log.scheduleDate})` : ""}</td>
                    <td className="px-5 py-3 text-white">{log.memberName || "—"}</td>
                    <td className="px-5 py-3 text-gray-400 font-mono">{log.phone || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[log.confirmationStatus] || ""}`}>
                        {log.confirmationStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 max-w-[180px] truncate" title={log.responseText || ""}>
                      {log.responseText || "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-400 font-mono">
                      {log.sentAt ? new Date(log.sentAt).toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
                {filteredConfirmations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-xs text-gray-500 font-mono">
                      Nenhuma confirmação registrada para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
