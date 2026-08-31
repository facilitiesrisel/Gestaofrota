import React, { useState } from "react";
import { 
  BookOpen, 
  Database, 
  Server, 
  ShieldCheck, 
  Lock, 
  FileCode2, 
  CheckCircle2, 
  Truck, 
  FileText, 
  Copy, 
  Check, 
  ExternalLink,
  Layers,
  Sparkles,
  Zap,
  Globe
} from "lucide-react";

export function SystemDocumentation() {
  const [activeDocTab, setActiveDocTab] = useState<"visaoGeral" | "banco" | "permissoes" | "deploy" | "regras">("visaoGeral");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 3000);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header da Documentação */}
      <div className="bg-gradient-to-r from-[#07110C] via-[#0D261C] to-[#07110C] p-6 rounded-3xl text-white border border-emerald-900/60 shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-inner shrink-0">
              <BookOpen className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-black text-white">Central de Documentação & Engenharia ERP</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                  v2.5 Release
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Registro técnico e arquitetural restrito ao Gestor Executivo Deny Gonçalves (<span className="text-emerald-300 font-mono">deny.goncalves@risel.com.br</span>).
              </p>
            </div>
          </div>
        </div>

        {/* Abas de Navegação da Documentação */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-emerald-900/40 overflow-x-auto no-scrollbar">
          {[
            { id: "visaoGeral", label: "Visão Geral & Módulos", icon: Layers },
            { id: "banco", label: "Arquitetura Supabase (SQL)", icon: Database },
            { id: "permissoes", label: "Controle de Acesso & RBAC", icon: ShieldCheck },
            { id: "regras", label: "Regras de Negócio & Frota", icon: Truck },
            { id: "deploy", label: "Guia de Deploy Zero Custo", icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDocTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDocTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive 
                    ? "bg-emerald-500 text-[#07110C] font-black shadow-sm" 
                    : "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {activeDocTab === "visaoGeral" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" /> Estrutura de Módulos Operacionais
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="p-3 bg-slate-50 rounded-2xl border border-slate-150">
                <strong className="text-slate-900 block mb-0.5">1. Lançamento de Documentos & Faturas</strong>
                Registro completo com alçadas de aprovação multinível, centros de custo, anexos e dashboard de vencimentos.
              </li>
              <li className="p-3 bg-slate-50 rounded-2xl border border-slate-150">
                <strong className="text-slate-900 block mb-0.5">2. Controle de Frota Leve (75 Veículos)</strong>
                Acompanhamento de 75 veículos reais, controle de contratos com régua de 90 dias, inativações e custos de abastecimento.
              </li>
              <li className="p-3 bg-slate-50 rounded-2xl border border-slate-150">
                <strong className="text-slate-900 block mb-0.5">3. Checklists de Veículos & Vistorias Públicas</strong>
                Rotas públicas e privadas (`/checklist-publico`) para motoristas realizarem vistorias fotográficas no smartphone sem login.
              </li>
              <li className="p-3 bg-slate-50 rounded-2xl border border-slate-150">
                <strong className="text-slate-900 block mb-0.5">4. Gestão de Reservas & Locações RAC</strong>
                Controle de uso diário, solicitações e fluxo administrativo de reservas de veículos.
              </li>
            </ul>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Stack Tecnológica & Resiliência
            </h3>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
                <span className="font-bold text-emerald-900 block mb-1">FrontEnd: React 19 + TypeScript + Tailwind 4</span>
                Arquitetura SPA de alta performance, animações com Spring Transitions (`motion`) e componentes modulares.
              </div>
              <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200/80">
                <span className="font-bold text-blue-900 block mb-1">BackEnd: Node.js Express Server</span>
                Endpoints seguros para IA (Gemini API), processamento de planilhas CSV, rotinas de e-mail e proxy.
              </div>
              <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200/80">
                <span className="font-bold text-purple-900 block mb-1">Banco de Dados: Supabase PostgreSQL Real</span>
                Conexão direta segura com persistência na nuvem e rotina de pulso (Keep-Alive anti-hibernação a cada 5 min).
              </div>
            </div>
          </div>
        </div>
      )}

      {activeDocTab === "banco" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" /> Dicionário de Tabelas do Supabase
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Projeto Supabase ativo: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-700">ihowbxlqfcjzzzleasqq</code></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-mono font-black text-slate-900 bg-white px-2 py-1 rounded-md border border-slate-200">public.veiculos</span>
              <p className="text-slate-600 text-[11px]">Armazena os 75 veículos da frota leve, placas, modelos, locadoras, datas de vencimento de contrato, odômetros e dados de inativação.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-mono font-black text-slate-900 bg-white px-2 py-1 rounded-md border border-slate-200">public.lancamentos</span>
              <p className="text-slate-600 text-[11px]">Guarda faturas fiscais, números de nota, valores, centros de custo, anexos em Base64 e status de aprovação de alçada.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-mono font-black text-slate-900 bg-white px-2 py-1 rounded-md border border-slate-200">public.abastecimentos</span>
              <p className="text-slate-600 text-[11px]">Histórico de abastecimentos de combustível, litros, postos credenciados, valores totais e condutores.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-mono font-black text-slate-900 bg-white px-2 py-1 rounded-md border border-slate-200">public.usuarios</span>
              <p className="text-slate-600 text-[11px]">Usuários corporativos, papéis de acesso (admin/user) e matriz granular de permissões por módulo.</p>
            </div>
          </div>
        </div>
      )}

      {activeDocTab === "permissoes" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Matriz de Permissões e Segurança
          </h3>
          
          <div className="space-y-3 text-xs">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950">
              <strong className="block mb-1 font-bold">🔐 Acesso Master Restrito (deny.goncalves@risel.com.br):</strong>
              Permissão exclusiva para visualizar as abas de Configurações de Banco de Dados, Assistente de IA Executivo, Documentação do Sistema e Gerenciamento de Usuários.
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 space-y-2">
              <strong className="block font-bold text-slate-900">Perfis de Usuários Comuns:</strong>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li><strong>Dashboard:</strong> Visualização de métricas e indicadores de faturas.</li>
                <li><strong>Lançamentos:</strong> Cadastro e acompanhamento de notas fiscais.</li>
                <li><strong>Fornecedores:</strong> Consulta e manutenção de parceiros homologados.</li>
                <li><strong>Frota:</strong> Consulta dos veículos, abastecimentos e alertas de contrato.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeDocTab === "regras" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-600" /> Regras de Negócio de Frota & Vencimentos
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200">
              <span className="font-bold text-rose-900 block mb-1">🔴 Contratos Vencidos</span>
              <p className="text-rose-700 text-[11px]">Contratos cuja data de término é anterior à data de referência ou atual. Destacados com urgência máxima.</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
              <span className="font-bold text-amber-900 block mb-1">🟡 Alerta Próximo (≤ 90 Dias)</span>
              <p className="text-amber-800 text-[11px]">Régua de 90 dias que categoriza os veículos que necessitam de renovação, substituição ou devolução.</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="font-bold text-emerald-900 block mb-1">🟢 Contratos Regulares</span>
              <p className="text-emerald-800 text-[11px]">Contratos vigentes com mais de 90 dias de prazo restante.</p>
            </div>
          </div>
        </div>
      )}

      {activeDocTab === "deploy" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" /> Opções de Hospedagem 100% Gratuitas e Seguras (Zero Risco de Cobrança)
            </h3>
            <p className="text-xs text-slate-500 mt-1">Comparativo de plataformas sem cartão ou com limites rígidos configuráveis.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Opção 1: Render */}
            <div className="p-4 bg-emerald-50/60 rounded-2xl border-2 border-emerald-300 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-900 text-sm">1. Render.com</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white">RECOMENDADO</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Hospeda aplicação Full-Stack (FrontEnd + BackEnd Node.js `server.ts`) em um único lugar no plano Free.
                </p>
                <ul className="text-[11px] text-emerald-800 space-y-1 font-medium">
                  <li>✅ 100% Gratuito sem cartão</li>
                  <li>✅ Roda o backend e IA perfeitamente</li>
                  <li>✅ SSL / HTTPS automático</li>
                </ul>
              </div>
            </div>

            {/* Opção 2: Netlify */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="font-black text-slate-900 text-sm">2. Netlify</span>
                <p className="text-slate-600 text-[11px]">
                  Excelente para o FrontEnd SPA estático. O arquivo <code className="bg-white px-1 py-0.5 rounded text-[10px] font-mono">netlify.toml</code> e <code className="bg-white px-1 py-0.5 rounded text-[10px] font-mono">_redirects</code> já foram criados no projeto.
                </p>
                <ul className="text-[11px] text-slate-600 space-y-1">
                  <li>✅ Gratuito (100 GB/mês)</li>
                  <li>⚠️ Requer Netlify Functions para rotas backend</li>
                </ul>
              </div>
            </div>

            {/* Opção 3: Railway / Vercel */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="font-black text-slate-900 text-sm">3. Vercel</span>
                <p className="text-slate-600 text-[11px]">
                  Plano Hobby gratuito com integração imediata com repositórios GitHub.
                </p>
                <ul className="text-[11px] text-slate-600 space-y-1">
                  <li>✅ Gratuito para uso corporativo interno</li>
                  <li>✅ Deploy em 1 clique</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
