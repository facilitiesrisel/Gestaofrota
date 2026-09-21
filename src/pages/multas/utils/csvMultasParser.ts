import { Multa, StatusMulta, TipoMulta, Veiculo, CodigoMulta } from '../types';

export interface CsvMultaItem {
  id: string;
  ait: string;
  placa: string;
  frota: string;
  base: string;
  dataHoraInfracao: string;
  dataRecebimento: string;
  enquadramento: string;
  descricaoInfracao: string;
  endereco: string;
  municipio: string;
  uf: string;
  rodoviaOuUrbano: 'RODOVIA' | 'URBANO';
  valor: number;
  desconto: number;
  valorComDesconto: number;
  status: StatusMulta;
  tipo: TipoMulta;
  pontosCnh: number;
  artigoCtb: string;
  empresaOuCondutor: string;
  descontarMotorista: string;
  pagoComDesconto: string;
  recebidaComPrazo: string;
  retornouComPrazo: string;
  obs: string;
  // Campos auxiliares de auditoria
  cliente?: string;
  chassi?: string;
  taxaAdm?: string;
  valorTaxaAdm?: number;
  valorReembolso?: number;
  // Status de duplicidade
  isDuplicate: boolean;
  duplicateReason?: string;
  selected: boolean;
}

export interface CsvParseResult {
  items: CsvMultaItem[];
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  totalValorDesconto: number;
  metadata: {
    cliente?: string;
    cnpj?: string;
    periodo?: string;
    qtdMultasDeclarada?: number;
    valorFaturadoDeclarado?: string;
  };
  errors: string[];
}

export const cleanString = (str: string | undefined | null): string => {
  return str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
};

// Parser robusto com suporte a RFC 4180 (aspas duplas com quebras de linha e delimitadores internos)
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  // Detecta o delimitador primário (; ou ,)
  const firstLines = text.substring(0, 1000);
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  const delimiter = semicolonCount >= commaCount ? ';' : ',';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // pula a segunda aspa escapada
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

// Cidades conhecidas para mapeamento preciso de endereço
const KNOWN_CITIES = [
  'ARTUR NOGUEIRA',
  'UBERLANDIA',
  'SAO PAULO',
  'CAMPINAS',
  'CUBATAO',
  'PINDAMONHANGABA',
  'SANTO ANDRE',
  'ITAPETININGA',
  'GUARULHOS',
  'ITAPECERICA DA SERRA',
  'SAO BERNARDO DO CAMPO',
  'SAO BERNARDO',
  'SANTA RITA DO PASSA QUATRO',
  'SANTA RITA DO PASSA',
  'RIBEIRAO PIRES',
  'AGUAS DA PRATA',
  'SUMARE',
  'PARDINHO',
  'BAURU',
  'GUARAREMA',
  'CAPELA DO ALTO',
  'BALSAMO',
  'JOAQUIM TAVORA',
  'JALES',
  'ESTIVA',
  'COTIA',
  'PERUIBE',
  'TURMALINA',
  'SOROCABA',
  'FRANCO DA ROCHA',
  'ITATIBA',
  'SAO LOURENCO DA SERRA',
  'BARUERI',
  'ITU',
  'PIRAI DO SUL',
  'SAO SEBASTIAO',
  'SANTOS',
  'DIADEMA',
  'OSASCO',
  'MAUA',
  'MOGI DAS CRUZES',
  'JACAREI',
  'TAUBATE',
  'SETE BARRAS',
  'MIRACATU',
  'BERTIOGA',
  'RIO CLARO',
  'ITATIAUCU',
  'MARILIA',
  'PAULINIA',
  'AGUAI',
  'BETIM',
  'CAPAO BONITO',
  'OURINHOS'
];

// Logradouros / Bairros característicos de São Paulo Capital
const SP_CAPITAL_KEYWORDS = [
  'MOOCA',
  'IPIRANGA',
  'PINHEIROS',
  'SUMARE',
  'PAULO VI',
  'RUBEM BERTA',
  'RICARDO JAFET',
  'MELO FREIRE',
  'ELLIS MAAS',
  'HELIOPOLIS',
  'SACOMA',
  'ANHAIA MELLO',
  'EUSEBIO MATOSO',
  'DOUTOR GENTIL DE MOURA',
  'DOM PEDRO I',
  'VIADUTO GRANDE SAO PAULO',
  'APUCARANA',
  'VILA MARIANA',
  'SANTO AMARO',
  'JABAQUARA',
  'LAPA',
  'BUTANTA',
  'CENTRO-BAIRRO'
];

export function extractCityAndState(addressRaw: string): {
  municipio: string;
  uf: string;
  rodoviaOuUrbano: 'RODOVIA' | 'URBANO';
  cleanedAddress: string;
} {
  if (!addressRaw) {
    return { municipio: '', uf: 'SP', rodoviaOuUrbano: 'URBANO', cleanedAddress: '' };
  }

  let text = addressRaw
    .replace(/^LOCAL\s*/i, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const upper = text.toUpperCase();

  // 1. Detecta Rodovia ou Urbano
  const isHighway =
    upper.includes('KM ') ||
    upper.includes('KM-') ||
    upper.includes('SP-') ||
    upper.includes('SP ') ||
    upper.includes('BR-') ||
    upper.includes('BR ') ||
    upper.includes('MGC') ||
    upper.includes('RODOVIA') ||
    upper.includes('METROS') ||
    upper.includes('SENTIDO');

  const rodoviaOuUrbano: 'RODOVIA' | 'URBANO' = isHighway ? 'RODOVIA' : 'URBANO';

  // 2. Extrai UF
  let uf = 'SP';
  if (upper.includes(' MG') || upper.includes('MGC') || upper.includes('UBERLANDIA') || upper.includes('ESTIVA') || upper.includes('BETIM') || upper.includes('ITATIAUCU')) {
    uf = 'MG';
  } else if (upper.includes(' PR') || upper.includes('PIRAI DO SUL') || upper.includes('JOAQUIM TAVORA')) {
    uf = 'PR';
  } else if (upper.includes(' RJ') || upper.includes('RIO DE JANEIRO')) {
    uf = 'RJ';
  }

  // 3. Extrai Cidade (Município)
  let municipio = '';

  // a) Procura se começa com cidade conhecida ou contém explicitamente
  for (const city of KNOWN_CITIES) {
    // Regex no início ou delimitado
    const regexStart = new RegExp(`^${city}\\b`, 'i');
    const regexDelim = new RegExp(`[-,\\s]${city}[-,\\s]`, 'i');
    const regexEnd = new RegExp(`[-,\\s]${city}$`, 'i');

    if (regexStart.test(upper)) {
      municipio = city;
      break;
    }
    if (regexDelim.test(upper) || regexEnd.test(upper)) {
      municipio = city;
      break;
    }
  }

  // b) Se não achou, testa padrões especiais de logradouro da capital SP
  if (!municipio) {
    if (SP_CAPITAL_KEYWORDS.some(k => upper.includes(k))) {
      municipio = 'SAO PAULO';
      uf = 'SP';
    }
  }

  // c) Padrão "Cidade-UF" ou "Cidade/UF" no texto (ex: "Guarulhos-SP", "Itapecerica da Serra SP")
  if (!municipio) {
    const matchUfPattern = upper.match(/([A-ZÀ-Ú\s]{3,25})\s*[-/]?\s*(SP|MG|PR|RJ)\b/);
    if (matchUfPattern && matchUfPattern[1]) {
      const candidate = matchUfPattern[1].trim();
      if (!candidate.includes('RUA') && !candidate.includes('AV') && !candidate.includes('RODOVIA')) {
        municipio = candidate;
        uf = matchUfPattern[2];
      }
    }
  }

  // Normalização final do nome da cidade
  if (municipio === 'SANTA RITA DO PASSA') {
    municipio = 'SANTA RITA DO PASSA QUATRO';
  } else if (municipio === 'SAO BERNARDO') {
    municipio = 'SAO BERNARDO DO CAMPO';
  }

  return {
    municipio,
    uf,
    rodoviaOuUrbano,
    cleanedAddress: text
  };
}

export function parseCurrency(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  str = str.replace(/R\$\s*/gi, '');
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  str = str.replace(/[^\d.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseDateTimeLocal(dateStr: string, timeStr?: string): string {
  if (!dateStr) return '';
  const cleanDate = dateStr.trim();
  const cleanTime = (timeStr || '').trim() || '00:00';

  // DD/MM/AAAA
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDate)) {
    const parts = cleanDate.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    const timeFormatted = cleanTime.substring(0, 5).padStart(5, '0');
    return `${y}-${m}-${d}T${timeFormatted}`;
  }

  // AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    const timeFormatted = cleanTime.substring(0, 5).padStart(5, '0');
    return `${cleanDate}T${timeFormatted}`;
  }

  if (cleanDate.includes('T')) {
    return cleanDate.substring(0, 16);
  }

  return cleanDate;
}

export function parseCsvMultas(
  csvContent: string,
  existingMultas: Multa[],
  veiculos: Veiculo[] = [],
  codigos: CodigoMulta[] = []
): CsvParseResult {
  const errors: string[] = [];
  const rows = parseCsvRows(csvContent);

  if (!rows || rows.length === 0) {
    return {
      items: [],
      totalRows: 0,
      newCount: 0,
      duplicateCount: 0,
      totalValorDesconto: 0,
      metadata: {},
      errors: ['O arquivo CSV está vazio.']
    };
  }

  // 1. Extração de Metadados do topo
  const metadata: CsvParseResult['metadata'] = {};
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowJoined = rows[i].join(';').toUpperCase();

    if (rowJoined.includes('RISEL') || rowJoined.includes('CLIENTE:')) {
      metadata.cliente = rows[i].find(c => c && c.trim().length > 0) || 'RISEL COMBUSTIVEIS LTDA';
    }
    if (rowJoined.includes('CNPJ:')) {
      metadata.cnpj = rows[i].find(c => c && c.includes('CNPJ:'));
    }
    if (rowJoined.includes('QTD. MULTAS:')) {
      const qtdCell = rows[i].find(c => c && c.toUpperCase().includes('QTD. MULTAS:'));
      if (qtdCell) {
        const match = qtdCell.match(/\d+/);
        if (match) metadata.qtdMultasDeclarada = parseInt(match[0], 10);
      }
      const valCell = rows[i].find(c => c && c.toUpperCase().includes('VALOR FATURADO:'));
      if (valCell) {
        metadata.valorFaturadoDeclarado = valCell;
      }
    }

    // Identifica linha de cabeçalho
    const isHeader =
      (rowJoined.includes('PLACA') && rowJoined.includes('AIT')) ||
      (rowJoined.includes('PLACA 1') && rowJoined.includes('AIT PRINCIPAL')) ||
      (rowJoined.includes('DATA DA INFRAÇÃO') && rowJoined.includes('CÓD.'));

    if (isHeader) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      items: [],
      totalRows: 0,
      newCount: 0,
      duplicateCount: 0,
      totalValorDesconto: 0,
      metadata,
      errors: ['Não foi possível localizar o cabeçalho das colunas (esperado "Placa 1", "AIT Principal", "Data da Infração").']
    };
  }

  const headers = rows[headerRowIndex].map(h =>
    h.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  );

  // Mapeamento dos índices
  const findColIndex = (keywords: string[]) => {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const colPlaca1 = findColIndex(['PLACA 1', 'PLACA1']);
  const colPlaca2 = findColIndex(['PLACA 2', 'PLACA2']);
  const colPlaca = colPlaca1 !== -1 ? colPlaca1 : findColIndex(['PLACA']);
  const colAit = findColIndex(['AIT PRINCIPAL', 'AIT']);
  const colData = findColIndex(['DATA DA INFRACAO', 'DATA INFRACAO', 'DATA']);
  const colHora = findColIndex(['HORA DA INFRACAO', 'HORA INFRACAO', 'HORA']);
  const colCod = findColIndex(['COD. DA INFRACAO', 'COD DA INFRACAO', 'COD. INFRACAO', 'ENQUADRAMENTO', 'CODIGO']);
  const colDesc = findColIndex(['DESCRICAO DA INFRACAO', 'DESCRICAO']);
  const colLocal = findColIndex(['LOCAL DA INFRACAO', 'LOCAL', 'ENDERECO']);
  const colValorDesc = findColIndex(['VALOR C/ DESCONTO', 'VALOR COM DESCONTO', 'VALOR C DESCONTO']);
  const colTaxaAdm = findColIndex(['TAXA ADM']);
  const colValorTaxa = findColIndex(['VALOR DA TAXA ADM']);
  const colValorReembolso = findColIndex(['VALOR DO REEMBOLSO']);
  const colChassi = findColIndex(['CHASSI']);
  const colCliente = findColIndex(['CLIENTE']);

  const todayStr = new Date().toISOString().split('T')[0]; // Data de importação

  const items: CsvMultaItem[] = [];
  const processedAitsInBatch = new Set<string>();
  const processedPlacaDateTimeInBatch = new Set<string>();

  // Processa as linhas de dados
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every(c => !c || c.trim() === '')) {
      continue; // pula linha vazia
    }

    const placaRaw = (
      (colPlaca1 !== -1 ? row[colPlaca1] : '') ||
      (colPlaca !== -1 ? row[colPlaca] : '') ||
      (colPlaca2 !== -1 ? row[colPlaca2] : '')
    ).trim();

    const aitRaw = (colAit !== -1 ? row[colAit] : '').trim();

    // Se não tiver nem placa nem AIT, ignora
    if (!placaRaw && !aitRaw) {
      continue;
    }

    const placa = cleanString(placaRaw);
    const ait = cleanString(aitRaw);
    const dataStr = colData !== -1 ? row[colData] : '';
    const horaStr = colHora !== -1 ? row[colHora] : '';
    const dataHoraInfracao = parseDateTimeLocal(dataStr, horaStr);
    const codInfracaoRaw = colCod !== -1 ? (row[colCod] || '').trim() : '';
    const descricao = colDesc !== -1 ? (row[colDesc] || '').trim() : '';
    const localRaw = colLocal !== -1 ? (row[colLocal] || '').trim() : '';
    const valorComDesconto = colValorDesc !== -1 ? parseCurrency(row[colValorDesc]) : 0;
    const taxaAdm = colTaxaAdm !== -1 ? (row[colTaxaAdm] || '').trim() : '';
    const valorTaxaAdm = colValorTaxa !== -1 ? parseCurrency(row[colValorTaxa]) : 0;
    const valorReembolso = colValorReembolso !== -1 ? parseCurrency(row[colValorReembolso]) : 0;
    const chassi = colChassi !== -1 ? (row[colChassi] || '').trim() : '';
    const cliente = colCliente !== -1 ? (row[colCliente] || '').trim() : '';

    // Extrai Cidade e UF
    const locationData = extractCityAndState(localRaw);

    // Associação com veículo para frota e filial
    const veiculoMatch = veiculos.find(v => cleanString(v.placa) === placa);
    const frota = veiculoMatch?.id || placa;
    const base = veiculoMatch?.filial || 'SBC';

    // Associação com catálogo de infrações CTB
    const cleanCod = cleanString(codInfracaoRaw);
    const codigoMatch = codigos.find(c => {
      const codeClean = cleanString(c.codigo);
      return codeClean === cleanCod || codeClean.replace('-', '') === cleanCod;
    });

    const enquadramento = codInfracaoRaw;
    const pontosCnh = codigoMatch?.pontos || 0;
    const artigoCtb = codigoMatch?.baseLegal || '';
    const valorIntegral = codigoMatch?.valor || (valorComDesconto > 0 ? valorComDesconto * 1.25 : 0);
    const descontoCalculado = Math.max(0, valorIntegral - valorComDesconto);

    // --- VERIFICAÇÃO DE DUPLICIDADE ---
    let isDuplicate = false;
    let duplicateReason: string | undefined = undefined;

    // Regra 1: AIT já existente
    if (ait) {
      const existingByAit = existingMultas.find(m => cleanString(m.ait) === ait);
      if (existingByAit) {
        isDuplicate = true;
        duplicateReason = `AIT já cadastrado no sistema (Status: ${existingByAit.status})`;
      } else if (processedAitsInBatch.has(ait)) {
        isDuplicate = true;
        duplicateReason = `AIT duplicado no próprio arquivo CSV`;
      }
    }

    // Regra 2: Placa + Data e Horário (se AIT não achou ou para tirar dúvida)
    if (!isDuplicate && placa && dataHoraInfracao) {
      const keyPlacaData = `${placa}_${dataHoraInfracao}`;
      const existingByPlacaDate = existingMultas.find(m => {
        if (cleanString(m.placa) !== placa) return false;
        // Compara datetime exato ou data aproximada
        return (
          m.dataHoraInfracao === dataHoraInfracao ||
          (m.dataHoraInfracao && dataHoraInfracao && m.dataHoraInfracao.substring(0, 16) === dataHoraInfracao.substring(0, 16))
        );
      });

      if (existingByPlacaDate) {
        isDuplicate = true;
        duplicateReason = `Mesma Placa (${placa}) e Data/Hora (${dataHoraInfracao}) no sistema (AIT: ${existingByPlacaDate.ait})`;
      } else if (processedPlacaDateTimeInBatch.has(keyPlacaData)) {
        isDuplicate = true;
        duplicateReason = `Mesma Placa e Data/Hora duplicada no arquivo`;
      }
    }

    // Registra no conjunto do lote
    if (ait) processedAitsInBatch.add(ait);
    if (placa && dataHoraInfracao) processedPlacaDateTimeInBatch.add(`${placa}_${dataHoraInfracao}`);

    // Cria o item da multa
    const item: CsvMultaItem = {
      id: ait || `IMP-${placa}-${Date.now()}-${i}`,
      ait: aitRaw || ait,
      placa: placaRaw || placa,
      frota,
      base,
      dataHoraInfracao,
      dataRecebimento: todayStr, // Data do recebimento que vai ser a data da Importação
      enquadramento,
      descricaoInfracao: descricao,
      endereco: locationData.cleanedAddress,
      municipio: locationData.municipio,
      uf: locationData.uf,
      rodoviaOuUrbano: locationData.rodoviaOuUrbano,
      valor: Number(valorIntegral.toFixed(2)),
      desconto: Number(descontoCalculado.toFixed(2)),
      valorComDesconto: Number(valorComDesconto.toFixed(2)),
      status: StatusMulta.IMPORTACAO_VAMOS, // Status Importação Vamos no Status
      tipo: TipoMulta.NOTIFICACAO,
      pontosCnh,
      artigoCtb,
      empresaOuCondutor: 'EMPRESA',
      descontarMotorista: 'NÃO',
      pagoComDesconto: 'SIM',
      recebidaComPrazo: 'SIM',
      retornouComPrazo: 'NÃO',
      obs: `Importado via CSV Demonstrativo Vamos (${todayStr})${taxaAdm ? ` | Taxa ADM: ${taxaAdm}` : ''}${valorTaxaAdm ? ` (R$ ${valorTaxaAdm.toFixed(2)})` : ''}${valorReembolso ? ` | Total Reembolso: R$ ${valorReembolso.toFixed(2)}` : ''}`,
      cliente,
      chassi,
      taxaAdm,
      valorTaxaAdm,
      valorReembolso,
      isDuplicate,
      duplicateReason,
      selected: !isDuplicate // Selecionado por padrão se não for duplicado
    };

    items.push(item);
  }

  const newCount = items.filter(it => !it.isDuplicate).length;
  const duplicateCount = items.filter(it => it.isDuplicate).length;
  const totalValorDesconto = items.reduce((acc, it) => acc + (it.valorComDesconto || 0), 0);

  return {
    items,
    totalRows: items.length,
    newCount,
    duplicateCount,
    totalValorDesconto: Number(totalValorDesconto.toFixed(2)),
    metadata,
    errors
  };
}
