import React, { useState, useRef, useEffect } from "react";
import { 
  Bot, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Terminal, 
  Database, 
  Cpu, 
  RefreshCw, 
  Copy, 
  Check, 
  Trash2,
  HelpCircle,
  Lightbulb,
  FileCode2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
}

export function AdminAiAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("risel_admin_ai_chat");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        id: "intro",
        role: "model",
        text: `👋 Olá, **Deny Gonçalves**!\n\nEu sou o seu **Assistente Executivo e Engenheiro de IA do Sistema ERP Risel**.\n\nEstou parametrizado com todo o contexto técnico do seu sistema: **75 veículos da Frota Leve**, lançamentos fiscais, **esquema do Supabase PostgreSQL**, deploys, integrações e boas práticas de negócio.\n\nComo posso ajudar você agora? Posso gerar consultas SQL, diagnosticar regras de negócio, sugerir manutenções ou rascunhar novas funcionalidades.`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      }
    ];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("risel_admin_ai_chat", JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const quickPrompts = [
    "Como gerar um relatório SQL dos contratos de frota vencendo em 90 dias?",
    "Quais os passos exatos para subir o sistema no Render sem nenhum custo?",
    "Como parametrizar novas regras de alçadas para aprovação de faturas?",
    "Revisar o status das tabelas do Supabase e rotinas anti-inatividade."
  ];

  const handleSend = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsLoading(true);

    try {
      // Histórico recente para contexto da conversa
      const history = messages.slice(-8).map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch("/api/gemini-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: user?.email || "deny.goncalves@risel.com.br",
          prompt: promptText,
          history
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${res.status} no servidor de IA.`);
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: data.reply || "Resposta processada.",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: `⚠️ **Atenção:** Não foi possível conectar ao servidor de IA.\n\n*Detalhe:* ${err.message}\n\n*Dica de Engenharia:* Verifique se a variável de ambiente \`GEMINI_API_KEY\` está configurada no servidor backend.`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleClearChat = () => {
    if (window.confirm("Deseja limpar todo o histórico desta conversa com o Assistente de IA?")) {
      const initialMsg: ChatMessage = {
        id: "intro",
        role: "model",
        text: `👋 Histórico limpo. Olá, Deny! Pronto para novas análises de BI, SQL e engenharia do Sistema Risel.`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages([initialMsg]);
      localStorage.removeItem("risel_admin_ai_chat");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col h-[760px] text-left">
      {/* Header do Assistente */}
      <div className="px-6 py-4.5 bg-gradient-to-r from-[#07110C] via-[#0E281E] to-[#07110C] text-white flex items-center justify-between border-b border-emerald-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-inner">
            <Bot className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-sm tracking-tight text-white">Assistente Executivo & IA de Engenharia</h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" /> Exclusivo Master Deny
              </span>
            </div>
            <p className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Gemini 2.5 Flash • Contexto Risel ERP Ativo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
            title="Limpar Conversa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prompts Rápidos Sugeridos */}
      <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar text-left">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Lightbulb className="w-3 h-3 text-amber-500" /> Ações Rápidas:
        </span>
        {quickPrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            className="text-[11px] font-medium bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 px-3 py-1 rounded-xl border border-slate-200 hover:border-emerald-300 whitespace-nowrap transition-all shadow-2xs cursor-pointer shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-50/50 via-white to-slate-50/30">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-[#07110C] border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
              )}

              <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xs relative group ${
                isUser 
                  ? "bg-[#114D38] text-white rounded-tr-none font-medium" 
                  : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-none"
              }`}>
                {/* Botão Copiar Mensagem */}
                <button
                  onClick={() => handleCopy(m.id, m.text)}
                  className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                    isUser ? "text-emerald-200 hover:bg-white/10" : "text-slate-400 hover:bg-slate-100"
                  }`}
                  title="Copiar texto"
                >
                  {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <div className="whitespace-pre-wrap font-sans text-xs">
                  {m.text}
                </div>

                <div className={`text-[9px] mt-2 font-mono ${isUser ? "text-emerald-200/80 text-right" : "text-slate-400 text-left"}`}>
                  {m.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm mt-0.5">
                  DG
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-8 h-8 rounded-xl bg-[#07110C] border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-4 h-4 text-emerald-400 animate-spin" />
            </div>
            <div className="bg-white text-slate-600 border border-slate-200 rounded-2xl rounded-tl-none p-3.5 text-xs flex items-center gap-2 shadow-2xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>O Assistente de IA está analisando o contexto e gerando a solução...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input de Mensagem */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 bg-white border-t border-slate-200 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte ao Assistente de IA (análise de frota, regras SQL, implantações, códigos)..."
            disabled={isLoading}
            className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-300 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-[#114D38]/30 focus:border-[#114D38] outline-none text-xs font-medium text-slate-800 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 bg-[#114D38] hover:bg-[#0d3b2b] disabled:bg-slate-300 text-white font-extrabold text-xs rounded-2xl flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
}
