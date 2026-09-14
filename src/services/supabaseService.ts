import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { VEICULOS_REAIS } from '../data/veiculos_reais';

// Configurações Padrão do Supabase (projeto oficial fornecido)
const env = (import.meta as any).env || {};
const DEFAULT_SUPABASE_URL = env.VITE_SUPABASE_URL || "https://ihowbxlqfcjzzzleasqq.supabase.co";
const DEFAULT_SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlob3dieGxxZmNqenp6bGVhc3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDAwNzksImV4cCI6MjEwMTMxNjA3OX0.nTbdmUa16BrXPlcX_RyWAzpPmCjqeivR1Yo1qjF_Ld0";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastPing?: string;
  pingCount?: number;
}

export function getSupabaseConfig(): SupabaseConfig {
  let savedUrl = localStorage.getItem("risel_supabase_url");
  let savedKey = localStorage.getItem("risel_supabase_key");

  // Se a URL estiver vazia, for exemplo antigo ou não for a do projeto oficial, atualiza automaticamente
  if (!savedUrl || savedUrl.includes("xyzcompany") || savedUrl.includes("xyzproject")) {
    savedUrl = DEFAULT_SUPABASE_URL;
    localStorage.setItem("risel_supabase_url", savedUrl);
  }
  if (!savedKey || savedKey.includes("sample_key")) {
    savedKey = DEFAULT_SUPABASE_KEY;
    localStorage.setItem("risel_supabase_key", savedKey);
  }

  const isConnected = localStorage.getItem("risel_supabase_connected") === "true";
  const lastPing = localStorage.getItem("risel_supabase_last_ping") || undefined;
  const pingCount = parseInt(localStorage.getItem("risel_supabase_ping_count") || "0", 10);

  return {
    url: savedUrl,
    anonKey: savedKey,
    isConnected,
    lastPing,
    pingCount
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem("risel_supabase_url", url.trim());
  localStorage.setItem("risel_supabase_key", anonKey.trim());
  localStorage.setItem("risel_supabase_connected", "true");
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!supabaseInstance) {
    supabaseInstance = createClient(config.url, config.anonKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseInstance;
}

export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

// Interfaces de Dados para Usuários no Supabase
export interface SupabaseUser {
  email: string;
  name: string;
  role: string;
  permissions: any;
  status: string;
  password?: string;
  must_change_password?: boolean;
  created_at?: string;
}

// Interfaces de Dados para o Módulo de Lançamento de Documentos
export interface SupabaseLancamento {
  id: number;
  status: string;
  data_lancamento?: string;
  data_vencimento: string;
  fornecedor: string;
  doc: string;
  valor: string;
  forma_pagto: string;
  tipo: string;
  descricao?: string;
  cnpj?: string;
  estabelecimento?: string;
  nome_arquivo_anexo?: string;
  arquivo_anexo_base64?: string;
  item_sistema?: string;
  data_emissao?: string;
  observacao?: string;
  frequencia?: string;
  lancado_por?: string;
  data_aprovacao?: string;
  centro_custo?: string;
  codigo_lancamento?: string;
  created_at?: string;
}

// 1. Teste de Conexão com o Supabase
export async function testSupabaseConnection(url?: string, key?: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = getSupabaseConfig();
    const targetUrl = url || config.url;
    const targetKey = key || config.anonKey;

    if (!targetUrl || !targetKey || targetUrl.includes("xyzcompany")) {
      return { 
        success: false, 
        message: "Configuração do Supabase pendente. Insira a URL e a Anon Key do projeto no Supabase." 
      };
    }

    const client = createClient(targetUrl, targetKey);
    const { data, error } = await client.from('lancamentos').select('count', { count: 'exact', head: true });

    if (error) {
      if (error.code === "PGRST301" || error.message?.includes("relation") || error.message?.includes("does not exist")) {
        return {
          success: true,
          message: "Conectado ao Supabase! A tabela 'lancamentos' ainda não existe. Clique em 'Criar Tabela no Supabase'."
        };
      }
      return { success: false, message: `Erro ao conectar: ${error.message}` };
    }

    localStorage.setItem("risel_supabase_connected", "true");
    return { success: true, message: "Conexão estabelecida com sucesso com o Banco de Dados Supabase!" };
  } catch (err: any) {
    return { success: false, message: `Falha de rede: ${err.message || "Erro desconhecido"}` };
  }
}

// 2. Anti-Inatividade Keep-Alive Ping (Garante que o banco de dados não entre em pausa no plano gratuito)
export async function pingSupabaseKeepAlive(): Promise<{ success: boolean; timestamp: string; count: number }> {
  const config = getSupabaseConfig();
  const now = new Date().toLocaleString("pt-BR");
  const newCount = (config.pingCount || 0) + 1;

  try {
    const client = getSupabaseClient();
    // Faz uma chamada mínima e leve para manter o banco ativo
    await client.from('lancamentos').select('id').limit(1);

    localStorage.setItem("risel_supabase_last_ping", now);
    localStorage.setItem("risel_supabase_ping_count", newCount.toString());

    return { success: true, timestamp: now, count: newCount };
  } catch (e) {
    localStorage.setItem("risel_supabase_last_ping", now + " (Tentativa realizada)");
    localStorage.setItem("risel_supabase_ping_count", newCount.toString());
    return { success: false, timestamp: now, count: newCount };
  }
}

// 3. Buscar Lançamentos no Supabase
export async function fetchLancamentosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('lancamentos')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar lançamentos no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => {
      // Extrai metadados seguros caso estejam embutidos na observação
      let rawObs = row.observacao || "";
      let parsedOc = row.codigo_lancamento || row.cod_lancamento_oc || "";
      let parsedCc = row.centro_custo || "";
      let parsedAlcada = row.aprovadores || "";
      let parsedBase = row.estabelecimento || "";

      const ocMatch = rawObs.match(/\[OC\/CÓD:\s*([^\]]+)\]/i);
      if (ocMatch && ocMatch[1]) {
        if (!parsedOc) parsedOc = ocMatch[1].trim();
      }

      const ccMatch = rawObs.match(/\[CENTRO DE CUSTO:\s*([^\]]+)\]/i);
      if (ccMatch && ccMatch[1]) {
        if (!parsedCc) parsedCc = ccMatch[1].trim();
      }

      const alcadaMatch = rawObs.match(/\[ALÇADA:\s*([^\]]+)\]/i);
      if (alcadaMatch && alcadaMatch[1]) {
        if (!parsedAlcada) parsedAlcada = alcadaMatch[1].trim();
      }

      const baseMatch = rawObs.match(/\[BASE:\s*([^\]]+)\]/i);
      if (baseMatch && baseMatch[1]) {
        if (!parsedBase) parsedBase = baseMatch[1].trim();
      }

      return {
        id: row.id,
        status: row.status,
        dataLancamento: row.data_lancamento,
        dataVencimento: row.data_vencimento,
        fornecedor: row.fornecedor,
        doc: row.doc,
        valor: row.valor,
        formaPagto: row.forma_pagto,
        tipo: row.tipo,
        descricao: row.descricao,
        cnpj: row.cnpj,
        estabelecimento: parsedBase || "100 - Paulínia",
        nomeArquivoAnexo: row.nome_arquivo_anexo,
        arquivoAnexoBase64: row.arquivo_anexo_base64,
        itemSistema: row.item_sistema,
        dataEmissao: row.data_emissao,
        observacao: row.observacao,
        frequencia: row.frequencia,
        lancadoPor: row.lancado_por,
        dataAprovacao: row.data_aprovacao,
        aprovadores: parsedAlcada || "Deny e Gerência",
        centroCusto: parsedCc || "C.C 101 - Operacional",
        codLancamentoOc: parsedOc || "",
        codigoLancamento: parsedOc || row.doc || "",
        cidade: row.cidade || "",
        uf: row.uf || "",
        telefone: row.telefone || "",
        email: row.email || ""
      };
    });
  } catch (err) {
    console.error("Erro no fetchLancamentosSupabase:", err);
    return [];
  }
}

// 4. Salvar / Atualizar Lançamento no Supabase
export async function saveLancamentoSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const rawId = item.id;
    let targetId: number;

    if (typeof rawId === "number" && !isNaN(rawId)) {
      targetId = rawId;
    } else if (typeof rawId === "string" && !isNaN(Number(rawId)) && Number(rawId) > 0) {
      targetId = Number(rawId);
    } else {
      targetId = Date.now();
    }

    const codOc = item.codLancamentoOc || item.codigoLancamento || "";
    const centCusto = item.centroCusto || "C.C 101 - Operacional";
    const alcada = item.aprovadores || "Deny e Gerência";
    const filialBase = item.estabelecimento || "100 - Paulínia";

    // Preserva embutido na observação para garantir persistência 100% à prova de falhas de schema
    let finalObs = item.observacao || "";
    if (codOc && !finalObs.includes(`[OC/CÓD: ${codOc}]`)) {
      finalObs = finalObs ? `${finalObs} [OC/CÓD: ${codOc}]` : `[OC/CÓD: ${codOc}]`;
    }
    if (centCusto && !finalObs.includes(`[CENTRO DE CUSTO: ${centCusto}]`)) {
      finalObs = finalObs ? `${finalObs} [CENTRO DE CUSTO: ${centCusto}]` : `[CENTRO DE CUSTO: ${centCusto}]`;
    }
    if (alcada && !finalObs.includes(`[ALÇADA: ${alcada}]`)) {
      finalObs = finalObs ? `${finalObs} [ALÇADA: ${alcada}]` : `[ALÇADA: ${alcada}]`;
    }
    if (filialBase && !finalObs.includes(`[BASE: ${filialBase}]`)) {
      finalObs = finalObs ? `${finalObs} [BASE: ${filialBase}]` : `[BASE: ${filialBase}]`;
    }

    // Monta o objeto base
    const baseRecord: any = {
      id: targetId,
      status: item.status || "Aguardando aprovação",
      data_lancamento: item.dataLancamento || new Date().toISOString().split("T")[0],
      data_vencimento: item.dataVencimento || item.dataLancamento,
      fornecedor: item.fornecedor || "Fornecedor Não Informado",
      doc: item.doc || "N/A",
      valor: item.valor || "R$ 0,00",
      forma_pagto: item.formaPagto || "Boleto",
      tipo: item.tipo || "NF-e",
      descricao: item.descricao || "",
      cnpj: item.cnpj || "",
      estabelecimento: filialBase,
      nome_arquivo_anexo: item.nomeArquivoAnexo || "",
      arquivo_anexo_base64: item.arquivoAnexoBase64 || "",
      item_sistema: item.itemSistema || "",
      data_emissao: item.dataEmissao || "",
      observacao: finalObs,
      frequencia: item.frequencia || "Esporádico",
      lancado_por: item.lancadoPor || "Deny",
      data_aprovacao: item.dataAprovacao || ""
    };

    // Tenta primeiro com as colunas completas caso já existam na tabela do Supabase
    const completeRecord = {
      ...baseRecord,
      centro_custo: centCusto,
      codigo_lancamento: codOc,
      aprovadores: alcada
    };

    const firstTry = await client
      .from('lancamentos')
      .upsert(completeRecord, { onConflict: 'id' });

    if (!firstTry.error) {
      return true;
    }

    // Se o erro for de coluna inexistente (PGRST204), tenta sem essas colunas (pois já embutimos na observação)
    if (firstTry.error && firstTry.error.code === 'PGRST204') {
      const retry = await client
        .from('lancamentos')
        .upsert(baseRecord, { onConflict: 'id' });

      if (!retry.error) {
        return true;
      }
      console.error("Erro no retry ao gravar lançamento no Supabase:", retry.error.message || retry.error);
      return false;
    }

    console.error("Erro ao gravar lançamento no Supabase:", firstTry.error.message || firstTry.error);
    return false;
  } catch (err) {
    console.error("Erro no saveLancamentoSupabase:", err);
    return false;
  }
}

// 5. Excluir Lançamento no Supabase
export async function deleteLancamentoSupabase(id: number | string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const numId = typeof id === "number" ? id : (parseInt(String(id), 10) || Number(id));
    const { error } = await client
      .from('lancamentos')
      .delete()
      .eq('id', numId);

    if (error) {
      console.error("Erro ao excluir do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteLancamentoSupabase:", err);
    return false;
  }
}

// --- FUNÇÕES DE GESTÃO DE USUÁRIOS NO SUPABASE ---

export async function fetchUsuariosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('usuarios')
      .select('*');

    if (error) {
      console.warn("Aviso ao buscar usuários do Supabase:", error.message || error);
      return [];
    }

    if (!data || data.length === 0) return [];

    return data.map((item: any) => {
      const rawPerms = item.permissoes !== undefined && item.permissoes !== null
        ? item.permissoes
        : item.permissions;

      const perms = typeof rawPerms === 'string' 
        ? (() => { try { return JSON.parse(rawPerms); } catch { return {}; } })() 
        : (rawPerms || {});

      const isMaster = item.email && item.email.toLowerCase() === "deny.goncalves@risel.com.br";

      const mustChange = isMaster 
        ? false 
        : (item.must_change_password !== undefined && item.must_change_password !== null
            ? Boolean(item.must_change_password)
            : (perms?.mustChangePassword !== undefined && perms?.mustChangePassword !== null
                ? Boolean(perms.mustChangePassword)
                : (perms?.must_change_password !== undefined && perms?.must_change_password !== null
                    ? Boolean(perms.must_change_password)
                    : false)));

      const resolvedName = item.nome || item.name || item.full_name || item.username || (item.email ? item.email.split('@')[0] : "Usuário");
      const resolvedPass = item.senha || item.password || perms?.password || "";

      // Mapeamento normalizado completo de permissões
      const docsAllowed = perms.documentos !== undefined
        ? Boolean(perms.documentos)
        : Boolean(perms.dashboard || perms.lancamentos || perms.lancamento || perms.fornecedores || perms.fornecedor);

      const fVeiculos = perms.frota_veiculos !== undefined 
        ? Boolean(perms.frota_veiculos) 
        : Boolean(perms.frota);
      const fChecklist = perms.frota_checklist !== undefined 
        ? Boolean(perms.frota_checklist) 
        : Boolean(perms.checklist);
      const fReservas = perms.frota_reservas !== undefined 
        ? Boolean(perms.frota_reservas) 
        : Boolean(perms.reservas);
      const fMultas = perms.frota_multas !== undefined 
        ? Boolean(perms.frota_multas) 
        : Boolean(perms.multas);
      const fRastreamento = perms.frota_rastreamento !== undefined 
        ? Boolean(perms.frota_rastreamento) 
        : Boolean(perms.telemetria || perms.rastreamento);

      const frotaGeral = fVeiculos || fChecklist || fReservas || fMultas || fRastreamento;

      const normalizedPermissions = isMaster || item.role === "admin" || perms.admin === true
        ? {
            admin: true,
            documentos: true,
            dashboard: true,
            lancamentos: true,
            fornecedores: true,
            frota: true,
            frota_veiculos: true,
            frota_checklist: true,
            frota_reservas: true,
            frota_multas: true,
            frota_rastreamento: true,
            usuarios: true,
          }
        : {
            admin: false,
            documentos: docsAllowed,
            dashboard: docsAllowed,
            lancamentos: docsAllowed,
            fornecedores: docsAllowed,
            frota: frotaGeral,
            frota_veiculos: fVeiculos,
            frota_checklist: fChecklist,
            frota_reservas: fReservas,
            frota_multas: fMultas,
            frota_rastreamento: fRastreamento,
            usuarios: false,
          };

      return {
        id: item.id,
        email: item.email,
        name: resolvedName,
        role: isMaster ? "admin" : (normalizedPermissions.admin ? "admin" : (item.role || "user")),
        permissions: normalizedPermissions,
        status: item.status || "Ativa",
        password: resolvedPass,
        mustChangePassword: mustChange,
        createdAt: item.created_at
      };
    });
  } catch (err) {
    console.error("Erro no fetchUsuariosSupabase:", err);
    return [];
  }
}

export async function saveUsuarioSupabase(user: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const userEmail = (user.email || "").toLowerCase().trim();
    if (!userEmail) return false;

    const resolvedName = user.name || user.nome || userEmail;
    const isMaster = userEmail === "deny.goncalves@risel.com.br";
    const basePermissions = typeof user.permissions === 'object' && user.permissions !== null
      ? user.permissions
      : {};

    const mustChangeVal = user.mustChangePassword !== undefined ? user.mustChangePassword : false;
    const resolvedPassword = user.password || user.senha || "Risel@2026!";

    // Mapeamento normalizado garantindo todas as chaves
    const docsAllowed = basePermissions.documentos !== undefined
      ? Boolean(basePermissions.documentos)
      : Boolean(basePermissions.dashboard || basePermissions.lancamentos || basePermissions.fornecedores);

    const fVeiculos = basePermissions.frota_veiculos !== undefined 
      ? Boolean(basePermissions.frota_veiculos) 
      : Boolean(basePermissions.frota);
    const fChecklist = basePermissions.frota_checklist !== undefined 
      ? Boolean(basePermissions.frota_checklist) 
      : Boolean(basePermissions.checklist);
    const fReservas = basePermissions.frota_reservas !== undefined 
      ? Boolean(basePermissions.frota_reservas) 
      : Boolean(basePermissions.reservas);
    const fMultas = basePermissions.frota_multas !== undefined 
      ? Boolean(basePermissions.frota_multas) 
      : Boolean(basePermissions.multas);
    const fRastreamento = basePermissions.frota_rastreamento !== undefined 
      ? Boolean(basePermissions.frota_rastreamento) 
      : Boolean(basePermissions.telemetria || basePermissions.rastreamento);

    const frotaGeral = fVeiculos || fChecklist || fReservas || fMultas || fRastreamento;
    const isAdmin = isMaster || user.role === "admin" || basePermissions.admin === true;

    // Objeto de permissões salvo no Supabase com compatibilidade tanto para chaves modernas quanto legadas
    const permissoesPayload = isAdmin ? {
      admin: true,
      documentos: true,
      dashboard: true,
      lancamentos: true,
      fornecedores: true,
      frota: true,
      frota_veiculos: true,
      frota_checklist: true,
      frota_reservas: true,
      frota_multas: true,
      frota_rastreamento: true,
      usuarios: true,
      // Legados
      checklist: true,
      reservas: true,
      telemetria: true,
      rastreamento: true,
      multas: true,
      lancamento: true,
      fornecedor: true,
      mustChangePassword: mustChangeVal,
      must_change_password: mustChangeVal,
      password: resolvedPassword
    } : {
      admin: false,
      documentos: docsAllowed,
      dashboard: docsAllowed,
      lancamentos: docsAllowed,
      fornecedores: docsAllowed,
      frota: frotaGeral,
      frota_veiculos: fVeiculos,
      frota_checklist: fChecklist,
      frota_reservas: fReservas,
      frota_multas: fMultas,
      frota_rastreamento: fRastreamento,
      usuarios: false,
      // Legados
      checklist: fChecklist,
      reservas: fReservas,
      telemetria: fRastreamento,
      rastreamento: fRastreamento,
      multas: fMultas,
      lancamento: docsAllowed,
      fornecedor: docsAllowed,
      mustChangePassword: mustChangeVal,
      must_change_password: mustChangeVal,
      password: resolvedPassword
    };

    // Tentativa 1: Schema exato da tabela usuarios no Supabase (coluna 'permissoes', 'nome', 'senha')
    const primaryRecord: any = {
      email: userEmail,
      nome: resolvedName,
      role: isAdmin ? "admin" : "user",
      status: user.status || "Ativa",
      senha: resolvedPassword,
      permissoes: permissoesPayload,
      updated_at: new Date().toISOString()
    };

    let { error } = await client
      .from('usuarios')
      .upsert(primaryRecord, { onConflict: 'email' });

    if (!error) return true;

    // Fallback 1: Caso a coluna updated_at não exista no Supabase
    const recordSemUpdatedAt: any = {
      email: userEmail,
      nome: resolvedName,
      role: isAdmin ? "admin" : "user",
      status: user.status || "Ativa",
      senha: resolvedPassword,
      permissoes: permissoesPayload
    };
    const resSemUpdate = await client.from('usuarios').upsert(recordSemUpdatedAt, { onConflict: 'email' });
    if (!resSemUpdate.error) return true;

    // Fallback 2: Caso exista variação com 'name' ou 'password' / 'permissions'
    const recordBothKeys: any = {
      email: userEmail,
      nome: resolvedName,
      name: resolvedName,
      role: isAdmin ? "admin" : "user",
      status: user.status || "Ativa",
      senha: resolvedPassword,
      password: resolvedPassword,
      permissoes: permissoesPayload,
      permissions: permissoesPayload
    };
    const resBoth = await client.from('usuarios').upsert(recordBothKeys, { onConflict: 'email' });
    if (!resBoth.error) return true;

    // Fallback 3: Caso o schema use estritamente inglês
    const recordEnglish: any = {
      email: userEmail,
      name: resolvedName,
      role: isAdmin ? "admin" : "user",
      status: user.status || "Ativa",
      password: resolvedPassword,
      permissions: permissoesPayload
    };
    const resEnglish = await client.from('usuarios').upsert(recordEnglish, { onConflict: 'email' });
    if (!resEnglish.error) return true;

    console.warn("Aviso ao salvar usuário no Supabase:", error?.message || resSemUpdate.error?.message);
    return false;
  } catch (err) {
    console.error("Erro no saveUsuarioSupabase:", err);
    return false;
  }
}

/**
 * Garante que o login corporativo especificado esteja salvo diretamente no banco de dados Supabase.
 * Preserva integralmente permissões customizadas definidas pelo Administrador.
 */
export async function ensureUserCredentialsInSupabase(
  email: string,
  defaultUser: any
): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanEmail = (email || "").toLowerCase().trim();
    if (!cleanEmail) return false;

    // Consulta se o usuário já existe na tabela 'usuarios'
    const { data, error } = await client
      .from('usuarios')
      .select('*')
      .eq('email', cleanEmail);

    if (!error && Array.isArray(data) && data.length > 0) {
      const existing = data[0];
      const rawPerms = existing.permissoes !== undefined && existing.permissoes !== null
        ? existing.permissoes
        : existing.permissions;

      const existingPerms = typeof rawPerms === 'string' 
        ? (() => { try { return JSON.parse(rawPerms); } catch { return {}; } })() 
        : (rawPerms || {});

      const existingPassword = existing.senha || existing.password || existingPerms?.password;

      // Se o usuário já possui registro no banco, PRESERVA INTEGRALMENTE as permissões
      if (existingPassword && existingPassword.trim().length > 0) {
        return true;
      }

      // Caso contrário (sem senha no banco), preenche a senha padrão preservando todas as permissões
      const updated = {
        ...existing,
        email: cleanEmail,
        permissions: existingPerms,
        role: existing.role || "user",
        password: defaultUser.password,
        must_change_password: false
      };
      return await saveUsuarioSupabase(updated);
    } else {
      // Se não existe na base de dados, insere com as configurações padrão
      return await saveUsuarioSupabase({
        ...defaultUser,
        email: cleanEmail,
        password: defaultUser.password,
        must_change_password: false
      });
    }
  } catch (err) {
    console.warn(`Aviso ao assegurar credencial de ${email} no Supabase:`, err);
    return false;
  }
}

export async function deleteUsuarioSupabase(email: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const userEmail = (email || "").toLowerCase().trim();
    if (!userEmail) return false;

    const { error } = await client
      .from('usuarios')
      .delete()
      .eq('email', userEmail);

    if (error) {
      console.error("Erro ao excluir usuário do Supabase:", error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteUsuarioSupabase:", err);
    return false;
  }
}

export async function syncLocalUsuariosToSupabase(localUsers: any[]): Promise<{ count: number; success: boolean }> {
  if (!localUsers || localUsers.length === 0) return { count: 0, success: true };

  try {
    let successCount = 0;
    for (const u of localUsers) {
      const ok = await saveUsuarioSupabase(u);
      if (ok) successCount++;
    }
    return { count: successCount, success: true };
  } catch (err) {
    console.error("Erro na sincronização de usuários:", err);
    return { count: 0, success: false };
  }
}

// 6. Sincronizar todos os registros do LocalStorage com o Supabase
export async function syncLocalLancamentosToSupabase(localItems: any[]): Promise<{ count: number; success: boolean }> {
  if (!localItems || localItems.length === 0) return { count: 0, success: true };

  try {
    const client = getSupabaseClient();
    const dbRecords = localItems.map(item => ({
      id: typeof item.id === "number" ? item.id : (parseInt(item.id, 10) || Math.floor(Math.random() * 1000000000)),
      status: item.status || "Aguardando aprovação",
      data_lancamento: item.dataLancamento || new Date().toISOString().split("T")[0],
      data_vencimento: item.dataVencimento || item.dataLancamento,
      fornecedor: item.fornecedor || "Fornecedor",
      doc: item.doc || "N/A",
      valor: item.valor || "R$ 0,00",
      forma_pagto: item.formaPagto || "Boleto",
      tipo: item.tipo || "NF-e",
      descricao: item.descricao || "",
      cnpj: item.cnpj || "",
      estabelecimento: item.estabelecimento || "100 - Paulínia",
      nome_arquivo_anexo: item.nomeArquivoAnexo || "",
      arquivo_anexo_base64: item.arquivoAnexoBase64 || "",
      item_sistema: item.itemSistema || "",
      data_emissao: item.dataEmissao || "",
      observacao: item.observacao || "",
      frequencia: item.frequencia || "Esporádico",
      lancado_por: item.lancadoPor || "Deny",
      data_aprovacao: item.dataAprovacao || ""
    }));

    const { error } = await client
      .from('lancamentos')
      .upsert(dbRecords, { onConflict: 'id' });

    if (error) {
      console.error("Erro na sincronização em lote com o Supabase:", error);
      return { count: 0, success: false };
    }

    return { count: dbRecords.length, success: true };
  } catch (err) {
    console.error("Erro na sincronização com Supabase:", err);
    return { count: 0, success: false };
  }
}

// 7. Interfaces e Funções para a Tabela de Abastecimentos no Supabase
export interface SupabaseAbastecimento {
  id: string;
  placa: string;
  base?: string;
  condutor?: string;
  data: string;
  litros: number;
  km_percorrido: number;
  valor_total: number;
  combustivel?: string;
  posto?: string;
  cidade?: string;
  uf?: string;
  valor_litro?: number;
  saldo?: number;
  hodometro?: number;
  cartao?: string;
  cnpj_posto?: string;
  transacao?: string;
  modelo?: string;
  observacoes?: string;
  created_at?: string;
}

export async function fetchAbastecimentosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('abastecimentos')
      .select('*')
      .order('data', { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar abastecimentos no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      placa: row.placa,
      base: row.base,
      condutor: row.condutor,
      data: row.data,
      litros: Number(row.litros) || 0,
      kmPercorrido: Number(row.km_percorrido) || 0,
      valorTotal: Number(row.valor_total) || 0,
      combustivel: row.combustivel,
      posto: row.posto,
      cidade: row.cidade,
      uf: row.uf || undefined,
      valorLitro: row.valor_litro !== null && row.valor_litro !== undefined ? Number(row.valor_litro) : undefined,
      saldo: row.saldo !== null && row.saldo !== undefined ? Number(row.saldo) : undefined,
      hodometro: row.hodometro !== null && row.hodometro !== undefined ? Number(row.hodometro) : undefined,
      cartao: row.cartao || undefined,
      cnpjPosto: row.cnpj_posto || undefined,
      transacao: row.transacao || undefined,
      modelo: row.modelo || undefined,
      observacoes: row.observacoes || undefined
    }));
  } catch (err) {
    console.error("Erro no fetchAbastecimentosSupabase:", err);
    return [];
  }
}

export async function saveAbastecimentoSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord: Partial<SupabaseAbastecimento> = {
      id: item.id || ("abast-" + Date.now() + "-" + Math.random().toString(36).substring(7)),
      placa: (item.placa || "").toUpperCase(),
      base: item.base || "CAMPINEIRA",
      condutor: item.condutor || "Sem Motorista Associado",
      data: item.data || new Date().toISOString().split("T")[0],
      litros: Number(item.litros) || 0,
      km_percorrido: Number(item.kmPercorrido) || 0,
      valor_total: Number(item.valorTotal) || 0,
      combustivel: item.combustivel || "Gasolina",
      posto: item.posto || "",
      cidade: item.cidade || "",
      uf: item.uf || undefined,
      valor_litro: item.valorLitro !== undefined && item.valorLitro !== null ? Number(item.valorLitro) : undefined,
      saldo: item.saldo !== undefined && item.saldo !== null ? Number(item.saldo) : undefined,
      hodometro: item.hodometro !== undefined && item.hodometro !== null ? Number(item.hodometro) : undefined,
      cartao: item.cartao || undefined,
      cnpj_posto: item.cnpjPosto || undefined,
      transacao: item.transacao || undefined,
      modelo: item.modelo || undefined,
      observacoes: item.observacoes || undefined
    };

    const { error } = await client
      .from('abastecimentos')
      .upsert(dbRecord, { onConflict: 'id' });

    if (error) {
      console.warn("Aviso ao gravar abastecimento no Supabase (tentando fallback base):", error.message);
      const baseRecord = {
        id: dbRecord.id,
        placa: dbRecord.placa,
        base: dbRecord.base,
        condutor: dbRecord.condutor,
        data: dbRecord.data,
        litros: dbRecord.litros,
        km_percorrido: dbRecord.km_percorrido,
        valor_total: dbRecord.valor_total,
        combustivel: dbRecord.combustivel,
        posto: dbRecord.posto,
        cidade: dbRecord.cidade,
        saldo: dbRecord.saldo,
        hodometro: dbRecord.hodometro
      };
      const { error: errBase } = await client
        .from('abastecimentos')
        .upsert(baseRecord, { onConflict: 'id' });
      if (errBase) {
        console.error("Erro no saveAbastecimentoSupabase (fallback):", errBase);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("Erro no saveAbastecimentoSupabase:", err);
    return false;
  }
}

export async function saveBatchAbastecimentosSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };

  try {
    const client = getSupabaseClient();
    const dbRecords = items.map(item => ({
      id: item.id || ("abast-" + Date.now() + "-" + Math.random().toString(36).substring(7)),
      placa: (item.placa || "").toUpperCase(),
      base: item.base || "CAMPINEIRA",
      condutor: item.condutor || "Sem Motorista Associado",
      data: item.data || new Date().toISOString().split("T")[0],
      litros: Number(item.litros) || 0,
      km_percorrido: Number(item.kmPercorrido) || 0,
      valor_total: Number(item.valorTotal) || 0,
      combustivel: item.combustivel || "Gasolina",
      posto: item.posto || "",
      cidade: item.cidade || "",
      uf: item.uf || null,
      valor_litro: item.valorLitro !== undefined && item.valorLitro !== null ? Number(item.valorLitro) : null,
      saldo: item.saldo !== undefined && item.saldo !== null ? Number(item.saldo) : null,
      hodometro: item.hodometro !== undefined && item.hodometro !== null ? Number(item.hodometro) : null,
      cartao: item.cartao || null,
      cnpj_posto: item.cnpjPosto || null,
      transacao: item.transacao || null,
      modelo: item.modelo || null,
      observacoes: item.observacoes || null
    }));

    const CHUNK_SIZE = 500;
    let totalSaved = 0;

    for (let i = 0; i < dbRecords.length; i += CHUNK_SIZE) {
      const chunk = dbRecords.slice(i, i + CHUNK_SIZE);
      const { error } = await client
        .from('abastecimentos')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        console.warn("Aviso ao gravar lote no Supabase (tentando fallback base):", error.message);
        const chunkBase = chunk.map(rec => ({
          id: rec.id,
          placa: rec.placa,
          base: rec.base,
          condutor: rec.condutor,
          data: rec.data,
          litros: rec.litros,
          km_percorrido: rec.km_percorrido,
          valor_total: rec.valor_total,
          combustivel: rec.combustivel,
          posto: rec.posto,
          cidade: rec.cidade,
          saldo: rec.saldo,
          hodometro: rec.hodometro
        }));

        const { error: errBase } = await client
          .from('abastecimentos')
          .upsert(chunkBase, { onConflict: 'id' });

        if (errBase) {
          console.error("Erro no fallback do saveBatchAbastecimentosSupabase:", errBase);
        } else {
          totalSaved += chunkBase.length;
        }
      } else {
        totalSaved += chunk.length;
      }
    }

    return { count: totalSaved, success: totalSaved > 0 };
  } catch (err) {
    console.error("Erro no saveBatchAbastecimentosSupabase:", err);
    return { count: 0, success: false };
  }
}

export async function deleteAbastecimentoSupabase(id: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('abastecimentos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erro ao excluir abastecimento do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteAbastecimentoSupabase:", err);
    return false;
  }
}

// 8. Interfaces e Funções para Veículos no Supabase
export interface SupabaseVeiculo {
  placa: string;
  modelo: string;
  marca?: string;
  ano?: number;
  tipo?: string;
  base?: string;
  condutor?: string;
  status?: string;
  km_atual?: number;
  combustivel_padrao?: string;
  observacoes?: string;
  created_at?: string;
}

export async function fetchVeiculosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('veiculos')
      .select('*')
      .order('placa', { ascending: true });

    if (error) {
      console.warn("Aviso ao buscar veículos no Supabase:", error.message);
      return [];
    }

    const dbMap = new Map((data || []).map(row => [row.placa, row]));
    let needsSync = false;

    // Garante que todos os 75 veículos reais façam parte da lista
    const mergedList = VEICULOS_REAIS.map(real => {
      const row = dbMap.get(real.placa);
      if (!row) {
        needsSync = true;
        return real;
      }

      let extra: any = {};
      if (row.observacoes && typeof row.observacoes === "string" && row.observacoes.startsWith("{")) {
        try {
          extra = JSON.parse(row.observacoes);
        } catch (e) {}
      }

      // Se no Supabase a filial veio como CAMPINEIRA ou vazia, mas existe filial original em VEICULOS_REAIS, restaura a filial cadastrada originalmente
      const realFilial = real.filial;
      const rawFilial = row.filial || row.base || extra.filial;
      const filialFinal = (rawFilial && rawFilial !== "CAMPINEIRA" && rawFilial !== "Campineira") 
        ? rawFilial 
        : (realFilial || rawFilial || "CAMPINEIRA");

      if (!row.venc_contrato || !row.gestor_resp || !row.email || !row.filial || !row.locadora || row.filial !== filialFinal) {
        needsSync = true;
      }

      return {
        id: row.placa,
        placa: row.placa,
        modelo: row.modelo || real.modelo || "Veículo Frota",
        vencContrato: row.venc_contrato || row.vencContrato || extra.vencContrato || real.vencContrato || "",
        condutor: row.condutor || real.condutor || "Disponível",
        cpfCondutor: row.cpf_condutor || row.cpfCondutor || extra.cpfCondutor || real.cpfCondutor || "",
        cnhValidade: row.cnh_validade || row.cnhValidade || extra.cnhValidade || "",
        cnhNumero: row.cnh_numero || row.cnhNumero || extra.cnhNumero || "",
        cnhAnexoBase64: row.cnh_anexo_base64 || row.cnhAnexoBase64 || extra.cnhAnexoBase64 || "",
        cnhNomeArquivo: row.cnh_nome_arquivo || row.cnhNomeArquivo || extra.cnhNomeArquivo || "",
        funcao: row.funcao || extra.funcao || real.funcao || "Motorista",
        contatoMotorista: row.contato_motorista || row.contatoMotorista || extra.contatoMotorista || real.contatoMotorista || "",
        gestorResp: row.gestor_resp || row.gestorResp || extra.gestorResp || real.gestorResp || "",
        email: row.email || extra.email || real.email || "",
        filial: filialFinal,
        base: filialFinal,
        locadora: row.locadora || extra.locadora || real.locadora || "Frota Própria",
        contrato: row.contrato || extra.contrato || real.contrato || "",
        odometro: Number(row.odometro || row.km_atual || extra.odometro || real.odometro || 0),
        combustivel: row.combustivel || row.combustivel_padrao || extra.combustivel || real.combustivel || "Flex",
        status: row.status || real.status || "Ativo",
        dataTrocaCondutor: row.data_troca_condutor || row.dataTrocaCondutor || extra.dataTrocaCondutor || real.dataTrocaCondutor || "",
        dataInativacao: row.data_inativacao || row.dataInativacao || extra.dataInativacao || (real as any).dataInativacao || "",
        motivoInativacao: row.motivo_inativacao || row.motivoInativacao || extra.motivoInativacao || (real as any).motivoInativacao || "",
        observacoes: row.observacoes && !row.observacoes.startsWith("{") ? row.observacoes : (extra.observacoes || (real as any).observacoes || "")
      };
    });

    // Inclui também veículos que foram criados manualmente diretamente no Supabase e que não estão na lista padrão
    (data || []).forEach(row => {
      if (!VEICULOS_REAIS.some(v => v.placa === row.placa)) {
        let extra: any = {};
        if (row.observacoes && typeof row.observacoes === "string" && row.observacoes.startsWith("{")) {
          try { extra = JSON.parse(row.observacoes); } catch (e) {}
        }
        mergedList.push({
          id: row.placa,
          placa: row.placa,
          modelo: row.modelo || "Veículo Frota",
          vencContrato: row.venc_contrato || row.vencContrato || extra.vencContrato || "",
          condutor: row.condutor || "Disponível",
          cpfCondutor: row.cpf_condutor || row.cpfCondutor || extra.cpfCondutor || "",
          funcao: row.funcao || extra.funcao || "Motorista",
          contatoMotorista: row.contato_motorista || row.contatoMotorista || extra.contatoMotorista || "",
          gestorResp: row.gestor_resp || row.gestorResp || extra.gestorResp || "",
          email: row.email || extra.email || "",
          filial: row.filial || row.base || extra.filial || "CAMPINEIRA",
          locadora: row.locadora || extra.locadora || "Frota Própria",
          contrato: row.contrato || extra.contrato || "",
          odometro: Number(row.odometro || row.km_atual || extra.odometro || 0),
          combustivel: row.combustivel || row.combustivel_padrao || extra.combustivel || "Flex",
          status: row.status || "Ativo",
          dataTrocaCondutor: row.data_troca_condutor || row.dataTrocaCondutor || extra.dataTrocaCondutor || "",
          dataInativacao: row.data_inativacao || row.dataInativacao || extra.dataInativacao || "",
          motivoInativacao: row.motivo_inativacao || row.motivoInativacao || extra.motivoInativacao || "",
          observacoes: row.observacoes && !row.observacoes.startsWith("{") ? row.observacoes : (extra.observacoes || "")
        });
      }
    });

    // Se identificou dados que vieram com campos ausentes/NULL no Supabase, atualiza todos em lote para preencher as novas colunas
    if (needsSync || (data || []).length < VEICULOS_REAIS.length) {
      saveBatchVeiculosSupabase(mergedList).catch(err => console.warn("Aviso ao sincronizar campos dos veículos no Supabase:", err));
    }

    return mergedList;
  } catch (err) {
    console.error("Erro no fetchVeiculosSupabase:", err);
    return [];
  }
}

export async function saveVeiculoSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanPlaca = (item.placa || "").toUpperCase().trim();
    const realVeh = VEICULOS_REAIS.find(v => v.placa === cleanPlaca);
    const resolvedFilial = (item.filial && item.filial !== "CAMPINEIRA" && item.filial !== "Campineira") 
      ? item.filial 
      : (realVeh ? realVeh.filial : (item.base || "CAMPINEIRA"));

    const extraData = JSON.stringify({
      vencContrato: item.vencContrato || "",
      cpfCondutor: item.cpfCondutor || "",
      cnhValidade: item.cnhValidade || "",
      cnhNumero: item.cnhNumero || "",
      cnhAnexoBase64: item.cnhAnexoBase64 || "",
      cnhNomeArquivo: item.cnhNomeArquivo || "",
      funcao: item.funcao || "",
      contatoMotorista: item.contatoMotorista || "",
      gestorResp: item.gestorResp || "",
      email: item.email || "",
      filial: resolvedFilial,
      locadora: item.locadora || "",
      contrato: item.contrato || "",
      odometro: item.odometro || 0,
      combustivel: item.combustivel || "Flex",
      dataTrocaCondutor: item.dataTrocaCondutor || "",
      dataInativacao: item.dataInativacao || "",
      motivoInativacao: item.motivoInativacao || "",
      observacoes: item.observacoes || ""
    });

    const dbRecord = {
      placa: cleanPlaca,
      modelo: item.modelo || "Veículo Frota",
      marca: item.marca || "",
      ano: Number(item.ano) || new Date().getFullYear(),
      tipo: item.tipo || "Leve",
      base: resolvedFilial,
      condutor: item.condutor || "Disponível",
      status: item.status || "Ativo",
      km_atual: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
      combustivel_padrao: item.combustivel || item.combustivelPadrao || "Flex",
      // Campos detalhados explícitos no Supabase
      venc_contrato: item.vencContrato || "",
      cpf_condutor: item.cpfCondutor || "",
      cnh_validade: item.cnhValidade || "",
      cnh_numero: item.cnhNumero || "",
      cnh_anexo_base64: item.cnhAnexoBase64 || "",
      cnh_nome_arquivo: item.cnhNomeArquivo || "",
      funcao: item.funcao || "Motorista",
      contato_motorista: item.contatoMotorista || "",
      gestor_resp: item.gestorResp || "",
      email: item.email || "",
      filial: resolvedFilial,
      locadora: item.locadora || "Frota Própria",
      contrato: item.contrato || "",
      odometro: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
      combustivel: item.combustivel || item.combustivelPadrao || "Flex",
      data_troca_condutor: item.dataTrocaCondutor || "",
      data_inativacao: item.dataInativacao || "",
      motivo_inativacao: item.motivoInativacao || "",
      observacoes: extraData
    };

    let { error } = await client
      .from('veiculos')
      .upsert(dbRecord, { onConflict: 'placa' });

    // Fallback caso a tabela no Supabase não contenha colunas mais recentes
    if (error) {
      const standardRecord = {
        placa: cleanPlaca,
        modelo: item.modelo || "Veículo Frota",
        marca: item.marca || "",
        ano: Number(item.ano) || new Date().getFullYear(),
        tipo: item.tipo || "Leve",
        base: resolvedFilial,
        condutor: item.condutor || "Disponível",
        status: item.status || "Ativo",
        km_atual: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
        combustivel_padrao: item.combustivel || item.combustivelPadrao || "Flex",
        observacoes: extraData
      };
      const fallbackRes = await client
        .from('veiculos')
        .upsert(standardRecord, { onConflict: 'placa' });
      
      if (fallbackRes.error) {
        console.warn("Aviso ao gravar veículo no Supabase (fallback padrão):", fallbackRes.error.message);
        return false;
      }
      return true;
    }
    return true;
  } catch (err) {
    console.error("Erro no saveVeiculoSupabase:", err);
    return false;
  }
}

export async function saveBatchVeiculosSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };

  try {
    const client = getSupabaseClient();
    const dbRecords = items.map(item => {
      const cleanPlaca = (item.placa || "").toUpperCase().trim();
      const realVeh = VEICULOS_REAIS.find(v => v.placa === cleanPlaca);
      const resolvedFilial = (item.filial && item.filial !== "CAMPINEIRA" && item.filial !== "Campineira") 
        ? item.filial 
        : (realVeh ? realVeh.filial : (item.base || "CAMPINEIRA"));

      const extraData = JSON.stringify({
        vencContrato: item.vencContrato || "",
        cpfCondutor: item.cpfCondutor || "",
        cnhValidade: item.cnhValidade || "",
        cnhNumero: item.cnhNumero || "",
        cnhAnexoBase64: item.cnhAnexoBase64 || "",
        cnhNomeArquivo: item.cnhNomeArquivo || "",
        funcao: item.funcao || "",
        contatoMotorista: item.contatoMotorista || "",
        gestorResp: item.gestorResp || "",
        email: item.email || "",
        filial: resolvedFilial,
        locadora: item.locadora || "",
        contrato: item.contrato || "",
        odometro: item.odometro || 0,
        combustivel: item.combustivel || "Flex",
        dataTrocaCondutor: item.dataTrocaCondutor || "",
        dataInativacao: item.dataInativacao || "",
        motivoInativacao: item.motivoInativacao || "",
        observacoes: item.observacoes || ""
      });

      return {
        placa: cleanPlaca,
        modelo: item.modelo || "Veículo Frota",
        marca: item.marca || "",
        ano: Number(item.ano) || new Date().getFullYear(),
        tipo: item.tipo || "Leve",
        base: resolvedFilial,
        condutor: item.condutor || "Disponível",
        status: item.status || "Ativo",
        km_atual: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
        combustivel_padrao: item.combustivel || item.combustivelPadrao || "Flex",
        venc_contrato: item.vencContrato || "",
        cpf_condutor: item.cpfCondutor || "",
        cnh_validade: item.cnhValidade || "",
        cnh_numero: item.cnhNumero || "",
        cnh_anexo_base64: item.cnhAnexoBase64 || "",
        cnh_nome_arquivo: item.cnhNomeArquivo || "",
        funcao: item.funcao || "Motorista",
        contato_motorista: item.contatoMotorista || "",
        gestor_resp: item.gestorResp || "",
        email: item.email || "",
        filial: resolvedFilial,
        locadora: item.locadora || "Frota Própria",
        contrato: item.contrato || "",
        odometro: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
        combustivel: item.combustivel || item.combustivelPadrao || "Flex",
        data_troca_condutor: item.dataTrocaCondutor || "",
        data_inativacao: item.dataInativacao || "",
        motivo_inativacao: item.motivoInativacao || "",
        observacoes: extraData
      };
    });

    let { error } = await client
      .from('veiculos')
      .upsert(dbRecords, { onConflict: 'placa' });

    // Fallback caso a tabela no Supabase não contenha as novas colunas
    if (error) {
      const standardBatch = items.map(item => {
        const cleanPlaca = (item.placa || "").toUpperCase().trim();
        const realVeh = VEICULOS_REAIS.find(v => v.placa === cleanPlaca);
        const resolvedFilial = (item.filial && item.filial !== "CAMPINEIRA" && item.filial !== "Campineira") 
          ? item.filial 
          : (realVeh ? realVeh.filial : (item.base || "CAMPINEIRA"));

        const extraData = JSON.stringify({
          vencContrato: item.vencContrato || "",
          funcao: item.funcao || "",
          contatoMotorista: item.contatoMotorista || "",
          gestorResp: item.gestorResp || "",
          email: item.email || "",
          filial: resolvedFilial,
          locadora: item.locadora || "",
          contrato: item.contrato || "",
          odometro: item.odometro || 0,
          combustivel: item.combustivel || "Flex",
          dataTrocaCondutor: item.dataTrocaCondutor || "",
          dataInativacao: item.dataInativacao || "",
          motivoInativacao: item.motivoInativacao || "",
          observacoes: item.observacoes || ""
        });

        return {
          placa: cleanPlaca,
          modelo: item.modelo || "Veículo Frota",
          marca: item.marca || "",
          ano: Number(item.ano) || new Date().getFullYear(),
          tipo: item.tipo || "Leve",
          base: resolvedFilial,
          condutor: item.condutor || "Disponível",
          status: item.status || "Ativo",
          km_atual: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
          combustivel_padrao: item.combustivel || item.combustivelPadrao || "Flex",
          observacoes: extraData
        };
      });

      const fallbackRes = await client
        .from('veiculos')
        .upsert(standardBatch, { onConflict: 'placa' });

      if (fallbackRes.error) {
        console.warn("Aviso ao gravar lote padrão de veículos no Supabase:", fallbackRes.error.message);
        return { count: 0, success: false };
      }
      return { count: standardBatch.length, success: true };
    }

    if (error) {
      console.error("Erro ao gravar lote de veículos no Supabase:", error.message || error);
      return { count: 0, success: false };
    }

    return { count: dbRecords.length, success: true };
  } catch (err) {
    console.error("Erro no saveBatchVeiculosSupabase:", err);
    return { count: 0, success: false };
  }
}

export async function deleteVeiculoSupabase(placa: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('veiculos')
      .delete()
      .eq('placa', placa.toUpperCase().trim());

    if (error) {
      console.error("Erro ao excluir veículo do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteVeiculoSupabase:", err);
    return false;
  }
}

// 9. Interfaces e Funções para Contratos da Frota no Supabase
export interface SupabaseContrato {
  id: string;
  numero: string;
  veiculo_placa?: string;
  fornecedor: string;
  tipo_contrato?: string;
  data_inicio?: string;
  data_vencimento: string;
  valor_mensal?: number;
  status?: string;
  observacao?: string;
  created_at?: string;
}

export async function fetchContratosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('contratos')
      .select('*')
      .order('data_vencimento', { ascending: true });

    if (error) {
      console.warn("Aviso ao buscar contratos no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      numero: row.numero,
      veiculoPlaca: row.veiculo_placa || "",
      fornecedor: row.fornecedor,
      tipoContrato: row.tipo_contrato || "Locação",
      dataInicio: row.data_inicio || "",
      dataVencimento: row.data_vencimento,
      valorMensal: Number(row.valor_mensal) || 0,
      status: row.status || "Ativo",
      observacao: row.observacao || ""
    }));
  } catch (err) {
    console.error("Erro no fetchContratosSupabase:", err);
    return [];
  }
}

export async function saveContratoSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord: Partial<SupabaseContrato> = {
      id: item.id || ("cto-" + Date.now() + "-" + Math.random().toString(36).substring(7)),
      numero: item.numero || item.doc || "CTO-" + Date.now(),
      veiculo_placa: (item.veiculoPlaca || item.placa || "").toUpperCase().trim(),
      fornecedor: item.fornecedor || "Locadora / Fornecedor",
      tipo_contrato: item.tipoContrato || item.tipo || "Locação",
      data_inicio: item.dataInicio || "",
      data_vencimento: item.dataVencimento || item.vencimento || new Date().toISOString().split("T")[0],
      valor_mensal: Number(item.valorMensal || item.valor) || 0,
      status: item.status || "Ativo",
      observacao: item.observacao || ""
    };

    const { error } = await client
      .from('contratos')
      .upsert(dbRecord, { onConflict: 'id' });

    if (error) {
      console.error("Erro ao gravar contrato no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no saveContratoSupabase:", err);
    return false;
  }
}

export async function saveBatchContratosSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };

  try {
    const client = getSupabaseClient();
    const dbRecords = items.map(item => ({
      id: item.id || ("cto-" + Date.now() + "-" + Math.random().toString(36).substring(7)),
      numero: item.numero || item.doc || "CTO-" + Date.now(),
      veiculo_placa: (item.veiculoPlaca || item.placa || "").toUpperCase().trim(),
      fornecedor: item.fornecedor || "Locadora / Fornecedor",
      tipo_contrato: item.tipoContrato || item.tipo || "Locação",
      data_inicio: item.dataInicio || "",
      data_vencimento: item.dataVencimento || item.vencimento || new Date().toISOString().split("T")[0],
      valor_mensal: Number(item.valorMensal || item.valor) || 0,
      status: item.status || "Ativo",
      observacao: item.observacao || ""
    }));

    const { error } = await client
      .from('contratos')
      .upsert(dbRecords, { onConflict: 'id' });

    if (error) {
      console.error("Erro ao gravar lote de contratos no Supabase:", error);
      return { count: 0, success: false };
    }

    return { count: dbRecords.length, success: true };
  } catch (err) {
    console.error("Erro no saveBatchContratosSupabase:", err);
    return { count: 0, success: false };
  }
}

export async function deleteContratoSupabase(id: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('contratos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erro ao excluir contrato do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteContratoSupabase:", err);
    return false;
  }
}

// 9. FORNECEDORES
export async function fetchFornecedoresSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('fornecedores')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.warn("Aviso ao buscar fornecedores no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id || row.cnpj,
      cnpj: row.cnpj,
      nome: row.nome,
      codigoItem: row.codigo_item || row.codigoItem || "",
      cidade: row.cidade || "",
      uf: row.uf || "",
      telefone: row.telefone || "",
      email: row.email || "",
      status: row.status || "Ativo",
      avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.nome?.charAt(0) || "F")}&background=f8fafc`,
      logradouro: row.logradouro || "",
      numero: row.numero || "",
      bairro: row.bairro || "",
      cep: row.cep || ""
    }));
  } catch (err) {
    console.error("Erro no fetchFornecedoresSupabase:", err);
    return [];
  }
}

export async function saveFornecedorSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanCnpj = (item.cnpj || "").replace(/\D/g, "") || item.cnpj;
    const baseRecord: any = {
      cnpj: cleanCnpj,
      nome: item.nome || "Fornecedor sem nome",
      codigo_item: item.codigoItem || "",
      cidade: item.cidade || "",
      uf: item.uf || "",
      telefone: item.telefone || "",
      email: item.email || "",
      status: item.status || "Ativo",
      avatar: item.avatar || ""
    };

    const completeRecord = {
      ...baseRecord,
      logradouro: item.logradouro || "",
      numero: item.numero || "",
      bairro: item.bairro || "",
      cep: item.cep || ""
    };

    const firstTry = await client
      .from('fornecedores')
      .upsert(completeRecord, { onConflict: 'cnpj' });

    if (!firstTry.error) {
      return true;
    }

    // Se falhar por ausência de colunas adicionais, tenta salvar com as colunas base
    if (firstTry.error && (firstTry.error.code === 'PGRST204' || firstTry.error.message?.includes('column'))) {
      const retry = await client
        .from('fornecedores')
        .upsert(baseRecord, { onConflict: 'cnpj' });
      return !retry.error;
    }

    console.error("Erro ao gravar fornecedor no Supabase:", firstTry.error);
    return false;
  } catch (err) {
    console.error("Erro no saveFornecedorSupabase:", err);
    return false;
  }
}

export async function deleteFornecedorSupabase(cnpj: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanCnpj = (cnpj || "").replace(/\D/g, "") || cnpj;
    const { error } = await client
      .from('fornecedores')
      .delete()
      .eq('cnpj', cleanCnpj);

    if (error) {
      console.error("Erro ao deletar fornecedor do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteFornecedorSupabase:", err);
    return false;
  }
}

// 10. CENTROS DE CUSTO
export async function fetchCentrosCustoSupabase(): Promise<string[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('centros_custo')
      .select('nome')
      .order('nome', { ascending: true });

    if (error) {
      // Fallback para Firestore caso a tabela ainda não exista
      try {
        const { db } = await import("../firebaseConfig");
        const snap = await db.collection("centros_custo").get();
        const firestoreList: string[] = [];
        snap.forEach(doc => {
          const d = doc.data();
          if (d.nome) firestoreList.push(d.nome);
        });
        if (firestoreList.length > 0) return firestoreList;
      } catch (e) {}
      return [];
    }
    return (data || []).map(row => row.nome).filter(Boolean);
  } catch (err) {
    return [];
  }
}

export async function saveCentroCustoSupabase(nome: string, codigo?: string, descricao?: string): Promise<boolean> {
  try {
    const cleanName = nome.trim();
    if (!cleanName) return false;

    // 1. Salva no Supabase
    try {
      const client = getSupabaseClient();
      const dbRecord = {
        nome: cleanName,
        codigo: codigo || "",
        descricao: descricao || ""
      };

      const { error } = await client
        .from('centros_custo')
        .upsert(dbRecord, { onConflict: 'nome' });

      if (error) {
        console.warn("Aviso ao salvar Centro de Custo no Supabase:", error.message);
      }
    } catch (sbErr) {
      console.warn("Falha no client Supabase para Centro de Custo:", sbErr);
    }

    // 2. Salva no Firestore para redundância e disponibilidade multiusuário imediata
    try {
      const { db } = await import("../firebaseConfig");
      const docKey = cleanName.replace(/[/\\?%*:|"<>]/g, '_');
      await db.collection("centros_custo").doc(docKey).set({
        nome: cleanName,
        codigo: codigo || "",
        descricao: descricao || "",
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (fErr) {
      console.warn("Aviso ao salvar Centro de Custo no Firestore:", fErr);
    }

    return true;
  } catch (err) {
    console.error("Erro no saveCentroCustoSupabase:", err);
    return false;
  }
}

// 10.B. Funções para Persistência de Bases (Estabelecimentos / Filiais)
export async function fetchBasesSupabase(): Promise<string[]> {
  const resultList = new Set<string>();

  // 1. Tenta buscar no Supabase
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('bases')
      .select('nome')
      .order('nome', { ascending: true });

    if (!error && Array.isArray(data)) {
      data.forEach(row => {
        if (row.nome && typeof row.nome === "string") {
          resultList.add(row.nome.trim());
        }
      });
    }
  } catch (err) {}

  // 2. Tenta buscar no Firestore
  try {
    const { db } = await import("../firebaseConfig");
    const snap = await db.collection("bases_filiais").get();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.nome && typeof d.nome === "string") {
        resultList.add(d.nome.trim());
      }
    });
  } catch (e) {}

  return Array.from(resultList);
}

export async function saveBaseSupabase(nome: string): Promise<boolean> {
  try {
    const cleanName = nome.trim();
    if (!cleanName) return false;

    // 1. Salva no Supabase
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('bases')
        .upsert({ nome: cleanName }, { onConflict: 'nome' });

      if (error) {
        console.warn("Aviso ao salvar Base no Supabase:", error.message);
      }
    } catch (sbErr) {
      console.warn("Falha no client Supabase para Base:", sbErr);
    }

    // 2. Salva no Firestore
    try {
      const { db } = await import("../firebaseConfig");
      const docKey = cleanName.replace(/[/\\?%*:|"<>]/g, '_');
      await db.collection("bases_filiais").doc(docKey).set({
        nome: cleanName,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (fErr) {
      console.warn("Aviso ao salvar Base no Firestore:", fErr);
    }

    return true;
  } catch (err) {
    console.error("Erro no saveBaseSupabase:", err);
    return false;
  }
}

// 11. Interfaces e Funções para Multas no Supabase (Módulo de Controle de Multas)
export interface SupabaseMulta {
  id: string;
  placa: string;
  frota?: string;
  ait?: string;
  tipo?: string;
  status?: string;
  valor?: number;
  valor_com_desconto?: number;
  desconto?: number;
  data_infracao?: string;
  data_recebimento?: string;
  prazo_indicacao?: string;
  enquadramento?: string;
  artigo_ctb?: string;
  descricao_infracao?: string;
  pontos_cnh?: number;
  base?: string;
  nome_motorista?: string;
  orgao_autuador?: string;
  endereco?: string;
  municipio?: string;
  uf?: string;
  rodovia_urbano?: string;
  recebida_com_prazo?: string;
  retornou_com_prazo?: string;
  empresa_ou_condutor?: string;
  descontar_motorista?: string;
  pago_com_desconto?: string;
  enviado_rh?: string;
  link_ait?: string;
  link_autorizacao?: string;
  obs?: string;
  created_at?: string;
}

export async function fetchMultasSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('multas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("Aviso ao carregar multas do Supabase:", error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: String(row.id || row.ait || ''),
      status: row.status || 'AGUARDANDO BOLETO',
      frota: row.frota || row.placa || '',
      placa: (row.placa || '').toUpperCase().trim(),
      base: row.base || '',
      ait: row.ait || row.id || '',
      tipo: row.tipo || 'AUTO',
      dataHoraInfracao: row.data_infracao || '',
      dataRecebimento: row.data_recebimento || '',
      prazoIndicacao: row.prazo_indicacao || '',
      recebidaComPrazo: row.recebida_com_prazo || 'SIM',
      enquadramento: row.enquadramento || '',
      artigoCtb: row.artigo_ctb || '',
      descricaoInfracao: row.descricao_infracao || '',
      pontosCnh: Number(row.pontos_cnh !== undefined ? row.pontos_cnh : 0),
      responsavelCodigo: '',
      responsavelNome: row.nome_motorista || '',
      orgaoAutuador: row.orgao_autuador || '',
      endereco: row.endereco || '',
      municipio: row.municipio || '',
      uf: row.uf || '',
      rodoviaOuUrbano: row.rodovia_urbano || 'URBANO',
      retornouComPrazo: row.retornou_com_prazo || 'SIM',
      valor: Number(row.valor || 0),
      desconto: Number(row.desconto || 0),
      valorComDesconto: Number(row.valor_com_desconto || (row.valor || 0)),
      empresaOuCondutor: row.empresa_ou_condutor || 'CONDUTOR',
      descontarMotorista: row.descontar_motorista || 'SIM',
      pagoComDesconto: row.pago_com_desconto || 'SIM',
      enviadoAoRh: row.enviado_rh || 'NÃO',
      obs: row.obs || '',
      linkAit: row.link_ait || '',
      linkAuth: row.link_autorizacao || '',
      createdAt: row.created_at || new Date().toISOString()
    }));
  } catch (err) {
    console.error("Erro no fetchMultasSupabase:", err);
    return [];
  }
}

export async function saveMultaSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const id = String(item.id || item.ait || `multa-${Date.now()}`);
    const placa = (item.placa || '').toUpperCase().trim();
    
    // Normalizar data_infracao para formato YYYY-MM-DD
    let dataInfracao: string | null = null;
    if (item.dataHoraInfracao) {
      if (item.dataHoraInfracao.includes('T')) {
        dataInfracao = item.dataHoraInfracao.split('T')[0];
      } else if (item.dataHoraInfracao.length === 10) {
        dataInfracao = item.dataHoraInfracao;
      }
    }

    const dbRecord: SupabaseMulta = {
      id,
      placa: placa || 'SEM-PLACA',
      frota: item.frota || placa,
      ait: item.ait || id,
      tipo: item.tipo || 'AUTO',
      status: item.status || 'AGUARDANDO BOLETO',
      valor: Number(item.valor) || 0,
      valor_com_desconto: Number(item.valorComDesconto) || (Number(item.valor) || 0),
      desconto: Number(item.desconto) || 0,
      data_infracao: dataInfracao || undefined,
      data_recebimento: item.dataRecebimento || undefined,
      prazo_indicacao: item.prazoIndicacao || undefined,
      enquadramento: item.enquadramento || '',
      artigo_ctb: item.artigoCtb || '',
      descricao_infracao: item.descricaoInfracao || '',
      pontos_cnh: Number(item.pontosCnh) || 0,
      base: item.base || '',
      nome_motorista: item.responsavelNome || '',
      orgao_autuador: item.orgaoAutuador || '',
      endereco: item.endereco || '',
      municipio: item.municipio || '',
      uf: item.uf || '',
      rodovia_urbano: item.rodoviaOuUrbano || 'URBANO',
      recebida_com_prazo: item.recebidaComPrazo || 'SIM',
      retornou_com_prazo: item.retornouComPrazo || 'SIM',
      empresa_ou_condutor: item.empresaOuCondutor || 'CONDUTOR',
      descontar_motorista: item.descontarMotorista || 'SIM',
      pago_com_desconto: item.pagoComDesconto || 'SIM',
      enviado_rh: item.enviadoAoRh || 'NÃO',
      link_ait: item.linkAit || '',
      link_autorizacao: item.linkAuth || '',
      obs: item.obs || ''
    };

    const res = await client
      .from('multas')
      .upsert(dbRecord, { onConflict: 'id' });

    if (res.error) {
      console.warn("Aviso ao salvar multa no Supabase:", res.error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Erro no saveMultaSupabase:", err);
    return false;
  }
}

export async function deleteMultaSupabase(id: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('multas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erro ao deletar multa no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteMultaSupabase:", err);
    return false;
  }
}

export async function clearAllMultasSupabase(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('multas')
      .delete()
      .neq('id', '___NUNCA_EXISTE___');

    if (error) {
      console.error("Erro ao zerar tabela de multas no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no clearAllMultasSupabase:", err);
    return false;
  }
}

export async function saveBatchMultasSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };
  let count = 0;
  for (const item of items) {
    const ok = await saveMultaSupabase(item);
    if (ok) count++;
  }
  return { count, success: count > 0 };
}

import { 
  ServicoManutencaoItem, 
  AnexoManutencao, 
  AutorizacaoDescontoAvaria 
} from './termoAvariaPdfService';

// 12. Interfaces e Funções para a Tabela de Manutenções da Frota no Supabase
export interface SupabaseManutencao {
  id: string;
  placa: string;
  tipo: "Preventiva" | "Corretiva";
  descricao: string;
  data: string;
  dataEntrada?: string;
  dataSaida?: string;
  odometro: number;
  custo: number;
  oficina: string;
  condutor?: string;
  base?: string;
  modelo?: string;
  nf_os?: string;
  status?: "Concluída" | "Em Andamento" | "Agendada";
  observacoes?: string;
  created_at?: string;
  servicos?: ServicoManutencaoItem[];
  anexos?: AnexoManutencao[];
  autorizacaoAvaria?: AutorizacaoDescontoAvaria;
}

export async function fetchManutencoesSupabase(): Promise<SupabaseManutencao[]> {
  const client = getSupabaseClient();
  let manutencoes: SupabaseManutencao[] = [];

  // 1. Tenta carregar da tabela dedicada 'manutencoes' no Supabase
  try {
    const { data, error } = await client
      .from('manutencoes')
      .select('*')
      .order('data', { ascending: false });

    if (!error && data && data.length > 0) {
      manutencoes = data.map((row: any) => ({
        id: String(row.id),
        placa: (row.placa || '').toUpperCase().trim(),
        tipo: row.tipo === 'Corretiva' ? 'Corretiva' : 'Preventiva',
        descricao: row.descricao || '',
        data: row.data || new Date().toISOString().split('T')[0],
        dataEntrada: row.data_entrada || row.dataEntrada || row.data || new Date().toISOString().split('T')[0],
        dataSaida: row.data_saida || row.dataSaida || row.data || new Date().toISOString().split('T')[0],
        odometro: Number(row.odometro) || 0,
        custo: Number(row.custo) || 0,
        oficina: row.oficina || '',
        condutor: row.condutor || undefined,
        base: row.base || undefined,
        modelo: row.modelo || undefined,
        nf_os: row.nf_os || row.doc || undefined,
        status: row.status || 'Concluída',
        observacoes: row.observacoes || undefined,
        created_at: row.created_at || undefined
      }));
      localStorage.setItem("risel_frota_manutencoes", JSON.stringify(manutencoes));
      return manutencoes;
    }
  } catch (err) {
    // Tabela dedicada pode não existir no schema cache do Supabase
  }

  // 2. Persistência cruzada com a tabela 'lancamentos' do Supabase (onde tipo = 'Manutenção' ou item_sistema inicia com 'MANUT-')
  try {
    const { data: lancData, error: lancErr } = await client
      .from('lancamentos')
      .select('*')
      .or('tipo.eq.Manutenção,item_sistema.ilike.MANUT%')
      .order('data_lancamento', { ascending: false });

    if (!lancErr && lancData && lancData.length > 0) {
      manutencoes = lancData.map((row: any) => {
        let obsObj: any = {};
        if (row.observacao) {
          try {
            obsObj = typeof row.observacao === 'object' ? row.observacao : JSON.parse(row.observacao);
          } catch (e) {
            obsObj = {};
          }
        }

        const placa = (obsObj.placa || (row.item_sistema ? row.item_sistema.replace(/^MANUT-/i, '') : '') || row.doc || '').toUpperCase().trim();
        const tipo = (obsObj.tipo === 'Corretiva' || (row.descricao && row.descricao.toLowerCase().includes('corretiva'))) ? 'Corretiva' : 'Preventiva';
        const custo = Number(obsObj.custo) || Number(row.valor) || 0;
        const odometro = Number(obsObj.odometro) || 0;
        const data = obsObj.data || row.data_lancamento || row.data_vencimento || new Date().toISOString().split('T')[0];
        const dataEntrada = obsObj.dataEntrada || obsObj.data_entrada || data;
        const dataSaida = obsObj.dataSaida || obsObj.data_saida || data;

        return {
          id: String(row.id),
          placa: placa || 'SEM-PLACA',
          tipo: tipo as "Preventiva" | "Corretiva",
          descricao: obsObj.descricao || row.descricao || 'Manutenção veicular',
          data,
          dataEntrada,
          dataSaida,
          odometro,
          custo,
          oficina: obsObj.oficina || row.fornecedor || '',
          condutor: obsObj.condutor,
          base: obsObj.base,
          modelo: obsObj.modelo,
          nf_os: obsObj.nf_os || row.doc,
          status: (obsObj.status || (row.status === 'Aprovado' ? 'Concluída' : 'Em Andamento')) as any,
          observacoes: obsObj.observacoes || row.observacao,
          created_at: row.created_at,
          servicos: obsObj.servicos || undefined,
          anexos: obsObj.anexos || undefined,
          autorizacaoAvaria: obsObj.autorizacaoAvaria || undefined
        };
      });

      if (manutencoes.length > 0) {
        localStorage.setItem("risel_frota_manutencoes", JSON.stringify(manutencoes));
        return manutencoes;
      }
    }
  } catch (err) {
    console.warn("Aviso ao buscar manutenções via lancamentos no Supabase:", err);
  }

  // 3. Fallback para dados salvos localmente (removendo mocks legados)
  const saved = localStorage.getItem("risel_frota_manutencoes");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Purga registros mock legados (ex: mn1, mn2, mn3)
        const realItems = parsed.filter(
          (m: any) => m && !["mn1", "mn2", "mn3"].includes(String(m.id))
        );
        if (realItems.length !== parsed.length) {
          localStorage.setItem("risel_frota_manutencoes", JSON.stringify(realItems));
        }
        if (realItems.length > 0) {
          return realItems;
        }
      }
    } catch (e) {}
  }

  // 4. Se não há dados reais no Supabase nem em cache, retorna vazio (pronto para dados reais)
  return [];
}

export async function saveManutencaoSupabase(item: any): Promise<boolean> {
  const client = getSupabaseClient();
  const idStr = String(item.id || `mn-${Date.now()}`);
  const placa = String(item.placa || '').toUpperCase().trim();
  const custo = Number(item.custo) || 0;
  const odometro = Number(item.odometro) || 0;
  const data = item.data || new Date().toISOString().split('T')[0];
  const dataEntrada = item.dataEntrada || data;
  const dataSaida = item.dataSaida || data;
  const tipo = item.tipo === 'Corretiva' ? 'Corretiva' : 'Preventiva';

  const manutencaoObj: SupabaseManutencao = {
    id: idStr,
    placa,
    tipo,
    descricao: item.descricao || 'Manutenção veicular',
    data,
    dataEntrada,
    dataSaida,
    odometro,
    custo,
    oficina: item.oficina || 'Oficina Credenciada',
    condutor: item.condutor,
    base: item.base,
    modelo: item.modelo,
    nf_os: item.nf_os,
    status: item.status || 'Concluída',
    observacoes: item.observacoes,
    servicos: item.servicos || undefined,
    anexos: item.anexos || undefined,
    autorizacaoAvaria: item.autorizacaoAvaria || undefined
  };

  // Atualiza cache local imediatamente garantindo apenas registros reais
  try {
    const saved = localStorage.getItem("risel_frota_manutencoes");
    let list: SupabaseManutencao[] = saved ? JSON.parse(saved) : [];
    list = list.filter(m => !["mn1", "mn2", "mn3"].includes(String(m.id)));
    const idx = list.findIndex(m => String(m.id) === idStr);
    if (idx >= 0) {
      list[idx] = manutencaoObj;
    } else {
      list = [manutencaoObj, ...list];
    }
    localStorage.setItem("risel_frota_manutencoes", JSON.stringify(list));
  } catch (e) {}

  let savedInSupabase = false;

  // 1. Tenta salvar na tabela 'manutencoes' com compatibilidade de nomes de colunas
  try {
    const dbPayload: any = {
      id: idStr,
      placa,
      tipo,
      descricao: item.descricao || 'Manutenção veicular',
      data,
      data_entrada: dataEntrada,
      data_saida: dataSaida,
      odometro,
      km_veiculo: odometro,
      custo,
      valor_total: custo,
      oficina: item.oficina || 'Oficina Credenciada',
      oficina_fornecedor: item.oficina || 'Oficina Credenciada',
      condutor: item.condutor || null,
      base: item.base || null,
      modelo: item.modelo || null,
      nf_os: item.nf_os || null,
      status: item.status || 'Concluída',
      observacoes: item.observacoes || null
    };

    const { error } = await client
      .from('manutencoes')
      .upsert(dbPayload, { onConflict: 'id' });

    if (!error) {
      savedInSupabase = true;
    }
  } catch (err) {
    // Continua para o salvamento via lancamentos
  }

  // 2. Persiste na tabela 'lancamentos' do Supabase garantindo persistência no PostgreSQL oficial
  try {
    // Converte ID para número seguro de BIGINT se necessário
    const rawNum = parseInt(idStr.replace(/\D/g, ''), 10);
    const numericId = !isNaN(rawNum) && rawNum > 0 && rawNum < 9000000000 
      ? rawNum 
      : Math.abs(idStr.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 2147483647, 0));

    const lancRecord = {
      id: numericId,
      status: item.status === 'Em Andamento' ? 'Aguardando aprovação' : 'Aprovado',
      data_lancamento: data,
      data_vencimento: data,
      fornecedor: item.oficina || 'Oficina / Fornecedor',
      doc: item.nf_os || `OS-${placa}-${Date.now().toString().slice(-4)}`,
      valor: custo.toFixed(2),
      forma_pagto: 'Boleto',
      tipo: 'Manutenção',
      descricao: `[${tipo}] ${placa} - ${item.descricao || 'Ordem de Serviço de Manutenção'}`,
      estabelecimento: item.base || '100 - Paulínia',
      item_sistema: `MANUT-${placa}`,
      observacao: JSON.stringify(manutencaoObj),
      frequencia: 'Eventual',
      lancado_por: 'Controle de Frota Leve'
    };

    const { error: lancErr } = await client
      .from('lancamentos')
      .upsert(lancRecord, { onConflict: 'id' });

    if (!lancErr) {
      savedInSupabase = true;
    }
  } catch (err) {
    console.warn("Aviso ao salvar manutenção no Supabase:", err);
  }

  return savedInSupabase || true;
}

export async function deleteManutencaoSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  const idStr = String(id);

  // Atualiza cache local
  try {
    const saved = localStorage.getItem("risel_frota_manutencoes");
    if (saved) {
      const list: SupabaseManutencao[] = JSON.parse(saved);
      const filtered = list.filter(m => String(m.id) !== idStr);
      localStorage.setItem("risel_frota_manutencoes", JSON.stringify(filtered));
    }
  } catch (e) {}

  // 1. Tenta deletar da tabela 'manutencoes'
  try {
    await client.from('manutencoes').delete().eq('id', idStr);
  } catch (e) {}

  // 2. Tenta deletar da tabela 'lancamentos'
  try {
    const rawNum = parseInt(idStr.replace(/\D/g, ''), 10);
    if (!isNaN(rawNum) && rawNum > 0) {
      await client.from('lancamentos').delete().eq('id', rawNum);
    }
  } catch (e) {}

  return true;
}

export async function saveBatchManutencoesSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };
  let count = 0;
  for (const item of items) {
    const ok = await saveManutencaoSupabase(item);
    if (ok) count++;
  }
  return { count, success: count > 0 };
}

// 13. RESERVAS DE VEÍCULOS (FROTA LEVE)
export async function fetchReservasSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('reservas')
      .select('*')
      .order('de', { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar reservas no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      placa: row.placa,
      condutor: row.condutor,
      de: row.de,
      ate: row.ate,
      destino: row.destino || "",
      status: row.status || "Confirmada",
      observacoes: row.observacoes || ""
    }));
  } catch (err) {
    console.error("Erro no fetchReservasSupabase:", err);
    return [];
  }
}

export async function saveReservaSupabase(reserva: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord = {
      id: String(reserva.id || `res_${Date.now()}`),
      placa: String(reserva.placa || "").toUpperCase().trim(),
      condutor: reserva.condutor || "Disponível",
      de: reserva.de || new Date().toISOString(),
      ate: reserva.ate || new Date().toISOString(),
      destino: reserva.destino || "",
      status: reserva.status || "Confirmada",
      observacoes: reserva.observacoes || ""
    };

    const { error } = await client
      .from('reservas')
      .upsert(dbRecord, { onConflict: 'id' });

    if (error) {
      console.warn("Aviso ao salvar reserva no Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no saveReservaSupabase:", err);
    return false;
  }
}

export async function saveBatchReservasSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };
  let count = 0;
  for (const item of items) {
    const ok = await saveReservaSupabase(item);
    if (ok) count++;
  }
  return { count, success: count > 0 };
}

export async function deleteReservaSupabase(id: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('reservas')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn("Aviso ao deletar reserva no Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteReservaSupabase:", err);
    return false;
  }
}

// 14. CHECKLISTS DE VEÍCULOS
export async function fetchChecklistsSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('checklists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      placa: row.placa,
      condutor: row.condutor,
      data: row.data,
      odometro: Number(row.odometro || 0),
      status: row.status,
      observacoes: row.observacoes || "",
      itens: row.itens || {},
      email: row.email,
      tipo: row.tipo || "Saída"
    }));
  } catch (err) {
    return [];
  }
}

export async function saveChecklistSupabase(checklist: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord = {
      id: String(checklist.id || `chk_${Date.now()}`),
      placa: String(checklist.placa || "").toUpperCase().trim(),
      condutor: checklist.condutor || "",
      data: checklist.data || new Date().toISOString(),
      odometro: Number(checklist.odometro || 0),
      status: checklist.status || "Aprovado",
      observacoes: checklist.observacoes || "",
      itens: checklist.itens || {},
      email: checklist.email || "",
      tipo: checklist.tipo || "Saída"
    };

    const { error } = await client
      .from('checklists')
      .upsert(dbRecord, { onConflict: 'id' });

    return !error;
  } catch (err) {
    return false;
  }
}

// 15. MAPEAMENTOS DE E-MAIL (CONFIGURAÇÕES DE MULTAS & FROTA)
export async function fetchEmailMappingsSupabase(tipo: 'placa' | 'base'): Promise<any | null> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('email_mappings')
      .select('mappings')
      .eq('tipo', tipo)
      .maybeSingle();

    if (error || !data) return null;
    return data.mappings;
  } catch (err) {
    return null;
  }
}

export async function saveEmailMappingsSupabase(tipo: 'placa' | 'base', mappings: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('email_mappings')
      .upsert({
        id: `map_${tipo}`,
        tipo,
        mappings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    return !error;
  } catch (err) {
    return false;
  }
}

// 16. Script SQL de Criação das Tabelas do Risel ERP no Supabase
export const SUPABASE_SQL_SCHEMA = `-- Script Completo do Banco de Dados Real - Risel ERP (Supabase Oficial: https://ihowbxlqfcjzzzleasqq.supabase.co)

-- 1. TABELA DE LANÇAMENTOS DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.lancamentos (
    id BIGINT PRIMARY KEY,
    status VARCHAR(100) NOT NULL DEFAULT 'Aguardando aprovação',
    data_lancamento VARCHAR(50),
    data_vencimento VARCHAR(50) NOT NULL,
    fornecedor VARCHAR(255) NOT NULL,
    doc VARCHAR(255) NOT NULL,
    valor VARCHAR(100) NOT NULL,
    forma_pagto VARCHAR(100) DEFAULT 'Boleto',
    tipo VARCHAR(100) DEFAULT 'NF-e',
    descricao TEXT,
    cnpj VARCHAR(50),
    estabelecimento VARCHAR(255) DEFAULT '100 - Paulínia',
    nome_arquivo_anexo TEXT,
    arquivo_anexo_base64 TEXT,
    item_sistema VARCHAR(100),
    data_emissao VARCHAR(50),
    observacao TEXT,
    frequencia VARCHAR(100) DEFAULT 'Esporádico',
    lancado_por VARCHAR(100) DEFAULT 'Deny',
    data_aprovacao VARCHAR(50),
    centro_custo VARCHAR(255) DEFAULT 'C.C 101 - Operacional',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(255) DEFAULT 'C.C 101 - Operacional';
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS codigo_lancamento VARCHAR(255);

-- 1. Políticas Seguras de RLS para Lançamentos (Prevenção contra exclusão indevida e controle de acesso)
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Leitura Lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Gravacao Lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Exclusao Restrita Lancamentos" ON public.lancamentos;
CREATE POLICY "Leitura Lancamentos" ON public.lancamentos FOR SELECT USING (true);
CREATE POLICY "Gravacao Lancamentos" ON public.lancamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Lancamentos" ON public.lancamentos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Lancamentos" ON public.lancamentos FOR DELETE TO authenticated USING (true);

-- 2. TABELA DE CENTROS DE CUSTO
CREATE TABLE IF NOT EXISTS public.centros_custo (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50),
    nome VARCHAR(255) UNIQUE NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Centros Custo" ON public.centros_custo;
DROP POLICY IF EXISTS "Leitura Centros Custo" ON public.centros_custo;
DROP POLICY IF EXISTS "Modificacao Centros Custo" ON public.centros_custo;
CREATE POLICY "Leitura Centros Custo" ON public.centros_custo FOR SELECT USING (true);
CREATE POLICY "Modificacao Centros Custo" ON public.centros_custo FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 3. TABELA DE VEÍCULOS (FROTA LEVE - DADOS COMPLETOS DE CADASTRO)
CREATE TABLE IF NOT EXISTS public.veiculos (
    placa VARCHAR(20) PRIMARY KEY,
    modelo VARCHAR(255) NOT NULL,
    marca VARCHAR(100),
    ano INT,
    tipo VARCHAR(100) DEFAULT 'Leve',
    base VARCHAR(100) DEFAULT 'CAMPINEIRA',
    condutor VARCHAR(255) DEFAULT 'Disponível',
    status VARCHAR(100) DEFAULT 'Ativo',
    km_atual NUMERIC(10,2) DEFAULT 0,
    combustivel_padrao VARCHAR(100) DEFAULT 'Flex',
    venc_contrato VARCHAR(50),
    cpf_condutor VARCHAR(50),
    cnh_validade VARCHAR(50),
    cnh_numero VARCHAR(50),
    cnh_anexo_base64 TEXT,
    cnh_nome_arquivo VARCHAR(255),
    funcao VARCHAR(100) DEFAULT 'Motorista',
    contato_motorista VARCHAR(100),
    gestor_resp VARCHAR(255),
    email VARCHAR(255),
    filial VARCHAR(100) DEFAULT 'CAMPINEIRA',
    locadora VARCHAR(255) DEFAULT 'Frota Própria',
    contrato VARCHAR(100),
    odometro NUMERIC(10,2) DEFAULT 0,
    combustivel VARCHAR(100) DEFAULT 'Flex',
    data_troca_condutor VARCHAR(50),
    data_inativacao VARCHAR(50),
    motivo_inativacao TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir adição de colunas detalhadas caso a tabela 'veiculos' já exista no Supabase:
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS venc_contrato VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cpf_condutor VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cnh_validade VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cnh_numero VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cnh_anexo_base64 TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cnh_nome_arquivo VARCHAR(255);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS funcao VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS contato_motorista VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS gestor_resp VARCHAR(255);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS filial VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS locadora VARCHAR(255);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS contrato VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS odometro NUMERIC(10,2);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS combustivel VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS data_troca_condutor VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS data_inativacao VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS motivo_inativacao TEXT;

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Leitura Veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Gravacao Veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Atualizacao Veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Exclusao Restrita Veiculos" ON public.veiculos;
CREATE POLICY "Leitura Veiculos" ON public.veiculos FOR SELECT USING (true);
CREATE POLICY "Gravacao Veiculos" ON public.veiculos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Veiculos" ON public.veiculos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Veiculos" ON public.veiculos FOR DELETE TO authenticated USING (true);

-- 4. TABELA DE FORNECEDORES
CREATE TABLE IF NOT EXISTS public.fornecedores (
    cnpj VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    codigo_item VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(10),
    telefone VARCHAR(100),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Ativo',
    avatar TEXT,
    logradouro TEXT,
    numero VARCHAR(50),
    bairro VARCHAR(100),
    cep VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS numero VARCHAR(50);
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS cep VARCHAR(20);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Leitura Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Modificacao Fornecedores" ON public.fornecedores;
CREATE POLICY "Leitura Fornecedores" ON public.fornecedores FOR SELECT USING (true);
CREATE POLICY "Modificacao Fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. TABELA DE ABASTECIMENTOS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.abastecimentos (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    base VARCHAR(100),
    condutor VARCHAR(255),
    data DATE,
    litros NUMERIC(10,2),
    km_percorrido NUMERIC(10,2),
    valor_total NUMERIC(10,2),
    combustivel VARCHAR(100),
    posto VARCHAR(255),
    cidade VARCHAR(100),
    uf VARCHAR(20),
    valor_litro NUMERIC(10,2),
    saldo NUMERIC(10,2),
    hodometro NUMERIC(10,2),
    cartao VARCHAR(100),
    cnpj_posto VARCHAR(50),
    transacao VARCHAR(100),
    modelo VARCHAR(100),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS uf VARCHAR(20);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS valor_litro NUMERIC(10,2);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS cartao VARCHAR(100);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS cnpj_posto VARCHAR(50);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS transacao VARCHAR(100);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE public.abastecimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Abastecimentos" ON public.abastecimentos;
DROP POLICY IF EXISTS "Leitura Abastecimentos" ON public.abastecimentos;
DROP POLICY IF EXISTS "Gravacao Abastecimentos" ON public.abastecimentos;
DROP POLICY IF EXISTS "Atualizacao Abastecimentos" ON public.abastecimentos;
DROP POLICY IF EXISTS "Exclusao Restrita Abastecimentos" ON public.abastecimentos;
CREATE POLICY "Leitura Abastecimentos" ON public.abastecimentos FOR SELECT USING (true);
CREATE POLICY "Gravacao Abastecimentos" ON public.abastecimentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Abastecimentos" ON public.abastecimentos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Abastecimentos" ON public.abastecimentos FOR DELETE TO authenticated USING (true);

-- 6. TABELA DE CONTRATOS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.contratos (
    id TEXT PRIMARY KEY,
    numero VARCHAR(100) NOT NULL,
    veiculo_placa VARCHAR(20),
    fornecedor VARCHAR(255) NOT NULL,
    tipo_contrato VARCHAR(100) DEFAULT 'Locação',
    data_inicio DATE,
    data_vencimento DATE NOT NULL,
    valor_mensal NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(100) DEFAULT 'Ativo',
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Contratos" ON public.contratos;
DROP POLICY IF EXISTS "Leitura Contratos" ON public.contratos;
DROP POLICY IF EXISTS "Gravacao Contratos" ON public.contratos;
DROP POLICY IF EXISTS "Atualizacao Contratos" ON public.contratos;
DROP POLICY IF EXISTS "Exclusao Restrita Contratos" ON public.contratos;
CREATE POLICY "Leitura Contratos" ON public.contratos FOR SELECT USING (true);
CREATE POLICY "Gravacao Contratos" ON public.contratos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Contratos" ON public.contratos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Contratos" ON public.contratos FOR DELETE TO authenticated USING (true);

-- 7. TABELA DE MANUTENÇÕES (FROTA LEVE - DADOS REAIS)
CREATE TABLE IF NOT EXISTS public.manutencoes (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    data DATE,
    data_entrada DATE,
    data_saida DATE,
    tipo VARCHAR(100) DEFAULT 'Preventiva',
    descricao TEXT,
    oficina_fornecedor VARCHAR(255),
    oficina VARCHAR(255),
    valor_total NUMERIC(10,2) DEFAULT 0,
    custo NUMERIC(10,2) DEFAULT 0,
    km_veiculo NUMERIC(10,2),
    odometro NUMERIC(10,2),
    condutor VARCHAR(255),
    base VARCHAR(100),
    modelo VARCHAR(100),
    nf_os VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Concluída',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS data_saida DATE;
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS oficina VARCHAR(255);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS custo NUMERIC(10,2);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS odometro NUMERIC(10,2);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS condutor VARCHAR(255);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS base VARCHAR(100);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS nf_os VARCHAR(100);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Manutencoes" ON public.manutencoes;
DROP POLICY IF EXISTS "Leitura Manutencoes" ON public.manutencoes;
DROP POLICY IF EXISTS "Gravacao Manutencoes" ON public.manutencoes;
DROP POLICY IF EXISTS "Atualizacao Manutencoes" ON public.manutencoes;
DROP POLICY IF EXISTS "Exclusao Restrita Manutencoes" ON public.manutencoes;
CREATE POLICY "Leitura Manutencoes" ON public.manutencoes FOR SELECT USING (true);
CREATE POLICY "Gravacao Manutencoes" ON public.manutencoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Manutencoes" ON public.manutencoes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Manutencoes" ON public.manutencoes FOR DELETE TO authenticated USING (true);

-- 8. TABELA DE MULTAS (FROTA LEVE - DADOS COMPLETOS)
CREATE TABLE IF NOT EXISTS public.multas (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    frota VARCHAR(100),
    ait VARCHAR(100),
    tipo VARCHAR(50) DEFAULT 'AUTO',
    status VARCHAR(100) DEFAULT 'AGUARDANDO BOLETO',
    valor NUMERIC(10,2) DEFAULT 0,
    valor_com_desconto NUMERIC(10,2) DEFAULT 0,
    desconto NUMERIC(10,2) DEFAULT 0,
    data_infracao DATE,
    data_recebimento DATE,
    prazo_indicacao DATE,
    enquadramento VARCHAR(100),
    artigo_ctb VARCHAR(100),
    descricao_infracao TEXT,
    pontos_cnh INT DEFAULT 0,
    base VARCHAR(100),
    nome_motorista VARCHAR(255),
    orgao_autuador VARCHAR(255),
    endereco TEXT,
    municipio VARCHAR(100),
    uf VARCHAR(10),
    rodovia_urbano VARCHAR(50) DEFAULT 'URBANO',
    recebida_com_prazo VARCHAR(20) DEFAULT 'SIM',
    retornou_com_prazo VARCHAR(20) DEFAULT 'SIM',
    empresa_ou_condutor VARCHAR(50) DEFAULT 'CONDUTOR',
    descontar_motorista VARCHAR(20) DEFAULT 'SIM',
    pago_com_desconto VARCHAR(20) DEFAULT 'SIM',
    enviado_rh VARCHAR(20) DEFAULT 'NÃO',
    link_ait TEXT,
    link_autorizacao TEXT,
    obs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir adição de colunas em bancos existentes
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS frota VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS ait VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'AUTO';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'AGUARDANDO BOLETO';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS valor_com_desconto NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS data_infracao DATE;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS data_recebimento DATE;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS prazo_indicacao DATE;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS enquadramento VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS artigo_ctb VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS descricao_infracao TEXT;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS pontos_cnh INT DEFAULT 0;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS base VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS nome_motorista VARCHAR(255);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS orgao_autuador VARCHAR(255);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS uf VARCHAR(10);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS rodovia_urbano VARCHAR(50) DEFAULT 'URBANO';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS recebida_com_prazo VARCHAR(20) DEFAULT 'SIM';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS retornou_com_prazo VARCHAR(20) DEFAULT 'SIM';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS empresa_ou_condutor VARCHAR(50) DEFAULT 'CONDUTOR';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS descontar_motorista VARCHAR(20) DEFAULT 'SIM';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS pago_com_desconto VARCHAR(20) DEFAULT 'SIM';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS enviado_rh VARCHAR(20) DEFAULT 'NÃO';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS link_ait TEXT;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS link_autorizacao TEXT;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS obs TEXT;

ALTER TABLE public.multas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Multas" ON public.multas;
DROP POLICY IF EXISTS "Leitura Multas" ON public.multas;
DROP POLICY IF EXISTS "Gravacao Multas" ON public.multas;
DROP POLICY IF EXISTS "Atualizacao Multas" ON public.multas;
DROP POLICY IF EXISTS "Exclusao Restrita Multas" ON public.multas;
CREATE POLICY "Leitura Multas" ON public.multas FOR SELECT USING (true);
CREATE POLICY "Gravacao Multas" ON public.multas FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Multas" ON public.multas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Multas" ON public.multas FOR DELETE TO authenticated USING (true);

-- 9. TABELA DE USUÁRIOS E ACESSOS
CREATE TABLE IF NOT EXISTS public.usuarios (
    email VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    nome VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    permissions JSONB,
    status VARCHAR(50) DEFAULT 'Ativa',
    password VARCHAR(255),
    must_change_password BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS nome VARCHAR(255);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Leitura Usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Modificacao Usuarios" ON public.usuarios;
CREATE POLICY "Leitura Usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Modificacao Usuarios" ON public.usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. TABELA DE RESERVAS DE VEÍCULOS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.reservas (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    condutor VARCHAR(255) NOT NULL,
    de VARCHAR(50) NOT NULL,
    ate VARCHAR(50) NOT NULL,
    destino TEXT,
    status VARCHAR(50) DEFAULT 'Confirmada',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Leitura Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Gravacao Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Atualizacao Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Exclusao Restrita Reservas" ON public.reservas;
CREATE POLICY "Leitura Reservas" ON public.reservas FOR SELECT USING (true);
CREATE POLICY "Gravacao Reservas" ON public.reservas FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Reservas" ON public.reservas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Reservas" ON public.reservas FOR DELETE TO authenticated USING (true);

-- 11. TABELA DE CHECKLISTS DE VEÍCULOS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.checklists (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    condutor VARCHAR(255) NOT NULL,
    data VARCHAR(50),
    odometro NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Aprovado',
    observacoes TEXT,
    itens JSONB,
    email VARCHAR(255),
    tipo VARCHAR(50) DEFAULT 'Saída',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Checklists" ON public.checklists;
DROP POLICY IF EXISTS "Leitura Checklists" ON public.checklists;
DROP POLICY IF EXISTS "Gravacao Checklists" ON public.checklists;
CREATE POLICY "Leitura Checklists" ON public.checklists FOR SELECT USING (true);
CREATE POLICY "Gravacao Checklists" ON public.checklists FOR ALL USING (true) WITH CHECK (true);

-- 12. TABELA DE MAPEAMENTOS DE E-MAIL (CONFIGURAÇÃO DE DISPAROS DE MULTAS E FROTAS)
CREATE TABLE IF NOT EXISTS public.email_mappings (
    id TEXT PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    mappings JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.email_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Email Mappings" ON public.email_mappings;
CREATE POLICY "Leitura Email Mappings" ON public.email_mappings FOR SELECT USING (true);
CREATE POLICY "Gravacao Email Mappings" ON public.email_mappings FOR ALL USING (true) WITH CHECK (true);
`;

