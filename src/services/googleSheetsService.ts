import firebase from "firebase/compat/app";
import { auth } from "../firebaseConfig";
import { Veiculo, VEICULOS_REAIS } from "../data/veiculos_reais";
import { Abastecimento } from "../pages/Frota";
import Papa from "papaparse";

// Planilha ID oficial do Controle de Frota Leve
export const SPREADSHEET_ID = "1ap_3AucNXOYAJue_KDC-uI54O6fFt2-v-tlteEpBUsA";
export const GID_VEICULOS = 0;
export const GID_ABASTECIMENTOS = 0;

let cachedAccessToken: string | null = null;

// Inicializa ou escuta mudanças de autenticação
auth.onAuthStateChanged((user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

/**
 * Realiza login com o Google para obter permissões de Sheets e Drive.
 */
export const connectGoogleSheets = async (): Promise<string> => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/spreadsheets");
    provider.addScope("https://www.googleapis.com/auth/drive.file");

    const result = await auth.signInWithPopup(provider);
    const credential = result.credential as firebase.auth.OAuthCredential;
    
    if (!credential || !credential.accessToken) {
      throw new Error("Não foi possível obter o token de acesso da conta Google.");
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem("google_sheets_token", credential.accessToken);
    localStorage.setItem("google_sheets_enabled", "true");
    return cachedAccessToken;
  } catch (error: any) {
    console.error("Erro ao conectar com Google Sheets:", error);
    if (error?.code === "auth/popup-blocked" || error?.message?.includes("popup-blocked") || error?.code === "auth/popup-closed-by-user") {
      throw new Error(`A janela pop-up do Google foi bloqueada pelo navegador/iFrame.\n\nNão se preocupe: o sistema irá salvar e processar suas importações normalmente!`);
    }
    if (error?.code === "auth/unauthorized-domain" || error?.message?.includes("unauthorized-domain")) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
      throw new Error(`O domínio "${hostname}" não está autorizado no seu projeto Firebase para login do Google.\n\nVocê pode continuar utilizando o sistema e importando seus arquivos normalmente.`);
    }
    throw error;
  }
};

/**
 * Retorna o token de acesso em cache ou do localStorage.
 */
export const getAccessToken = (): string | null => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem("google_sheets_token");
  }
  return cachedAccessToken;
};

export const setAccessToken = (token: string) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem("google_sheets_token", token);
  } else {
    localStorage.removeItem("google_sheets_token");
  }
};

/**
 * Busca e salva a URL do Google Apps Script Web App para sincronização de planilha sem OAuth
 */
export const getAppsScriptUrl = async (): Promise<string> => {
  const local = localStorage.getItem("risel_apps_script_url");
  if (local) return local;
  try {
    const res = await fetch("/api/sheets/config");
    if (res.ok) {
      const data = await res.json();
      if (data.appsScriptUrl) {
        localStorage.setItem("risel_apps_script_url", data.appsScriptUrl);
        return data.appsScriptUrl;
      }
    }
  } catch (e) {}
  return "";
};

export const saveAppsScriptUrl = async (url: string): Promise<boolean> => {
  const cleanUrl = url.trim();
  localStorage.setItem("risel_apps_script_url", cleanUrl);
  try {
    await fetch("/api/sheets/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appsScriptUrl: cleanUrl })
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Leitura pública direta do CSV exportado pelo Google Visualizations (gviz)
 */
export const readPublicCsvByGid = async (gid: number | string): Promise<{ sheetTitle: string; headers: string[]; rows: string[][] }> => {
  const gidsToTry = [gid, 0, 1773480680];
  for (const tryGid of gidsToTry) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${tryGid}`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0 && !text.includes("<!DOCTYPE html>")) {
          const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
          const data = parsed.data || [];
          if (data.length > 0) {
            const headers = data[0].map(h => String(h || "").trim());
            const rows = data.slice(1).map(r => r.map(c => String(c || "").trim()));
            const sheetTitle = Number(tryGid) === 1773480680 ? "Abastecimento" : "Página1";
            return { sheetTitle, headers, rows };
          }
        }
      }
    } catch (e) {
      console.warn(`Erro ao tentar ler GID ${tryGid} no Google Sheets:`, e);
    }
  }
  return { sheetTitle: "Página1", headers: [], rows: [] };
};

/**
 * Busca o nome da aba correspondente ao GID (sheetId) especificado
 */
export const getSheetTitleByGid = async (token: string, gid: number | string): Promise<string> => {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties(sheetId,title)`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      const targetGid = Number(gid);
      if (data.sheets && data.sheets.length > 0) {
        const found = data.sheets.find((s: any) => Number(s.properties?.sheetId) === targetGid);
        if (found?.properties?.title) {
          return found.properties.title;
        }
        if (data.sheets[0]?.properties?.title) {
          return data.sheets[0].properties.title;
        }
      }
    }
  } catch (err) {
    console.warn(`Erro ao obter nome da aba para gid ${gid}:`, err);
  }
  return "Página1";
};

/**
 * Lê os dados de uma aba específica da planilha através do seu GID
 */
export const readSheetDataByGid = async (token?: string | null, gid: number | string = GID_VEICULOS): Promise<{ sheetTitle: string; headers: string[]; rows: string[][] }> => {
  if (token) {
    try {
      const sheetTitle = await getSheetTitleByGid(token, gid);
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:ZZ100000`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const values: string[][] = data.values || [];

        if (values.length === 0) {
          return { sheetTitle, headers: [], rows: [] };
        }

        const headers = values[0];
        const rows = values.slice(1);
        return { sheetTitle, headers, rows };
      }
    } catch (err) {
      console.warn(`Falha na leitura autenticada da aba ${gid}, tentando leitura pública:`, err);
    }
  }

  // Fallback para leitura pública via gviz CSV
  return readPublicCsvByGid(gid);
};

/**
 * Escreve todos os dados em uma aba por GID (limpa dados anteriores e substitui)
 */
export const writeSheetDataByGid = async (token: string, gid: number | string, headers: string[], rows: string[][]): Promise<void> => {
  if (!token) {
    throw new Error("Token de acesso do Google ausente. Conecte sua conta do Google Sheets para salvar.");
  }
  const sheetTitle = await getSheetTitleByGid(token, gid);

  // Limpa o conteúdo anterior
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:ZZ100000:clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  }).catch(() => {});

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [headers, ...rows]
    })
  });

  if (!res.ok) {
    throw new Error(`Falha ao gravar os dados na aba "${sheetTitle}": ${res.statusText}`);
  }
};

/**
 * Adiciona novas linhas em uma aba por GID mapeando exatamente as colunas da aba (preservando de A ate BI)
 */
export const saveCsvDataToSheetsByGid = async (
  token: string | null, 
  gid: number | string, 
  csvRows: any[], 
  rawHeaders?: string[], 
  rawRows?: string[][]
): Promise<{ added: number; total: number; savedInSheets?: boolean }> => {
  const activeToken = token || getAccessToken();

  if (!csvRows || csvRows.length === 0) {
    return { added: 0, total: 0 };
  }

  const { sheetTitle, headers: sheetHeaders } = await readSheetDataByGid(activeToken, gid);
  const sampleRow = csvRows[0];
  const isArrayRow = Array.isArray(sampleRow);
  const csvHeaders = rawHeaders || (isArrayRow ? [] : Object.keys(sampleRow));

  const normalize = (str: string) => 
    String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();

  let targetHeaders = sheetHeaders.length > 0 ? sheetHeaders : csvHeaders;

  const normalizedCsvHeaders = csvHeaders.map((h, i) => ({ original: h, normalized: normalize(h), index: i }));

  // Helper de busca inteligente por nomes de colunas na planilha
  const getFieldValue = (row: any, targetHeader: string, colIdx: number): string => {
    if (Array.isArray(row)) {
      return row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]) : "";
    }

    if (row[targetHeader] !== undefined && row[targetHeader] !== null && String(row[targetHeader]).trim() !== "") {
      return String(row[targetHeader]);
    }

    const normSh = normalize(targetHeader);
    
    const match = normalizedCsvHeaders.find(ch => ch.normalized === normSh);
    if (match && row[match.original] !== undefined && row[match.original] !== null && String(row[match.original]).trim() !== "") {
      return String(row[match.original]);
    }

    const partialMatch = normalizedCsvHeaders.find(ch => 
      (normSh.length >= 3 && ch.normalized.includes(normSh)) || 
      (ch.normalized.length >= 3 && normSh.includes(ch.normalized))
    );
    if (partialMatch && row[partialMatch.original] !== undefined && row[partialMatch.original] !== null && String(row[partialMatch.original]).trim() !== "") {
      return String(row[partialMatch.original]);
    }

    if (csvHeaders[colIdx] && row[csvHeaders[colIdx]] !== undefined && row[csvHeaders[colIdx]] !== null && String(row[csvHeaders[colIdx]]).trim() !== "") {
      return String(row[csvHeaders[colIdx]]);
    }

    const rowKeys = Object.keys(row);
    const getByKeys = (possibleKeys: string[]) => {
      for (const pk of possibleKeys) {
        const normPk = normalize(pk);
        const kMatch = rowKeys.find(rk => normalize(rk) === normPk || normalize(rk).includes(normPk) || normPk.includes(normalize(rk)));
        if (kMatch && row[kMatch] !== undefined && row[kMatch] !== null && String(row[kMatch]).trim() !== "") {
          return String(row[kMatch]);
        }
      }
      return "";
    };

    if (normSh.includes("placa") || normSh.includes("veiculo")) return getByKeys(["placa", "veiculo", "placaVeiculo", "matricula"]);
    if (normSh.includes("data") || normSh.includes("transac")) return getByKeys(["data", "dataHora", "dtTransacao", "dataTransacao"]);
    if (normSh.includes("litro") || normSh.includes("mercadoria") || normSh.includes("qtd") || normSh.includes("volume")) return getByKeys(["litros", "qtdMercadoria", "volume", "quantidade"]);
    if (normSh.includes("valor") || normSh.includes("custo") || normSh.includes("gasto") || normSh.includes("pago")) return getByKeys(["valorTotal", "valor", "custoTotal", "valorLiquido"]);
    if (normSh.includes("km") || normSh.includes("hodometro") || normSh.includes("distancia") || normSh.includes("percorrido")) return getByKeys(["kmPercorrido", "hodometro", "km", "leitura"]);
    if (normSh.includes("combustivel") || normSh.includes("produto")) return getByKeys(["combustivel", "mercadoria", "tipoMercadoria", "produto"]);
    if (normSh.includes("posto") || normSh.includes("ec") || normSh.includes("estabelecimento")) return getByKeys(["posto", "nomeEc", "estabelecimento", "razaoSocial"]);
    if (normSh.includes("cidade") || normSh.includes("municipio") || normSh.includes("uf")) return getByKeys(["cidade", "cidadeEc", "municipio"]);
    if (normSh.includes("base") || normSh.includes("filial") || normSh.includes("unidade")) return getByKeys(["base", "nomeFilial", "filial", "unidade"]);
    if (normSh.includes("motorista") || normSh.includes("condutor")) return getByKeys(["condutor", "nomeMotorista", "motorista"]);

    return "";
  };

  const rowsToWrite = rawRows || csvRows.map(row => {
    return targetHeaders.map((sh, idx) => getFieldValue(row, sh, idx));
  });

  // Envia via proxy seguro no servidor
  try {
    const proxyRes = await fetch("/api/sheets/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle,
        rows: rowsToWrite,
        token: activeToken,
        items: csvRows,
        rawHeaders: csvHeaders,
        rawRows: rawRows || rowsToWrite
      })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return { added: rowsToWrite.length, total: rowsToWrite.length, savedInSheets: Boolean(data.savedInSheets) };
    }
  } catch (proxyErr) {
    console.warn("Erro no proxy de gravação do servidor, tentando API direta do Google:", proxyErr);
  }

  if (activeToken) {
    if (sheetHeaders.length === 0 && csvHeaders.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: [csvHeaders] })
      }).catch(() => {});
    }

    const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: rowsToWrite })
    });

    if (appendRes.ok) {
      return { added: rowsToWrite.length, total: rowsToWrite.length, savedInSheets: true };
    }
  }

  return { added: rowsToWrite.length, total: rowsToWrite.length, savedInSheets: false };
};

/**
 * Salva a lista completa de abastecimentos na aba GID_ABASTECIMENTOS respeitando as 61 colunas (A ate BI) da planilha
 */
export const saveAllAbastecimentosToSheets = async (token: string, abastecimentos: Abastecimento[]): Promise<void> => {
  if (!token) return;

  const { sheetTitle, headers: sheetHeaders } = await readSheetDataByGid(token, GID_ABASTECIMENTOS);
  
  const targetHeaders = sheetHeaders.length > 0 ? sheetHeaders : [
    "Placa", "Filial", "Condutor", "Data Transação", "Qtd Mercadoria", "Km Percorrido", "Valor Total", "Combustível", "Posto", "Cidade"
  ];

  const normalize = (str: string) => 
    String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();

  const rows = abastecimentos.map(a => {
    const itemRecord: Record<string, any> = {
      placa: a.placa,
      base: a.base,
      filial: a.base,
      condutor: a.condutor,
      data: a.data,
      dataTransacao: a.data,
      litros: a.litros,
      qtdMercadoria: a.litros,
      kmPercorrido: a.kmPercorrido,
      valorTotal: a.valorTotal,
      valor: a.valorTotal,
      combustivel: a.combustivel,
      posto: a.posto,
      cidade: a.cidade,
      saldo: a.saldo !== undefined ? a.saldo : "",
      hodometro: a.hodometro !== undefined ? a.hodometro : ""
    };

    return targetHeaders.map(sh => {
      const normSh = normalize(sh);
      if (normSh.includes("placa") || normSh.includes("veiculo")) return itemRecord.placa || "";
      if (normSh.includes("data") || normSh.includes("transac")) return itemRecord.data || "";
      if (normSh.includes("litro") || normSh.includes("mercadoria") || normSh.includes("qtd") || normSh.includes("volume")) return String(itemRecord.litros || 0);
      if (normSh.includes("valor") || normSh.includes("custo") || normSh.includes("gasto") || normSh.includes("pago")) return String(itemRecord.valorTotal || 0);
      if (normSh.includes("km") || normSh.includes("hodometro") || normSh.includes("percorrido")) return String(itemRecord.kmPercorrido || 0);
      if (normSh.includes("combustivel") || normSh.includes("produto")) return itemRecord.combustivel || "";
      if (normSh.includes("posto") || normSh.includes("ec") || normSh.includes("estabelecimento")) return itemRecord.posto || "";
      if (normSh.includes("cidade") || normSh.includes("municipio")) return itemRecord.cidade || "";
      if (normSh.includes("base") || normSh.includes("filial") || normSh.includes("unidade")) return itemRecord.base || "";
      if (normSh.includes("motorista") || normSh.includes("condutor")) return itemRecord.condutor || "";
      if (normSh.includes("saldo")) return itemRecord.saldo ? String(itemRecord.saldo) : "";
      return "";
    });
  });

  await writeSheetDataByGid(token, GID_ABASTECIMENTOS, targetHeaders, rows);
};

/**
 * Salva a lista inteira de veículos na aba gid=0 da planilha do Google
 */
export const saveVehiclesToSheets = async (token: string, veiculos: Veiculo[]): Promise<void> => {
  const headers = [
    "Placa", "Modelo", "Condutor", "Função", "Contato Motorista", 
    "Gestor Resp.", "Email", "Filial", "Locadora", "Contrato", 
    "Venc. Contrato", "Odômetro", "Combustível", "Status"
  ];

  const rows = veiculos.map(v => [
    v.placa || "",
    v.modelo || "",
    v.condutor || "",
    v.funcao || "",
    v.contatoMotorista || "",
    v.gestorResp || "",
    v.email || "",
    v.filial || "",
    v.locadora || "",
    v.contrato || "",
    v.vencContrato || "",
    String(v.odometro || 0),
    v.combustivel || "",
    v.status || "Ativo"
  ]);

  await writeSheetDataByGid(token, GID_VEICULOS, headers, rows);
};

/**
 * Lê os veículos salvos na aba gid=0 da planilha do Google
 */
export const readVehiclesFromSheets = async (token?: string | null): Promise<Veiculo[]> => {
  const { headers, rows } = await readSheetDataByGid(token, GID_VEICULOS);
  if (headers.length === 0 || rows.length === 0) return [];

  const normalize = (str: string) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  const getCol = (row: string[], colNames: string[]) => {
    for (const cn of colNames) {
      const normTarget = normalize(cn);
      const idx = headers.findIndex(h => normalize(h) === normTarget || normalize(h).includes(normTarget));
      if (idx !== -1 && row[idx] !== undefined) {
        return row[idx].trim();
      }
    }
    return "";
  };

  return rows.map((row, index) => {
    const placa = getCol(row, ["Placa", "placa", "Veículo"]).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!placa) return null;

    const modelo = getCol(row, ["Modelo", "modelo", "Veiculo"]) || "MOBI";
    const condutor = getCol(row, ["Condutor", "condutor", "Motorista"]) || "Motorista Risel";
    const funcao = getCol(row, ["Função", "Funcao", "funcao"]);
    const contatoMotorista = getCol(row, ["Contato Motorista", "Contato", "Telefone"]);
    const gestorResp = getCol(row, ["Gestor Resp.", "Gestor", "Responsavel"]);
    const email = getCol(row, ["Email", "email"]);
    const rawFilial = getCol(row, ["Filial", "filial", "Base"]);
    const realVeh = VEICULOS_REAIS.find(v => v.placa === placa);
    const filial = (rawFilial && rawFilial !== "CAMPINEIRA" && rawFilial !== "Campineira") 
      ? rawFilial 
      : (realVeh ? realVeh.filial : "CAMPINEIRA");
    const locadora = getCol(row, ["Locadora", "locadora"]);
    const contrato = getCol(row, ["Contrato", "contrato"]);
    const vencContrato = getCol(row, ["Venc. Contrato", "Vencimento"]);
    const odometro = parseFloat(getCol(row, ["Odômetro", "Odometro", "Km"]).replace(/[^0-9.]/g, '')) || 0;
    const combustivel = getCol(row, ["Combustível", "Combustivel"]) || "Flex";
    const statusRaw = getCol(row, ["Status", "status"]) || "Ativo";

    let status: Veiculo["status"] = "Ativo";
    if (statusRaw.toLowerCase().includes("inativ")) status = "Inativo";
    else if (statusRaw.toLowerCase().includes("manut")) status = "Em Manutenção";
    else if (statusRaw.toLowerCase().includes("reserv")) status = "Reservado";
    else if (statusRaw.toLowerCase().includes("viagem")) status = "Em Viagem";

    return {
      id: `sheet-v-${placa.toLowerCase()}-${index}`,
      placa,
      modelo,
      condutor,
      funcao,
      contatoMotorista,
      gestorResp,
      email,
      filial,
      locadora,
      contrato,
      vencContrato,
      odometro,
      combustivel,
      status
    };
  }).filter(Boolean) as Veiculo[];
};

/**
 * Lê os abastecimentos salvos na aba GID_ABASTECIMENTOS da planilha do Google
 */
export const readFuelFromSheets = async (token?: string | null): Promise<Abastecimento[]> => {
  // 1. Tenta carregar do backend local (/api/abastecimentos/data) que acessa a planilha do Google Sheets diretamente sem restrição de CORS
  try {
    const apiRes = await fetch("/api/abastecimentos/data");
    if (apiRes.ok) {
      const data: Abastecimento[] = await apiRes.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`Carregados ${data.length} abastecimentos via API do Servidor Google Sheets.`);
        return data;
      }
    }
  } catch (err) {
    console.warn("API de abastecimentos indisponível, buscando diretamente via Sheets API / GViz:", err);
  }

  // 2. Fallback: Leitura direta do frontend por GID
  const { headers, rows } = await readSheetDataByGid(token, GID_ABASTECIMENTOS);
  if (headers.length === 0 || rows.length === 0) return [];

  const normalize = (str: string) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  const getCol = (row: string[], colNames: string[]) => {
    for (const cn of colNames) {
      const normTarget = normalize(cn);
      const idx = headers.findIndex(h => normalize(h) === normTarget || normalize(h).includes(normTarget));
      if (idx !== -1 && row[idx] !== undefined) {
        return row[idx].trim();
      }
    }
    return "";
  };

  const parseFloatBr = (val: string): number => {
    if (!val) return 0;
    const str = val.replace(/R\$/gi, '').replace(/L/gi, '').replace(/km/gi, '').trim();
    if (!str) return 0;
    if (str.includes(",") && str.includes(".")) {
      if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
      } else {
        return parseFloat(str.replace(/,/g, "")) || 0;
      }
    }
    if (str.includes(",")) {
      return parseFloat(str.replace(",", ".")) || 0;
    }
    return parseFloat(str) || 0;
  };

  const parseBrazilianDate = (str: string): string => {
    if (!str) return "";
    const isoMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, "0");
      const d = isoMatch[3].padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const brMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (brMatch) {
      const d = brMatch[1].padStart(2, "0");
      const m = brMatch[2].padStart(2, "0");
      let y = brMatch[3];
      if (y.length === 2) y = "20" + y;
      return `${y}-${m}-${d}`;
    }
    return "";
  };

  return rows.map((row, index) => {
    const placa = getCol(row, ["Placa", "placa", "PLACA", "Veiculo", "Veículo", "Placa do Veiculo", "Placa do Veículo", "Matricula", "Matrícula", "Placa Veículo", "Placa - Dig.Motorista"]).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!placa) return null;

    const dataRaw = getCol(row, ["Data/ Hora transação", "Data/ Hora transao", "Data Transação", "Data/Hora", "Data", "data", "DATA", "Dt Transacao", "Data Abastecimento", "Transação"]);
    const data = parseBrazilianDate(dataRaw);
    if (!data) return null;

    const litros = parseFloatBr(getCol(row, ["Qtd Mercadoria", "Litros", "litros", "Volume", "Quantidade", "Qtd", "Volume (L)", "Qtd Litros"]));
    const valorTotal = parseFloatBr(getCol(row, ["Valor total com desconto", "Valor total original", "Valor total", "Valor Total", "Valor Gasto", "Valor", "Custo Total", "Valor (R$)"]));
    if (litros <= 0 && valorTotal <= 0) return null;

    const kmPercorrido = parseFloatBr(getCol(row, ["Km/Hr Percorrido", "Km Percorrido", "Distancia", "Hodômetro Transação - Dig. Motorista", "Hodometro", "Km atual", "Km", "Leitura"]));
    const base = getCol(row, ["Nome Filial", "Base", "base", "Filial", "filial", "Unidade"]) || "CAMPINEIRA";
    const condutor = getCol(row, ["Nome motorista", "Motorista", "Condutor", "condutor"]) || "Sem Motorista Associado";
    const combustivel = getCol(row, ["Mercadoria", "Tipo Mercadoria", "Combustivel", "Combustível", "Produto"]);
    const posto = getCol(row, ["Nome EC", "Nome do Posto", "Posto", "posto", "Estabelecimento"]);
    const cidade = getCol(row, ["Cidade EC", "Cidade", "cidade", "Município", "UF"]);
    const saldo = parseFloatBr(getCol(row, ["Saldo Cartão", "Saldo Cartao", "Saldo", "saldo"])) || undefined;
    const hodometro = parseFloatBr(getCol(row, ["Hodômetro Transação - Dig. Motorista", "Hodometro", "Km atual", "Leitura"])) || undefined;

    return {
      id: `sheet-f-${placa.toLowerCase()}-${index}`,
      placa,
      base: base.trim().toUpperCase(),
      condutor: condutor.trim(),
      data,
      litros,
      kmPercorrido,
      valorTotal,
      combustivel,
      posto,
      cidade,
      saldo,
      hodometro
    };
  }).filter(Boolean) as Abastecimento[];
};

// Manter retrocompatibilidade com funções genéricas antigas
export const readSheetData = async (token?: string | null) => readSheetDataByGid(token, GID_ABASTECIMENTOS);
export const saveCsvDataToSheets = async (token: string | null, csvRows: any[]) => saveCsvDataToSheetsByGid(token, GID_ABASTECIMENTOS, csvRows);


