import { Sinistro, GravidadeSinistro, StatusSinistro, CulpabilidadeSinistro } from "../types";
import { formatEventFolderName, GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL } from "../../../services/googleDriveService";
import * as XLSX from "xlsx";

const STORAGE_KEY = "risel_sinistros_frota_pesada_v1";

// Dataset inicial realista com histórico de comunicados de sinistro da Risel Combustíveis
export const SEED_SINISTROS: Sinistro[] = [
  {
    id: "sin-101",
    numeroProtocolo: "SIN-2026-001",
    dataHora: "2026-09-18T14:30",
    dataComunicado: "18/09/2026",
    placa: "BRL2E19",
    placaCarreta: "RIS9B22",
    base: "Paulínia",
    motorista: "Carlos Eduardo Silva",
    cnhMotorista: "04938271640",
    tipoEvento: "Colisão Traseira",
    gravidade: "Média",
    status: "Em Reparo",
    culpabilidade: "Terceiro",
    local: "SP-332, KM 128 (Rod. Zeferino Vaz)",
    municipio: "Paulínia",
    uf: "SP",
    rodoviaOuUrbano: "Rodovia",
    boletimOcorrencia: "BO-77291/2026 - Polícia Militar Rodoviária",
    orgaoPolicial: "PMRv SP",
    houveVitimas: "Não",
    houveTerceiros: "Sim",
    dadosTerceiro: "Veículo VW Gol (Placa FGT4A12) - Condutor: Marcos Paulo Oliveira - Seguradora Tokio Marine",
    seguradoraAcionada: "Sim",
    nomeSeguradora: "Tokio Marine",
    numeroSinistroSeguradora: "TM-998231",
    valorEstimadoPrejuizo: 18500.0,
    valorFranquia: 4000.0,
    valorPagoSeguradora: 14500.0,
    custoEfetivoRisel: 0.0,
    descricao: "Veículo terceiro não guardou distância de segurança na desaceleração antes do pedágio e colidiu na traseira do semirreboque. Danos no para-choque traseiro e sistema de iluminação do tanque.",
    avariasVeiculo: "Para-choque homologado traseiro amassado, lanternagem LED danificada, suporte da placa avariado.",
    driveFolderId: "folder_101",
    driveFolderUrl: `${GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL}`,
    anexos: [
      { id: "anx-1", nome: "Boletim_Ocorrencia_77291.pdf", tamanho: 420000, tipo: "application/pdf" },
      { id: "anx-2", nome: "Foto_Traseira_Danos.jpg", tamanho: 890000, tipo: "image/jpeg" },
      { id: "anx-3", nome: "Orcamento_Oficina_Risel.pdf", tamanho: 310000, tipo: "application/pdf" }
    ],
    origem: "Microsoft Forms"
  },
  {
    id: "sin-102",
    numeroProtocolo: "SIN-2026-002",
    dataHora: "2026-09-08T09:15",
    dataComunicado: "08/09/2026",
    placa: "RIS8A44",
    placaCarreta: "RSL4K99",
    base: "Aguaí",
    motorista: "Antônio Ferreira Santos",
    cnhMotorista: "03847291055",
    tipoEvento: "Abalroamento Lateral",
    gravidade: "Leve",
    status: "Finalizado / Concluído",
    culpabilidade: "Sem Culpa / Condições Adversas",
    local: "SP-344, KM 205",
    municipio: "Aguaí",
    uf: "SP",
    rodoviaOuUrbano: "Rodovia",
    boletimOcorrencia: "BO-12048/2026",
    orgaoPolicial: "PMRv SP",
    houveVitimas: "Não",
    houveTerceiros: "Não",
    seguradoraAcionada: "Não",
    valorEstimadoPrejuizo: 3200.0,
    valorFranquia: 0.0,
    valorPagoSeguradora: 0.0,
    custoEfetivoRisel: 3200.0,
    descricao: "Ao cruzar ponte em obra com pista estreita, galho de árvore solto atingiu o retrovisor e a carenagem lateral direita do cavalo mecânico.",
    avariasVeiculo: "Retrovisor auxiliar quebrado e arranhões na lataria lateral da cabine.",
    driveFolderId: "folder_102",
    driveFolderUrl: `${GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL}`,
    anexos: [
      { id: "anx-4", nome: "Fotos_Carenagem_Lateral.jpg", tamanho: 750000, tipo: "image/jpeg" },
      { id: "anx-5", nome: "Nota_Fiscal_Troca_Espelho.pdf", tamanho: 180000, tipo: "application/pdf" }
    ],
    origem: "SharePoint Excel"
  },
  {
    id: "sin-103",
    numeroProtocolo: "SIN-2026-003",
    dataHora: "2026-08-25T19:40",
    dataComunicado: "26/08/2026",
    placa: "DNY3G77",
    placaCarreta: "CBR1190",
    base: "Santos",
    motorista: "Rogério Mendes Castro",
    cnhMotorista: "08912347510",
    tipoEvento: "Choque com Objeto Fixo",
    gravidade: "Média",
    status: "Regulado",
    culpabilidade: "Condutor Risel",
    local: "Av. Portuária, altura do Pátio de Triagem",
    municipio: "Santos",
    uf: "SP",
    rodoviaOuUrbano: "Urbano",
    boletimOcorrencia: "BO-44321/2026",
    orgaoPolicial: "Polícia Civil SP",
    houveVitimas: "Não",
    houveTerceiros: "Não",
    seguradoraAcionada: "Sim",
    nomeSeguradora: "Porto Seguro",
    numeroSinistroSeguradora: "PS-554109",
    valorEstimadoPrejuizo: 12000.0,
    valorFranquia: 5000.0,
    valorPagoSeguradora: 7000.0,
    custoEfetivoRisel: 5000.0,
    descricao: "Durante manobra em marcha à ré sob chuva no terminal de carregamento, o semirreboque tocou na coluna de proteção da balança.",
    avariasVeiculo: "Deformação na longarina de proteção e quebra da caixa de ferramentas plástica.",
    driveFolderId: "folder_103",
    driveFolderUrl: `${GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL}`,
    anexos: [
      { id: "anx-6", nome: "Laudo_Interno_Seguranca.pdf", tamanho: 540000, tipo: "application/pdf" }
    ],
    origem: "Microsoft Forms"
  },
  {
    id: "sin-104",
    numeroProtocolo: "SIN-2026-004",
    dataHora: "2026-08-10T11:20",
    dataComunicado: "10/08/2026",
    placa: "RSL9K21",
    placaCarreta: "RSL8H33",
    base: "Betim",
    motorista: "Wellington Alves Ribeiro",
    cnhMotorista: "06644299812",
    tipoEvento: "Colisão Frontal",
    gravidade: "Grave",
    status: "Aberto na Seguradora",
    culpabilidade: "Terceiro",
    local: "BR-381, KM 492 (Fernão Dias)",
    municipio: "Betim",
    uf: "MG",
    rodoviaOuUrbano: "Rodovia",
    boletimOcorrencia: "BO-PRF-99320/2026",
    orgaoPolicial: "PRF",
    houveVitimas: "Feridos Leves",
    houveTerceiros: "Sim",
    dadosTerceiro: "Caminhão Baú Mercedes-Benz 710 (Placa JKL2291) - Condutor levado para UPA sem gravidade",
    seguradoraAcionada: "Sim",
    nomeSeguradora: "Allianz Seguros",
    numeroSinistroSeguradora: "AL-2026-8871",
    valorEstimadoPrejuizo: 64000.0,
    valorFranquia: 8500.0,
    valorPagoSeguradora: 55500.0,
    custoEfetivoRisel: 0.0,
    descricao: "Veículo terceiro perdeu o freio na descida e atingiu a dianteira esquerda do cavalo mecânico Risel. Tanque intacto sem vazamento de produto.",
    avariasVeiculo: "Para-lama dianteiro esquerdo, grade, radiador, farol esquerdo e eixo dianteiro desalinhado.",
    driveFolderId: "folder_104",
    driveFolderUrl: `${GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL}`,
    anexos: [
      { id: "anx-7", nome: "Boletim_PRF_Betim.pdf", tamanho: 920000, tipo: "application/pdf" },
      { id: "anx-8", nome: "Tacografo_Digital_Leitura.pdf", tamanho: 1400000, tipo: "application/pdf" },
      { id: "anx-9", nome: "Fotos_Periciais_BR381.jpg", tamanho: 2100000, tipo: "image/jpeg" }
    ],
    origem: "Microsoft Forms"
  },
  {
    id: "sin-105",
    numeroProtocolo: "SIN-2026-005",
    dataHora: "2026-07-14T16:05",
    dataComunicado: "14/07/2026",
    placa: "BRA2E88",
    placaCarreta: "RTN7C41",
    base: "Paulínia",
    motorista: "José Ricardo Barbosa",
    cnhMotorista: "01948271103",
    tipoEvento: "Avaria de Carga / Válvula",
    gravidade: "Leve",
    status: "Finalizado / Concluído",
    culpabilidade: "Sem Culpa / Condições Adversas",
    local: "Base Operacional Paulínia - Baia 3",
    municipio: "Paulínia",
    uf: "SP",
    rodoviaOuUrbano: "Urbano",
    boletimOcorrencia: "Comunicação Interna de SMS #104",
    orgaoPolicial: "Segurança Interna Risel",
    houveVitimas: "Não",
    houveTerceiros: "Não",
    seguradoraAcionada: "Não",
    valorEstimadoPrejuizo: 1500.0,
    valorFranquia: 0.0,
    valorPagoSeguradora: 0.0,
    custoEfetivoRisel: 1500.0,
    descricao: "Válvula de fundo com travamento durante o descarregamento no cliente. Troca do engate rápido e retentor de vedação.",
    avariasVeiculo: "Substituição preventiva do acoplador de fundo.",
    driveFolderId: "folder_105",
    driveFolderUrl: `${GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL}`,
    anexos: [
      { id: "anx-10", nome: "Relatorio_SMS_Paulínia.pdf", tamanho: 240000, tipo: "application/pdf" }
    ],
    origem: "SharePoint Excel"
  }
];

/**
 * Busca a lista consolidada de sinistros (servidor / localStorage / seed)
 */
export async function fetchSinistros(): Promise<Sinistro[]> {
  try {
    const res = await fetch("/api/sinistros");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    console.warn("Aviso ao buscar sinistros no servidor, utilizando base local:", e);
  }

  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {}
  }

  // Se não existir dados, inicializa com a semente
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_SINISTROS));
  saveSinistrosToServer(SEED_SINISTROS).catch(() => {});
  return SEED_SINISTROS;
}

/**
 * Salva a lista consolidada de sinistros no servidor
 */
export async function saveSinistrosToServer(list: Sinistro[]): Promise<boolean> {
  try {
    const res = await fetch("/api/sinistros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(list)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Salva ou atualiza um sinistro individual
 */
export async function saveOrUpdateSinistro(sinistro: Sinistro): Promise<Sinistro[]> {
  const current = await fetchSinistros();
  const index = current.findIndex(s => s.id === sinistro.id);

  let updatedList: Sinistro[];
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = { ...updatedList[index], ...sinistro };
  } else {
    updatedList = [sinistro, ...current];
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  saveSinistrosToServer(updatedList).catch(() => {});
  return updatedList;
}

/**
 * Exclui um sinistro
 */
export async function deleteSinistro(id: string): Promise<Sinistro[]> {
  const current = await fetchSinistros();
  const updatedList = current.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  saveSinistrosToServer(updatedList).catch(() => {});
  return updatedList;
}

export interface SinistrosOnlineSyncResult {
  success: boolean;
  totalSinistros?: number;
  addedCount?: number;
  lastSync?: string;
  sheetUrl?: string;
  formsUrl?: string;
  message?: string;
  error?: string;
}

export interface SinistrosOnlineConfig {
  sharepointUrl: string;
  formsUrl: string;
  driveFolderUrl: string;
  autoSync: boolean;
  lastSync?: string;
  status?: string;
  lastMessage?: string;
}

/**
 * Busca a configuração da planilha online e sincronização automática
 */
export async function fetchSinistrosConfig(): Promise<SinistrosOnlineConfig> {
  try {
    const res = await fetch("/api/sinistros/config");
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Erro ao buscar config de sinistros:", e);
  }
  return {
    sharepointUrl: "https://riselcombustiveis-my.sharepoint.com/:x:/r/personal/deny_goncalves_risel_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B08C8A01A-45A5-4439-94F4-5F0505EDE3B3%7D&file=Comunicado%20de%20Sinistro_Frota%20Pesada.xlsx&action=default&mobileredirect=true",
    formsUrl: "https://forms.cloud.microsoft/Pages/DesignPageV2.aspx?prevorigin=Marketing&origin=NeoPortalPage&subpage=design&id=--soOq0dkkmCvV864R49jTu3qwhCFQBElTcewqtXSeRUQTE2N0tGUjlEMjREQU5OUzFKN1NSR1pQWS4u",
    driveFolderUrl: "https://drive.google.com/drive/folders/1A62QNaC-5m7xMVzZtUxvXxBCHREp_jse?hl=pt-br",
    autoSync: true,
    status: "conectado",
    lastMessage: "Integrado com o SharePoint da Risel Combustíveis"
  };
}

/**
 * Dispara a sincronização online com a planilha do SharePoint
 */
export async function syncSinistrosOnline(): Promise<SinistrosOnlineSyncResult> {
  try {
    const res = await fetch("/api/sinistros/sync-online", {
      method: "POST"
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || "Falha ao sincronizar com a planilha online do SharePoint."
    };
  } catch (e: any) {
    return {
      success: false,
      error: e.message || "Erro de conexão com o servidor."
    };
  }
}

/**
 * Parser inteligente de planilhas Excel (.xlsx/.xls) exportadas do Microsoft Forms / SharePoint
 * "Comunicado de Sinistro_Frota Pesada.xlsx"
 */
export function parseSinistrosExcel(dataBuffer: ArrayBuffer): Sinistro[] {
  const workbook = XLSX.read(dataBuffer, { type: "array" });
  // Localiza especificamente a aba Sheet1 informada pelo usuário
  const targetSheetName = workbook.SheetNames.find(s => s.trim().toLowerCase() === "sheet1") || "Sheet1";
  const worksheet = workbook.Sheets[targetSheetName] || workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("A planilha está vazia ou sem linhas de dados reconhecidas.");
  }

  const result: Sinistro[] = [];

  rawRows.forEach((row, idx) => {
    // Normaliza as chaves do objeto para busca sem distinção de acento e maiúsculas
    const normalizedRow: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
      normalizedRow[cleanKey] = row[key];
    }

    const findVal = (keywords: string[]): any => {
      for (const k of Object.keys(normalizedRow)) {
        for (const kw of keywords) {
          if (k.includes(kw)) {
            return normalizedRow[k];
          }
        }
      }
      return "";
    };

    const rawPlaca = String(findVal(["placa", "veiculo", "cavalo"])).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!rawPlaca && !findVal(["condutor", "motorista", "protocolo", "sinistro"])) {
      // Linha vazia ou irrelevante
      return;
    }

    const placaFinal = rawPlaca || `VEIC-${idx + 1}`;
    const baseFinal = String(findVal(["base", "filial", "unidade"]) || "Paulínia").trim();
    const motoristaFinal = String(findVal(["motorista", "condutor", "nome"]) || "Condutor não informado").trim();

    // Data e Hora
    let dataHoraRaw = findVal(["data e hora", "data do evento", "data do sinistro", "horario", "hora de conclusao", "hora de inicio", "data"]);
    let dataHoraIso = "";
    if (typeof dataHoraRaw === "number") {
      try {
        const dateObj = XLSX.SSF.parse_date_code(dataHoraRaw);
        const y = dateObj.y;
        const m = String(dateObj.m).padStart(2, "0");
        const d = String(dateObj.d).padStart(2, "0");
        const H = String(dateObj.H || 12).padStart(2, "0");
        const M = String(dateObj.M || 0).padStart(2, "0");
        dataHoraIso = `${y}-${m}-${d}T${H}:${M}`;
      } catch (e) {
        dataHoraIso = new Date().toISOString().substring(0, 16);
      }
    } else if (typeof dataHoraRaw === "string" && dataHoraRaw.trim()) {
      dataHoraIso = dataHoraRaw.trim();
    } else {
      dataHoraIso = new Date().toISOString().substring(0, 16);
    }

    // Tipo de Evento
    const tipoEventoRaw = String(findVal(["tipo de evento", "tipo de sinistro", "evento", "natureza", "tipo"]) || "Colisão").trim();

    // Gravidade
    let gravidade: GravidadeSinistro = "Média";
    const gravRaw = String(findVal(["gravidade", "severidade"])).toLowerCase();
    if (gravRaw.includes("leve")) gravidade = "Leve";
    else if (gravRaw.includes("grave") && !gravRaw.includes("graviss")) gravidade = "Grave";
    else if (gravRaw.includes("graviss")) gravidade = "Gravíssima";

    // Status
    let status: StatusSinistro = "Em Apuração";
    const statusRaw = String(findVal(["status", "situacao"])).toLowerCase();
    if (statusRaw.includes("final") || statusRaw.includes("conclui") || statusRaw.includes("encerr")) status = "Finalizado / Concluído";
    else if (statusRaw.includes("reparo") || statusRaw.includes("oficina")) status = "Em Reparo";
    else if (statusRaw.includes("orcam")) status = "Aguardando Orçamento";
    else if (statusRaw.includes("seguradora")) status = "Aberto na Seguradora";
    else if (statusRaw.includes("indeniz")) status = "Indenizado";
    else if (statusRaw.includes("regul")) status = "Regulado";

    // Culpabilidade
    let culpabilidade: CulpabilidadeSinistro = "Em Apuração";
    const culpaRaw = String(findVal(["culpabilidade", "responsabilidade", "culpa"])).toLowerCase();
    if (culpaRaw.includes("terceiro")) culpabilidade = "Terceiro";
    else if (culpaRaw.includes("risel") || culpaRaw.includes("condutor")) culpabilidade = "Condutor Risel";
    else if (culpaRaw.includes("sem culpa") || culpaRaw.includes("adversa")) culpabilidade = "Sem Culpa / Condições Adversas";

    // Valores
    const valorPrejuizo = Number(String(findVal(["prejuizo", "estimativa", "valor estimado", "custo total"])).replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
    const valorFranquia = Number(String(findVal(["franquia", "valor da franquia"])).replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
    const valorSeguradora = Number(String(findVal(["seguradora paga", "pago pela seguradora", "indenizacao"])).replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;

    const folderName = formatEventFolderName(placaFinal, baseFinal, dataHoraIso);

    const sinistro: Sinistro = {
      id: `sin_import_${Date.now()}_${idx}`,
      numeroProtocolo: String(findVal(["protocolo", "id", "identificador", "resposta"]) || `SIN-2026-${String(idx + 1).padStart(3, "0")}`),
      dataHora: dataHoraIso,
      dataComunicado: new Date().toLocaleDateString("pt-BR"),
      placa: placaFinal,
      placaCarreta: String(findVal(["carreta", "semirreboque", "reboque"])).trim().toUpperCase(),
      base: baseFinal,
      motorista: motoristaFinal,
      cnhMotorista: String(findVal(["cnh"])).trim(),
      tipoEvento: tipoEventoRaw,
      gravidade: gravidade,
      status: status,
      culpabilidade: culpabilidade,
      local: String(findVal(["local", "rodovia", "endereco", "km"]) || "Em apuração").trim(),
      municipio: String(findVal(["municipio", "cidade"]) || baseFinal).trim(),
      uf: String(findVal(["uf", "estado"]) || "SP").trim().toUpperCase().substring(0, 2),
      rodoviaOuUrbano: String(findVal(["rodovia", "trecho"])).toLowerCase().includes("urb") ? "Urbano" : "Rodovia",
      boletimOcorrencia: String(findVal(["boletim", "bo", "b.o", "ocorrencia"])).trim(),
      orgaoPolicial: String(findVal(["orgao", "policia"])).trim(),
      houveVitimas: String(findVal(["vitima"])).toLowerCase().includes("sim") ? "Feridos Leves" : "Não",
      houveTerceiros: String(findVal(["terceiro"])).toLowerCase().includes("sim") ? "Sim" : "Não",
      dadosTerceiro: String(findVal(["dados do terceiro", "veiculo terceiro", "terceiro"])).trim(),
      seguradoraAcionada: valorPrejuizo > 5000 || String(findVal(["seguradora"])).toLowerCase().includes("sim") ? "Sim" : "Não",
      nomeSeguradora: String(findVal(["nome da seguradora", "seguradora"]) || (valorPrejuizo > 5000 ? "Porto Seguro" : "")).trim(),
      valorEstimadoPrejuizo: valorPrejuizo,
      valorFranquia: valorFranquia,
      valorPagoSeguradora: valorSeguradora,
      custoEfetivoRisel: Math.max(0, valorPrejuizo - valorSeguradora),
      descricao: String(findVal(["descricao", "relato", "dinamica", "detalhes"]) || "Comunicado importado da planilha SharePoint de sinistros.").trim(),
      avariasVeiculo: String(findVal(["avaria", "danos"])).trim(),
      driveFolderId: `folder_${idx}`,
      driveFolderUrl: `${GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL}`,
      anexos: [],
      origem: "SharePoint Excel"
    };

    result.push(sinistro);
  });

  return result;
}

/**
 * Exporta a lista de sinistros para arquivo Excel (.xlsx)
 */
export function exportSinistrosToExcel(sinistros: Sinistro[]) {
  const rows = sinistros.map(s => ({
    "Nº Protocolo": s.numeroProtocolo,
    "Data e Hora": s.dataHora,
    "Placa Cavalo": s.placa,
    "Placa Carreta": s.placaCarreta || "",
    "Base / Filial": s.base,
    "Motorista": s.motorista,
    "CNH": s.cnhMotorista || "",
    "Tipo de Evento": s.tipoEvento,
    "Gravidade": s.gravidade,
    "Status": s.status,
    "Culpabilidade": s.culpabilidade,
    "Local": s.local,
    "Município": s.municipio,
    "UF": s.uf,
    "Tipo de Via": s.rodoviaOuUrbano,
    "Boletim de Ocorrência": s.boletimOcorrencia || "",
    "Órgão Policial": s.orgaoPolicial || "",
    "Houve Vítimas": s.houveVitimas,
    "Houve Terceiros": s.houveTerceiros,
    "Seguradora Acionada": s.seguradoraAcionada,
    "Seguradora": s.nomeSeguradora || "",
    "Nº Sinistro Seguradora": s.numeroSinistroSeguradora || "",
    "Prejuízo Estimado (R$)": s.valorEstimadoPrejuizo,
    "Valor Franquia (R$)": s.valorFranquia,
    "Valor Pago Seguradora (R$)": s.valorPagoSeguradora,
    "Custo Efetivo Risel (R$)": s.custoEfetivoRisel,
    "Descrição da Ocorrência": s.descricao,
    "Link Pasta Google Drive": s.driveFolderUrl || GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL,
    "Qtd Anexos": s.anexos?.length || 0,
    "Origem": s.origem || "Manual"
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sinistros Frota Pesada");
  XLSX.writeFile(workbook, `Comunicado_Sinistros_Frota_Pesada_${new Date().toISOString().split("T")[0]}.xlsx`);
}
