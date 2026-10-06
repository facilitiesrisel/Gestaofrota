import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, ArrowRight, Bell, Edit2, ShieldAlert, Calendar } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDateDisplay, calcularDiasAteVencimento, normalizeDateToInput, parseDateToLocalDay } from "./Lancamento";
import { subscribeToLancamentosUnified, getLancamentosUnified } from "../../services/lancamentosService";

export default function Vencimentos() {
  const [activeTab, setActiveTab] = useState<"Próximos" | "Em Atraso" | "Mensais">("Próximos");
  const [lancamentos, setLancamentos] = useState<any[]>(() => getLancamentosUnified());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToLancamentosUnified((items) => {
      setLancamentos(items);
      setLoading(false);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Vencimentos reais filtrados estritamente por documentos que estão "Aguardando aprovação"
  const vencimentosReais = useMemo(() => {
    return lancamentos
      .filter(item => {
        const s = String(item.status || "").trim().toLowerCase();
        return s === "aguardando aprovação" || s === "aguardando aprovacao" || s === "aguardando";
      })
      .map(item => {
        const vencCalc = calcularDiasAteVencimento(item.dataVencimento, item.status);
        return {
          id: item.id,
          idSys: `#${item.id}`,
          fornecedor: item.fornecedor || "Fornecedor",
          doc: item.doc || (item.codigoLancamento ? `${item.tipo || 'NF-e'} ${item.codigoLancamento}` : (item.codLancamentoOc ? `DOC-${item.codLancamentoOc}` : `DOC-${item.id}`)),
          codigoLancamento: item.codigoLancamento || item.numeroDocumento || "",
          codLancamentoOc: item.codLancamentoOc || "",
          valor: item.valor || "R$ 0,00",
          vencimento: item.dataVencimento,
          status: item.status === "Aguardando aprovação" ? "Aguardando Aprovação" : (item.status || "Aguardando Aprovação"),
          dias: vencCalc.days,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.fornecedor || 'F')}&background=0d4a36&color=ffffff`
        };
      });
  }, [lancamentos]);

  // Contas Mensais Reais calculadas a partir dos lançamentos:
  // REQUISITO OFICIAL: Em Mensais alertar SOMENTE faturas cadastradas como mensais emitidas até a mesma data no mês anterior, que ainda não tiveram lançamento realizado.
  const mensaisPendentes = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentMonthPrefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

    const prevMonthDate = new Date(currentYear, today.getMonth() - 1, 1);
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevMonthPrefix = `${prevMonthYear}-${String(prevMonth).padStart(2, "0")}`;

    const lancamentosMensais = lancamentos.filter(item => {
      const freq = String(item.frequencia || item.tipo || "").trim().toLowerCase();
      return freq.includes("mensal") || freq.includes("recorrente");
    });

    const lancadosNoMesAtual = new Set<string>();
    lancamentos.forEach(item => {
      const dataEmissaoRef = normalizeDateToInput(item.dataEmissao);
      const dataLancRef = normalizeDateToInput(item.dataLancamento);
      const dataVencRef = normalizeDateToInput(item.dataVencimento);

      const isDesteMes = (dataEmissaoRef && dataEmissaoRef.startsWith(currentMonthPrefix)) ||
                         (dataLancRef && dataLancRef.startsWith(currentMonthPrefix)) ||
                         (dataVencRef && dataVencRef.startsWith(currentMonthPrefix));

      if (isDesteMes) {
        const normForn = String(item.fornecedor || "").trim().toUpperCase();
        const normCnpj = String(item.cnpj || "").replace(/\D/g, "");
        if (normForn) lancadosNoMesAtual.add(normForn);
        if (normCnpj) lancadosNoMesAtual.add(normCnpj);
      }
    });

    const pendentesMap = new Map<string, any>();

    lancamentosMensais.forEach(item => {
      const dataEmissaoRef = normalizeDateToInput(item.dataEmissao || item.dataLancamento);
      if (!dataEmissaoRef) return;

      if (dataEmissaoRef.startsWith(prevMonthPrefix)) {
        const parsedEmissao = parseDateToLocalDay(dataEmissaoRef);
        const diaEmissao = parsedEmissao ? parsedEmissao.getDate() : parseInt(dataEmissaoRef.slice(8, 10), 10);

        if (!isNaN(diaEmissao) && diaEmissao <= currentDay) {
          const normForn = String(item.fornecedor || "").trim().toUpperCase();
          const normCnpj = String(item.cnpj || "").replace(/\D/g, "");
          const chaveUnica = normCnpj ? `cnpj_${normCnpj}` : `forn_${normForn}`;

          const jaLancado = (normForn && lancadosNoMesAtual.has(normForn)) || 
                            (normCnpj && lancadosNoMesAtual.has(normCnpj));

          if (!jaLancado) {
            if (!pendentesMap.has(chaveUnica)) {
              const diffDias = currentDay - diaEmissao;
              const diasText = diffDias === 0 
                ? "Emissão esperada para hoje" 
                : `${diffDias} dia(s) após a data habitual`;

              pendentesMap.set(chaveUnica, {
                id: item.id,
                fornecedor: item.fornecedor || "Fornecedor",
                cnpj: item.cnpj || "",
                doc: item.doc || (item.tipo ? `${item.tipo} Recorrente` : "Fatura Recorrente"),
                valor: item.valor || "R$ 0,00",
                vencimento: item.dataVencimento,
                emissaoMesAnterior: dataEmissaoRef,
                diaEmissaoHabitual: diaEmissao,
                status: "Aguardando Lançamento do Mês",
                diasText,
                diffDias,
                lancamentoOriginal: item,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.fornecedor || 'F')}&background=0d4a36&color=ffffff`
              });
            }
          }
        }
      }
    });

    return Array.from(pendentesMap.values()).sort((a, b) => b.diffDias - a.diffDias);
  }, [lancamentos]);

  const proximos = useMemo(() => vencimentosReais.filter(v => v.dias >= 0), [vencimentosReais]);
  const atrasados = useMemo(() => vencimentosReais.filter(v => v.dias < 0), [vencimentosReais]);

  const displayedList = activeTab === "Próximos" ? proximos : activeTab === "Em Atraso" ? atrasados : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-800">Alertas e Vencimentos</h2>
          <p className="text-slate-500 mt-1">Acompanhe documentos que estão <strong>Aguardando Aprovação</strong> e faturas mensais pendentes.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-[16px] shadow-sm border border-slate-200">
            {(["Próximos", "Em Atraso", "Mensais"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-5 py-2 text-sm font-bold rounded-[12px] transition-all cursor-pointer",
                  activeTab === tab 
                    ? tab === "Em Atraso" 
                      ? "bg-rose-50 text-rose-700 border border-rose-200" 
                      : tab === "Mensais"
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "bg-[#114D38] text-white shadow-md shadow-[#114D38]/20" 
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                {tab}
                {tab === "Próximos" && <span className="ml-2 bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">{proximos.length}</span>}
                {tab === "Em Atraso" && <span className="ml-2 bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">{atrasados.length}</span>}
                {tab === "Mensais" && <span className="ml-2 bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">{mensaisPendentes.length}</span>}
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
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#114D38]" />
                {activeTab === "Próximos" ? "Vencimentos Próximos (Aguardando Aprovação)" : "Vencimentos em Atraso (Aguardando Aprovação)"}
              </h3>
              <span className="text-xs text-slate-500 font-medium">Exibindo apenas documentos pendentes de aprovação</span>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400 font-medium">Carregando vencimentos da base integrada...</div>
              ) : displayedList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium">Nenhum documento aguardando aprovação nesta categoria.</div>
              ) : (
                <table className="w-full text-[13px] text-left whitespace-nowrap">
                  <thead className="bg-[#114D38] text-white text-[10px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3">AÇÕES</th>
                      <th className="px-6 py-3">STATUS</th>
                      <th className="px-6 py-3">VENCIMENTO</th>
                      <th className="px-6 py-3">FORNECEDOR</th>
                      <th className="px-6 py-3">DOCUMENTO</th>
                      <th className="px-6 py-3 text-right">VALOR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedList.map((item) => {
                      const isRed = item.dias < 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <Link 
                                to="/documentos/lancamento" 
                                state={{ openForm: true, prefill: item }} 
                                className="text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-[8px] font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-sm hover:shadow"
                                title="Ver / Editar lançamento"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Lançar / Ver</span>
                              </Link>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded shadow-sm",
                              isRed
                                ? "bg-rose-50 border-rose-200 text-rose-700"
                                : "bg-orange-50 border-orange-200 text-orange-700"
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
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold", isRed ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600")}>
                                {isRed ? `${Math.abs(item.dias)}d atrás` : `em ${item.dias}d`}
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
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-amber-50/40 flex items-center justify-between">
              <h3 className="font-bold text-amber-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-700" />
                Faturas Mensais Pendentes de Lançamento (Mês Atual)
              </h3>
              <span className="text-xs text-amber-700 font-semibold">
                Emitidas no mês anterior até hoje (dia {new Date().getDate()}) sem lançamento neste mês
              </span>
            </div>
            <div className="overflow-x-auto">
              {mensaisPendentes.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium">
                  <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <p className="text-slate-700 font-bold text-sm">Nenhuma fatura mensal pendente de lançamento para hoje (dia {new Date().getDate()}).</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Alertamos faturas mensais emitidas até a mesma data no mês anterior que ainda não tiveram lançamento neste mês.
                  </p>
                </div>
              ) : (
                <table className="w-full text-[13px] text-left whitespace-nowrap">
                  <thead className="bg-[#114D38] text-white text-[10px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3">AÇÕES</th>
                      <th className="px-6 py-3">STATUS</th>
                      <th className="px-6 py-3">DATA HABITUAL</th>
                      <th className="px-6 py-3">FORNECEDOR</th>
                      <th className="px-6 py-3">DOCUMENTO / TIPO</th>
                      <th className="px-6 py-3 text-right">VALOR HABITUAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mensaisPendentes.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-3">
                          <Link 
                            to="/documentos/lancamento" 
                            state={{ openForm: true, prefill: {
                              fornecedor: item.fornecedor,
                              cnpj: item.cnpj,
                              valor: item.valor,
                              tipo: "Mensal",
                              status: "Aguardando Aprovação",
                              lancamentoOriginal: item.lancamentoOriginal
                            } }} 
                            className="text-white bg-[#114D38] hover:bg-[#0d3b2b] px-3 py-1.5 rounded-[8px] font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm"
                            title="Lançar fatura deste mês"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Lançar Este Mês</span>
                          </Link>
                        </td>
                        <td className="px-6 py-3">
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded shadow-sm bg-amber-50 border-amber-200 text-amber-800">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span className="text-slate-700 font-bold">Dia {item.diaEmissaoHabitual}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                              {item.diasText}
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
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
