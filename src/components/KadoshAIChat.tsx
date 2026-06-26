import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, Send, User, AlertTriangle } from "lucide-react";
import { ChatMessage } from "../types";
import { apiFetch } from "../lib/api";

const QUICK_PROMPTS = [
  "Monte uma escala para domingo.",
  "Quem está sem participar há mais tempo?",
  "Sugira músicas para culto de gratidão.",
  "Qual cantor teve mais participações este mês?",
];

export function KadoshAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    setError("");

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);

    try {
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Falha ao conversar com o Kadosh AI.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const token = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + token };
          return updated;
        });
      }
    } catch (err: any) {
      setError(err.message || "Não foi possível conectar ao Ollama. Verifique se o serviço está em execução.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-[calc(100vh-220px)] max-w-3xl"
    >
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles size={18} className="text-[#CC5A0D]" /> Kadosh AI Chat
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Converse com a inteligência local do ministério sobre escalas, músicos e repertório.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Sugestões rápidas</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-xs px-3 py-2 rounded-full border border-[#CC5A0D]/20 text-[#E7C19A] hover:bg-[#CC5A0D]/10 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <span className="shrink-0 w-7 h-7 bg-[#CC5A0D]/10 text-[#CC5A0D] rounded-lg flex items-center justify-center">
                <Sparkles size={13} />
              </span>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[#CC5A0D] text-black font-medium"
                  : "bg-white/[0.03] border border-white/5 text-gray-200"
              }`}
            >
              {m.content || (sending && i === messages.length - 1 ? "..." : "")}
            </div>
            {m.role === "user" && (
              <span className="shrink-0 w-7 h-7 bg-white/5 text-gray-400 rounded-lg flex items-center justify-center">
                <User size={13} />
              </span>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-300 bg-red-950/20 border border-red-500/10 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        className="mt-4 flex items-center gap-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo ao Kadosh AI..."
          disabled={sending}
          className="flex-1 bg-[#161616] text-sm px-4 py-3 rounded-xl border border-white/5 text-gray-200 focus:outline-none focus:border-[#CC5A0D] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="p-3 rounded-xl bg-[#CC5A0D] text-black hover:brightness-110 transition-all disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </motion.div>
  );
}
