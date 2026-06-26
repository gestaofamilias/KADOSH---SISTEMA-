import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, RefreshCw, Cpu, Server, CheckCircle2, XCircle, Cloud, HardDrive, Workflow, Save } from "lucide-react";
import { AISettings } from "../types";
import { apiFetch } from "../lib/api";

export function SettingsView() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // n8n integration settings
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch("/api/ai/settings");
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchN8nSettings = async () => {
    try {
      const res = await apiFetch("/api/n8n/settings");
      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.webhookUrl || "");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveWebhook = async () => {
    setWebhookSaving(true);
    setWebhookSaved(false);
    try {
      const res = await apiFetch("/api/n8n/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      if (res.ok) {
        setWebhookSaved(true);
        setTimeout(() => setWebhookSaved(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWebhookSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchN8nSettings();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestMessage("");
    try {
      const res = await apiFetch("/api/ai/test-connection", { method: "POST" });
      const data = await res.json();
      setTestMessage(data.message);
      await fetchSettings();
    } catch (err) {
      setTestMessage("Erro de rede ao testar a conexão.");
    } finally {
      setTesting(false);
    }
  };

  const updateSettings = async (patch: { provider?: "ollama" | "gemini"; model?: string }) => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        await fetchSettings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 text-sm font-mono">
        Carregando configurações...
      </div>
    );
  }

  const { ollama, geminiConfigured, provider } = settings;
  const runningModel = ollama.running.find(r => r.name === ollama.currentModel);
  const vramMb = runningModel ? Math.round(runningModel.size_vram / 1024 / 1024) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-3xl"
    >
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles size={18} className="text-[#CC5A0D]" /> Inteligência Artificial
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Configure o motor que alimenta o Kadosh AI. Por padrão, o sistema usa o Ollama instalado localmente — sem custo e sem depender de serviços externos.
        </p>
      </div>

      {/* STATUS CARD */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-xl ${ollama.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              <Server size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Ollama Local</p>
              <p className="text-xs text-gray-500 font-mono">{ollama.baseUrl}</p>
            </div>
          </div>
          <span
            className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
              ollama.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`}
          >
            {ollama.connected ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {ollama.connected ? "Conectado" : "Offline"}
          </span>
        </div>

        {!ollama.connected && (
          <div className="bg-red-950/20 border border-red-500/10 rounded-xl p-3 text-xs text-red-300">
            Não foi possível conectar ao Ollama. Verifique se o serviço está em execução.
          </div>
        )}

        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg bg-[#CC5A0D] text-black hover:brightness-110 transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={testing ? "animate-spin" : ""} /> Testar Conexão
        </button>

        {testMessage && <p className="text-xs text-gray-400 italic">{testMessage}</p>}
      </div>

      {/* PROVIDER SELECTION */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
        <p className="text-xs uppercase tracking-widest font-mono font-bold text-[#E7C19A] opacity-70">Provedor Ativo</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => updateSettings({ provider: "ollama" })}
            disabled={saving}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
              provider === "ollama"
                ? "border-[#CC5A0D] bg-[#CC5A0D]/10"
                : "border-white/5 hover:border-white/15"
            }`}
          >
            <HardDrive size={18} className={provider === "ollama" ? "text-[#CC5A0D]" : "text-gray-500"} />
            <div>
              <p className="text-sm font-bold text-white">Ollama (Local)</p>
              <p className="text-[10px] text-gray-500">Gratuito, roda no seu computador</p>
            </div>
          </button>

          <button
            onClick={() => updateSettings({ provider: "gemini" })}
            disabled={saving || !geminiConfigured}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
              provider === "gemini"
                ? "border-[#CC5A0D] bg-[#CC5A0D]/10"
                : "border-white/5 hover:border-white/15"
            } ${!geminiConfigured ? "opacity-40 cursor-not-allowed" : ""}`}
            title={!geminiConfigured ? "Configure GEMINI_API_KEY para habilitar" : ""}
          >
            <Cloud size={18} className={provider === "gemini" ? "text-[#CC5A0D]" : "text-gray-500"} />
            <div>
              <p className="text-sm font-bold text-white">Gemini (Cloud)</p>
              <p className="text-[10px] text-gray-500">
                {geminiConfigured ? "Serviço pago configurado" : "Requer GEMINI_API_KEY"}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* MODEL SELECTION */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
        <p className="text-xs uppercase tracking-widest font-mono font-bold text-[#E7C19A] opacity-70">Modelo do Ollama</p>

        {ollama.models.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum modelo instalado foi encontrado no Ollama.</p>
        ) : (
          <select
            value={ollama.currentModel || ""}
            onChange={(e) => updateSettings({ model: e.target.value })}
            className="w-full bg-[#0A0A0A] text-sm px-3 py-2.5 rounded-lg border border-white/5 text-gray-200 focus:outline-none focus:border-[#CC5A0D]"
          >
            {ollama.models.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
          <Cpu size={13} className="text-[#CC5A0D]" />
          {vramMb !== null
            ? `Memória em uso pelo modelo carregado: ~${vramMb} MB (VRAM)`
            : "Memória do modelo não disponível (modelo pode não estar carregado agora)."}
        </div>
      </div>

      {/* N8N INTEGRATION */}
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Workflow size={18} className="text-[#CC5A0D]" /> Integração n8n
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Configure a URL do webhook do n8n para enviar escalas (completas ou só técnica) e receber confirmações via WhatsApp.
        </p>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
        <label className="text-xs uppercase tracking-widest font-mono font-bold text-[#E7C19A] opacity-70 block">
          URL do Webhook n8n
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://seu-n8n.com/webhook/kadosh-escalas"
          className="w-full bg-[#0A0A0A] text-sm px-3 py-2.5 rounded-lg border border-white/5 text-gray-200 focus:outline-none focus:border-[#CC5A0D]"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveWebhook}
            disabled={webhookSaving}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg bg-[#CC5A0D] text-black hover:brightness-110 transition-all disabled:opacity-50"
          >
            {webhookSaved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {webhookSaving ? "Salvando..." : webhookSaved ? "Salvo!" : "Salvar Webhook"}
          </button>
          <p className="text-[10px] text-gray-500">
            Usado pelos botões &quot;Enviar n8n&quot; e &quot;Enviar Técnica n8n&quot; dentro de cada escala.
          </p>
        </div>
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-[10px] text-gray-500 leading-relaxed">
          O segredo usado para validar as confirmações recebidas do n8n (<code className="text-[#E7C19A]">N8N_CONFIRMATION_SECRET</code>) fica no arquivo <code className="text-[#E7C19A]">.env</code> do servidor, por segurança — não é exibido aqui.
        </div>
      </div>
    </motion.div>
  );
}
