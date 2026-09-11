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
 * Verifica se um CNPJ ou Razão Social pertence à própria Risel Combustíveis (Tomador/Destinatário)
 */
export function isRiselCnpjOrName(cnpjRaw?: string, nameRaw?: string): boolean {
  const clean = (cnpjRaw || "").replace(/\D/g, "");
  const upper = (nameRaw || "").toUpperCase();

  if (clean.startsWith("46677860") || clean.startsWith("03882880")) {
    return true;
  }
  if (upper.includes("RISEL COMBUSTIVEIS") || upper.includes("RISEL COMBUSTÍVEIS") || upper === "RISEL") {
    return true;
  }
  return false;
}

/**
 * Consulta informações de CNPJ com múltiplas contingências
 * 1. Backend proxy /api/cnpj/:cnpj (BrasilAPI -> MinhaReceita -> ReceitaWS)
 * 2. Fallback direto no client via BrasilAPI (aberta com CORS e ultra-rápida)
 * 3. Fallback adicional via MinhaReceita
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
        const razao = (json.data.razao_social || json.data.nome_fantasia || "").trim();
        const isRisel = json.isRisel || isRiselCnpjOrName(cleanCnpj, razao);
        return {
          ...json.data,
          isRisel
        };
      }
    }
  } catch (err) {
    console.warn("[CNPJ] Falha ao consultar endpoint interno /api/cnpj, tentando fallback externo:", err);
  }

  // 2ª Tentativa: BrasilAPI direto no cliente (CORS liberado, resposta em ~100ms)
  try {
    const res2 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: AbortSignal.timeout(4500)
    });
    if (res2.ok) {
      const d2 = await res2.json();
      const razao = (d2.razao_social || d2.nome_fantasia || "").trim();
      if (razao) {
        const isRisel = isRiselCnpjOrName(cleanCnpj, razao) || isRiselCnpjOrName(cleanCnpj, d2.nome_fantasia);
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
          telefone: d2.ddd_telefone_1 || d2.ddd_telefone_2 || d2.telefone || "",
          email: d2.email || "",
          situacao_cadastral: d2.descricao_situacao_cadastral || "ATIVA",
          isRisel,
          source: "BrasilAPI Client"
        };
      }
    }
  } catch (err) {}

  // 3ª Tentativa: MinhaReceita direto no cliente
  try {
    const res1 = await fetch(`https://minhareceita.org/${cleanCnpj}`, {
      signal: AbortSignal.timeout(4500)
    });
    if (res1.ok) {
      const d1 = await res1.json();
      const razao = (d1.razao_social || d1.nome_fantasia || "").trim();
      if (razao) {
        const isRisel = isRiselCnpjOrName(cleanCnpj, razao) || isRiselCnpjOrName(cleanCnpj, d1.nome_fantasia);
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
          telefone: d1.ddd_telefone_1 || d1.ddd_telefone_2 || d1.telefone || "",
          email: d1.email || "",
          situacao_cadastral: d1.descricao_situacao_cadastral || "ATIVA",
          isRisel,
          source: "MinhaReceita Client"
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
 * Formata telefone brasileiro (10 ou 11 dígitos, com suporte a múltiplos números separados por barra/vírgula)
 */
export function formatarTelefone(telRaw?: string): string {
  if (!telRaw) return "";
  const firstPart = telRaw.split(/[\/,;]/)[0]?.trim() || telRaw;
  const clean = firstPart.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6, 10)}`;
  }
  if (clean.length === 9) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return telRaw.trim();
}

/**
 * Regra de Negócio:
 * "quando for um lançamento mensal, ou tiver mais de três lançamentos, mesmo que não seja mensal, envie para a lista de cadastro de Fornecedores"
 * Completa automaticamente todos os dados disponíveis: Telefone, E-mail, Cidade, Estado (UF), Endereço e Código do Item
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

    // Ignora se for a própria Risel Combustíveis (Tomador dos serviços)
    if (isRiselCnpjOrName(cleanCnpj, nomeFornecedor)) {
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

    // Obter dados complementares completos (Telefone, E-mail, Cidade, UF, etc.)
    let complementares: Partial<CnpjSearchResult> | null = dadosCnpjComplementares || null;
    const faltaDados = !complementares || !complementares.municipio || !complementares.telefone || !complementares.email;
    if (cleanCnpj.length === 14 && faltaDados) {
      try {
        const liveSearch = await consultarCnpjReceita(cleanCnpj);
        if (liveSearch) {
          complementares = {
            ...complementares,
            ...liveSearch
          };
        }
      } catch (e) {
        console.warn("Aviso ao buscar dados cadastrais da Receita para fornecedor:", e);
      }
    }

    // Recupera cadastro existente caso já conste no banco local
    let existingForn: any = null;
    try {
      const savedForn = localStorage.getItem("risel_fornecedores");
      if (savedForn) {
        const listForn = JSON.parse(savedForn);
        if (Array.isArray(listForn)) {
          existingForn = listForn.find((f: any) => {
            const fc = (f.cnpj || "").replace(/\D/g, "");
            return (cleanCnpj && fc === cleanCnpj) || (f.nome && f.nome.toUpperCase() === nomeFornecedor.toUpperCase());
          });
        }
      }
    } catch (e) {}

    const formattedCnpj = cleanCnpj ? formatarCnpjCpf(cleanCnpj) : (novoOuEditadoLancamento.cnpj || "");
    const cidadeFinal = (complementares?.municipio || novoOuEditadoLancamento.cidade || existingForn?.cidade || "").trim();
    const ufFinal = (complementares?.uf || novoOuEditadoLancamento.uf || existingForn?.uf || "").toUpperCase().trim();
    const telRaw = complementares?.telefone || novoOuEditadoLancamento.telefone || existingForn?.telefone || "";
    const telFinal = formatarTelefone(telRaw);
    const emailFinal = (complementares?.email || novoOuEditadoLancamento.email || existingForn?.email || "").toLowerCase().trim();
    const codigoItemFinal = novoOuEditadoLancamento.itemSistema || existingForn?.codigoItem || complementares?.cnae_fiscal_descricao?.slice(0, 30) || "";

    const fornRecord = {
      id: existingForn?.id || Date.now(),
      cnpj: cleanCnpj || formattedCnpj,
      cnpjFormatado: formattedCnpj,
      nome: nomeFornecedor,
      codigoItem: codigoItemFinal,
      cidade: cidadeFinal,
      uf: ufFinal,
      telefone: telFinal,
      email: emailFinal,
      logradouro: complementares?.logradouro || existingForn?.logradouro || "",
      numero: complementares?.numero || existingForn?.numero || "",
      bairro: complementares?.bairro || existingForn?.bairro || "",
      cep: complementares?.cep || existingForn?.cep || "",
      status: existingForn?.status || "Ativo",
      avatar: existingForn?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeFornecedor.charAt(0) || "F")}&background=114D38&color=fff&bold=true`
    };

    // Atualiza no localStorage e garante que Risel não esteja na lista
    try {
      const savedForn = localStorage.getItem("risel_fornecedores");
      let listForn: any[] = savedForn ? JSON.parse(savedForn) : [];
      // Remove qualquer registro indevido da própria Risel
      listForn = listForn.filter((f: any) => !isRiselCnpjOrName(f.cnpj, f.nome));

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

      // Notifica todos os módulos abertos sobre a atualização no cadastro de Fornecedores
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("risel_fornecedores_sync_event", { detail: listForn }));
      }
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
 * Enriquece um fornecedor existente com dados completos da Receita Federal (Telefone, E-mail, Cidade, UF, Endereço)
 */
export async function enriquecerDadosFornecedor(fornecedor: any): Promise<any> {
  if (!fornecedor) return fornecedor;
  const cleanCnpj = (fornecedor.cnpj || "").replace(/\D/g, "");
  if (cleanCnpj.length !== 14) return fornecedor;

  try {
    const res = await consultarCnpjReceita(cleanCnpj);
    if (!res) return fornecedor;

    const telRaw = res.telefone || fornecedor.telefone || "";
    const telFinal = formatarTelefone(telRaw);
    const emailFinal = (res.email || fornecedor.email || "").toLowerCase().trim();
    const cidadeFinal = (res.municipio || fornecedor.cidade || "").trim();
    const ufFinal = (res.uf || fornecedor.uf || "").toUpperCase().trim();

    return {
      ...fornecedor,
      nome: fornecedor.nome || res.razao_social,
      cidade: cidadeFinal,
      uf: ufFinal,
      telefone: telFinal,
      email: emailFinal,
      logradouro: res.logradouro || fornecedor.logradouro || "",
      numero: res.numero || fornecedor.numero || "",
      bairro: res.bairro || fornecedor.bairro || "",
      cep: res.cep || fornecedor.cep || "",
      codigoItem: fornecedor.codigoItem || res.cnae_fiscal_descricao?.slice(0, 30) || "",
    };
  } catch (e) {
    console.warn("Erro ao enriquecer dados do fornecedor:", e);
    return fornecedor;
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
    if (isRiselCnpjOrName(cleanCnpj, nome)) {
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
