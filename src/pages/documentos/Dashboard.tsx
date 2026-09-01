import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, LabelList } from "recharts";
import { Filter, TrendingUp, TrendingDown, Clock, CheckCircle2, Users, Receipt, Calendar, Building, CreditCard, Trophy, Crown, Award } from "lucide-react";
import { cn } from "../../lib/utils";

// Inicialização zerada do módulo para lançamentos reais
const DEFAULT_LANCAMENTOS: any[] = [];

const formatarNomeFornecedor = (nome: string): string => {
  if (!nome) return "";
  
  const nomeUpper = nome.toUpperCase().trim();
  
  // Casos específicos conhecidos solicitados ou mapeados
  if (nomeUpper.includes("PRT SOLUCOES") || nomeUpper.includes("PRT SOLUÇÕES")) {
    return "PRT SOLUÇÕES";
  }
  if (nomeUpper.includes("POSTOS ABC") || nomeUpper.includes("ABC LOCACOES") || nomeUpper.includes("ABC LOCAÇÕES")) {
    return "POSTOS ABC";
  }
  if (nomeUpper.includes("MANUTENCAO XYZ") || nomeUpper.includes("MANUTENÇÃO XYZ")) {
    return "MANUTENÇÃO XYZ";
  }
  if (nomeUpper.includes("LIMPEZA & CIA")) {
    return "LIMPEZA & CIA";
  }
  
  // Limpeza de sufixos corporativos e palavras desnecessárias para o visual
  let limpo = nomeUpper
    .replace(/\s+LTDA\.?\s*/gi, " ")
    .replace(/\s+S\.?A\.?\s*/gi, " ")
    .replace(/\s+LIMITADA\s*/gi, " ")
    .replace(/\s+S\/A\s*/gi, " ")
    .replace(/\s+M\.?E\.?\s*/gi, " ")
    .replace(/\s+E\.?P\.?P\.?\s*/gi, " ")
    .replace(/\s+EIRELI\s*/gi, " ")
    .replace(/\s+SERVICOS\s*/gi, " SERVIÇOS")
    .replace(/\s+COMERCIO\s*/gi, " COMÉRCIO")
    .replace(/\s+TELEFONIA\s+/gi, " ")
    .replace(/\s+SEGURANCA\s+/gi, " ")
    .replace(/\s+ELETRONICA\s+/gi, " ")
    .replace(/\s+NACIONAL\s+/gi, " ")
    .replace(/\s+BRASIL\s+/gi, " ")
    .replace(/\s+E\s+PARTICIPACOES\s*/gi, "")
    .replace(/\s+E\s+PARTICIPAÇÕES\s*/gi, "")
    .replace(/\s+CONSTRUTORA\s+/gi, " ")
    .replace(/\s+DISTRIBUIDORA\s+/gi, " ")
    .replace(/\s+LOGISTICA\s+/gi, " ")
    .replace(/\s+LOGÍSTICA\s+/gi, " ")
    .replace(/\s+EMPREENDIMENTOS\s*/gi, "")
    .trim();

  // Limpeza de múltiplos espaços
  limpo = limpo.replace(/\s+/g, " ");

  // Se ainda for muito longo (mais de 14 caracteres), reduzimos para as duas primeiras palavras
  if (limpo.length > 14) {
    const palavras = limpo.split(" ");
    if (palavras.length > 2) {
      const conectores = ["DE", "EM", "E", "DO", "DA", "DOS", "DAS", "COM", "PARA"];
      if (conectores.includes(palavras[1]) && palavras[2]) {
        limpo = `${palavras[0]} ${palavras[1]} ${palavras[2]}`;
      } else {
        limpo = `${palavras[0]} ${palavras[1]}`;
      }
    }
  }

  // Se persistir muito longo, cortamos esteticamente
  if (limpo.length > 16) {
    limpo = limpo.substring(0, 15) + "...";
  }

  return limpo;
};

export default function Dashboard() {
  const [periodo, setPeriodo] = useState<"mes" | "dia">("mes");
  const [filtroMes, setFiltroMes] = useState<string>("Todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("Todos");

  // Carrega os lançamentos reais do localStorage para análise dinâmica
  const lancamentos = useMemo(() => {
    const saved = localStorage.getItem("risel_lancamentos");
    const list = saved ? JSON.parse(saved) : DEFAULT_LANCAMENTOS;
    
    // Obter data de hoje no formato YYYY-MM-DD
    const hoje = new Date().toISOString().split("T")[0];
    let alterado = false;
    
    const listAtualizada = list.map((item: any) => {
      // Se for "Aprovado" e a data de vencimento <= hoje
      if (item.status === "Aprovado" && item.dataVencimento && item.dataVencimento <= hoje) {
        alterado = true;
        return { ...item, status: "Finalizado" };
      }
      return item;
    });

    if (alterado) {
      localStorage.setItem("risel_lancamentos", JSON.stringify(listAtualizada));
    }
    return listAtualizada;
  }, []);

  // Lista dinâmica de fornecedores e meses para popular os filtros
  const fornecedoresUnicos = useMemo<string[]>(() => {
    const list = lancamentos.map(l => String(l.fornecedor || "")).filter(Boolean);
    return ["Todos", ...(Array.from(new Set(list)) as string[])];
  }, [lancamentos]);

  const mesesDisponiveis = useMemo(() => {
    const temp: { ano: number; mes: number; label: string }[] = [];
    const seen = new Set<string>();

    lancamentos.forEach(l => {
      if (l.dataVencimento && l.dataVencimento.includes("-")) {
        const parts = l.dataVencimento.split("-");
        if (parts.length >= 2) {
          const ano = parseInt(parts[0], 10);
          const mes = parseInt(parts[1], 10);
          const label = `${parts[1]}/${parts[0]}`; // MM/AAAA
          if (!seen.has(label)) {
            seen.add(label);
            temp.push({ ano, mes, label });
          }
        }
      }
    });

    // Ordenação cronológica perfeita (Ano crescente, depois Mês crescente)
    temp.sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return a.mes - b.mes;
    });

    return ["Todos", ...temp.map(t => t.label)];
  }, [lancamentos]);

  // Filtragem Dinâmica dos Dados de BI baseado estritamente na Data de Emissão para os períodos
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      // Filtro de fornecedor
      if (filtroFornecedor !== "Todos" && l.fornecedor !== filtroFornecedor) {
        return false;
      }

      // Filtro de período (Mês/Ano do Vencimento) baseado na Data de Vencimento
      if (filtroMes !== "Todos") {
        if (l.dataVencimento && l.dataVencimento.includes("-")) {
          const parts = l.dataVencimento.split("-");
          if (parts.length >= 2) {
            const label = `${parts[1]}/${parts[0]}`; // MM/AAAA
            if (label !== filtroMes) return false;
          } else {
            return false;
          }
        } else {
          return false;
        }
      }

      return true;
    });
  }, [lancamentos, filtroMes, filtroFornecedor]);

  // Parser de data auxiliar para cálculos de SLA
  const parseDate = (str: string) => {
    if (!str) return null;
    if (str.includes("-")) {
      return new Date(str + "T12:00:00");
    }
    if (str.includes("/")) {
      const parts = str.split("/");
      if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
    return null;
  };

  // Helper para o SLA médio de aprovação
  const calcularSlaMedio = (lista: any[]) => {
    const aprovadas = lista.filter(l => {
      const st = (l.status || "").toLowerCase();
      return st.includes("aprovado") || st.includes("finalizado") || st.includes("lançado");
    });
    if (aprovadas.length === 0) return 0;
    
    let somaDias = 0;
    let total = 0;
    
    aprovadas.forEach(l => {
      const dtLanc = parseDate(l.dataLancamento || l.dataEmissao);
      const dtAprov = parseDate(l.dataAprovacao);
      if (dtLanc && dtAprov) {
        const diffTime = Math.abs(dtAprov.getTime() - dtLanc.getTime());
        const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        somaDias += dias;
        total++;
      }
    });
    
    return total > 0 ? somaDias / total : 0;
  };

  // Helper para somar os valores numéricos dos lançamentos
  const calcularSomaValor = (lista: any[]) => {
    return lista.reduce((acc, l) => {
      const numeric = parseFloat(l.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      return acc + numeric;
    }, 0);
  };

  // Extração de data de faturamento/emissão
  const extrairDataEmissao = (l: any) => {
    if (l.dataEmissao && l.dataEmissao.includes("-")) {
      return l.dataEmissao;
    }
    if (l.dataLancamento && l.dataLancamento.includes("/")) {
      const parts = l.dataLancamento.split("/");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return l.dataVencimento || "2026-02-12";
  };

  // Label amigável do mês/ano de vencimento
  const getMesAnoLabel = (l: any) => {
    if (l.dataVencimento && l.dataVencimento.includes("-")) {
      const parts = l.dataVencimento.split("-");
      if (parts.length >= 2) {
        return `${parts[1]}/${parts[0]}`; // MM/AAAA
      }
    }
    return "02/2026";
  };

  // Calculation of previous month
  const getMesAnteriorLabel = (label: string) => {
    if (!label || label === "Todos") return "Todos";
    const parts = label.split("/");
    if (parts.length !== 2) return "";
    const mes = parseInt(parts[0], 10);
    const ano = parseInt(parts[1], 10);
    if (mes === 1) {
      return `12/${ano - 1}`;
    } else {
      return `${String(mes - 1).padStart(2, '0')}/${ano}`;
    }
  };

  // Determinar o mês ativo de referência no BI
  const mesReferenciaAtivo = useMemo(() => {
    if (filtroMes !== "Todos") return filtroMes;
    if (lancamentos.length === 0) return "02/2026";
    const ordenados = [...lancamentos]
      .filter(l => l.dataVencimento)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    if (ordenados.length === 0) return "02/2026";
    return getMesAnoLabel(ordenados[ordenados.length - 1]);
  }, [filtroMes, lancamentos]);

  // Determinar o mês anterior de comparação
  const mesReferenciaAnterior = useMemo(() => {
    return getMesAnteriorLabel(mesReferenciaAtivo);
  }, [mesReferenciaAtivo]);

  // Lançamentos filtrados para o mês ativo e anterior
  const lancamentosAtivosParaTrend = useMemo(() => {
    return lancamentos.filter(l => {
      if (filtroFornecedor !== "Todos" && l.fornecedor !== filtroFornecedor) return false;
      return getMesAnoLabel(l) === mesReferenciaAtivo;
    });
  }, [lancamentos, filtroFornecedor, mesReferenciaAtivo]);

  const lancamentosAnterioresParaTrend = useMemo(() => {
    return lancamentos.filter(l => {
      if (filtroFornecedor !== "Todos" && l.fornecedor !== filtroFornecedor) return false;
      return getMesAnoLabel(l) === mesReferenciaAnterior;
    });
  }, [lancamentos, filtroFornecedor, mesReferenciaAnterior]);

  // Cálculos dinâmicos dos KPIs baseados no filtro do usuário (que agora utiliza a Data de Emissão)
  const stats = useMemo(() => {
    const totalDocs = lancamentosFiltrados.length;
    
    const pendentes = lancamentosFiltrados.filter(l => 
      l.status.toLowerCase().includes("aguardando") || 
      l.status.toLowerCase().includes("pendente")
    ).length;

    const finalizados = lancamentosFiltrados.filter(l => 
      l.status.toLowerCase().includes("finalizado") || 
      l.status.toLowerCase().includes("aprovado") ||
      l.status.toLowerCase().includes("lançado")
    ).length;

    const uniqueForn = new Set(lancamentosFiltrados.map(l => l.fornecedor)).size;

    const totalValorNum = lancamentosFiltrados.reduce((acc, l) => {
      const numeric = parseFloat(l.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      return acc + numeric;
    }, 0);

    return {
      totalDocs,
      pendentes,
      finalizados,
      uniqueForn,
      totalValor: totalValorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    };
  }, [lancamentosFiltrados]);

  // Média de SLA Geral dos lançamentos filtrados para colocar no card
  const slaMedioAtual = useMemo(() => {
    const media = calcularSlaMedio(lancamentosFiltrados);
    const mediaArredondada = Math.round(media);
    return `${mediaArredondada} ${mediaArredondada === 1 ? 'Dia' : 'Dias'}`;
  }, [lancamentosFiltrados]);

  // Cálculo das Tendências para os cards
  const trendDocs = useMemo(() => {
    const ativoCount = lancamentosAtivosParaTrend.length;
    const anteriorCount = lancamentosAnterioresParaTrend.length;
    
    if (anteriorCount === 0) {
      if (ativoCount === 0) return { percent: "0.0%", isIncrease: false, isGood: true, rawAnterior: 0, numDiff: "+0" };
      return { percent: "+100%", isIncrease: true, isGood: true, rawAnterior: 0, numDiff: `+${ativoCount}` };
    }
    const diff = ativoCount - anteriorCount;
    const pct = (diff / anteriorCount) * 100;
    const sign = diff >= 0 ? "+" : "";
    return {
      percent: `${sign}${pct.toFixed(1)}% (${sign}${diff} ${Math.abs(diff) === 1 ? 'doc' : 'docs'})`,
      isIncrease: diff >= 0,
      isGood: diff >= 0,
      rawAnterior: anteriorCount,
      numDiff: `${sign}${diff}`
    };
  }, [lancamentosAtivosParaTrend, lancamentosAnterioresParaTrend]);

  const trendSla = useMemo(() => {
    const ativoSla = calcularSlaMedio(lancamentosAtivosParaTrend);
    const anteriorSla = calcularSlaMedio(lancamentosAnterioresParaTrend);
    
    if (anteriorSla === 0 || ativoSla === 0) {
      return { percent: "0.0%", isIncrease: false, isGood: true, rawAnterior: Math.round(anteriorSla) };
    }
    
    const diff = ativoSla - anteriorSla;
    const pct = (diff / anteriorSla) * 100;
    const sign = diff >= 0 ? "+" : "";
    return {
      percent: `${sign}${pct.toFixed(1)}% (${sign}${diff.toFixed(1)}d)`,
      isIncrease: diff >= 0,
      isGood: diff <= 0, // SLA menor é melhor!
      rawAnterior: Math.round(anteriorSla)
    };
  }, [lancamentosAtivosParaTrend, lancamentosAnterioresParaTrend]);

  const trendValor = useMemo(() => {
    const ativoVal = calcularSomaValor(lancamentosAtivosParaTrend);
    const anteriorVal = calcularSomaValor(lancamentosAnterioresParaTrend);
    
    const rawAnteriorFormated = anteriorVal.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      maximumFractionDigits: 0 
    });
    
    if (anteriorVal === 0) {
      if (ativoVal === 0) return { percent: "0.0%", isIncrease: false, isGood: true, rawAnteriorFormated: "R$ 0" };
      return { percent: "+100%", isIncrease: true, isGood: false, rawAnteriorFormated: "R$ 0" };
    }
    const diff = ativoVal - anteriorVal;
    const pct = (diff / anteriorVal) * 100;
    const sign = diff >= 0 ? "+" : "";
    const diffValFormated = Math.abs(diff).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    });
    return {
      percent: `${sign}${pct.toFixed(1)}% (${sign}${diffValFormated})`,
      isIncrease: diff >= 0,
      isGood: diff <= 0, // Para despesas, menos gastos (diff <= 0) é bom (verde), mais gastos (diff > 0) é ruim (vermelho)
      rawAnteriorFormated
    };
  }, [lancamentosAtivosParaTrend, lancamentosAnterioresParaTrend]);

  // Gráfico 1: Evolução dos Lançamentos com agrupamento dinâmico Mês vs Dia e ordenação cronológica
  const dataEvolucao = useMemo(() => {
    const extrairDataEmissao = (l: any) => {
      if (l.dataEmissao && l.dataEmissao.includes("-")) {
        return l.dataEmissao;
      }
      if (l.dataLancamento && l.dataLancamento.includes("/")) {
        const parts = l.dataLancamento.split("/");
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      return l.dataVencimento || "2026-02-12";
    };

    if (periodo === "dia") {
      // Agrupamento por Dia (DD/MM) baseado na Data de Emissão
      const dadosPorDia: Record<string, { name: string; dateObj: Date; docs: number; valor: number }> = {};
      
      lancamentosFiltrados.forEach(l => {
        const dtStr = extrairDataEmissao(l);
        const dateParts = dtStr.split("-");
        if (dateParts.length === 3) {
          const ano = parseInt(dateParts[0], 10);
          const mes = parseInt(dateParts[1], 10);
          const dia = parseInt(dateParts[2], 10);
          const dateObj = new Date(ano, mes - 1, dia);
          
          const key = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
          const val = parseFloat(l.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

          if (!dadosPorDia[key]) {
            dadosPorDia[key] = { name: key, dateObj, docs: 0, valor: 0 };
          }
          dadosPorDia[key].docs += 1;
          dadosPorDia[key].valor += val;
        }
      });

      // Ordenação por tempo absoluto para garantir cronologia
      return Object.values(dadosPorDia)
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
        .map(({ name, docs, valor }) => ({ name, docs, valor }));
    } else {
      // Agrupamento por Mês Completo
      const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const dadosPorMes: Record<string, { name: string; mesIndex: number; docs: number; valor: number }> = {};

      lancamentosFiltrados.forEach(l => {
        const dtStr = extrairDataEmissao(l);
        const dateParts = dtStr.split("-");
        if (dateParts.length === 3) {
          const mesIndex = parseInt(dateParts[1], 10) - 1;
          const nomeMes = mesesNomes[mesIndex] || "Janeiro";
          const val = parseFloat(l.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

          if (!dadosPorMes[nomeMes]) {
            dadosPorMes[nomeMes] = { name: nomeMes, mesIndex, docs: 0, valor: 0 };
          }
          dadosPorMes[nomeMes].docs += 1;
          dadosPorMes[nomeMes].valor += val;
        }
      });

      // Caso esteja vazio, inicializa meses padrão para manter a continuidade visual do gráfico
      if (Object.keys(dadosPorMes).length === 0) {
        mesesNomes.slice(0, 6).forEach((m, idx) => {
          dadosPorMes[m] = { name: m, mesIndex: idx, docs: 0, valor: 0 };
        });
      }

      // Ordenação cronológica baseada no índice do mês
      return Object.values(dadosPorMes)
        .sort((a, b) => a.mesIndex - b.mesIndex)
        .map(({ name, docs, valor }) => ({ name, docs, valor }));
    }
  }, [lancamentosFiltrados, periodo]);

  // Gráfico 2: Documentos por Status
  const dataStatus = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    lancamentosFiltrados.forEach(l => {
      const st = l.status || "Pendente";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const colors: Record<string, string> = {
      "Aprovado": "#10b981",
      "Finalizado": "#059669",
      "Aguardando aprovação": "#f59e0b",
      "Aguardando lançamento": "#3b82f6",
      "Aguardando Boleto": "#f59e0b",
      "Lançado": "#6366f1"
    };

    return Object.entries(statusCounts).map(([name, val]) => ({
      name,
      value: val,
      color: colors[name] || "#64748b"
    }));
  }, [lancamentosFiltrados]);

  // Gráfico 3: Top Fornecedores por Valor Acumulado
  const dataFornecedores = useMemo(() => {
    const mapFornecedores: Record<string, number> = {};
    lancamentosFiltrados.forEach(l => {
      const val = parseFloat(l.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      mapFornecedores[l.fornecedor] = (mapFornecedores[l.fornecedor] || 0) + val;
    });

    return Object.entries(mapFornecedores)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
  }, [lancamentosFiltrados]);

  // Gráfico 4: Volume por Estabelecimento (Filial sem número)
  const dataEstabelecimento = useMemo(() => {
    const mapEstab: Record<string, number> = {};
    lancamentosFiltrados.forEach(l => {
      const estabRaw = l.estabelecimento || "Outros";
      // Limpar número e hífen. Ex: de "100 - Paulínia" para "Paulínia"
      const estab = estabRaw.replace(/^\d+\s*-\s*/, "").trim();
      mapEstab[estab] = (mapEstab[estab] || 0) + 1;
    });

    return Object.entries(mapEstab).map(([name, value]) => ({ name, value }));
  }, [lancamentosFiltrados]);

  // Gráfico 5: Por Tipo de Documento
  const dataPorTipo = useMemo(() => {
    const mapTipo: Record<string, number> = {};
    lancamentosFiltrados.forEach(l => {
      const tipo = l.tipo || "NF-e";
      mapTipo[tipo] = (mapTipo[tipo] || 0) + 1;
    });

    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];
    return Object.entries(mapTipo).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length]
    }));
  }, [lancamentosFiltrados]);

  // Gráfico 6: Por Frequência (Recorrência) - Cálculo real do banco de dados
  const dataPorFrequencia = useMemo(() => {
    let esporadicos = 0;
    let mensais = 0;

    lancamentosFiltrados.forEach(l => {
      const valFreq = String(l.frequencia || l.tipo || "").trim().toLowerCase();
      if (valFreq.includes("mensal") || valFreq.includes("recorren") || valFreq.includes("recorrên")) {
        mensais++;
      } else {
        esporadicos++;
      }
    });

    return [
      { name: "Esporádico", value: esporadicos, color: "#114D38" },
      { name: "Mensal", value: mensais, color: "#3b82f6" }
    ];
  }, [lancamentosFiltrados]);

  // Gráfico 7: Por Forma de Pagamento
  const dataPorPagamento = useMemo(() => {
    const mapPag: Record<string, number> = {};
    lancamentosFiltrados.forEach(l => {
      const pag = l.formaPagto || "Boleto";
      mapPag[pag] = (mapPag[pag] || 0) + 1;
    });

    return Object.entries(mapPag).map(([name, value]) => ({ name, value }));
  }, [lancamentosFiltrados]);

  // Gráfico TOP 10 Custos por Centro de Custo (C.C) - Colunas Verticais em Ordem Alfabética com Destaque para o Maior
  const dataTopCentroCusto = useMemo(() => {
    const mapCC: Record<string, number> = {};
    lancamentosFiltrados.forEach(l => {
      const cc = (l.centroCusto || "C.C 101 - Operacional").trim().toUpperCase();
      const val = parseFloat((l.valor || "").replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      mapCC[cc] = (mapCC[cc] || 0) + val;
    });

    const formatOnlyCcName = (fullName: string) => {
      if (!fullName) return "";
      let cleaned = fullName
        .replace(/^(c\.?c\.?\s*|\d+[\s\.-]*)+/gi, '')
        .replace(/^\d+\s*[-–—]\s*/, '')
        .trim();
      return cleaned || fullName;
    };

    const top10 = Object.entries(mapCC)
      .map(([name, value]) => ({
        name,
        displayName: formatOnlyCcName(name),
        value,
        formattedValue: value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    if (top10.length === 0) return [];

    const maxVal = Math.max(...top10.map(item => item.value));

    // Ordenar os TOP 10 em ORDEM ALFABÉTICA pelo nome limpo (displayName)
    const sortedAlphabetically = [...top10].sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR', { numeric: true }));

    return sortedAlphabetically.map(item => ({
      ...item,
      isMax: item.value === maxVal && maxVal > 0
    }));
  }, [lancamentosFiltrados]);

  // Gráfico 8: Tempo Médio de Aprovação (em dias) por Alçada de Aprovação / Diretor
  const dataMediaAprovacao = useMemo(() => {
    const parseDate = (str: string) => {
      if (!str) return null;
      if (str.includes("-")) {
        return new Date(str + "T12:00:00");
      }
      if (str.includes("/")) {
        const parts = str.split("/");
        if (parts.length === 3) {
          return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      }
      return null;
    };

    const dadosPorAprovador: Record<string, { nome: string; somaDias: number; total: number }> = {};

    lancamentos.forEach((l) => {
      const isApprovedOrFinalized = (l.status || "").toLowerCase().includes("aprovado") || (l.status || "").toLowerCase().includes("finalizado");
      if (!isApprovedOrFinalized) return;

      const aprovador = l.aprovadores || "Diretoria Financeira";

      const dtLanc = parseDate(l.dataLancamento || l.dataEmissao);
      const dtAprov = parseDate(l.dataAprovacao);

      if (dtLanc && dtAprov) {
        const diffTime = Math.abs(dtAprov.getTime() - dtLanc.getTime());
        const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (!dadosPorAprovador[aprovador]) {
          dadosPorAprovador[aprovador] = { nome: aprovador, somaDias: 0, total: 0 };
        }
        dadosPorAprovador[aprovador].somaDias += dias;
        dadosPorAprovador[aprovador].total += 1;
      }
    });

    return Object.values(dadosPorAprovador)
      .map(item => ({
        name: item.nome,
        media: item.total > 0 ? Math.round((item.somaDias / item.total) * 10) / 10 : 0,
        totalAprovados: item.total
      }))
      .filter(item => item.media > 0);
  }, [lancamentos]);

  return (
    <div className="space-y-6 relative">
      
      {/* Container Sticky para os cartões superiores e filtros ficarem sempre visíveis (Dashboard BI) */}
      <div className="sticky top-[-16px] z-35 bg-slate-50/98 backdrop-blur-md pb-4 pt-4 border-b border-slate-200/40 -mx-4 md:-mx-6 px-4 md:px-6 shadow-sm/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-display font-black text-slate-800 flex items-center gap-2 text-left">
              <span>Dashboard Analítico</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">BI REAL-TIME</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium text-left">Relatórios e indicadores dinâmicos atualizados na hora.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold px-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filtros:</span>
            </div>
            
            {/* Filtro Dinâmico de Período (Mês de Vencimento) */}
            <select 
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 py-1.5 px-3 rounded-lg cursor-pointer outline-none border border-slate-200"
            >
              <option value="Todos">📅 Todos os Períodos</option>
              {mesesDisponiveis.filter(m => m !== "Todos").map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Filtro Dinâmico de Fornecedor */}
            <select 
              value={filtroFornecedor}
              onChange={(e) => setFiltroFornecedor(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 py-1.5 px-3 rounded-lg cursor-pointer outline-none border border-slate-200"
            >
              <option value="Todos">🏢 Todos Fornecedores</option>
              {fornecedoresUnicos.filter(f => f !== "Todos").map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards Grid - Sempre Visível no topo do painel, agora super espaçoso para não cortar os textos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard 
            title="Total Documentos" 
            value={stats.totalDocs} 
            icon={Receipt} 
            theme="blue"
            trend={{
              percent: trendDocs.percent,
              isGood: trendDocs.isGood,
              label: `vs. ${mesReferenciaAnterior} (${trendDocs.rawAnterior} ${trendDocs.rawAnterior === 1 ? 'doc' : 'docs'})`
            }}
            delay={0.02}
          />
          <KpiCard 
            title="Faturas Pendentes" 
            value={stats.pendentes} 
            icon={Clock} 
            theme="orange"
            delay={0.06}
          />
          <KpiCard 
            title="Lançamentos Finalizados" 
            value={stats.finalizados} 
            icon={CheckCircle2} 
            theme="emerald"
            delay={0.10}
          />
          <KpiCard 
            title="Média SLA Aprovação" 
            value={slaMedioAtual} 
            icon={Clock} 
            theme="violet"
            trend={{
              percent: trendSla.percent,
              isGood: trendSla.isGood,
              label: `vs. ${mesReferenciaAnterior} (${trendSla.rawAnterior} ${trendSla.rawAnterior === 1 ? 'dia' : 'dias'})`
            }}
            delay={0.14}
          />
          <KpiCard 
            title="Valor Consolidado" 
            value={stats.totalValor} 
            icon={TrendingUp} 
            theme="emerald"
            trend={{
              percent: trendValor.percent,
              isGood: trendValor.isGood,
              label: `vs. ${mesReferenciaAnterior} (${trendValor.rawAnteriorFormated})`
            }}
            delay={0.18}
          />
        </div>
      </div>

      {/* Grid de Gráficos de alta resolução */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        
        {/* Gráfico 1: Evolução de Lançamentos com Meses Completos (Soberano na linha inteira - Valor R$ + Qtd) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="lg:col-span-3 bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 flex flex-col justify-between"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-800">Evolução de Lançamentos</h3>
              <p className="text-xs text-slate-400 font-medium">Histórico acumulado de volume financeiro (R$) e quantidade total de documentos por período.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Legenda de Cores da Identidade Visual Risel */}
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-[11px] font-extrabold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-sm" />
                  <span className="text-slate-700">Valor Total (R$)</span>
                </div>
                <div className="w-px h-3 bg-slate-300" />
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] shadow-sm" />
                  <span className="text-slate-700">Qtd. Lançamentos</span>
                </div>
              </div>

              {/* Botões Mês/Dia */}
              <div className="flex bg-slate-100 p-1 rounded-[12px] border border-slate-200">
                <button 
                  onClick={() => setPeriodo("dia")}
                  className={cn("px-3 py-1 text-xs font-bold rounded-[8px] transition-colors cursor-pointer", periodo === "dia" ? "bg-white text-[#114D38] shadow-sm" : "text-slate-500")}
                >
                  Dia
                </button>
                <button 
                  onClick={() => setPeriodo("mes")}
                  className={cn("px-3 py-1 text-xs font-bold rounded-[8px] transition-colors cursor-pointer", periodo === "mes" ? "bg-white text-[#114D38] shadow-sm" : "text-slate-500")}
                >
                  Mês
                </button>
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataEvolucao} margin={{ top: 10, right: 15, left: 15, bottom: 10 }}>
                <defs>
                  {/* Gradiente 1: Valor Total (R$) - Verde Risel (#10b981) */}
                  <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  {/* Gradiente 2: Qtd Lançamentos - Azul Sky Risel (#0284c7) */}
                  <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.30}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 11, fontWeight: 700}} dy={10} />
                
                {/* Eixo Esquerdo: Valor (R$) */}
                <YAxis 
                  yAxisId="valor" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#059669', fontSize: 10, fontWeight: 800}} 
                  tickFormatter={(val) => `R$ ${parseFloat(val).toLocaleString('pt-BR', { notation: 'compact', compactDisplay: 'short' })}`} 
                />
                
                {/* Eixo Direito: Qtd Documentos */}
                <YAxis 
                  yAxisId="docs" 
                  orientation="right" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#0284c7', fontSize: 10, fontWeight: 800}} 
                  tickFormatter={(val) => `${val} un`} 
                />

                <RechartsTooltip 
                  formatter={(value: any, name: any) => {
                    if (name === "Valor Total (R$)" || name === "valor") {
                      return [`R$ ${parseFloat(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, "Valor Total"];
                    }
                    return [`${value} lançamento(s)`, "Qtd. Lançamentos"];
                  }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 20px -3px rgba(0,0,0,0.08)', backgroundColor: '#fff', color: '#114D38', fontWeight: 'bold' }}
                />

                {/* Área 1: Valor (R$) - Gradiente Verde */}
                <Area 
                  yAxisId="valor" 
                  type="monotone" 
                  dataKey="valor" 
                  name="Valor Total (R$)" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorValor)" 
                />

                {/* Área 2: Qtd. Lançamentos - Gradiente Azul */}
                <Area 
                  yAxisId="docs" 
                  type="monotone" 
                  dataKey="docs" 
                  name="Qtd. Lançamentos" 
                  stroke="#0284c7" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorDocs)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Pódio de Fornecedores (Maiores Custos - 2 colunas) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.24 }}
          className="lg:col-span-2 bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 flex flex-col justify-between text-left"
        >
          <div>
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="font-display font-extrabold text-lg text-slate-800 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Maiores Custos (Ranking Fornecedores)
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Top 5 fornecedores homologados ordenados por volume financeiro lançado no período.
                </p>
              </div>
              <div className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-100 flex items-center gap-1 shrink-0">
                <Crown className="w-3.5 h-3.5 text-amber-500" /> Top Fornecedores
              </div>
            </div>

            {/* Visual do Pódio 3D */}
            {dataFornecedores.length > 0 ? (
              <div className="mt-8 mb-4 flex flex-col justify-between gap-6 md:gap-4">
                {/* O Pódio das 5 posições físicas */}
                <div className="flex items-end justify-center gap-1.5 sm:gap-3 md:gap-4 lg:gap-5 pt-10 min-h-[220px]">
                  
                  {/* 5º Lugar - Slate/Ferro */}
                  {dataFornecedores[4] ? (
                    <div className="flex flex-col items-center flex-1 max-w-[110px] sm:max-w-[125px] group">
                      {/* Nome e Valor */}
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] text-slate-500 font-black block leading-tight truncate w-full px-1 uppercase" title={dataFornecedores[4].name.toUpperCase()}>
                          {formatarNomeFornecedor(dataFornecedores[4].name)}
                        </span>
                        <span className="text-[10px] sm:text-xs font-display font-black text-slate-600 block mt-0.5 whitespace-nowrap">
                          {dataFornecedores[4].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      
                      {/* Coluna Física */}
                      <div className="w-full h-11 bg-gradient-to-t from-slate-100 via-slate-50/50 to-white border-x border-t border-slate-200 rounded-t-2xl shadow-sm flex flex-col items-center justify-between p-2 transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-1 relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-200 rounded-t-2xl" />
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-50 border border-slate-300 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-slate-500 shadow-inner">
                          5º
                        </div>
                        <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center flex-1 max-w-[110px] sm:max-w-[125px] opacity-30">
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[10px] text-slate-400 font-bold block">N/A</span>
                      </div>
                      <div className="w-full h-8 bg-slate-100 border-t border-slate-200 rounded-t-2xl" />
                    </div>
                  )}

                  {/* 3º Lugar - Bronze */}
                  {dataFornecedores[2] ? (
                    <div className="flex flex-col items-center flex-1 max-w-[110px] sm:max-w-[125px] group">
                      {/* Nome e Valor */}
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] text-orange-800 font-black block leading-tight truncate w-full px-1 uppercase" title={dataFornecedores[2].name.toUpperCase()}>
                          {formatarNomeFornecedor(dataFornecedores[2].name)}
                        </span>
                        <span className="text-[10px] sm:text-xs font-display font-black text-slate-650 block mt-0.5 whitespace-nowrap">
                          {dataFornecedores[2].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      
                      {/* Coluna Física */}
                      <div className="w-full h-20 bg-gradient-to-t from-orange-100 via-orange-50/50 to-white border-x border-t border-orange-200 rounded-t-2xl shadow-sm flex flex-col items-center justify-between p-2.5 transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-1 relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-orange-300 to-orange-500 rounded-t-2xl" />
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-50 border-2 border-orange-400 flex items-center justify-center text-[10px] sm:text-xs font-black text-orange-800 shadow-inner">
                          3º
                        </div>
                        <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center flex-1 max-w-[110px] sm:max-w-[125px] opacity-30">
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[10px] text-slate-400 font-bold block">N/A</span>
                      </div>
                      <div className="w-full h-12 bg-slate-100 border-t border-slate-200 rounded-t-2xl" />
                    </div>
                  )}

                  {/* 1º Lugar - Ouro */}
                  {dataFornecedores[0] ? (
                    <div className="flex flex-col items-center flex-1 max-w-[120px] sm:max-w-[135px] group relative -mt-6">
                      {/* Coroa flutuante */}
                      <Crown className="w-6 h-6 text-amber-400 animate-bounce absolute -top-10 drop-shadow-md" />
                      
                      {/* Nome e Valor */}
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[10px] sm:text-xs text-amber-900 font-black block leading-tight truncate w-full px-1 uppercase" title={dataFornecedores[0].name.toUpperCase()}>
                          {formatarNomeFornecedor(dataFornecedores[0].name)}
                        </span>
                        <span className="text-xs sm:text-sm md:text-base font-display font-black text-[#114D38] block mt-0.5 whitespace-nowrap">
                          {dataFornecedores[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      
                      {/* Coluna Física */}
                      <div className="w-full h-32 bg-gradient-to-t from-amber-100 via-amber-50 to-white border-x border-t border-amber-300 rounded-t-2xl shadow-xl flex flex-col items-center justify-between p-3 transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-1 relative">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-t-2xl" />
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-xs sm:text-sm font-black text-amber-700 shadow-md">
                          1º
                        </div>
                        <Trophy className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-amber-500" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center flex-1 max-w-[120px] sm:max-w-[135px] opacity-30">
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[10px] text-slate-400 font-bold block">N/A</span>
                      </div>
                      <div className="w-full h-24 bg-slate-100 border-t border-slate-200 rounded-t-2xl" />
                    </div>
                  )}

                  {/* 2º Lugar - Prata */}
                  {dataFornecedores[1] ? (
                    <div className="flex flex-col items-center flex-1 max-w-[110px] sm:max-w-[125px] group">
                      {/* Nome e Valor */}
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] text-slate-700 font-black block leading-tight truncate w-full px-1 uppercase" title={dataFornecedores[1].name.toUpperCase()}>
                          {formatarNomeFornecedor(dataFornecedores[1].name)}
                        </span>
                        <span className="text-[10px] sm:text-xs font-display font-black text-slate-650 block mt-0.5 whitespace-nowrap">
                          {dataFornecedores[1].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      
                      {/* Coluna Física */}
                      <div className="w-full h-26 bg-gradient-to-t from-slate-200 via-slate-100 to-white border-x border-t border-slate-300 rounded-t-2xl shadow-md flex flex-col items-center justify-between p-2.5 transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1 relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-400 rounded-t-2xl" />
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 border-2 border-slate-400 flex items-center justify-center text-[10px] sm:text-xs font-black text-slate-600 shadow-inner">
                          2º
                        </div>
                        <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center flex-1 max-w-[110px] sm:max-w-[125px] opacity-30">
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[10px] text-slate-400 font-bold block">N/A</span>
                      </div>
                      <div className="w-full h-16 bg-slate-100 border-t border-slate-200 rounded-t-2xl" />
                    </div>
                  )}

                  {/* 4º Lugar - Esmeralda/Verde */}
                  {dataFornecedores[3] ? (
                    <div className="flex flex-col items-center flex-1 max-w-[110px] sm:max-w-[125px] group">
                      {/* Nome e Valor */}
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] text-emerald-800 font-black block leading-tight truncate w-full px-1 uppercase" title={dataFornecedores[3].name.toUpperCase()}>
                          {formatarNomeFornecedor(dataFornecedores[3].name)}
                        </span>
                        <span className="text-[10px] sm:text-xs font-display font-black text-slate-600 block mt-0.5 whitespace-nowrap">
                          {dataFornecedores[3].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      
                      {/* Coluna Física */}
                      <div className="w-full h-16 bg-gradient-to-t from-emerald-50 via-emerald-50/20 to-white border-x border-t border-emerald-200 rounded-t-2xl shadow-sm flex flex-col items-center justify-between p-2 transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-1 relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-200 to-emerald-300 rounded-t-2xl" />
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-emerald-800 shadow-inner">
                          4º
                        </div>
                        <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center flex-1 max-w-[110px] sm:max-w-[125px] opacity-30">
                      <div className="text-center mb-3 min-h-[48px] flex flex-col justify-end w-full">
                        <span className="text-[10px] text-slate-400 font-bold block">N/A</span>
                      </div>
                      <div className="w-full h-10 bg-slate-100 border-t border-slate-200 rounded-t-2xl" />
                    </div>
                  )}

                </div>
              </div>
            ) : (
              <div className="mt-12 mb-6 py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                <Trophy className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
                <span className="text-xs font-bold">Sem dados de fornecedores para o período</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Gráfico 2: Divisão por Status (1 coluna, ao lado do pódio) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.28 }}
          className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 flex flex-col justify-between"
        >
          <div>
            <h3 className="font-display font-extrabold text-lg text-slate-800">Faturas por Status</h3>
          </div>
          <div className="h-[260px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataStatus.length > 0 ? dataStatus : [{ name: "Sem dados", value: 1, color: "#cbd5e1" }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: any) => [value, "Quantidade"]}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: '#fff', color: '#1e293b' }} 
                />
                <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 750 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-30px]">
              <span className="text-2xl font-display font-black text-slate-800">{lancamentosFiltrados.length}</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">faturas</span>
            </div>
          </div>
        </motion.div>

        {/* Gráfico 4: Volume por Base/Filial (2 colunas) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.32 }}
          className="lg:col-span-2 bg-gradient-to-br from-[#114D38] to-slate-900 rounded-[24px] p-6 shadow-lg border border-slate-700 text-white flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div>
            <h3 className="font-display font-extrabold text-lg text-white">Lançamentos por Base/Filial</h3>
            <p className="text-xs text-slate-300 font-medium">Distribuição geográfica do volume de faturas cadastradas.</p>
          </div>
          <div className="h-[240px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataEstabelecimento.length > 0 ? dataEstabelecimento : [{ name: "Sem dados", value: 0 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBaseFilial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#114D38" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                <RechartsTooltip 
                  cursor={{fill: '#1e293b', opacity: 0.15}} 
                  formatter={(value: any) => [value, "Quantidade"]}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff' }} 
                />
                <Bar dataKey="value" fill="url(#colorBaseFilial)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Gráfico 5: Por Tipo de Documento (1 coluna) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.36 }}
          className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 flex flex-col justify-between"
        >
          <div>
            <h3 className="font-display font-extrabold text-lg text-slate-800">Documentos por Tipo</h3>
            <p className="text-xs text-slate-400 font-medium">Filtro de arquivos categorizados por tipo regulatório.</p>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(dataPorTipo.length > 0 ? dataPorTipo : [{ name: "Sem dados", value: 0, color: "#94a3b8" }]) as any} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
                <RechartsTooltip 
                  formatter={(value: any) => [value, "Quantidade"]}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: '#fff', color: '#1e293b' }} 
                />
                <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} barSize={16}>
                  {dataPorTipo.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || "#10b981"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Subgrid Simétrico de Largura Cheia para os dois últimos gráficos: Frequência e Formas de Pagamento */}
        <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico 6: Por Frequência (Recorrência) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.40 }}
            className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 flex flex-col justify-between"
          >
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-800">Frequência</h3>
              <p className="text-xs text-slate-400 font-medium">Recorrência mensal versus faturas avulsas esporádicas.</p>
            </div>
            <div className="h-[240px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPorFrequencia}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {dataPorFrequencia.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: any) => [value, "Quantidade"]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: '#fff', color: '#1e293b' }} 
                  />
                  <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Gráfico 7: Por Forma de Pagamento */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.44 }}
            className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 flex flex-col justify-between"
          >
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-800">Formas de Pagamento</h3>
              <p className="text-xs text-slate-400 font-medium">Canais e canais bancários mais utilizados para liquidação.</p>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataPorPagamento.length > 0 ? dataPorPagamento : [{ name: "Sem dados", value: 0 }]} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 700}} />
                  <RechartsTooltip 
                    cursor={{fill: '#f8fafc'}} 
                    formatter={(value: any) => [value, "Quantidade"]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: '#fff', color: '#1e293b' }} 
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={12}>
                    {dataPorPagamento.map((entry, index) => {
                      const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#64748b'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

        </div>

        {/* Gráfico Destacado: TOP 10 Custos por Centro de Custo */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.48 }}
          className="lg:col-span-3 bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 flex flex-col justify-between"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <h3 className="font-display font-extrabold text-xl text-slate-800 flex items-center gap-2">
              <Building className="w-5.5 h-5.5 text-[#114D38]" />
              <span>TOP 10 Custos por Centro de Custo</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="bg-[#114D38]/10 text-[#114D38] border border-[#114D38]/20 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                {dataTopCentroCusto.length} C.C ATIVOS
              </span>
            </div>
          </div>

          {dataTopCentroCusto.length > 0 ? (
            <div className="h-[360px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataTopCentroCusto} margin={{ top: 25, right: 20, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="displayName" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#334155', fontSize: 11, fontWeight: 800}} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#059669', fontSize: 10, fontWeight: 800}} 
                    tickFormatter={(val) => `R$ ${parseFloat(val).toLocaleString('pt-BR', { notation: 'compact', compactDisplay: 'short' })}`} 
                  />
                  <RechartsTooltip 
                    cursor={{fill: '#f0fdf4'}} 
                    formatter={(value: any) => [
                      `R$ ${parseFloat(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 
                      "Custo Total"
                    ]}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 20px -3px rgba(0,0,0,0.08)', backgroundColor: '#fff', color: '#114D38', fontWeight: 'bold' }} 
                  />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                    <LabelList dataKey="formattedValue" position="top" style={{ fontSize: '11px', fontWeight: '900', fill: '#114D38' }} />
                    {dataTopCentroCusto.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.isMax ? '#f59e0b' : '#114D38'} 
                        stroke={entry.isMax ? '#d97706' : '#0d3d2c'}
                        strokeWidth={entry.isMax ? 2 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 font-medium text-xs">
              Nenhum custo por Centro de Custo registrado no período selecionado.
            </div>
          )}
        </motion.div>

      </div>

    </div>
  );
}

// Componente KpiCard com design moderno e premium com suporte a tendências e animações dinâmicas de transição
function KpiCard({ title, value, icon: Icon, theme, trend, delay = 0 }: any) {
  // Gradientes premium com alto contraste e design requintado
  const themes = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/15',
      iconBg: 'bg-white/15 text-blue-100 border-white/10',
      titleText: 'text-blue-100',
      valueText: 'text-white'
    },
    orange: {
      bg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/15',
      iconBg: 'bg-white/15 text-orange-100 border-white/10',
      titleText: 'text-orange-50',
      valueText: 'text-white'
    },
    emerald: {
      bg: 'bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-800 text-white shadow-lg shadow-emerald-500/25',
      iconBg: 'bg-white/20 text-emerald-50 border-white/15',
      titleText: 'text-emerald-50 font-medium',
      valueText: 'text-white font-extrabold'
    },
    violet: {
      bg: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-800 text-white shadow-lg shadow-violet-500/25',
      iconBg: 'bg-white/20 text-violet-50 border-white/15',
      titleText: 'text-violet-100 font-medium',
      valueText: 'text-white font-extrabold'
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-500 to-indigo-700 text-white shadow-lg shadow-purple-500/15',
      iconBg: 'bg-white/15 text-purple-100 border-white/10',
      titleText: 'text-purple-100',
      valueText: 'text-white'
    },
  }[theme as string] || {
    bg: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-slate-500/10',
    iconBg: 'bg-white/15 text-slate-100 border-white/10',
    titleText: 'text-slate-100',
    valueText: 'text-white'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      className={cn(
        "rounded-[22px] p-3.5 border border-white/5 shadow-md relative overflow-hidden transition-all duration-300 ease-out cursor-default group hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg flex flex-col justify-between min-h-[105px]",
        themes.bg
      )}
    >
      {/* Círculo luminoso de background */}
      <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-colors pointer-events-none" />
      
      <div className="flex items-center gap-3 w-full">
        <div className={cn("p-2 rounded-2xl transition-all duration-300 group-hover:scale-110 border backdrop-blur-sm shadow-inner shrink-0", themes.iconBg)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="overflow-hidden text-left flex-1 min-w-0">
          <h4 className={cn("text-[9px] sm:text-[10px] font-black uppercase tracking-wider whitespace-normal break-words leading-tight mb-0.5", themes.titleText)}>
            {title}
          </h4>
          <div className={cn("text-sm sm:text-base font-display font-black tracking-tight leading-none truncate", themes.valueText)}>
            {value}
          </div>
        </div>
      </div>

      {/* Seção de tendência baseada em BI moderno com formatação condicional */}
      {trend && (
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[9px] font-bold w-full">
          <span className="text-white/70 truncate">{trend.label}</span>
          <span className={cn(
            "px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm font-black",
            trend.isGood 
              ? "bg-emerald-500/20 text-emerald-250 border border-emerald-500/15" 
              : "bg-rose-500/20 text-rose-250 border border-rose-500/15"
          )}>
            {trend.percent}
          </span>
        </div>
      )}
    </motion.div>
  );
}
