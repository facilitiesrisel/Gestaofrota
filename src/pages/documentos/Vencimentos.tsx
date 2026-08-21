import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, ArrowRight, Settings, ChevronDown, Bell, Edit2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDateDisplay } from "./Lancamento";

const mockVencimentos = [
  { id: 1, idSys: "#2032", fornecedor: "Postos ABC Locações", doc: "Fatura 1902", valor: "R$ 4.500,00", vencimento: "2026-05-18", status: "Lançado", dias: 4, avatar: "https://ui-avatars.com/api/?name=P&background=f8fafc" },
  { id: 2, idSys: "#2033", fornecedor: "Manutenção XYZ Ltda", doc: "NF-e 8839", valor: "R$ 1.250,00", vencimento: "2026-05-15", status: "Aguardando aprovação", dias: 1, avatar: "https://ui-avatars.com/api/?name=M&background=f8fafc" },
  { id: 3, idSys: "#2034", fornecedor: "Limpeza & Cia Silva", doc: "NFS-e 492", valor: "R$ 800,00", vencimento: "2026-05-10", status: "Atrasado", dias: -4, avatar: "https://ui-avatars.com/api/?name=L&background=f8fafc" },
  { id: 4, idSys: "#2035", fornecedor: "K Automóveis Especiais", doc: "Fatura 9912", valor: "R$ 9.300,00", vencimento: "2026-05-17", status: "Lançado", dias: 3, avatar: "https://ui-avatars.com/api/?name=K&background=f8fafc" },
  { id: 5, idSys: "#2036", fornecedor: "Internet Fibra", doc: "Fatura", valor: "R$ 299,90", vencimento: "2026-05-05", status: "Atrasado", dias: -9, avatar: "https://ui-avatars.com/api/?name=I&background=f8fafc" },
];

const mockMensaisPendentes = [
  { id: 4, fornecedor: "Vivo Móvel", doc: "Fatura Mensal", emissaoAnt: "2026-04-14", diasAtraso: 30 },
  { id: 5, fornecedor: "Sem Parar", doc: "Fatura Pedágio", emissaoAnt: "2026-04-10", diasAtraso: 34 },
];

export default function Vencimentos() {
  const [activeTab, setActiveTab] = useState("Próximos");

  const proximos = mockVencimentos.filter(v => v.dias >= 0);
  const atrasados = mockVencimentos.filter(v => v.dias < 0);

  const displayedList = activeTab === "Próximos" ? proximos : activeTab === "Em Atraso" ? atrasados : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-800">Alertas e Vencimentos</h2>
          <p className="text-slate-500 mt-1">Acompanhe documentos com vencimento próximo e lançamentos pendentes.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-[16px] shadow-sm border border-slate-200">
            {["Próximos", "Em Atraso", "Mensais"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-5 py-2 text-sm font-bold rounded-[12px] transition-all",
                  activeTab === tab 
                    ? tab === "Em Atraso" ? "bg-rose-50 text-rose-700" : "bg-[#114D38] text-white shadow-md shadow-[#114D38]/20" 
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                {tab}
                {tab === "Em Atraso" && <span className="ml-2 bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded-full text-[10px]">{atrasados.length}</span>}
                {tab === "Mensais" && <span className="ml-2 bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full text-[10px]">{mockMensaisPendentes.length}</span>}
              </button>
            ))}
          </div>
          <Link to="/documentos/lancamento" className="px-6 py-2.5 rounded-[12px] font-bold bg-[#114D38] hover:bg-[#0d3b2b] text-white shadow-lg shadow-[#114D38]/20 transition-all flex items-center gap-2">
            + Novo Lançamento
          </Link>
        </div>
      </div>

      <div>
        {activeTab === "Próximos" || activeTab === "Em Atraso" ? (
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#114D38]" />
                {activeTab === "Próximos" ? "Vencimentos Próximos" : "Vencimentos em Atraso"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              {displayedList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium">Nenhum documento listado nesta categoria.</div>
              ) : (
                <table className="w-full text-[13px] text-left whitespace-nowrap">
                  <thead className="bg-[#114D38] text-white text-[10px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3">AÇÕES</th>
                      <th className="px-6 py-3">STATUS <span className="ml-1 opacity-60">↑↓</span></th>
                      <th className="px-6 py-3">VENCIMENTO <span className="ml-1 opacity-60">↑↓</span></th>
                      <th className="px-6 py-3">FORNECEDOR <span className="ml-1 opacity-60">↑↓</span></th>
                      <th className="px-6 py-3">DOCUMENTO <span className="ml-1 opacity-60">↑↓</span></th>
                      <th className="px-6 py-3 text-right">VALOR <span className="ml-1 opacity-60">↑↓</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedList.map((item) => {
                      const isOrange = item.status.includes("Aguardando");
                      const isRed = item.status.includes("Atrasado");
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <Link 
                                to="/documentos/lancamento" 
                                state={{ openForm: true, prefill: item }} 
                                className="text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-[8px] font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-sm hover:shadow"
                                title="Efetuar lançamento desta fatura"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Lançar</span>
                              </Link>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded shadow-sm",
                              isRed
                                ? "bg-rose-50 border-rose-200 text-rose-700"
                                : isOrange 
                                  ? "bg-orange-50 border-orange-200 text-orange-700" 
                                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            )}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isRed && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                              <span className={isRed ? "text-rose-600 font-bold" : "text-slate-600"}>
                                {formatDateDisplay(item.vencimento)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <img src={item.avatar} alt="logo" className="w-5 h-5 rounded-full shadow-sm" />
                              <span className="font-bold text-slate-800">{item.fornecedor}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-slate-500 font-medium">
                            {item.doc}
                          </td>
                          <td className="px-6 py-3 text-right font-bold text-slate-800 tracking-tight">
                            {item.valor}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-[24px] shadow-sm border border-orange-200/50 overflow-hidden relative">
              <div className="absolute right-0 top-0 opacity-10">
                <AlertTriangle className="w-32 h-32 -mr-8 -mt-8" />
              </div>
              
              <div className="p-8 relative z-10">
                <h3 className="font-display font-bold text-orange-900 text-2xl mb-1">Avisos Mensais Pendentes</h3>
                <p className="text-base text-orange-700/80 mb-6 font-medium">Você tem fornecedores recorrentes que precisam ser lançados.</p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {mockMensaisPendentes.map((item) => (
                    <div key={item.id} className="p-5 bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-sm hover:shadow-md transition-shadow group cursor-pointer flex flex-col justify-between h-full">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-slate-800 text-lg">{item.fornecedor}</h4>
                          <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-100 px-2 py-1 rounded-md">+{item.diasAtraso} dias do último</span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium bg-slate-50 p-2 rounded-lg inline-block border border-slate-100">{item.doc}</p>
                        <p className="text-sm text-slate-500 mt-4 flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Último lançamento efetuado em {formatDateDisplay(item.emissaoAnt)}
                        </p>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <Link 
                          to="/documentos/lancamento" 
                          state={{ openForm: true, prefill: { fornecedor: item.fornecedor, doc: item.doc, valor: "", vencimento: "" } }} 
                          className="text-sm font-bold text-orange-600 group-hover:text-orange-700 transition-colors uppercase tracking-wide flex items-center gap-2"
                        >
                          Efetuar Lançamento Agora
                        </Link>
                        <ArrowRight className="w-5 h-5 text-orange-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
