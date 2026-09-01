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

    return (data || []).map(row => ({
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
      estabelecimento: row.estabelecimento,
      nomeArquivoAnexo: row.nome_arquivo_anexo,
      arquivoAnexoBase64: row.arquivo_anexo_base64,
      itemSistema: row.item_sistema,
      dataEmissao: row.data_emissao,
      observacao: row.observacao,
      frequencia: row.frequencia,
      lancadoPor: row.lancado_por,
      dataAprovacao: row.data_aprovacao,
      centroCusto: row.centro_custo || row.centroCusto || "C.C 101 - Operacional"
    }));
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

    const dbRecord: Partial<SupabaseLancamento> = {
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
      estabelecimento: item.estabelecimento || "100 - Paulínia",
      nome_arquivo_anexo: item.nomeArquivoAnexo || "",
      arquivo_anexo_base64: item.arquivoAnexoBase64 || "",
      item_sistema: item.itemSistema || "",
      data_emissao: item.dataEmissao || "",
      observacao: item.observacao || "",
      frequencia: item.frequencia || "Esporádico",
      lancado_por: item.lancadoPor || "Deny",
      data_aprovacao: item.dataAprovacao || "",
      centro_custo: item.centroCusto || "C.C 101 - Operacional"
    };

    const { error } = await client
      .from('lancamentos')
      .upsert(dbRecord, { onConflict: 'id' });

    if (error) {
      console.error("Erro ao gravar lançamento no Supabase:", error.message || error);
      return false;
    }
    return true;
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
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn("Aviso ao buscar usuários do Supabase:", error.message || error);
      return [];
    }

    if (!data || data.length === 0) return [];

    return data.map((item: any) => {
      const perms = typeof item.permissions === 'string' 
        ? (() => { try { return JSON.parse(item.permissions); } catch { return {}; } })() 
        : (item.permissions || {});

      const mustChange = item.must_change_password !== undefined 
        ? item.must_change_password 
        : (perms?.mustChangePassword !== undefined 
            ? perms.mustChangePassword 
            : (perms?.must_change_password !== undefined 
                ? perms.must_change_password 
                : true));

      return {
        email: item.email,
        name: item.name,
        role: item.role || (perms?.admin ? "admin" : "user"),
        permissions: perms,
        status: item.status || "Ativa",
        password: item.password || "",
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

    const basePermissions = typeof user.permissions === 'object' && user.permissions !== null
      ? user.permissions
      : {};

    const mustChangeVal = user.mustChangePassword !== undefined ? user.mustChangePassword : true;
    const permissionsWithFallback = {
      ...basePermissions,
      mustChangePassword: mustChangeVal,
      must_change_password: mustChangeVal
    };

    const dbRecord: any = {
      email: userEmail,
      name: user.name || userEmail,
      role: user.role || "user",
      permissions: permissionsWithFallback,
      status: user.status || "Ativa",
      password: user.password || "",
      must_change_password: mustChangeVal
    };

    let { error } = await client
      .from('usuarios')
      .upsert(dbRecord, { onConflict: 'email' });

    // Se o banco ainda não possuir a coluna 'must_change_password', realiza fallback gravando sem essa coluna
    if (error && (error.code === 'PGRST204' || error.message?.includes('must_change_password'))) {
      const { must_change_password, ...safeRecord } = dbRecord;
      const fallbackRes = await client
        .from('usuarios')
        .upsert(safeRecord, { onConflict: 'email' });
      error = fallbackRes.error;
    }

    if (error) {
      console.error("Erro ao salvar usuário no Supabase:", error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no saveUsuarioSupabase:", err);
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
    if (error && (error.code === 'PGRST204' || error.message?.includes('data_inativacao') || error.message?.includes('motivo_inativacao') || error.message?.includes('data_troca_condutor'))) {
      const safeRecord: any = { ...dbRecord };
      delete safeRecord.data_inativacao;
      delete safeRecord.motivo_inativacao;
      delete safeRecord.data_troca_condutor;
      const fallbackRes = await client
        .from('veiculos')
        .upsert(safeRecord, { onConflict: 'placa' });
      error = fallbackRes.error;
    }

    if (error) {
      console.error("Erro ao gravar veículo no Supabase:", error.message || error);
      return false;
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

    // Fallback caso a tabela no Supabase não contenha colunas mais recentes
    if (error && (error.code === 'PGRST204' || error.message?.includes('data_inativacao') || error.message?.includes('motivo_inativacao') || error.message?.includes('data_troca_condutor'))) {
      const safeBatch = dbRecords.map(r => {
        const copy: any = { ...r };
        delete copy.data_inativacao;
        delete copy.motivo_inativacao;
        delete copy.data_troca_condutor;
        return copy;
      });
      const fallbackRes = await client
        .from('veiculos')
        .upsert(safeBatch, { onConflict: 'placa' });
      error = fallbackRes.error;
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
      avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.nome?.charAt(0) || "F")}&background=f8fafc`
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
    const dbRecord = {
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

    const { error } = await client
      .from('fornecedores')
      .upsert(dbRecord, { onConflict: 'cnpj' });

    if (error) {
      console.error("Erro ao gravar fornecedor no Supabase:", error);
      return false;
    }
    return true;
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

    if (error) return [];
    return (data || []).map(row => row.nome);
  } catch (err) {
    return [];
  }
}

export async function saveCentroCustoSupabase(nome: string, codigo?: string, descricao?: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanName = nome.trim();
    if (!cleanName) return false;

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
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no saveCentroCustoSupabase:", err);
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

// 12. Script SQL de Criação das Tabelas do Risel ERP no Supabase
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

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Lancamentos" ON public.lancamentos;
CREATE POLICY "Acesso Total Lancamentos" ON public.lancamentos FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "Acesso Total Centros Custo" ON public.centros_custo FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "Acesso Total Veiculos" ON public.veiculos FOR ALL USING (true) WITH CHECK (true);

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Fornecedores" ON public.fornecedores;
CREATE POLICY "Acesso Total Fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "Acesso Total Abastecimentos" ON public.abastecimentos FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "Acesso Total Contratos" ON public.contratos FOR ALL USING (true) WITH CHECK (true);

-- 7. TABELA DE MANUTENÇÕES (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.manutencoes (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    data DATE,
    tipo VARCHAR(100) DEFAULT 'Preventiva',
    descricao TEXT,
    oficina_fornecedor VARCHAR(255),
    valor_total NUMERIC(10,2) DEFAULT 0,
    km_veiculo NUMERIC(10,2),
    status VARCHAR(50) DEFAULT 'Concluída',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Manutencoes" ON public.manutencoes;
CREATE POLICY "Acesso Total Manutencoes" ON public.manutencoes FOR ALL USING (true) WITH CHECK (true);

-- 8. TABELA DE MULTAS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.multas (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    data_infracao DATE,
    infracao TEXT,
    motorista VARCHAR(255),
    valor NUMERIC(10,2) DEFAULT 0,
    pontos INT DEFAULT 0,
    status VARCHAR(100) DEFAULT 'Pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.multas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Multas" ON public.multas;
CREATE POLICY "Acesso Total Multas" ON public.multas FOR ALL USING (true) WITH CHECK (true);

-- 9. TABELA DE USUÁRIOS E ACESSOS
CREATE TABLE IF NOT EXISTS public.usuarios (
    email VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    permissions JSONB,
    status VARCHAR(50) DEFAULT 'Ativa',
    password VARCHAR(255),
    must_change_password BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Usuarios" ON public.usuarios;
CREATE POLICY "Acesso Total Usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);
`;

