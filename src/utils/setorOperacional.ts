/**
 * Utilitário de normalização e padronização ortográfica de Setores, Departamentos e Centros de Custo.
 * Risel Combustíveis - Garante consistência de dados em todos os módulos e submódulos do sistema.
 * 
 * Corrige e unifica variações ortográficas, ausência de acentos, maiúsculas/minúsculas,
 * abreviações (ex: "OP", "ADM", "RH", "MKT", "TI") e erros comuns de digitação.
 * 
 * Exemplos:
 * "Operações", "operacoes", "OPERAÇOES", "operacao", "operacional", "op" -> "Operações"
 * "manutencao", "manut", "oficina", "MANUTENÇÃO" -> "Manutenção"
 * "ti", "t.i.", "sistemas", "tecnologia" -> "TI & Sistemas"
 * "recursos humanos", "rh", "dp", "gente e gestao" -> "Recursos Humanos"
 */

// Conectores em português que devem ficar em minúsculo na formatação de nomes de setores
const LOWERCASE_PARTICLES = new Set(["de", "da", "do", "dos", "das", "e", "em", "para", "por", "com", "&", "/"]);

// Palavras que devem ser totalmente em maiúsculas (siglas)
const UPPERCASE_ACRONYMS = new Set(["ti", "dp", "rh", "sst", "sms", "sesmt", "ceo", "cnh", "rac", "cc", "c.c", "d.p", "r.h", "s.s.t", "qssma", "hseq"]);

/**
 * Remove acentos e normaliza para minúsculas e espaços únicos.
 */
function cleanString(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[._\-–—/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lista canônica de setores e departamentos oficiais da Risel Combustíveis
 */
export const SETORES_OFICIAIS: string[] = [
  "Operações",
  "Manutenção",
  "Logística & Transporte",
  "Administrativo",
  "Diretoria",
  "TI & Sistemas",
  "Comercial & Vendas",
  "Recursos Humanos",
  "Financeiro & Controladoria",
  "Segurança do Trabalho",
  "Suprimentos & Compras",
  "Marketing & Eventos",
  "Gestão de Frota",
  "Qualidade & Processos",
  "Jurídico"
];

/**
 * Centros de Custo Oficiais com numeração e descrição padronizada
 */
export const CENTROS_CUSTO_OFICIAIS: string[] = [
  "C.C 101 - Operacional",
  "C.C 102 - Manutenção / Oficina",
  "C.C 103 - Logística & Transporte",
  "C.C 104 - Administrativo / Sede",
  "C.C 105 - Diretoria / Executivo",
  "C.C 106 - TI & Sistemas",
  "C.C 107 - Comercial & Vendas",
  "C.C 108 - Recursos Humanos / D.P",
  "C.C 109 - Marketing & Eventos",
  "C.C 110 - Gestão de Frota",
  "C.C 111 - Financeiro & Controladoria",
  "C.C 112 - Segurança do Trabalho",
  "C.C 113 - Suprimentos & Compras"
];

/**
 * Mapa de correspondência direta para variações conhecidas (chave em minúsculas e sem acentos)
 */
const CANONICAL_SECTORS_MAP: Record<string, string> = {
  // 1. Operações / Operacional / Campo
  "operacoes": "Operações",
  "operacao": "Operações",
  "operacoe": "Operações",
  "operacões": "Operações",
  "operaçoes": "Operações",
  "operacoes de campo": "Operações",
  "operacional": "Operações",
  "operacional campo": "Operações",
  "operacional e campo": "Operações",
  "campo": "Operações",
  "op": "Operações",
  "ops": "Operações",
  "frota operacional": "Operações",
  "operaconal": "Operações",
  "operacioanl": "Operações",
  "operacioanais": "Operações",
  "operacoes logistica": "Operações",
  "operacao e logistica": "Operações",

  // 2. Manutenção / Oficina
  "manutencao": "Manutenção",
  "manutencao preventiva": "Manutenção",
  "manutencao corretiva": "Manutenção",
  "manutencao mecânica": "Manutenção",
  "manutencao mecanica": "Manutenção",
  "manut": "Manutenção",
  "manut.": "Manutenção",
  "oficina": "Manutenção",
  "oficina mecanica": "Manutenção",
  "mecanica": "Manutenção",
  "manutencao e oficina": "Manutenção",
  "manutencao / oficina": "Manutenção",
  "oficina / manutencao": "Manutenção",
  "servicos mecanicos": "Manutenção",

  // 3. Logística & Transporte
  "logistica": "Logística & Transporte",
  "logistica e transporte": "Logística & Transporte",
  "logistica & transporte": "Logística & Transporte",
  "logistica e transportes": "Logística & Transporte",
  "logistica & transportes": "Logística & Transporte",
  "transporte": "Logística & Transporte",
  "transportes": "Logística & Transporte",
  "log": "Logística & Transporte",
  "log.": "Logística & Transporte",
  "trafego": "Logística & Transporte",
  "distribuicao": "Logística & Transporte",
  "expedicao": "Logística & Transporte",
  "rotas": "Logística & Transporte",

  // 4. Administrativo / Sede
  "administrativo": "Administrativo",
  "adm": "Administrativo",
  "adm.": "Administrativo",
  "admin": "Administrativo",
  "administracao": "Administrativo",
  "administracao geral": "Administrativo",
  "sede": "Administrativo",
  "sede administrativa": "Administrativo",
  "escritorio": "Administrativo",
  "corporativo": "Administrativo",
  "facilities": "Administrativo",
  "geral": "Administrativo",
  "secretaria": "Administrativo",

  // 5. Diretoria / Executivo
  "diretoria": "Diretoria",
  "dir": "Diretoria",
  "dir.": "Diretoria",
  "executivo": "Diretoria",
  "presidencia": "Diretoria",
  "ceo": "Diretoria",
  "c level": "Diretoria",
  "diretoria executiva": "Diretoria",
  "diretoria geral": "Diretoria",
  "conselho": "Diretoria",
  "gestao executiva": "Diretoria",
  "governanca": "Diretoria",

  // 6. TI & Sistemas
  "ti": "TI & Sistemas",
  "t i": "TI & Sistemas",
  "t.i": "TI & Sistemas",
  "t.i.": "TI & Sistemas",
  "ti e sistemas": "TI & Sistemas",
  "ti & sistemas": "TI & Sistemas",
  "ti sistemas": "TI & Sistemas",
  "tecnologia": "TI & Sistemas",
  "tecnologia da informacao": "TI & Sistemas",
  "informatica": "TI & Sistemas",
  "suporte ti": "TI & Sistemas",
  "suporte": "TI & Sistemas",
  "sistemas": "TI & Sistemas",
  "helpdesk": "TI & Sistemas",
  "infraestrutura ti": "TI & Sistemas",
  "desenvolvimento": "TI & Sistemas",
  "dados": "TI & Sistemas",

  // 7. Comercial & Vendas
  "comercial": "Comercial & Vendas",
  "comercial e vendas": "Comercial & Vendas",
  "comercial & vendas": "Comercial & Vendas",
  "vendas": "Comercial & Vendas",
  "com": "Comercial & Vendas",
  "com.": "Comercial & Vendas",
  "comercial / vendas": "Comercial & Vendas",
  "vendedor": "Comercial & Vendas",
  "representantes": "Comercial & Vendas",
  "novos negocios": "Comercial & Vendas",
  "trading": "Comercial & Vendas",
  "contas": "Comercial & Vendas",

  // 8. Recursos Humanos / D.P
  "recursos humanos": "Recursos Humanos",
  "rh": "Recursos Humanos",
  "r h": "Recursos Humanos",
  "r.h": "Recursos Humanos",
  "r.h.": "Recursos Humanos",
  "dp": "Recursos Humanos",
  "d p": "Recursos Humanos",
  "d.p": "Recursos Humanos",
  "d.p.": "Recursos Humanos",
  "departamento pessoal": "Recursos Humanos",
  "gente e gestao": "Recursos Humanos",
  "gente & gestao": "Recursos Humanos",
  "gestao de pessoas": "Recursos Humanos",
  "recursos humanos e dp": "Recursos Humanos",
  "rh / dp": "Recursos Humanos",
  "rh e dp": "Recursos Humanos",
  "treinamento": "Recursos Humanos",
  "recrutamento": "Recursos Humanos",

  // 9. Financeiro & Controladoria
  "financeiro": "Financeiro & Controladoria",
  "fin": "Financeiro & Controladoria",
  "fin.": "Financeiro & Controladoria",
  "controladoria": "Financeiro & Controladoria",
  "contabilidade": "Financeiro & Controladoria",
  "contabil": "Financeiro & Controladoria",
  "fiscal": "Financeiro & Controladoria",
  "tributario": "Financeiro & Controladoria",
  "tesouraria": "Financeiro & Controladoria",
  "contas a pagar": "Financeiro & Controladoria",
  "contas a receber": "Financeiro & Controladoria",
  "faturamento": "Financeiro & Controladoria",
  "financeiro e controladoria": "Financeiro & Controladoria",
  "financeiro & controladoria": "Financeiro & Controladoria",
  "financeiro / controladoria": "Financeiro & Controladoria",

  // 10. Segurança do Trabalho & Meio Ambiente
  "seguranca do trabalho": "Segurança do Trabalho",
  "seguranca": "Segurança do Trabalho",
  "sst": "Segurança do Trabalho",
  "s s t": "Segurança do Trabalho",
  "sms": "Segurança do Trabalho",
  "sesmt": "Segurança do Trabalho",
  "meio ambiente": "Segurança do Trabalho",
  "seguranca e meio ambiente": "Segurança do Trabalho",
  "qssma": "Segurança do Trabalho",
  "hseq": "Segurança do Trabalho",

  // 11. Suprimentos & Compras
  "suprimentos": "Suprimentos & Compras",
  "compras": "Suprimentos & Compras",
  "suprimentos e compras": "Suprimentos & Compras",
  "suprimentos & compras": "Suprimentos & Compras",
  "almoxarifado": "Suprimentos & Compras",
  "almoxarifado e suprimentos": "Suprimentos & Compras",
  "almoxarifado / suprimentos": "Suprimentos & Compras",
  "patrimonio": "Suprimentos & Compras",
  "comprador": "Suprimentos & Compras",
  "aquisicoes": "Suprimentos & Compras",
  "estoque": "Suprimentos & Compras",

  // 12. Marketing & Eventos
  "marketing": "Marketing & Eventos",
  "mkt": "Marketing & Eventos",
  "mkt.": "Marketing & Eventos",
  "marketing e eventos": "Marketing & Eventos",
  "marketing & eventos": "Marketing & Eventos",
  "comunicacao": "Marketing & Eventos",
  "eventos": "Marketing & Eventos",
  "publicidade": "Marketing & Eventos",
  "propaganda": "Marketing & Eventos",
  "branding": "Marketing & Eventos",
  "midia": "Marketing & Eventos",

  // 13. Gestão de Frota
  "gestao de frota": "Gestão de Frota",
  "gestao de frotas": "Gestão de Frota",
  "frota": "Gestão de Frota",
  "frotas": "Gestão de Frota",
  "controle de frota": "Gestão de Frota",
  "administracao de frota": "Gestão de Frota",
  "telemetria": "Gestão de Frota",

  // 14. Qualidade & Processos
  "qualidade": "Qualidade & Processos",
  "processos": "Qualidade & Processos",
  "qualidade e processos": "Qualidade & Processos",
  "qualidade & processos": "Qualidade & Processos",
  "auditoria": "Qualidade & Processos",
  "compliance": "Qualidade & Processos",
  "gestao da qualidade": "Qualidade & Processos",

  // 15. Jurídico
  "juridico": "Jurídico",
  "advocacia": "Jurídico",
  "legal": "Jurídico",
  "compliance juridico": "Jurídico",
  "departamento juridico": "Jurídico",
  "assessoria juridica": "Jurídico"
};

/**
 * Formata uma string de setor desconhecido com capitalização inteligente de título
 */
function toSmartSectorTitleCase(str: string): string {
  if (!str) return "";
  const parts = str.trim().split(/\s+/);
  return parts
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (UPPERCASE_ACRONYMS.has(lower)) {
        return lower.toUpperCase();
      }
      if (index > 0 && LOWERCASE_PARTICLES.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Normaliza e padroniza o nome do Setor ou Departamento.
 * 
 * @param setor Nome do setor bruto vindo do formulário, banco ou importação.
 * @param fallback Valor retornado caso o setor seja vazio ou inválido (padrão: "Operações").
 * @returns Nome do setor canônico, com acentuação e pontuação corretas.
 */
export function normalizeNomeSetor(setor: string | undefined | null, fallback = "Operações"): string {
  if (!setor || typeof setor !== "string") {
    return fallback;
  }

  const rawTrimmed = setor.trim();
  if (!rawTrimmed || rawTrimmed === "-" || rawTrimmed.toLowerCase() === "n/a" || rawTrimmed.toLowerCase() === "null") {
    return fallback;
  }

  const cleaned = cleanString(rawTrimmed);

  // 1. Verificação direta no mapa canônico
  if (CANONICAL_SECTORS_MAP[cleaned]) {
    return CANONICAL_SECTORS_MAP[cleaned];
  }

  // 2. Verificação de correspondência parcial ou por prefixos/termos-chave
  if (cleaned.startsWith("operac") || cleaned.includes("operac")) {
    return "Operações";
  }
  if (cleaned.startsWith("manut") || cleaned.includes("oficin") || cleaned.includes("mecanic")) {
    return "Manutenção";
  }
  if (cleaned.startsWith("logist") || cleaned.includes("transp") || cleaned.includes("trafego") || cleaned.includes("distrib")) {
    return "Logística & Transporte";
  }
  if (cleaned.startsWith("adm") || cleaned.includes("administr") || cleaned.includes("sede") || cleaned.includes("escritor")) {
    return "Administrativo";
  }
  if (cleaned.startsWith("dir") || cleaned.includes("diretor") || cleaned.includes("presid") || cleaned.includes("executiv")) {
    return "Diretoria";
  }
  if (cleaned === "ti" || cleaned.startsWith("ti ") || cleaned.includes("sistem") || cleaned.includes("tecnolog") || cleaned.includes("informatic")) {
    return "TI & Sistemas";
  }
  if (cleaned.startsWith("comerc") || cleaned.includes("venda") || cleaned.includes("trading")) {
    return "Comercial & Vendas";
  }
  if (cleaned === "rh" || cleaned === "dp" || cleaned.includes("recurso") || cleaned.includes("pessoal") || cleaned.includes("gente")) {
    return "Recursos Humanos";
  }
  if (cleaned.startsWith("fin") || cleaned.includes("financ") || cleaned.includes("contab") || cleaned.includes("fiscal") || cleaned.includes("tesour") || cleaned.includes("controlad")) {
    return "Financeiro & Controladoria";
  }
  if (cleaned.includes("seguranc") || cleaned === "sst" || cleaned === "sms" || cleaned === "sesmt") {
    return "Segurança do Trabalho";
  }
  if (cleaned.includes("suprim") || cleaned.includes("compr") || cleaned.includes("almoxar") || cleaned.includes("patrimon")) {
    return "Suprimentos & Compras";
  }
  if (cleaned.includes("market") || cleaned === "mkt" || cleaned.includes("comunic") || cleaned.includes("event")) {
    return "Marketing & Eventos";
  }
  if (cleaned.includes("frot") || cleaned.includes("telemetr")) {
    return "Gestão de Frota";
  }
  if (cleaned.includes("qualid") || cleaned.includes("process") || cleaned.includes("audit") || cleaned.includes("complian")) {
    return "Qualidade & Processos";
  }
  if (cleaned.includes("jurid") || cleaned.includes("advoc") || cleaned.includes("legal")) {
    return "Jurídico";
  }

  // 3. Fallback formatado com Title Case inteligente
  return toSmartSectorTitleCase(rawTrimmed);
}

/**
 * Normaliza e padroniza o Centro de Custo para o formato "C.C XXX - Nome".
 * 
 * @param centroCusto Centro de custo bruto (ex: "101", "C.C 101", "Operações", "CC 102")
 * @param fallback Valor padrão (padrão: "C.C 101 - Operacional")
 */
export function normalizeCentroCusto(centroCusto: string | undefined | null, fallback = "C.C 101 - Operacional"): string {
  if (!centroCusto || typeof centroCusto !== "string") {
    return fallback;
  }

  const rawTrimmed = centroCusto.trim();
  if (!rawTrimmed || rawTrimmed === "-" || rawTrimmed.toLowerCase() === "n/a") {
    return fallback;
  }

  const cleaned = cleanString(rawTrimmed);

  // Mapeamento por Código Numérico
  if (cleaned.includes("101") || cleaned.includes("operac") || cleaned.includes("campo")) {
    return "C.C 101 - Operacional";
  }
  if (cleaned.includes("102") || cleaned.includes("manut") || cleaned.includes("oficin")) {
    return "C.C 102 - Manutenção / Oficina";
  }
  if (cleaned.includes("103") || cleaned.includes("logist") || cleaned.includes("transp")) {
    return "C.C 103 - Logística & Transporte";
  }
  if (cleaned.includes("104") || cleaned.includes("adm") || cleaned.includes("sede")) {
    return "C.C 104 - Administrativo / Sede";
  }
  if (cleaned.includes("105") || cleaned.includes("diretor") || cleaned.includes("execut")) {
    return "C.C 105 - Diretoria / Executivo";
  }
  if (cleaned.includes("106") || cleaned.includes("ti") || cleaned.includes("sistem") || cleaned.includes("tecnolog")) {
    return "C.C 106 - TI & Sistemas";
  }
  if (cleaned.includes("107") || cleaned.includes("comerc") || cleaned.includes("venda")) {
    return "C.C 107 - Comercial & Vendas";
  }
  if (cleaned.includes("108") || cleaned.includes("rh") || cleaned.includes("dp") || cleaned.includes("recurs")) {
    return "C.C 108 - Recursos Humanos / D.P";
  }
  if (cleaned.includes("109") || cleaned.includes("mkt") || cleaned.includes("market") || cleaned.includes("event")) {
    return "C.C 109 - Marketing & Eventos";
  }
  if (cleaned.includes("110") || cleaned.includes("frot")) {
    return "C.C 110 - Gestão de Frota";
  }
  if (cleaned.includes("111") || cleaned.includes("financ") || cleaned.includes("contab") || cleaned.includes("fiscal")) {
    return "C.C 111 - Financeiro & Controladoria";
  }
  if (cleaned.includes("112") || cleaned.includes("seguranc") || cleaned.includes("sst")) {
    return "C.C 112 - Segurança do Trabalho";
  }
  if (cleaned.includes("113") || cleaned.includes("suprim") || cleaned.includes("compr") || cleaned.includes("almox")) {
    return "C.C 113 - Suprimentos & Compras";
  }

  // Se já começar com "C.C", mantém com formatação
  if (rawTrimmed.toUpperCase().startsWith("C.C") || rawTrimmed.toUpperCase().startsWith("CC")) {
    return rawTrimmed.replace(/^CC/i, "C.C");
  }

  // Tenta mapear o setor pelo nome
  const setorNormalizado = normalizeNomeSetor(rawTrimmed, "");
  if (setorNormalizado) {
    const ccEncontrado = CENTROS_CUSTO_OFICIAIS.find(cc => cc.toLowerCase().includes(cleanString(setorNormalizado)));
    if (ccEncontrado) return ccEncontrado;
  }

  return rawTrimmed;
}
