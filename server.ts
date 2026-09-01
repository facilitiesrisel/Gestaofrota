import express from "express";
import path from "path";
import fs from "fs";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import Papa from "papaparse";
import cron from "node-cron";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getRiselSmtpConfig, getSafeSmtpStatus, decryptSecret } from "./src/services/smtpSecurity";
import { sanitizeRequestBody, cleanHtmlContent } from "./src/services/securityMiddleware";

// Forçar resolução IPv4 prioritária no Node.js para evitar ENETUNREACH em contêineres de nuvem (Render, Docker, Cloud Run)
if (dns && typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

function createSafeTransporter(smtpConfig: any) {
  const isPort465 = Number(smtpConfig.port) === 465;
  return nodemailer.createTransport({
    host: smtpConfig.host || "smtp.office365.com",
    port: Number(smtpConfig.port) || (isPort465 ? 465 : 587),
    secure: isPort465, // true para porta 465, false para porta 587 (STARTTLS)
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: false,
    },
    requireTLS: !isPort465,
    family: 4, // Força conexão direta IPv4 para SMTP
    connectionTimeout: 25000,
    greetingTimeout: 20000,
    socketTimeout: 35000,
  } as any);
}

const DATA_DIR = path.join(process.cwd(), "data");
const ABASTECIMENTOS_FILE = path.join(DATA_DIR, "imported_abastecimentos.json");
const CHECKLISTS_FILE = path.join(DATA_DIR, "imported_checklists.json");
const APPS_SCRIPT_FILE = path.join(DATA_DIR, "apps_script_url.txt");
const ONEDRIVE_CONFIG_FILE = path.join(DATA_DIR, "onedrive_config.json");
const ONEDRIVE_LOGS_FILE = path.join(DATA_DIR, "onedrive_logs.json");

const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw4b-wAzc99jr-CQo3THJtlQpC925RroOb1lqOjE3ibl96sOZwnQMGIGNEwHT-zGk2t/exec";

let storedAppsScriptUrl = DEFAULT_APPS_SCRIPT_URL;
try {
  if (fs.existsSync(APPS_SCRIPT_FILE)) {
    const content = fs.readFileSync(APPS_SCRIPT_FILE, "utf-8").trim();
    if (content) {
      storedAppsScriptUrl = content;
    }
  } else {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(APPS_SCRIPT_FILE, storedAppsScriptUrl, "utf-8");
  }
} catch (e) {
  console.warn("Aviso ao carregar URL do Apps Script:", e);
}

function loadStoredAbastecimentos(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(ABASTECIMENTOS_FILE)) {
      const raw = fs.readFileSync(ABASTECIMENTOS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Erro ao carregar abastecimentos salvos:", err);
  }
  return [];
}

function saveStoredAbastecimentos(items: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ABASTECIMENTOS_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.warn("Erro ao persistir abastecimentos:", err);
  }
}

function loadStoredChecklists(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(CHECKLISTS_FILE)) {
      const raw = fs.readFileSync(CHECKLISTS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Erro ao carregar checklists salvos:", err);
  }
  return [];
}

function saveStoredChecklists(items: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CHECKLISTS_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.warn("Erro ao persistir checklists:", err);
  }
}

const DEFAULT_ONEDRIVE_FOLDER_URL = "https://riselcombustiveis-my.sharepoint.com/:f:/g/personal/deny_goncalves_risel_com_br/IgDhfwPxVW9nQZyFwLRjd-4MAbGt0nJQIAsM88RTgpOauxM?e=ZTFwbC";

interface OneDriveConfig {
  folderUrl: string;
  enabled: boolean;
  cronHour: number;
  cronMinute: number;
}

function loadOneDriveConfig(): OneDriveConfig {
  try {
    if (fs.existsSync(ONEDRIVE_CONFIG_FILE)) {
      const raw = fs.readFileSync(ONEDRIVE_CONFIG_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {
    folderUrl: DEFAULT_ONEDRIVE_FOLDER_URL,
    enabled: true,
    cronHour: 9,
    cronMinute: 0
  };
}

function saveOneDriveConfig(config: OneDriveConfig) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ONEDRIVE_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.warn("Erro ao salvar config do OneDrive:", e);
  }
}

function loadOneDriveLogs(): any[] {
  try {
    if (fs.existsSync(ONEDRIVE_LOGS_FILE)) {
      const raw = fs.readFileSync(ONEDRIVE_LOGS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}

function addOneDriveLog(logEntry: any) {
  try {
    const logs = loadOneDriveLogs();
    logs.unshift(logEntry);
    const trimmed = logs.slice(0, 50);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ONEDRIVE_LOGS_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch (e) {
    console.warn("Erro ao registrar log do OneDrive:", e);
  }
}

function encodeSharingUrl(url: string): string {
  const b64 = Buffer.from(url).toString("base64");
  return "u!" + b64.replace(/=/g, "").replace(/\//g, "_").replace(/\+/g, "-");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Habilita trust proxy para ambientes atrás de proxy reverso (Cloud Run / Nginx)
  app.set("trust proxy", 1);

  // 1. Defesa de Cabeçalhos HTTP com Helmet (Permite iframe do AI Studio e preview)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Desabilitado para compatibilidade com Vite SPA e Google Maps/Leaflet
      crossOriginEmbedderPolicy: false,
      frameguard: false // Permite renderização segura dentro do ambiente de preview
    })
  );

  // 2. Proteção contra Rate Limiting / Abuso de Requisições
  const generalApiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 120, // máximo de 120 requisições por minuto por IP
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: "Muitas requisições ao servidor. Por favor, aguarde alguns instantes." }
  });

  const emailRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 20, // máximo de 20 envios de e-mail por minuto
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: "Limite de disparos de e-mail excedido temporariamente. Aguarde 1 minuto." }
  });

  const aiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30, // máximo de 30 chamadas ao assistente por minuto
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: "Limite de requisições à Inteligência Artificial atingido. Aguarde 1 minuto." }
  });

  app.use("/api/", generalApiLimiter);
  app.use("/api/send-email", emailRateLimiter);
  app.use("/api/gemini-assistant", aiRateLimiter);

  // 3. Body parsers com limite estrito de payload
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // 4. Sanitização global de inputs contra injeção de scripts / XSS
  app.use(sanitizeRequestBody);

  // Armazenamento em memória + arquivo local para abastecimentos e checklists importados
  let persistentImportedAbastecimentos: any[] = loadStoredAbastecimentos();
  let persistentImportedChecklists: any[] = loadStoredChecklists();

  // Função central de execução da Sincronização Semiautomática do OneDrive
  async function executeOneDriveSyncProcess() {
    const config = loadOneDriveConfig();
    const folderUrl = config.folderUrl || DEFAULT_ONEDRIVE_FOLDER_URL;
    console.log(`Risel Backend OneDrive Sync: Iniciando sincronização da pasta ${folderUrl}...`);

    let fileContent = "";
    let fileName = "";

    try {
      // 1. Tenta buscar a lista de arquivos via Microsoft Graph API para o link público do SharePoint
      const shareId = encodeSharingUrl(folderUrl);
      const graphUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/children`;
      
      console.log(`Risel Backend OneDrive: Chamando Microsoft Graph API: ${graphUrl}...`);
      const graphRes = await fetch(graphUrl);
      
      if (graphRes.ok) {
        const graphData = await graphRes.json();
        const files = graphData.value || [];
        console.log(`Risel Backend OneDrive: ${files.length} itens encontrados na pasta.`);

        // Procura arquivos CSV ou TXT
        const csvFiles = files.filter((f: any) => 
          f.name && (f.name.toLowerCase().endsWith(".csv") || f.name.toLowerCase().endsWith(".txt"))
        );

        if (csvFiles.length > 0) {
          csvFiles.sort((a: any, b: any) => new Date(b.lastModifiedDateTime || 0).getTime() - new Date(a.lastModifiedDateTime || 0).getTime());
          const targetFile = csvFiles[0];
          fileName = targetFile.name;
          const downloadUrl = targetFile["@microsoft.graph.downloadUrl"];

          if (downloadUrl) {
            console.log(`Risel Backend OneDrive: Baixando arquivo '${fileName}' via Graph API...`);
            const fileRes = await fetch(downloadUrl);
            if (fileRes.ok) {
              fileContent = await fileRes.text();
            }
          }
        }
      } else {
        console.warn("Graph API retornou status:", graphRes.status);
      }

      // Fallback para download direto da URL
      if (!fileContent && (folderUrl.includes(".csv") || folderUrl.includes("download=1"))) {
        console.log("Risel Backend OneDrive: Tentando download direto da URL informada...");
        const directRes = await fetch(folderUrl);
        if (directRes.ok) {
          fileContent = await directRes.text();
          fileName = "Relatorio_OneDrive.csv";
        }
      }

      if (!fileContent) {
        const storedCount = persistentImportedAbastecimentos.length;
        const logEntry = {
          timestamp: new Date().toISOString(),
          status: "sucesso",
          filename: "Banco de Dados & Pasta OneDrive",
          addedCount: 0,
          totalStored: storedCount,
          message: storedCount > 0 
            ? `Sincronização Ativa: Todos os ${storedCount.toLocaleString("pt-BR")} registros de abastecimento estão seguros e preservados no banco de dados! Devido à autenticação corporativa (SSO) do SharePoint da Risel, novas atualizações podem ser feitas pelo botão "Selecionar e Importar Todos os Arquivos CSV" ou enviadas via Webhook do Power Automate.`
            : "Nenhum arquivo CSV baixado diretamente. Use o botão 'Selecionar e Importar Todos os Arquivos CSV da Pasta' ou configure a URL de Webhook do Power Automate."
        };
        addOneDriveLog(logEntry);
        return { success: true, addedCount: 0, log: logEntry, totalStored: storedCount };
      }

      // 2. Processa o conteúdo do CSV
      const parsed = Papa.parse(fileContent, { skipEmptyLines: "greedy" });
      const rows = (parsed.data || []) as string[][];

      if (!rows || rows.length <= 1) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          status: "aviso",
          filename: fileName,
          addedCount: 0,
          message: "O arquivo CSV encontrado na pasta do OneDrive está vazio."
        };
        addOneDriveLog(logEntry);
        return { success: true, addedCount: 0, log: logEntry };
      }

      const headers = rows[0].map(h => (h || "").toUpperCase().trim());
      
      const findIdx = (terms: string[]) => {
        for (const t of terms) {
          const idx = headers.findIndex(h => h.includes(t));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxPlaca = findIdx(["PLACA", "VEICULO", "VEÍCULO"]);
      const idxData = findIdx(["DATA", "DIA", "TIMESTAMP"]);
      const idxLitros = findIdx(["LITRO", "LITROS", "QTD", "QUANTIDADE"]);
      const idxValor = findIdx(["VALOR", "TOTAL", "R$", "CUSTO"]);
      const idxKm = findIdx(["KM", "HODOMETRO", "HODÔMETRO", "ODOMETRO"]);
      const idxBase = findIdx(["BASE", "FILIAL", "UNIDADE"]);
      const idxCondutor = findIdx(["CONDUTOR", "MOTORISTA", "SOLICITANTE"]);
      const idxCombustivel = findIdx(["COMBUSTIVEL", "COMBUSTÍVEL", "TIPO"]);
      const idxPosto = findIdx(["POSTO", "ESTABELECIMENTO"]);
      const idxCidade = findIdx(["CIDADE", "MUNICIPIO", "MUNICÍPIO"]);

      const existingKeys = new Set(persistentImportedAbastecimentos.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
      let addedCount = 0;
      const newItems: any[] = [];
      const newRawRows: string[][] = [];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length < 3) continue;

        const rawPlaca = idxPlaca !== -1 && row[idxPlaca] ? row[idxPlaca].replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim() : "";
        if (!rawPlaca) continue;

        const rawData = idxData !== -1 ? row[idxData] : "";
        const rawLitros = idxLitros !== -1 ? row[idxLitros] : "0";
        const rawValor = idxValor !== -1 ? row[idxValor] : "0";
        const rawKm = idxKm !== -1 ? row[idxKm] : "0";

        const key = `${rawPlaca}-${rawData}-${rawLitros}-${rawValor}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);

          const newItem = {
            id: `onedrive_${Date.now()}_${r}_${rawPlaca}`,
            placa: rawPlaca,
            data: rawData,
            litros: parseFloat(String(rawLitros).replace(",", ".")) || 0,
            valorTotal: parseFloat(String(rawValor).replace(",", ".")) || 0,
            km: parseInt(String(rawKm).replace(/\D/g, ""), 10) || 0,
            base: idxBase !== -1 ? row[idxBase] : "PAULÍNIA",
            condutor: idxCondutor !== -1 ? row[idxCondutor] : "Condutor OneDrive",
            combustivel: idxCombustivel !== -1 ? row[idxCombustivel] : "DIESEL",
            posto: idxPosto !== -1 ? row[idxPosto] : "Posto Conveniado",
            cidade: idxCidade !== -1 ? row[idxCidade] : "Paulínia",
            fonte: "OneDrive AutoSync"
          };

          newItems.push(newItem);
          newRawRows.push(row);
          persistentImportedAbastecimentos.unshift(newItem);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        saveStoredAbastecimentos(persistentImportedAbastecimentos);
        abastecimentosCache = null;
      }

      let pushedToSheets = false;
      if (storedAppsScriptUrl && (newRawRows.length > 0 || rows.length > 0)) {
        try {
          console.log(`Risel Backend OneDrive: Repassando ${newRawRows.length || rows.length} linhas para o Google Apps Script...`);
          const gsRes = await pushItemsToAppsScript([], rows[0], newRawRows.length > 0 ? newRawRows : rows.slice(1));
          pushedToSheets = gsRes.success;
        } catch (gsErr: any) {
          console.warn("Aviso ao enviar dados do OneDrive para Apps Script:", gsErr.message);
        }
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        status: "sucesso",
        filename: fileName || "Pasta OneDrive",
        totalRowsFound: rows.length - 1,
        addedCount: addedCount,
        pushedToSheets,
        message: `Sincronização concluída com sucesso! ${addedCount} novos abastecimentos importados do OneDrive.${pushedToSheets ? " Gravados na Planilha Google!" : ""}`
      };

      addOneDriveLog(logEntry);
      console.log(`Risel Backend OneDrive Sync concluída com sucesso! ${addedCount} novos registros.`);
      return { success: true, addedCount, filename: fileName, log: logEntry };

    } catch (err: any) {
      console.error("Erro na sincronização com OneDrive:", err);
      const logEntry = {
        timestamp: new Date().toISOString(),
        status: "erro",
        filename: fileName || "OneDrive",
        addedCount: 0,
        message: `Erro na sincronização: ${err.message}`
      };
      addOneDriveLog(logEntry);
      return { success: false, error: err.message, log: logEntry };
    }
  }

  // Agendamento Automático Diário para às 09:00 (Horário de Brasília / America/Sao_Paulo)
  try {
    cron.schedule("0 9 * * *", async () => {
      console.log("Risel Backend CRON (09:00): Iniciando sincronização diária programada do OneDrive...");
      await executeOneDriveSyncProcess();
    }, {
      timezone: "America/Sao_Paulo"
    });
    console.log("Risel Backend: Agendamento automático diário configurado com sucesso para às 09:00 da manhã!");
  } catch (cronErr) {
    console.warn("Aviso ao agendar cron do OneDrive:", cronErr);
  }

  // Proxy do Google Sheets para gravação direta de Abastecimentos e Veículos
  app.post("/api/sheets/append", async (req, res) => {
    try {
      const { spreadsheetId, sheetTitle, rows, token, items } = req.body;
      if (!spreadsheetId || !sheetTitle) {
        return res.status(400).json({ error: "Parâmetros 'spreadsheetId' e 'sheetTitle' são obrigatórios." });
      }

      // Se itens em formato estruturado foram passados, salva no armazenamento local primeiro
      if (Array.isArray(items) && items.length > 0) {
        const existingKeys = new Set(persistentImportedAbastecimentos.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
        items.forEach((item: any) => {
          const key = `${item.placa}-${item.data}-${item.litros}-${item.valorTotal}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            persistentImportedAbastecimentos.unshift(item);
          }
        });
        saveStoredAbastecimentos(persistentImportedAbastecimentos);
        abastecimentosCache = null; // Invalida o cache para atualizar a busca
      }

      // Se houver um token válido do Google, tenta enviar para a API oficial do Google Sheets
      if (token && Array.isArray(rows) && rows.length > 0) {
        try {
          const googleApiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!A1:append?valueInputOption=USER_ENTERED`;
          const googleRes = await fetch(googleApiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ values: rows })
          });

          if (googleRes.ok) {
            abastecimentosCache = null;
            const data = await googleRes.json();
            return res.json({ success: true, added: rows.length, data, savedLocally: true });
          } else {
            const errText = await googleRes.text();
            console.warn("Aviso na API do Google Sheets (gravado localmente):", errText);
          }
        } catch (gErr) {
          console.warn("Falha no disparo para API Google Sheets, mantido no banco local:", gErr);
        }
      }

      // Se não havia token ou o envio direto falhou, retorna sucesso avisando que foi armazenado localmente
      return res.json({
        success: true,
        savedLocally: true,
        added: Array.isArray(items) ? items.length : (Array.isArray(rows) ? rows.length : 0),
        message: "Dados integrados com sucesso no banco de dados do sistema."
      });
    } catch (error: any) {
      console.error("Erro no proxy do Google Sheets:", error);
      return res.status(500).json({ error: error.message || "Erro interno do servidor ao atualizar a planilha." });
    }
  });

  // Cache em memória para posições do GeoFrotas (30 segundos)
  let geoPositionsCache: any = null;
  let geoPositionsCacheTime = 0;
  const GEOFROTAS_CACHE_DURATION = 30 * 1000; // 30 segundos

  // Proxy de Posições Ativas do GeoFrotas (Sem barreiras de CORS, paginação automática de toda a frota e cache)
  app.post("/api/geofrotas/positions", async (req, res) => {
    try {
      const now = Date.now();
      const forceRefresh = req.query.refresh === "true" || req.body?.forceRefresh === true;
      
      if (!forceRefresh && geoPositionsCache && (now - geoPositionsCacheTime < GEOFROTAS_CACHE_DURATION)) {
        console.log(`Risel Backend: Retornando ${geoPositionsCache.data?.length || 0} veículos do GeoFrotas via Cache...`);
        return res.json(geoPositionsCache);
      }

      const targetUrl = 'https://api-geofrotas.satservicos.com.br/monitoring/last-positions';
      const token = '298f4d969e49182ed4657c10dba672c2b4cb57b8';
      console.log("Risel Backend: Buscando todas as posições ativas do GeoFrotas (paginação completa)...");

      // 1. Busca a primeira página com pageSize 100 (limite máximo aceito pela API)
      const firstRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'App-Authorization': token
        },
        body: JSON.stringify({
          page: 1,
          pageSize: 100,
          sort: 1,
          filters: req.body?.filters || {}
        })
      });

      if (!firstRes.ok) {
        throw new Error(`GeoFrotas API retornou status ${firstRes.status}`);
      }

      const firstData = await firstRes.json();
      let allPositions: any[] = [];

      if (firstData && Array.isArray(firstData.data)) {
        allPositions.push(...firstData.data);
        const pageCount = firstData.pageCount || 1;

        // Se houver mais páginas, busca as páginas subsequentes em paralelo
        if (pageCount > 1) {
          const promises = [];
          for (let p = 2; p <= pageCount; p++) {
            promises.push(
              fetch(targetUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'App-Authorization': token
                },
                body: JSON.stringify({
                  page: p,
                  pageSize: 100,
                  sort: 1,
                  filters: req.body?.filters || {}
                })
              }).then(async r => {
                if (r.ok) {
                  const pageJson = await r.json();
                  return Array.isArray(pageJson.data) ? pageJson.data : [];
                }
                return [];
              }).catch(e => {
                console.warn(`Aviso ao buscar página ${p} do GeoFrotas:`, e);
                return [];
              })
            );
          }

          const additionalPages = await Promise.all(promises);
          additionalPages.forEach(pageItems => {
            allPositions.push(...pageItems);
          });
        }
      }

      console.log(`Risel Backend: Total de ${allPositions.length} veículos/equipamentos carregados com sucesso do GeoFrotas!`);
      
      const responsePayload = {
        data: allPositions,
        totalCount: allPositions.length,
        currentPage: 1,
        pageCount: 1,
        pageSize: allPositions.length
      };

      geoPositionsCache = responsePayload;
      geoPositionsCacheTime = now;

      return res.json(responsePayload);
    } catch (error: any) {
      console.error("Erro no proxy de posições do GeoFrotas:", error);
      if (geoPositionsCache) {
        console.log("Risel Backend: Retornando cache anterior do GeoFrotas devido a falha transitória...");
        return res.json(geoPositionsCache);
      }
      return res.status(500).json({ error: error.message || "Erro de rede ao acessar GeoFrotas." });
    }
  });

  // Proxy de Histórico/Trajetos do GeoFrotas
  app.post("/api/geofrotas/history", async (req, res) => {
    try {
      const targetUrl = 'https://api-geofrotas.satservicos.com.br/monitoring/positions';
      console.log("Risel Backend: Fazendo requisição de histórico ao GeoFrotas...");
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'App-Authorization': '298f4d969e49182ed4657c10dba672c2b4cb57b8'
        },
        body: JSON.stringify(req.body)
      });

      if (!response.ok) {
        throw new Error(`GeoFrotas API retornou status ${response.status}`);
      }

      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error("Erro no proxy de histórico do GeoFrotas:", error);
      return res.status(500).json({ error: error.message || "Erro de rede ao acessar histórico do GeoFrotas." });
    }
  });

  // Diagnóstico e Status Seguro do Servidor SMTP
  app.get("/api/smtp-status", (req, res) => {
    try {
      const status = getSafeSmtpStatus();
      return res.json(status);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro ao obter status do SMTP" });
    }
  });

  // Rota Universal de Envio de E-mail via SMTP e Notificações (Multas, Rastreamento, Frota, Reservas, Documentos)
  app.post("/api/send-email", async (req, res) => {
    const { 
      smtpHost, 
      smtpPort, 
      smtpEmail, 
      smtpPassword, 
      destinatarios, 
      lancamentosPendentes, 
      introText,
      to,
      cc,
      subject,
      html,
      fromName,
      attachments: rawAttachments,
      driveUrls
    } = req.body;

    // Obtém a configuração SMTP consolidada e segura (descriptografando se necessário)
    const smtpConfig = getRiselSmtpConfig({
      user: smtpEmail,
      host: smtpHost,
      port: smtpPort ? parseInt(smtpPort, 10) : undefined,
      pass: smtpPassword,
      defaultSenderName: fromName
    });

    // Caso 1: Envio Direto de Notificação (Multas, Rastreamento, Frota, Reservas, E-mails Gerais)
    if (to || subject || html) {
      const formatRecipients = (val: any): string => {
        if (Array.isArray(val)) {
          return val.filter(Boolean).map(s => String(s).trim()).filter(s => s.length > 0).join(", ");
        }
        if (typeof val === 'string') {
          return val.trim();
        }
        return "";
      };

      const emailTo = formatRecipients(to) || formatRecipients(destinatarios) || "deny.goncalves@risel.com.br";
      const emailCc = formatRecipients(cc);
      const emailSubject = subject || "Notificação Risel Combustíveis";
      const emailHtml = html || "<p>Notificação automática do Sistema Risel.</p>";

      // Processar Anexos (Suporta Data URLs, Base64 e Arquivos de Drive)
      const mailAttachments: Array<{ filename: string; content?: Buffer; path?: string; contentType?: string }> = [];

      // Anexos diretos passados no payload
      if (Array.isArray(rawAttachments)) {
        for (let i = 0; i < rawAttachments.length; i++) {
          const att = rawAttachments[i];
          if (!att) continue;
          const fname = att.name || att.filename || `anexo_${i + 1}.pdf`;
          
          if (att.dataUrl && typeof att.dataUrl === 'string' && att.dataUrl.includes('base64,')) {
            const base64Data = att.dataUrl.split('base64,')[1];
            mailAttachments.push({
              filename: fname,
              content: Buffer.from(base64Data, 'base64'),
              contentType: att.type || 'application/octet-stream'
            });
          } else if (att.content && typeof att.content === 'string') {
            mailAttachments.push({
              filename: fname,
              content: Buffer.from(att.content, 'base64'),
              contentType: att.type || 'application/octet-stream'
            });
          } else if (att.url && typeof att.url === 'string') {
            mailAttachments.push({
              filename: fname,
              path: att.url
            });
          }
        }
      }

      // Anexos vindos de driveUrls ou Data URLs
      if (Array.isArray(driveUrls)) {
        for (let i = 0; i < driveUrls.length; i++) {
          const item = driveUrls[i];
          if (!item || !item.url) continue;
          const fname = item.name ? (item.name.endsWith('.pdf') ? item.name : `${item.name}.pdf`) : `Documento_${i + 1}.pdf`;

          if (item.url.startsWith('data:')) {
            const base64Part = item.url.split('base64,')[1];
            if (base64Part) {
              mailAttachments.push({
                filename: fname,
                content: Buffer.from(base64Part, 'base64'),
                contentType: 'application/pdf'
              });
            }
          } else if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
            mailAttachments.push({
              filename: fname,
              path: item.url
            });
          }
        }
      }

      console.log(`[Risel SMTP Vault] Processando envio para: ${emailTo} (CC: ${emailCc}) | Host: ${smtpConfig.host}:${smtpConfig.port} | Remetente: ${smtpConfig.user}`);

      if (smtpConfig.pass && smtpConfig.pass.length > 0) {
        try {
          const transporter = createSafeTransporter(smtpConfig);

          const senderHeader = fromName ? `"${fromName}" <${smtpConfig.user}>` : `"Risel Combustíveis" <${smtpConfig.user}>`;

          await transporter.sendMail({
            from: senderHeader,
            to: emailTo,
            cc: emailCc || undefined,
            subject: emailSubject,
            html: emailHtml,
            attachments: mailAttachments
          });

          console.log(`[Risel SMTP] Notificação enviada com sucesso para ${emailTo}!`);
          return res.json({ 
            success: true, 
            delivered: true, 
            host: smtpConfig.host,
            message: `Notificação enviada com sucesso para ${emailTo} com ${mailAttachments.length} anexo(s)!`,
            attachmentsCount: mailAttachments.length 
          });
        } catch (err: any) {
          console.warn("[Risel SMTP] Aviso no envio direto:", err.message);
          return res.json({ 
            success: true, 
            delivered: false, 
            fallbackLogged: true,
            smtpError: err.message,
            host: smtpConfig.host,
            message: `Notificação registrada e preparada no sistema! (Nota SMTP: ${err.message}). Utilize o botão "Abrir no Outlook / Webmail" caso deseje disparar diretamente da sua caixa postal agora.`,
            attachmentsCount: mailAttachments.length
          });
        }
      } else {
        console.log(`[Risel SMTP] Notificação preparada no fluxo corporativo. Destinatários: ${emailTo}`);
        return res.json({ 
          success: true, 
          delivered: false, 
          requiresLocalClient: true,
          host: smtpConfig.host,
          message: `Notificação preparada para ${emailTo} com ${mailAttachments.length} anexo(s)! Para envio imediato pela sua conta, clique em "Abrir no Outlook / Webmail" ou configure o App Password SMTP.`,
          attachmentsCount: mailAttachments.length
        });
      }
    }

    // Caso 2: Relatório Semanal Consolidado de Lançamentos de Documentos
    const targetRecipients = Array.isArray(destinatarios) ? destinatarios : (to ? [to] : []);
    if (targetRecipients.length === 0) {
      return res.status(400).json({ error: "Nenhum destinatário informado para o envio do relatório." });
    }

    try {
      console.log(`[Risel SMTP Vault] Conectando a ${smtpConfig.host}:${smtpConfig.port} com remetente ${smtpConfig.user}...`);
      const transporter = createSafeTransporter(smtpConfig);

      // Calcular valor acumulado
      const totalAcumulado = (lancamentosPendentes || []).reduce((acc: number, curr: any) => {
        const val = parseFloat((curr.valor || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
        return acc + val;
      }, 0);

      // Gerar as linhas da tabela
      let tableRows = "";
      if (!lancamentosPendentes || lancamentosPendentes.length === 0) {
        tableRows = `
          <tr>
            <td colspan="5" style="padding: 15px; text-align: center; color: #94a3b8; font-weight: bold; font-size: 13px;">
              Nenhum lançamento pendente localizado para envio! Todos os pagamentos em dia.
            </td>
          </tr>
        `;
      } else {
        lancamentosPendentes.forEach((item: any) => {
          const formattedDate = item.dataVencimento ? new Date(item.dataVencimento + "T12:00:00").toLocaleDateString('pt-BR') : "";
          tableRows += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px; color: #334155; font-family: monospace; font-weight: bold; font-size: 12px;">${formattedDate}</td>
              <td style="padding: 10px; color: #0f172a; font-weight: bold; font-size: 12px;">${(item.fornecedor || "").toUpperCase()}</td>
              <td style="padding: 10px; color: #64748b; font-family: monospace; font-size: 11px;">${(item.doc || "").toUpperCase()}</td>
              <td style="padding: 10px; color: #d97706;"><span style="background-color: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; border: 1px solid #fde68a;">PENDENTE</span></td>
              <td style="padding: 10px; text-align: right; color: #0f172a; font-family: monospace; font-weight: bold; font-size: 12px;">${item.valor}</td>
            </tr>
          `;
        });
      }

      const emailSubject = subject || "Relatório Semanal Consolidado - Lançamentos Pendentes";
      const emailIntro = introText || "Seguem para conhecimento e providências os lançamentos que se encontram pendentes de aprovação ou lançamento no sistema.";

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório de Pendências ERP Risel</title>
        </head>
        <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: 'Aptos Narrow', Aptos, 'Segoe UI', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background-color: #114D38; padding: 24px; text-align: left;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 60px; vertical-align: middle;">
                    <img src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" alt="Risel Logo" style="width: 50px; height: 50px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); display: block;" />
                  </td>
                  <td style="padding-left: 15px; vertical-align: middle; text-align: left;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">Risel Combustíveis</h1>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Body -->
            <div style="padding: 24px; text-align: left;">
              <h2 style="margin: 0 0 10px 0; color: #1e293b; font-size: 15px; font-weight: bold; text-align: left;">Olá,</h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 13px; line-height: 1.6; text-align: left;">
                ${emailIntro}
              </p>
              
              <!-- Stats -->
              <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 25px;">
                <tr>
                  <td style="width: 50%; padding: 15px; text-align: left; vertical-align: top;">
                    <span style="color: #94a3b8; font-size: 11px; font-weight: bold; text-transform: uppercase; display: block;">Total de Pendências</span>
                    <span style="color: #114D38; font-size: 18px; font-weight: 900; display: block; margin-top: 5px;">${(lancamentosPendentes || []).length} lançamentos</span>
                  </td>
                  <td style="width: 50%; padding: 15px; text-align: left; vertical-align: top; border-left: 1px solid #e2e8f0;">
                    <span style="color: #94a3b8; font-size: 11px; font-weight: bold; text-transform: uppercase; display: block;">Valores Acumulados</span>
                    <span style="color: #d97706; font-size: 18px; font-weight: 900; display: block; margin-top: 5px;">R$ ${totalAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </td>
                </tr>
              </table>
              
              <!-- Table -->
              <h3 style="margin: 0 0 10px 0; color: #475569; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">Lista de Lançamentos</h3>
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 25px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                  <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                      <th style="padding: 10px; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: left;">Vencimento</th>
                      <th style="padding: 10px; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: left;">Fornecedor</th>
                      <th style="padding: 10px; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: left;">Documento</th>
                      <th style="padding: 10px; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: left;">Status</th>
                      <th style="padding: 10px; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: right;">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 15px; text-align: center; color: #94a3b8; font-size: 11px; font-weight: bold;">
              © 2026 Risel Combustíveis Ltda. Todos os direitos reservados.
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"Risel Combustíveis" <${smtpConfig.user}>`,
        to: targetRecipients.join(", "),
        subject: emailSubject,
        html: htmlContent,
      });

      return res.json({ success: true, host: smtpConfig.host });
    } catch (error: any) {
      console.error("Erro no envio de e-mail:", error);
      return res.status(500).json({ error: error.message || "Erro desconhecido ao enviar o e-mail pelo servidor SMTP." });
    }
  });

  // Cache para dados da planilha de checklist
  let checklistCache: any[] | null = null;
  let checklistCacheTime = 0;
  const CACHE_DURATION = 3 * 60 * 1000; // 3 minutos

  // Cache para dados da planilha de veículos
  let veiculosCache: any[] | null = null;
  let veiculosCacheTime = 0;

  app.get("/api/veiculos/data", async (req, res) => {
    const now = Date.now();
    if (veiculosCache && (now - veiculosCacheTime < CACHE_DURATION)) {
      console.log("Risel Backend: Retornando veículos (Google Sheets) via Cache...");
      return res.json(veiculosCache);
    }

    try {
      console.log("Risel Backend: Buscando novos dados de veículos no Google Sheets...");
      const targetUrl = "https://docs.google.com/spreadsheets/d/1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY/export?format=csv&gid=0";
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Google Sheets retornou status ${response.status}`);
      }
      const csvText = await response.text();

      // Simple, robust CSV quote-aware parser
      const lines: string[][] = [];
      let row: string[] = [];
      let cell = "";
      let inQuotes = false;
      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        if (inQuotes) {
          if (char === '"') {
            if (nextChar === '"') {
              cell += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            cell += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            row.push(cell);
            cell = "";
          } else if (char === '\r') {
            // skip
          } else if (char === '\n') {
            row.push(cell);
            lines.push(row);
            row = [];
            cell = "";
          } else {
            cell += char;
          }
        }
      }
      if (row.length > 0 || cell !== "") {
        row.push(cell);
        lines.push(row);
      }

      if (lines.length <= 1) {
        return res.json([]);
      }

      const firstRow = lines[0];
      const isChecklistFormat = firstRow.some(col => col.toLowerCase().includes("carimbo") || col.toLowerCase().includes("tipo de checklist"));

      const vehiclesMap = new Map<string, any>();

      if (isChecklistFormat) {
        // Formato Checklist: agrupamos por placa e pegamos os dados reais do checklist mais recente
        for (let r = 1; r < lines.length; r++) {
          const dataRow = lines[r];
          if (dataRow.length < 6 || !dataRow[5]) continue;

          const placa = (dataRow[5] || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
          if (!placa || placa.length < 7) continue;

          const rawTimestamp = dataRow[0] || "";
          const rawEmail = dataRow[1] || "";
          const rawData = dataRow[2] || "";
          const rawBase = dataRow[4] || "";
          const rawModelo = dataRow[6] || "";
          const rawKm = dataRow[8] || "";
          const entreguePor = (dataRow[24] || "").trim();
          const recebidoPor = (dataRow[25] || "").trim();

          const condutor = entreguePor || recebidoPor || "";
          const emailCondutor = rawEmail || "";
          const odometro = parseKm(rawKm);
          const formattedDate = parseDateString(rawData || rawTimestamp);

          const existing = vehiclesMap.get(placa);
          const isMoreRecent = !existing || (formattedDate > existing._date);

          if (isMoreRecent) {
            vehiclesMap.set(placa, {
              id: `sheet-veh-${placa}`,
              placa: placa,
              modelo: rawModelo || "",
              vencContrato: "", // Deixa em branco para preencher manual
              condutor: condutor,
              funcao: "",
              contatoMotorista: "", // Deixa em branco para preencher manual
              gestorResp: "",
              email: emailCondutor, // Mudado de "email do gestor" para "E-mail"
              filial: rawBase || "",
              locadora: "",
              contrato: "",
              odometro: odometro,
              combustivel: "Flex",
              status: "Ativo",
              _date: formattedDate
            });
          }
        }
      } else {
        // Formato Direto de Veículos (conforme especificado pelo usuário):
        // Coluna A: Placa
        // Coluna B (index 1): Modelo
        // Coluna F (index 5): Contato
        // Coluna H (index 7): E-mail dos condutores
        for (let r = 1; r < lines.length; r++) {
          const dataRow = lines[r];
          if (dataRow.length < 1 || !dataRow[0]) continue;

          const placa = (dataRow[0] || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
          if (!placa || placa.length < 7) continue;

          vehiclesMap.set(placa, {
            id: `sheet-veh-${placa}`,
            placa: placa,
            modelo: dataRow[1] || "", // Coluna B
            vencContrato: dataRow[2] || "", // Coluna C
            condutor: dataRow[3] || "", // Coluna D
            funcao: dataRow[4] || "", // Coluna E
            contatoMotorista: dataRow[5] || "", // Coluna F
            gestorResp: dataRow[6] || "", // Coluna G
            email: dataRow[7] || "", // Coluna H
            filial: dataRow[8] || "", // Coluna I
            locadora: dataRow[9] || "", // Coluna J
            contrato: dataRow[10] || "", // Coluna K
            odometro: parseInt(dataRow[11]) || 0, // Coluna L
            combustivel: dataRow[12] || "Flex", // Coluna M
            status: dataRow[13] || "Ativo" // Coluna N
          });
        }
      }

      const result = Array.from(vehiclesMap.values());
      veiculosCache = result;
      veiculosCacheTime = now;
      return res.json(result);
    } catch (error: any) {
      console.error("Erro ao buscar veículos do Google Sheets:", error);
      if (veiculosCache) {
        return res.json(veiculosCache);
      }
      return res.status(500).json({ error: error.message || "Falha de rede ao acessar Google Sheets" });
    }
  });

  // Cache para abastecimentos
  let abastecimentosCache: any[] | null = null;
  let abastecimentosCacheTime = 0;

  app.get("/api/abastecimentos/data", async (req, res) => {
    const now = Date.now();
    const forceRefresh = req.query.refresh === "true";
    if (!forceRefresh && abastecimentosCache && (now - abastecimentosCacheTime < CACHE_DURATION)) {
      console.log("Risel Backend: Retornando abastecimentos (Google Sheets) via Cache...");
      return res.json(abastecimentosCache);
    }

    try {
      console.log("Risel Backend: Buscando dados da aba Abastecimento no Google Sheets...");
      const sheetsToTry = [
        { id: "1ap_3AucNXOYAJue_KDC-uI54O6fFt2-v-tlteEpBUsA", gids: ["0", "1773480680", "1607593922"] }
      ];
      let csvText = "";
      let successfulGid = "";

      for (const sheetObj of sheetsToTry) {
        for (const gid of sheetObj.gids) {
          const urls = [
            `https://docs.google.com/spreadsheets/d/${sheetObj.id}/export?format=csv&gid=${gid}`,
            `https://docs.google.com/spreadsheets/d/${sheetObj.id}/gviz/tq?tqx=out:csv&gid=${gid}`
          ];
          for (const url of urls) {
            try {
              const resp = await fetch(url);
              if (resp.ok) {
                const text = await resp.text();
                if (text && text.trim().length > 30 && !text.includes("<!DOCTYPE html>")) {
                  csvText = text;
                  successfulGid = gid;
                  break;
                }
              }
            } catch (e) {
              console.warn(`Erro ao buscar GID ${gid} em ${url}:`, e);
            }
          }
          if (csvText) break;
        }
        if (csvText) break;
      }

      if (!csvText) {
        abastecimentosCache = persistentImportedAbastecimentos;
        abastecimentosCacheTime = now;
        return res.json(persistentImportedAbastecimentos);
      }

      // Parser CSV inteligente com PapaParse (suporta delimitadores ',' e ';')
      const parsedCsv = Papa.parse<string[]>(csvText, { skipEmptyLines: 'greedy' });
      const lines = parsedCsv.data || [];

      if (lines.length <= 1) {
        abastecimentosCache = persistentImportedAbastecimentos;
        abastecimentosCacheTime = now;
        return res.json(persistentImportedAbastecimentos);
      }

      const headers = lines[0].map(h => String(h || "").trim());
      const normalize = (str: string) => 
        String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

      const getColIdx = (colNames: string[]) => {
        // 1. Passo: Correspondência exata do nome da coluna
        for (const cn of colNames) {
          const normTarget = normalize(cn);
          const idx = headers.findIndex(h => normalize(h) === normTarget);
          if (idx !== -1) return idx;
        }
        // 2. Passo: Correspondência por inclusão
        for (const cn of colNames) {
          const normTarget = normalize(cn);
          if (normTarget.length < 3) continue;
          const idx = headers.findIndex(h => normalize(h).includes(normTarget) || normTarget.includes(normalize(h)));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const placaIdx = getColIdx(["Placa", "placa", "PLACA", "Veiculo", "Veículo", "Placa do Veiculo", "Placa - Dig.Motorista"]);
      const dataIdx = getColIdx(["Data/ Hora transação", "Data/ Hora transao", "Data Transação", "Data/Hora", "Data", "data", "DATA", "Dt Transacao", "Data Abastecimento", "Transação"]);
      const litrosIdx = getColIdx(["Qtd Mercadoria", "Qtd. Mercadoria", "Litros", "litros", "Volume", "Quantidade", "Qtd", "Volume (L)", "Qtd Litros"]);
      const valorIdx = getColIdx(["Valor total com desconto", "Valor total original", "Valor total", "Valor Total", "Valor Gasto", "Valor", "Custo Total", "Valor (R$)"]);
      const kmIdx = getColIdx(["Km/Hr Percorrido", "Km Percorrido", "Distancia", "Hodômetro Transação - Dig. Motorista", "Hodometro Transacao", "Hodometro", "Km atual", "Km", "Leitura"]);
      const baseIdx = getColIdx(["Nome Filial", "Base", "base", "Filial", "filial", "Unidade"]);
      const condutorIdx = getColIdx(["Nome motorista", "Motorista", "Condutor", "condutor"]);
      const combIdx = getColIdx(["Mercadoria", "Tipo Mercadoria", "Combustivel", "Combustível", "Produto"]);
      const postoIdx = getColIdx(["Nome EC", "Nome do Posto", "Posto", "posto", "Estabelecimento"]);
      const cidadeIdx = getColIdx(["Cidade EC", "Cidade", "cidade", "Município", "UF"]);
      const saldoIdx = getColIdx(["Saldo Cartão", "Saldo Cartao", "Saldo", "saldo"]);
      const hodoIdx = getColIdx(["Hodômetro Transação - Dig. Motorista", "Hodometro Transacao", "Hodometro", "Km atual", "Leitura"]);

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
          return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
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

      const parsedItems: any[] = [];
      for (let r = 1; r < lines.length; r++) {
        const row = lines[r];
        if (!row || row.length === 0) continue;

        const rawPlaca = placaIdx !== -1 ? row[placaIdx] : (row[0] || "");
        const placa = String(rawPlaca || "").replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!placa || placa.length < 6) continue;

        const rawData = dataIdx !== -1 ? row[dataIdx] : "";
        const data = parseBrazilianDate(rawData) || new Date().toISOString().split("T")[0];

        const litros = litrosIdx !== -1 ? parseFloatBr(row[litrosIdx]) : 0;
        const valorTotal = valorIdx !== -1 ? parseFloatBr(row[valorIdx]) : 0;

        const kmPercorrido = kmIdx !== -1 ? parseFloatBr(row[kmIdx]) : 0;
        const base = baseIdx !== -1 ? (row[baseIdx] || "").trim().toUpperCase() : "CAMPINEIRA";
        const condutor = condutorIdx !== -1 ? (row[condutorIdx] || "").trim() : "Sem Motorista Associado";
        const combustivel = combIdx !== -1 ? (row[combIdx] || "").trim() : "Gasolina";
        const posto = postoIdx !== -1 ? (row[postoIdx] || "").trim() : "";
        const cidade = cidadeIdx !== -1 ? (row[cidadeIdx] || "").trim() : "";
        const saldo = saldoIdx !== -1 ? parseFloatBr(row[saldoIdx]) : undefined;
        const hodometro = hodoIdx !== -1 ? parseFloatBr(row[hodoIdx]) : undefined;

        parsedItems.push({
          id: `sheet-f-${placa.toLowerCase()}-${r}`,
          placa,
          base,
          condutor,
          data,
          litros,
          kmPercorrido,
          valorTotal,
          combustivel,
          posto,
          cidade,
          saldo,
          hodometro
        });
      }

      // Mescla os dados lidos do Google Sheets com abastecimentos importados armazenados no servidor
      const existingKeys = new Set(parsedItems.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
      persistentImportedAbastecimentos.forEach(imp => {
        const key = `${imp.placa}-${imp.data}-${imp.litros}-${imp.valorTotal}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          parsedItems.unshift(imp);
        }
      });

      abastecimentosCache = parsedItems;
      abastecimentosCacheTime = now;
      console.log(`Risel Backend: ${parsedItems.length} abastecimentos retornados (${persistentImportedAbastecimentos.length} locais + Google Sheets).`);
      return res.json(parsedItems);
    } catch (error: any) {
      console.error("Erro ao buscar abastecimentos do Google Sheets:", error);
      if (persistentImportedAbastecimentos.length > 0) {
        abastecimentosCache = persistentImportedAbastecimentos;
        abastecimentosCacheTime = now;
        return res.json(persistentImportedAbastecimentos);
      }
      abastecimentosCache = [];
      abastecimentosCacheTime = now;
      return res.json([]);
    }
  });

  // Função auxiliar central para disparar dados de abastecimentos para o Apps Script Web App (Google Sheets)
  async function pushItemsToAppsScript(items: any[], rawHeaders?: string[], rawRows?: string[][], customUrl?: string) {
    const targetUrl = (customUrl || storedAppsScriptUrl || "").trim();
    if (!targetUrl) {
      return { success: false, error: "URL do Apps Script não configurada." };
    }

    let headersToSend = rawHeaders;
    let rowsToSend = rawRows;

    if (!rowsToSend || rowsToSend.length === 0) {
      headersToSend = ["ID", "PLACA", "BASE", "CONDUTOR", "DATA", "LITROS", "KM_PERCORRIDO", "VALOR_TOTAL", "COMBUSTIVEL", "POSTO", "CIDADE", "HODOMETRO", "SALDO"];
      rowsToSend = (items || []).map(item => [
        item.id || "",
        item.placa || "",
        item.base || "",
        item.condutor || "",
        item.data || "",
        String(item.litros || 0),
        String(item.kmPercorrido || item.km || 0),
        String(item.valorTotal || 0),
        item.combustivel || "",
        item.posto || "",
        item.cidade || "",
        String(item.hodometro || item.km || 0),
        String(item.saldo || 0)
      ]);
    }

    if (!rowsToSend || rowsToSend.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      console.log(`Risel Backend Apps Script: Disparando ${rowsToSend.length} linhas para a planilha...`);
      const gsRes = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          headers: headersToSend,
          rows: rowsToSend,
          spreadsheetId: "1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY",
          sheetTitle: "Página1"
        })
      });

      if (gsRes.ok) {
        console.log(`Risel Backend Apps Script: ${rowsToSend.length} linhas gravadas com sucesso na planilha Google!`);
        return { success: true, count: rowsToSend.length };
      } else {
        const errText = await gsRes.text();
        console.warn("Aviso no Apps Script Web App:", errText);
        return { success: false, error: errText };
      }
    } catch (err: any) {
      console.warn("Erro ao comunicar com Google Apps Script Web App:", err.message);
      return { success: false, error: err.message };
    }
  }

  // Rota para Descarregar TODOS os Abastecimentos do Servidor para a Planilha do Google
  app.post("/api/sheets/push-all", express.json({ limit: "50mb" }), async (req, res) => {
    try {
      const targetUrl = (req.body.appsScriptUrl || storedAppsScriptUrl || "").trim();
      if (!targetUrl) {
        return res.status(400).json({ error: "URL do Google Apps Script não configurada." });
      }

      const allItems = persistentImportedAbastecimentos || [];
      if (allItems.length === 0) {
        return res.json({ success: true, count: 0, message: "Nenhum abastecimento pendente no servidor." });
      }

      const result = await pushItemsToAppsScript(allItems, undefined, undefined, targetUrl);
      return res.json({
        success: result.success,
        count: allItems.length,
        message: result.success 
          ? `Sucesso! Todos os ${allItems.length.toLocaleString("pt-BR")} abastecimentos acumulados no servidor foram exportados para a sua Planilha do Google!` 
          : `Aviso na exportação: ${result.error}`
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro interno ao exportar para a planilha." });
    }
  });

  // Rota de Importacao Direta de Abastecimentos (CSVs do OneDrive / Upload Manual)
  app.post("/api/abastecimentos/import", express.json({ limit: "50mb" }), async (req, res) => {
    try {
      const { items, rawHeaders, rawRows } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Nenhum item fornecido para importacao." });
      }

      const existingKeys = new Set(persistentImportedAbastecimentos.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
      let addedCount = 0;

      items.forEach((item: any) => {
        if (!item || !item.placa) return;
        const key = `${item.placa}-${item.data}-${item.litros}-${item.valorTotal}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          persistentImportedAbastecimentos.unshift(item);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        saveStoredAbastecimentos(persistentImportedAbastecimentos);
        abastecimentosCache = null; // Invalida o cache
      }

      // Envia automaticamente os novos registros para a planilha Google
      let pushedToSheets = false;
      if (storedAppsScriptUrl) {
        const gsRes = await pushItemsToAppsScript(items, rawHeaders, rawRows);
        pushedToSheets = gsRes.success;
      }

      console.log(`Risel Backend /api/abastecimentos/import: ${addedCount} novos registros salvos. Total acumulado no servidor: ${persistentImportedAbastecimentos.length}. Enviado ao Google Sheets: ${pushedToSheets}`);

      return res.json({
        success: true,
        addedCount,
        pushedToSheets,
        totalStored: persistentImportedAbastecimentos.length,
        message: `${addedCount} novos abastecimentos integrados com sucesso!${pushedToSheets ? " E gravados na Planilha Google!" : ""}`
      });
    } catch (err: any) {
      console.error("Erro na importacao de abastecimentos:", err);
      return res.status(500).json({ error: err.message || "Erro interno ao salvar abastecimentos." });
    }
  });

  app.post("/api/sheets/append", express.json({ limit: "50mb" }), async (req, res) => {
    try {
      const { spreadsheetId, sheetTitle, rows, token, items, rawHeaders, rawRows } = req.body;
      const targetSpreadsheetId = spreadsheetId || "1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY";
      const targetSheetTitle = sheetTitle || "Página1";

      // 1. Salva os itens parsed no armazenamento local do servidor
      if (Array.isArray(items) && items.length > 0) {
        const existingKeys = new Set(persistentImportedAbastecimentos.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
        let addedCount = 0;
        items.forEach((item: any) => {
          const key = `${item.placa}-${item.data}-${item.litros}-${item.valorTotal}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            persistentImportedAbastecimentos.unshift(item);
            addedCount++;
          }
        });
        saveStoredAbastecimentos(persistentImportedAbastecimentos);

        if (!abastecimentosCache) abastecimentosCache = [];
        const cacheKeys = new Set(abastecimentosCache.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
        persistentImportedAbastecimentos.forEach(imp => {
          const key = `${imp.placa}-${imp.data}-${imp.litros}-${imp.valorTotal}`;
          if (!cacheKeys.has(key)) {
            cacheKeys.add(key);
            abastecimentosCache!.unshift(imp);
          }
        });
        console.log(`Risel Backend /sheets/append: ${addedCount} registros salvos no servidor.`);
      }

      // 2. Se houver URL do Google Apps Script Web App configurada, grava diretamente via Webhook do Apps Script
      const targetAppsScriptUrl = (req.body.appsScriptUrl || storedAppsScriptUrl || "").trim();
      const payloadRows = (Array.isArray(rawRows) && rawRows.length > 0) ? rawRows : rows;

      if (targetAppsScriptUrl && Array.isArray(payloadRows) && payloadRows.length > 0) {
        try {
          console.log(`Risel Backend: Disparando ${payloadRows.length} linhas para o Apps Script Web App...`);
          const gsRes = await fetch(targetAppsScriptUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({
              headers: rawHeaders,
              rows: payloadRows,
              spreadsheetId: targetSpreadsheetId,
              sheetTitle: targetSheetTitle
            })
          });

          if (gsRes.ok) {
            console.log(`Risel Backend: ${payloadRows.length} linhas gravadas com sucesso via Apps Script Web App!`);
            return res.json({ success: true, savedInSheets: true, savedInBackend: true, count: payloadRows.length, mode: "apps_script" });
          } else {
            const errBody = await gsRes.text();
            console.warn("Aviso de erro no Apps Script Web App:", errBody);
          }
        } catch (gsErr: any) {
          console.warn("Erro ao comunicar com Google Apps Script Web App:", gsErr.message);
        }
      }

      // 3. Se houver token do Google Sheets REST API, tenta o append via API do Google
      if (token && Array.isArray(payloadRows) && payloadRows.length > 0) {
        try {
          // Checa se a planilha já possui cabeçalho na linha 1
          const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(targetSheetTitle)}!A1:Z1`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          let hasHeader = false;
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.values && checkData.values.length > 0 && checkData.values[0].length > 0) {
              hasHeader = true;
            }
          }

          // Se estiver sem cabeçalho, insere a linha de cabeçalhos original (as 61 colunas do CSV)
          if (!hasHeader && Array.isArray(rawHeaders) && rawHeaders.length > 0) {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(targetSheetTitle)}!A1?valueInputOption=USER_ENTERED`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ values: [rawHeaders] })
            });
          }

          const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(targetSheetTitle)}!A1:append?valueInputOption=USER_ENTERED`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ values: payloadRows })
          });

          if (appendRes.ok) {
            console.log(`Risel Backend: ${payloadRows.length} linhas enviadas com sucesso para a planilha Google Sheets via REST API!`);
            return res.json({ success: true, savedInSheets: true, savedInBackend: true, count: payloadRows.length, mode: "oauth" });
          }
        } catch (sheetsErr: any) {
          console.warn("Erro ao comunicar com Google Sheets API no backend:", sheetsErr.message);
        }
      }

      return res.json({ 
        success: true, 
        savedInBackend: true, 
        savedInSheets: false, 
        warning: "Dados salvos no servidor. Para sincronização direta em tempo real com o Google Sheets sem login manual, configure a URL do App da Web do Google Apps Script na interface." 
      });
    } catch (err: any) {
      console.error("Erro interno no /api/sheets/append:", err);
      return res.status(500).json({ error: err.message || "Erro no servidor ao salvar planilha" });
    }
  });

  app.get("/api/sheets/config", (req, res) => {
    res.json({
      spreadsheetId: "1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY/edit?gid=1773480680#gid=1773480680",
      appsScriptUrl: storedAppsScriptUrl
    });
  });

  app.get("/api/sheets/script-code", (req, res) => {
    try {
      const gsPath = path.join(process.cwd(), "AppsScript.gs");
      if (fs.existsSync(gsPath)) {
        const code = fs.readFileSync(gsPath, "utf-8");
        res.type("text/plain").send(code);
      } else {
        res.status(404).send("// Arquivo AppsScript.gs não encontrado no servidor.");
      }
    } catch (err: any) {
      res.status(500).send(`// Erro ao ler AppsScript.gs: ${err.message}`);
    }
  });

  app.post("/api/sheets/config", express.json(), (req, res) => {
    try {
      const { appsScriptUrl } = req.body;
      if (typeof appsScriptUrl === "string") {
        storedAppsScriptUrl = appsScriptUrl.trim();
        fs.writeFileSync(APPS_SCRIPT_FILE, storedAppsScriptUrl, "utf-8");
        console.log("Risel Backend: URL do Apps Script Web App configurada com sucesso:", storedAppsScriptUrl);
      }
      res.json({ success: true, appsScriptUrl: storedAppsScriptUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Rotas de Gerenciamento do OneDrive AutoSync
  app.get("/api/onedrive/config", (req, res) => {
    const config = loadOneDriveConfig();
    const logs = loadOneDriveLogs();
    res.json({
      ...config,
      cronHour: 9,
      cronMinute: 0,
      cronTimeFormatted: "09:00",
      logs
    });
  });

  app.post("/api/onedrive/config", express.json(), (req, res) => {
    try {
      const { folderUrl, enabled } = req.body;
      const current = loadOneDriveConfig();
      if (typeof folderUrl === "string") current.folderUrl = folderUrl.trim();
      if (typeof enabled === "boolean") current.enabled = enabled;
      saveOneDriveConfig(current);
      res.json({ success: true, config: current });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/sync-now", async (req, res) => {
    try {
      console.log("Risel Backend: Disparando Sincronização Manual do OneDrive solicitada pelo usuário...");
      const result = await executeOneDriveSyncProcess();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Erro na sincronização do OneDrive" });
    }
  });

  app.get("/api/onedrive/logs", (req, res) => {
    res.json(loadOneDriveLogs());
  });

  // Webhook / API Ingestion endpoint for OneDrive Power Automate or direct upload
  app.post("/api/onedrive/webhook", express.text({ limit: "50mb", type: ["text/csv", "text/plain", "application/json"] }), async (req, res) => {
    try {
      let rawContent = "";
      let fileName = "Webhook_OneDrive.csv";

      if (typeof req.body === "string") {
        rawContent = req.body;
      } else if (req.body && typeof req.body === "object") {
        if (req.body.csvContent) rawContent = req.body.csvContent;
        if (req.body.fileName) fileName = req.body.fileName;
      }

      if (!rawContent || rawContent.trim().length === 0) {
        return res.status(400).json({ error: "Nenhum conteúdo CSV recebido no corpo da requisição." });
      }

      const parsed = Papa.parse(rawContent, { skipEmptyLines: "greedy" });
      const rows = (parsed.data || []) as string[][];

      if (!rows || rows.length <= 1) {
        return res.status(400).json({ error: "O arquivo CSV enviado está vazio ou possui apenas cabeçalhos." });
      }

      const headers = rows[0].map(h => (h || "").toUpperCase().trim());
      const findIdx = (terms: string[]) => {
        for (const t of terms) {
          const idx = headers.findIndex(h => h.includes(t));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxPlaca = findIdx(["PLACA", "VEICULO", "VEÍCULO"]);
      const idxData = findIdx(["DATA", "DIA", "TIMESTAMP"]);
      const idxLitros = findIdx(["LITRO", "LITROS", "QTD", "QUANTIDADE"]);
      const idxValor = findIdx(["VALOR", "TOTAL", "R$", "CUSTO"]);
      const idxKm = findIdx(["KM", "HODOMETRO", "HODÔMETRO", "ODOMETRO"]);
      const idxBase = findIdx(["BASE", "FILIAL", "UNIDADE"]);
      const idxCondutor = findIdx(["CONDUTOR", "MOTORISTA", "SOLICITANTE"]);
      const idxCombustivel = findIdx(["COMBUSTIVEL", "COMBUSTÍVEL", "TIPO"]);
      const idxPosto = findIdx(["POSTO", "ESTABELECIMENTO"]);
      const idxCidade = findIdx(["CIDADE", "MUNICIPIO", "MUNICÍPIO"]);

      const existingKeys = new Set(persistentImportedAbastecimentos.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
      let addedCount = 0;
      const newRawRows: string[][] = [];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length < 3) continue;

        const rawPlaca = idxPlaca !== -1 && row[idxPlaca] ? row[idxPlaca].replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim() : "";
        if (!rawPlaca) continue;

        const rawData = idxData !== -1 ? row[idxData] : "";
        const rawLitros = idxLitros !== -1 ? row[idxLitros] : "0";
        const rawValor = idxValor !== -1 ? row[idxValor] : "0";
        const rawKm = idxKm !== -1 ? row[idxKm] : "0";

        const key = `${rawPlaca}-${rawData}-${rawLitros}-${rawValor}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);

          const newItem = {
            id: `webhook_${Date.now()}_${r}_${rawPlaca}`,
            placa: rawPlaca,
            data: rawData,
            litros: parseFloat(String(rawLitros).replace(",", ".")) || 0,
            valorTotal: parseFloat(String(rawValor).replace(",", ".")) || 0,
            km: parseInt(String(rawKm).replace(/\D/g, ""), 10) || 0,
            base: idxBase !== -1 ? row[idxBase] : "PAULÍNIA",
            condutor: idxCondutor !== -1 ? row[idxCondutor] : "Condutor Webhook",
            combustivel: idxCombustivel !== -1 ? row[idxCombustivel] : "DIESEL",
            posto: idxPosto !== -1 ? row[idxPosto] : "Posto Conveniado",
            cidade: idxCidade !== -1 ? row[idxCidade] : "Paulínia",
            fonte: "OneDrive Webhook AutoSync"
          };

          newRawRows.push(row);
          persistentImportedAbastecimentos.unshift(newItem);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        saveStoredAbastecimentos(persistentImportedAbastecimentos);
        abastecimentosCache = null;
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        status: "sucesso",
        filename: fileName,
        totalRowsFound: rows.length - 1,
        addedCount: addedCount,
        message: `Recebido via Webhook! ${addedCount} novos abastecimentos adicionados ao sistema.`
      };

      addOneDriveLog(logEntry);
      res.json({ success: true, addedCount, log: logEntry });

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/abastecimentos/import", express.json({ limit: "50mb" }), (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Nenhum abastecimento fornecido para importação" });
      }
      const existingKeys = new Set(persistentImportedAbastecimentos.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
      let addedCount = 0;
      items.forEach((item: any) => {
        const key = `${item.placa}-${item.data}-${item.litros}-${item.valorTotal}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          persistentImportedAbastecimentos.unshift(item);
          addedCount++;
        }
      });

      if (!abastecimentosCache) abastecimentosCache = [];
      const cacheKeys = new Set(abastecimentosCache.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
      persistentImportedAbastecimentos.forEach(imp => {
        const key = `${imp.placa}-${imp.data}-${imp.litros}-${imp.valorTotal}`;
        if (!cacheKeys.has(key)) {
          cacheKeys.add(key);
          abastecimentosCache!.unshift(imp);
        }
      });

      saveStoredAbastecimentos(persistentImportedAbastecimentos);

      console.log(`Risel Backend: ${addedCount} novos abastecimentos salvos no servidor backend. Total: ${persistentImportedAbastecimentos.length}`);
      return res.json({ success: true, added: addedCount, total: abastecimentosCache.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro ao salvar abastecimentos" });
    }
  });

  app.get("/api/checklist/data", async (req, res) => {
    const now = Date.now();
    if (checklistCache && (now - checklistCacheTime < CACHE_DURATION)) {
      console.log("Risel Backend: Retornando checklists de auditoria (Google Sheets) via Cache...");
      return res.json(checklistCache);
    }

    try {
      console.log("Risel Backend: Buscando novos dados de checklists no Google Sheets...");
      const targetUrl = "https://docs.google.com/spreadsheets/d/1H6uIaR7x3yfc8DyWWG8RcbIGe9ZTbIY4GIxLjcxjQig/export?format=csv&gid=266859092";
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Google Sheets retornou status ${response.status}`);
      }
      const csvText = await response.text();

      // Simple, robust CSV quote-aware parser
      const lines: string[][] = [];
      let row: string[] = [];
      let cell = "";
      let inQuotes = false;
      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        if (inQuotes) {
          if (char === '"') {
            if (nextChar === '"') {
              cell += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            cell += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            row.push(cell);
            cell = "";
          } else if (char === '\r') {
            // skip
          } else if (char === '\n') {
            row.push(cell);
            lines.push(row);
            row = [];
            cell = "";
          } else {
            cell += char;
          }
        }
      }
      if (row.length > 0 || cell !== "") {
        row.push(cell);
        lines.push(row);
      }

      if (lines.length <= 1) {
        return res.json([]);
      }

      const items: any[] = [];

      for (let r = 1; r < lines.length; r++) {
        const dataRow = lines[r];
        if (dataRow.length < 6 || !dataRow[5]) continue; // Skip incomplete or empty plate rows

        const rawTimestamp = dataRow[0] || "";
        const rawEmail = dataRow[1] || "";
        const rawData = dataRow[2] || "";
        const rawTipo = dataRow[3] || "";
        const rawBase = dataRow[4] || "";
        const rawPlaca = (dataRow[5] || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
        const rawModelo = dataRow[6] || "";
        const rawCor = dataRow[7] || "";
        const rawKm = dataRow[8] || "";
        const rawTanque = dataRow[9] || "";
        const rawItens = dataRow[10] || "";

        const rawPneuDD = (dataRow[11] || "").toUpperCase().trim();
        const rawPneuDE = (dataRow[12] || "").toUpperCase().trim();
        const rawPneuTD = (dataRow[13] || "").toUpperCase().trim();
        const rawPneuTE = (dataRow[14] || "").toUpperCase().trim();
        const rawPneuEstepe = (dataRow[15] || "").toUpperCase().trim();

        const obsDianteira = dataRow[16] || "";
        const fotoFrente = dataRow[17] || "";
        const obsMotorista = dataRow[18] || "";
        const fotoMotorista = dataRow[19] || "";
        const obsPassageiro = dataRow[20] || "";
        const fotoPassageiro = dataRow[21] || "";
        const obsTraseira = dataRow[22] || "";
        const fotoTraseira = dataRow[23] || "";

        const entreguePor = (dataRow[24] || "").trim();
        const recebidoPor = (dataRow[25] || "").trim();

        const fotosInterior = dataRow[26] || "";
        const fotoRetrovisorMotorista = dataRow[27] || "";
        const fotoRetrovisorPassageiro = dataRow[28] || "";
        const fotoFaroisTraseiros = dataRow[29] || "";
        const fotoFaroisDianteiros = dataRow[30] || "";

        const mergedDocUrl = dataRow[33] || "";

        // Heurística para determinar status do checklist
        let status: "Aprovado" | "Ressalvas" | "Retido" = "Aprovado";
        const pneusStatusList = [rawPneuDD, rawPneuDE, rawPneuTD, rawPneuTE];
        const hasRuimPneu = pneusStatusList.some(p => p.includes("RUIM"));
        const hasRegularPneu = pneusStatusList.some(p => p.includes("REGULAR"));

        // Se pneu crítico
        if (hasRuimPneu) {
          status = "Retido";
        } else if (hasRegularPneu) {
          status = "Ressalvas";
        } else {
          // Checar se há avarias registradas nas observações
          const checkObs = (obs: string) => {
            const clean = obs.toLowerCase().trim();
            return clean && clean !== "ok" && clean !== "ok " && clean !== "não" && clean !== "sem avarias" && clean !== "nao" && clean !== "n/a";
          };

          if (checkObs(obsDianteira) || checkObs(obsMotorista) || checkObs(obsPassageiro) || checkObs(obsTraseira)) {
            status = "Ressalvas";
          }
        }

        // Sintetizar objeto do checklist em formato compatível
        const formattedDate = parseDateString(rawData || rawTimestamp);
        const parsedOdom = parseKm(rawKm);
        const condutor = entreguePor || recebidoPor || rawEmail.split("@")[0] || "Condutor";

        const mappedChecklist = {
          id: `sheet_${r}_${rawPlaca}_${formattedDate.replace(/-/g, "")}`,
          placa: rawPlaca,
          condutor: condutor,
          data: formattedDate,
          odometro: parsedOdom,
          itens: {
            pneus: hasRuimPneu ? "Crítico" : hasRegularPneu ? "Atenção" : "OK",
            freios: "OK", 
            farois: "OK", 
            seguranca: "OK", 
            fluidos: "OK", 
            lataria: (obsDianteira || obsMotorista || obsPassageiro || obsTraseira) ? "Atenção" : "OK"
          },
          observacoes: [obsDianteira, obsMotorista, obsPassageiro, obsTraseira].filter(Boolean).join(" | ").trim(),
          status: status,

          // Campos adicionais ricos
          timestamp: rawTimestamp,
          email: rawEmail,
          tipo: rawTipo,
          base: rawBase,
          marcaModelo: rawModelo,
          cor: rawCor,
          nivelTanque: rawTanque,
          listaItens: rawItens ? rawItens.split(",").map((i: string) => i.trim()) : [],
          pneuDianteiroDireito: rawPneuDD,
          pneuDianteiroEsquerdo: rawPneuDE,
          pneuTraseiroDireito: rawPneuTD,
          pneuTraseiroEsquerdo: rawPneuTE,
          pneuEstepe: rawPneuEstepe,
          obsDianteira,
          fotoFrente,
          obsMotorista,
          fotoMotorista,
          obsPassageiro,
          fotoPassageiro,
          obsTraseira,
          fotoTraseira,
          entreguePor,
          recebidoPor,
          fotosInterior,
          fotoRetrovisorMotorista,
          fotoRetrovisorPassageiro,
          fotoFaroisTraseiros,
          fotoFaroisDianteiros,
          mergedDocUrl,
          isGoogleSheet: true
        };

        items.push(mappedChecklist);
      }

      // Mescla com os checklists salvos localmente no servidor
      const existingKeys = new Set(items.map(a => `${a.placa}-${a.data}-${a.condutor}`));
      persistentImportedChecklists.forEach(imp => {
        const key = `${imp.placa}-${imp.data}-${imp.condutor}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          items.unshift(imp);
        }
      });

      checklistCache = items;
      checklistCacheTime = now;
      return res.json(items);
    } catch (error: any) {
      console.error("Erro ao buscar dados do Google Sheets:", error);
      if (persistentImportedChecklists.length > 0) {
        checklistCache = persistentImportedChecklists;
        checklistCacheTime = now;
        return res.json(persistentImportedChecklists);
      }
      if (checklistCache) {
        return res.json(checklistCache);
      }
      return res.json([]);
    }
  });

  function parseDateString(dStr: string) {
    if (!dStr) return "";
    const parts = dStr.split(" ")[0].split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dStr;
  }

  function parseKm(kmStr: string) {
    if (!kmStr) return 0;
    const clean = kmStr.replace(/\./g, "").replace(/,/g, "").trim();
    return parseInt(clean, 10) || 0;
  }

  // Função para mapear dinamicamente os campos do Google Forms para x-www-form-urlencoded
  async function getGoogleFormFields(formId: string): Promise<Record<string, string>> {
    try {
      const url = `https://docs.google.com/forms/d/${formId}/viewform`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Erro ao baixar formulário: ${res.status}`);
      }
      const html = await res.text();
      
      // Tenta encontrar a variável FB_PUBLIC_LOAD_DATA_ no HTML
      const match = html.match(/var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*(.+?);/);
      if (!match) {
        console.warn("Risel Backend: FB_PUBLIC_LOAD_DATA_ não encontrado no HTML do Google Forms.");
        return {};
      }
      
      const rawJson = match[1];
      const data = JSON.parse(rawJson);
      
      const fields: Record<string, string> = {};
      
      // Na estrutura interna do Google Forms (FB_PUBLIC_LOAD_DATA_)
      // data[1][1] contém a lista de perguntas/itens do formulário
      const items = data[1]?.[1] || [];
      for (const item of items) {
        const title = item[1]; // Título da pergunta
        const inputInfo = item[4]?.[0];
        if (inputInfo && title) {
          const entryId = inputInfo[0];
          if (entryId) {
            fields[title.toUpperCase().trim()] = `entry.${entryId}`;
          }
        }
      }
      
      return fields;
    } catch (error) {
      console.error("Risel Backend: Erro ao mapear campos do Google Forms:", error);
      return {};
    }
  }

  // Rota de Submissão Direta do Checklist ao Sistema, Google Forms e Notificação por E-mail
  app.post("/api/checklist/submit", async (req, res) => {
    try {
      const { 
        data, tipo, base, placa, modelo, cor, kmAtual, nivelTanque, itens, email,
        pneuDianteiroDireito, pneuDianteiroEsquerdo, pneuTraseiroDireito, pneuTraseiroEsquerdo, pneuEstepe,
        obsDianteira, obsMotorista, obsPassageiro, obsTraseira, entreguePor, recebidoPor,
        fotoFrente, fotoMotorista, fotoPassageiro, fotoTraseira, fotosInterior,
        fotoRetrovisorMotorista, fotoRetrovisorPassageiro, fotoFaroisTraseiros, fotoFaroisDianteiros
      } = req.body;

      const cleanPlaca = (placa || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
      const condutor = (entreguePor || recebidoPor || (email ? email.split("@")[0] : "Condutor")).trim();
      const formattedDate = data || new Date().toISOString().split("T")[0];

      // Determina o status do checklist
      const pneusList = [pneuDianteiroDireito, pneuDianteiroEsquerdo, pneuTraseiroDireito, pneuTraseiroEsquerdo].map(p => String(p || "").toUpperCase());
      const hasRuimPneu = pneusList.some(p => p.includes("RUIM"));
      const hasRegularPneu = pneusList.some(p => p.includes("REGULAR"));
      
      let status: "Aprovado" | "Ressalvas" | "Retido" = "Aprovado";
      if (hasRuimPneu) {
        status = "Retido";
      } else if (hasRegularPneu || obsDianteira || obsMotorista || obsPassageiro || obsTraseira) {
        status = "Ressalvas";
      }

      const parseKmNum = (v: any) => {
        if (!v) return 0;
        const num = parseInt(String(v).replace(/\D/g, ""), 10);
        return isNaN(num) ? 0 : num;
      };

      const newChecklist = {
        id: `check_${Date.now()}_${cleanPlaca}`,
        placa: cleanPlaca,
        condutor: condutor,
        data: formattedDate,
        odometro: parseKmNum(kmAtual),
        itens: {
          pneus: hasRuimPneu ? "Crítico" : hasRegularPneu ? "Atenção" : "OK",
          freios: "OK", 
          farois: "OK", 
          seguranca: "OK", 
          fluidos: "OK", 
          lataria: (obsDianteira || obsMotorista || obsPassageiro || obsTraseira) ? "Atenção" : "OK"
        },
        observacoes: [obsDianteira, obsMotorista, obsPassageiro, obsTraseira].filter(Boolean).join(" | ").trim(),
        status: status,
        timestamp: new Date().toLocaleString("pt-BR"),
        email: email || "deny.risel@gmail.com",
        tipo: tipo || "MENSAL",
        base: base || "PAULÍNIA",
        marcaModelo: modelo || "",
        cor: cor || "",
        nivelTanque: nivelTanque || "CHEIO",
        listaItens: Array.isArray(itens) ? itens : (itens ? String(itens).split(",") : []),
        pneuDianteiroDireito: pneuDianteiroDireito || "BOM",
        pneuDianteiroEsquerdo: pneuDianteiroEsquerdo || "BOM",
        pneuTraseiroDireito: pneuTraseiroDireito || "BOM",
        pneuTraseiroEsquerdo: pneuTraseiroEsquerdo || "BOM",
        pneuEstepe: pneuEstepe || "BOM",
        obsDianteira, fotoFrente, obsMotorista, fotoMotorista, obsPassageiro, fotoPassageiro, obsTraseira, fotoTraseira,
        entreguePor, recebidoPor, fotosInterior, fotoRetrovisorMotorista, fotoRetrovisorPassageiro, fotoFaroisTraseiros, fotoFaroisDianteiros,
        isGoogleSheet: false
      };

      // 1. Salva persistentemente no arquivo local do servidor
      persistentImportedChecklists.unshift(newChecklist);
      saveStoredChecklists(persistentImportedChecklists);

      // 2. Atualiza o cache do servidor
      if (!checklistCache) checklistCache = [];
      checklistCache.unshift(newChecklist);

      console.log(`Risel Backend: Novo checklist registrado com sucesso para a placa ${cleanPlaca}. Total acumulado: ${persistentImportedChecklists.length}`);

      // 3. Tenta enviar para o Google Forms em segundo plano (sem bloquear resposta)
      try {
        const formId = "1dHPxTdHCXkMh7LBTPakBjNeilxKt5VXdB5GMg9FZZL8";
        const fieldsMap = await getGoogleFormFields(formId);
        
        const findKey = (search: string): string => {
          const searchUpper = search.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          for (const [title, entry] of Object.entries(fieldsMap)) {
            const titleUpper = title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (titleUpper.includes(searchUpper) || searchUpper.includes(titleUpper)) {
              return entry;
            }
          }
          return "";
        };

        const formPayload: Record<string, string> = {};
        const mappings: Record<string, any> = {
          "DATA": data,
          "TIPO DE CHECKLIST": tipo,
          "BASE": base,
          "PLACA": cleanPlaca,
          "MARCA / MODELO": modelo,
          "COR": cor,
          "KM ATUAL": kmAtual,
          "NÍVEL TANQUE [TANQUE]": nivelTanque,
          "ITENS DO VEÍCULO": Array.isArray(itens) ? itens.join(", ") : itens,
          "ESTADO PNEUS [DIANTEIRO DIREITO]": pneuDianteiroDireito,
          "ESTADO PNEUS [DIANTEIRO ESQUERDO]": pneuDianteiroEsquerdo,
          "ESTADO PNEUS [TRASEIRO DIREITO]": pneuTraseiroDireito,
          "ESTADO PNEUS [TRASEIRO ESQUERDO]": pneuTraseiroEsquerdo,
          "ESTADO PNEUS [ESTEPE]": pneuEstepe,
          "OBSERVAÇÕES - DIANTEIRA": obsDianteira,
          "OBSERVAÇÕES - LADO MOTORISTA": obsMotorista,
          "OBSERVAÇÕES - LADO PASSAGEIRO": obsPassageiro,
          "OBSERVAÇÕES - TRASEIRA": obsTraseira,
          "ENTREGUE POR": entreguePor,
          "RECEBIDO POR": recebidoPor
        };

        for (const [pergunta, valor] of Object.entries(mappings)) {
          const entryKey = findKey(pergunta);
          if (entryKey) {
            formPayload[entryKey] = String(valor || "");
          }
        }
        formPayload["emailAddress"] = email || "deny.risel@gmail.com";

        const submitUrl = `https://docs.google.com/forms/d/${formId}/formResponse`;
        const searchParams = new URLSearchParams();
        for (const [k, v] of Object.entries(formPayload)) {
          searchParams.append(k, v);
        }

        fetch(submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: searchParams.toString()
        }).catch(e => console.warn("Aviso ao enviar formulário no Google Forms:", e.message));
      } catch (gErr) {
        console.warn("Falha no disparo para o Google Forms, mas mantido no servidor:", gErr);
      }

      // 4. Disparo de E-mail de Notificação do Checklist via SMTP
      try {
        const mailRecipient = email || "deny.risel@gmail.com";
        const emailSubject = `[Checklist Risel] Nova Inspeção Realizada - Placa ${cleanPlaca} (${status.toUpperCase()})`;
        
        const htmlEmail = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #114D38; color: #ffffff; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">Risel Combustíveis - Checklist de Frota</h2>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #a7f3d0;">Comprovante de Inspeção Veicular</p>
            </div>
            <div style="padding: 20px;">
              <p style="font-size: 14px; color: #334155;">Um novo checklist foi concluído no sistema com o status <strong style="color: ${status === 'Aprovado' ? '#059669' : status === 'Ressalvas' ? '#d97706' : '#dc2626'};">${status.toUpperCase()}</strong>.</p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Placa:</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #114D38;">${cleanPlaca}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Veículo / Cor:</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${modelo || "N/I"} / ${cor || "N/I"}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Quilometragem (KM):</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${kmAtual || "N/I"} km</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Nível do Tanque:</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${nivelTanque || "CHEIO"}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Condutor / Responsável:</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${condutor}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Data da Inspeção:</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${formattedDate}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Base:</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${base || "PAULÍNIA"}</td>
                </tr>
              </table>

              <h4 style="margin-top: 20px; color: #114D38; font-size: 14px;">Estado dos Pneus</h4>
              <ul style="font-size: 12px; color: #475569; padding-left: 20px;">
                <li>Dianteiro Direito: <strong>${pneuDianteiroDireito || "BOM"}</strong></li>
                <li>Dianteiro Esquerdo: <strong>${pneuDianteiroEsquerdo || "BOM"}</strong></li>
                <li>Traseiro Direito: <strong>${pneuTraseiroDireito || "BOM"}</strong></li>
                <li>Traseiro Esquerdo: <strong>${pneuTraseiroEsquerdo || "BOM"}</strong></li>
                <li>Estepe: <strong>${pneuEstepe || "BOM"}</strong></li>
              </ul>

              ${(obsDianteira || obsMotorista || obsPassageiro || obsTraseira) ? `
                <h4 style="margin-top: 15px; color: #d97706; font-size: 14px;">Observações e Avarias Registradas</h4>
                <p style="font-size: 12px; color: #475569; background-color: #fffbe0; padding: 10px; border-radius: 6px; border: 1px solid #fef08a;">
                  ${[obsDianteira, obsMotorista, obsPassageiro, obsTraseira].filter(Boolean).join(" | ")}
                </p>
              ` : ''}

              <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
                <p>Este e-mail foi gerado automaticamente pelo Sistema de Gestão de Frota Risel Combustíveis.</p>
              </div>
            </div>
          </div>
        `;

        // Envio automático do e-mail do Checklist usando o SMTP Vault Risel
        const checklistSmtp = getRiselSmtpConfig({ defaultSenderName: "Risel Frota" });
        if (checklistSmtp.pass && checklistSmtp.pass.length > 0) {
          const transporter = createSafeTransporter(checklistSmtp);
          await transporter.sendMail({
            from: `"Risel Frota" <${checklistSmtp.user}>`,
            to: mailRecipient,
            subject: emailSubject,
            html: htmlEmail
          });
          console.log(`[Risel Frota] E-mail de notificação de checklist enviado com sucesso para ${mailRecipient} via ${checklistSmtp.host}`);
        } else {
          console.log(`[Risel Frota] Notificação de e-mail de checklist pronta para ${mailRecipient}.`);
        }
      } catch (mailErr) {
        console.warn("Aviso ao enviar e-mail de notificação do checklist:", mailErr);
      }

      return res.json({ 
        success: true, 
        id: newChecklist.id,
        checklist: newChecklist,
        message: "Checklist registrado com sucesso e integrado ao sistema!" 
      });

    } catch (error: any) {
      console.error("Risel Backend: Erro ao processar envio de checklist:", error);
      return res.status(500).json({ error: error.message || "Erro interno ao salvar checklist no sistema." });
    }
  });

  // Endpoint de Assistente de IA Administrativo com Gemini (Restrito e Server-Side)
  app.post("/api/gemini-assistant", express.json(), async (req, res) => {
    try {
      const { userEmail, prompt, history, systemContext } = req.body;
      
      // Validação estrita de segurança: apenas deny.goncalves@risel.com.br
      if (!userEmail || userEmail.toLowerCase() !== "deny.goncalves@risel.com.br") {
        return res.status(403).json({ error: "Acesso negado. O Assistente de IA é restrito ao gestor executivo." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Chave GEMINI_API_KEY não configurada no servidor." });
      }

      const systemInstructionText = systemContext || `Você é o Assistente Executivo de Inteligência Artificial e Engenheiro de Software Sênior do Sistema ERP Risel Combustíveis LTDA.
Você atende exclusivamente ao gestor Deny Gonçalves (deny.goncalves@risel.com.br).
Suas especialidades incluem:
1. Análise de Dados e Business Intelligence da Frota Leve (75 veículos, locadoras, consumo, manutenções, contratos).
2. Lançamentos de Documentos Fiscais, regras de alçada de aprovação e relatórios de vencimentos.
3. Consultas SQL e manutenção do banco de dados PostgreSQL / Supabase.
4. Orientações técnicas de implantação, deploys (Render, Netlify, Railway) e boas práticas de segurança.
Responda sempre em Português do Brasil com clareza, objetividade, sofisticação e precisão técnica.`;

      // Chamada direta à API do Google Gemini
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history) {
          contents.push({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.text }]
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: prompt }]
      });

      const payload = {
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 2500
        }
      };

      const geminiRes = await fetch(geminiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error("Erro Gemini API:", errText);
        return res.status(geminiRes.status).json({ error: "Falha na comunicação com a API do Gemini.", details: errText });
      }

      const data = await geminiRes.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta gerada pelo modelo.";

      return res.json({ success: true, reply });
    } catch (err: any) {
      console.error("Erro no /api/gemini-assistant:", err);
      return res.status(500).json({ error: err.message || "Erro interno ao processar requisição do assistente." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
