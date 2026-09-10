import { saveFornecedorSupabase } from "./supabaseService";

export interface CnpjSearchResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cnae_fiscal_descricao?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  situacao_cadastral?: string;
  isRisel?: boolean;
  source?: string;
}

/**
 * Consulta informações de CNPJ com múltiplas contingências
 * 1. Backend proxy /api/cnpj/:cnpj (MinhaReceita -> BrasilAPI -> ReceitaWS)
 * 2. Fallback direto no client se o servidor local estiver inacessível
 */
export async function consultarCnpjReceita(cnpjRaw: string): Promise<CnpjSearchResult | null> {
  const cleanCnpj = (cnpjRaw || "").replace(/\D/g, "");
  if (cleanCnpj.length !== 14) return null;

  // 1ª Tentativa: Via Backend do Risel ERP
  try {
    const res = await fetch(`/api/cnpj/${cleanCnpj}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        return {
          ...json.data,
          isRisel: json.isRisel || cleanCnpj === "46677860000165" || cleanCnpj === "03882880000120"
        };
      }
    }
  } catch (err) {
    console.warn("[CNPJ] Falha ao consultar endpoint interno /api/cnpj, tentando fallback externo:", err);
  }

  // 2ª Tentativa: MinhaReceita direto no cliente
  try {
    const res1 = await fetch(`https://minhareceita.org/${cleanCnpj}`, {
      signal: AbortSignal.timeout(4500)
    });
    if (res1.ok) {
      const d1 = await res1.json();
      const razao = (d1.razao_social || d1.nome_fantasia || "").trim();
      if (razao) {
        const isRisel = cleanCnpj === "46677860000165" || 
                        cleanCnpj === "03882880000120" || 
                        razao.toUpperCase().includes("RISEL COMBUSTIVEIS");
        return {
          cnpj: cleanCnpj,
          razao_social: razao,
          nome_fantasia: (d1.nome_fantasia || "").trim(),
          cnae_fiscal_descricao: d1.cnae_fiscal_descricao || "",
          logradouro: d1.logradouro || "",
          numero: d1.numero || "",
          bairro: d1.bairro || "",
          municipio: d1.municipio || "",
          uf: d1.uf || "",
          cep: d1.cep || "",
          telefone: d1.ddd_telefone_1 || "",
          email: d1.email || "",
          situacao_cadastral: d1.descricao_situacao_cadastral || "ATIVA",
          isRisel,
          source: "MinhaReceita Client"
        };
      }
    }
  } catch (err) {}

  // 3ª Tentativa: BrasilAPI direto no cliente
  try {
    const res2 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: AbortSignal.timeout(4500)
    });
    if (res2.ok) {
      const d2 = await res2.json();
      const razao = (d2.razao_social || d2.nome_fantasia || "").trim();
      if (razao) {
        const isRisel = cleanCnpj === "46677860000165" || 
                        cleanCnpj === "03882880000120" || 
                        razao.toUpperCase().includes("RISEL COMBUSTIVEIS");
        return {
          cnpj: cleanCnpj,
          razao_social: razao,
          nome_fantasia: (d2.nome_fantasia || "").trim(),
          cnae_fiscal_descricao: d2.cnae_fiscal_descricao || "",
          logradouro: d2.logradouro || "",
          numero: d2.numero || "",
          bairro: d2.bairro || "",
          municipio: d2.municipio || "",
          uf: d2.uf || "",
          cep: d2.cep || "",
          telefone: d2.ddd_telefone_1 || "",
          email: d2.email || "",
          situacao_cadastral: d2.descricao_situacao_cadastral || "ATIVA",
          isRisel,
          source: "BrasilAPI Client"
        };
      }
    }
  } catch (err) {}

  return null;
}

/**
 * Formata CNPJ ou CPF para exibição amigável
 */
export function formatarCnpjCpf(valor: string): string {
  if (!valor) return "";
  const clean = valor.replace(/\D/g, "");
  if (clean.length === 14) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`;
  }
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  }
  return valor;
}

/**
 * Regra de Negócio:
 * "quando for um lançamento mensal, ou tiver mais de três lançamentos, mesmo que não seja mensal, envie para a lista de cadastro de Fornecedores"
 */
export async function avaliarEEnviarFornecedor(
  novoOuEditadoLancamento: any,
  historicoCompletoLancamentos: any[],
  dadosCnpjComplementares?: Partial<CnpjSearchResult> | null
): Promise<{ qualificado: boolean; motivo?: string; fornecedorCadastrado?: any }> {
  try {
    const rawCnpj = novoOuEditadoLancamento.cnpj || "";
    const cleanCnpj = rawCnpj.replace(/\D/g, "");
    const nomeFornecedor = (novoOuEditadoLancamento.fornecedor || "").trim();

    if (!nomeFornecedor && !cleanCnpj) {
      return { qualificado: false };
    }

    // Ignora se for a própria Risel Combustíveis
    if (cleanCnpj === "46677860000165" || cleanCnpj === "03882880000120" || nomeFornecedor.toUpperCase().includes("RISEL COMBUSTIVEIS")) {
      return { qualificado: false, motivo: "CNPJ/Razão pertence à própria Risel (tomador)." };
    }

    // 1. Critério de Periodicidade: Mensal
    const ehMensal = 
      novoOuEditadoLancamento.tipo === "Mensal" || 
      novoOuEditadoLancamento.frequencia === "Mensal";

    // 2. Critério de Volume: Mais de 3 lançamentos (ou seja >= 3 registros deste mesmo fornecedor/CNPJ)
    let contagem = 0;
    historicoCompletoLancamentos.forEach(l => {
      const lCleanCnpj = (l.cnpj || "").replace(/\D/g, "");
      const lNome = (l.fornecedor || "").trim().toUpperCase();

      const bateCnpj = cleanCnpj && lCleanCnpj && lCleanCnpj === cleanCnpj;
      const bateNome = nomeFornecedor && lNome && lNome === nomeFornecedor.toUpperCase();

      if (bateCnpj || bateNome) {
        contagem++;
      }
    });

    // Se o item que está sendo salvo não estiver na lista histórica ainda, soma 1
    const existeNoHistorico = historicoCompletoLancamentos.some(x => String(x.id) === String(novoOuEditadoLancamento.id));
    const contagemTotal = existeNoHistorico ? contagem : contagem + 1;

    const temMaisDeTres = contagemTotal >= 3;

    if (!ehMensal && !temMaisDeTres) {
      return { 
        qualificado: false, 
        motivo: `Ainda possui ${contagemTotal} lançamento(s) (necessário 3 ou frequência Mensal)` 
      };
    }

    const formattedCnpj = cleanCnpj ? formatarCnpjCpf(cleanCnpj) : "";
    const fornRecord = {
      cnpj: formattedCnpj,
      nome: nomeFornecedor,
      codigoItem: novoOuEditadoLancamento.itemSistema || dadosCnpjComplementares?.cnae_fiscal_descricao?.slice(0, 20) || "",
      cidade: dadosCnpjComplementares?.municipio || novoOuEditadoLancamento.cidade || "",
      uf: dadosCnpjComplementares?.uf || novoOuEditadoLancamento.uf || "",
      telefone: dadosCnpjComplementares?.telefone || novoOuEditadoLancamento.telefone || "",
      email: dadosCnpjComplementares?.email || novoOuEditadoLancamento.email || "",
      status: "Ativo",
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeFornecedor.charAt(0) || "F")}&background=f8fafc`
    };

    // Atualiza no localStorage
    try {
      const savedForn = localStorage.getItem("risel_fornecedores");
      let listForn: any[] = savedForn ? JSON.parse(savedForn) : [];
      const idx = listForn.findIndex((f: any) => {
        const fc = (f.cnpj || "").replace(/\D/g, "");
        return (cleanCnpj && fc === cleanCnpj) || (f.nome && f.nome.toUpperCase() === nomeFornecedor.toUpperCase());
      });

      if (idx >= 0) {
        listForn[idx] = { ...listForn[idx], ...fornRecord };
      } else {
        listForn.push(fornRecord);
      }
      localStorage.setItem("risel_fornecedores", JSON.stringify(listForn));
    } catch (e) {
      console.warn("Erro ao salvar no storage de fornecedores:", e);
    }

    // Persiste no Supabase
    saveFornecedorSupabase(fornRecord).catch(e => {
      console.warn("Aviso ao persistir fornecedor qualificado no Supabase:", e);
    });

    const motivoDesc = ehMensal 
      ? "Lançamento de frequência Mensal (recorrente)" 
      : `Identificados ${contagemTotal} lançamentos para este fornecedor (mínimo de 3 atingido)`;

    return {
      qualificado: true,
      motivo: motivoDesc,
      fornecedorCadastrado: fornRecord
    };
  } catch (err) {
    console.error("Erro ao avaliar e promover fornecedor:", err);
    return { qualificado: false };
  }
}

/**
 * Faz uma varredura geral em todos os lançamentos existentes e garante que qualquer fornecedor
 * mensal ou com 3+ lançamentos seja promovido para a tabela de Fornecedores.
 */
export async function sincronizarFornecedoresFrequentes(lancamentos: any[]): Promise<number> {
  if (!Array.isArray(lancamentos) || lancamentos.length === 0) return 0;

  let promovidos = 0;
  // Agrupa lançamentos por CNPJ ou nome
  const grupos = new Map<string, { itens: any[]; nome: string; cnpj: string }>();

  lancamentos.forEach(item => {
    const cleanCnpj = (item.cnpj || "").replace(/\D/g, "");
    const nome = (item.fornecedor || "").trim();
    if (!cleanCnpj && !nome) return;

    // Ignora Risel
    if (cleanCnpj === "46677860000165" || cleanCnpj === "03882880000120" || nome.toUpperCase().includes("RISEL COMBUSTIVEIS")) {
      return;
    }

    const chave = cleanCnpj || nome.toUpperCase();
    if (!grupos.has(chave)) {
      grupos.set(chave, { itens: [], nome, cnpj: item.cnpj || "" });
    }
    grupos.get(chave)!.itens.push(item);
  });

  for (const [, grupo] of grupos.entries()) {
    const ehMensal = grupo.itens.some(x => x.tipo === "Mensal" || x.frequencia === "Mensal");
    const temTresOuMais = grupo.itens.length >= 3;

    if (ehMensal || temTresOuMais) {
      const primeiro = grupo.itens[0];
      const res = await avaliarEEnviarFornecedor(primeiro, lancamentos);
      if (res.qualificado) {
        promovidos++;
      }
    }
  }

  return promovidos;
}
