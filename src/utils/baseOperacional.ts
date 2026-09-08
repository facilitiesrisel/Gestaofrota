/**
 * Utilitário de normalização e unificação ortográfica de Cidades e Bases Operacionais.
 * Risel Combustíveis - Garante consistência de dados em todos os módulos e submódulos.
 * Corrige e unifica variações ortográficas, ausência de acentos, abreviações, sufixos de UF e erros de digitação.
 * Exemplo: "Sao Paulo", "sao paulo", "SÃO PAULO", "São Paulo - SP", "SP" -> "São Paulo"
 * Exemplo: "Paulinia", "paulinia", "PAULINIA" -> "Paulínia"
 */

import { SP_CITIES } from "../constants_reserva";

// Mapa de correspondência direta para variações conhecidas (chave em minúsculas e sem acentos)
const CANONICAL_CITIES_MAP: Record<string, string> = {
  // Estado de São Paulo - Principais Polos e Cidades Operacionais
  "sao paulo": "São Paulo",
  "sp": "São Paulo",
  "sao paulo capital": "São Paulo",
  "capital": "São Paulo",
  "capital sp": "São Paulo",
  "sao paulo sp": "São Paulo",
  
  "paulinia": "Paulínia",
  "paulinia sp": "Paulínia",
  "paulinia matriz": "Paulínia (Matriz)",
  "matriz paulinia": "Paulínia (Matriz)",
  "matriz": "Paulínia (Matriz)",
  "filial paulinia": "Paulínia",
  "campineira": "Campineira",
  
  "campinas": "Campinas",
  "campinas sp": "Campinas",
  "aguai": "Aguaí",
  "aguai sp": "Aguaí",
  "ourinhos": "Ourinhos",
  "ourinhos sp": "Ourinhos",
  "jales": "Jales",
  "jales sp": "Jales",
  "capao bonito": "Capão Bonito",
  "capao bonito sp": "Capão Bonito",
  "cubatao": "Cubatão",
  "cubatao sp": "Cubatão",
  "asstam": "Asstam",
  "frota risel": "Frota Risel",

  "sao bernardo do campo": "São Bernardo do Campo",
  "sao bernardo": "São Bernardo do Campo",
  "sbc": "São Bernardo do Campo",
  "sao caetano do sul": "São Caetano do Sul",
  "sao caetano": "São Caetano do Sul",
  "santo andre": "Santo André",
  "ribeirao preto": "Ribeirão Preto",
  "ribeirao": "Ribeirão Preto",
  "sao jose dos campos": "São José dos Campos",
  "sjc": "São José dos Campos",
  "sao jose do rio preto": "São José do Rio Preto",
  "sjrp": "São José do Rio Preto",
  "sorocaba": "Sorocaba",
  "santos": "Santos",
  "jundiai": "Jundiaí",
  "piracicaba": "Piracicaba",
  "bauru": "Bauru",
  "taubate": "Taubaté",
  "guarulhos": "Guarulhos",
  "osasco": "Osasco",
  "barueri": "Barueri",
  "alphaville": "Barueri",
  "sumare": "Sumaré",
  "hortolandia": "Hortolândia",
  "americana": "Americana",
  "indaiatuba": "Indaiatuba",
  "limeira": "Limeira",
  "araraquara": "Araraquara",
  "franca": "Franca",
  "marilia": "Marília",
  "presidente prudente": "Presidente Prudente",
  "jacarei": "Jacareí",
  "cotia": "Cotia",
  "suzano": "Suzano",
  "mogi das cruzes": "Mogi das Cruzes",
  "mogi guacu": "Mogi Guaçu",
  "mogi mirim": "Mogi Mirim",
  "diadema": "Diadema",
  "maua": "Mauá",
  "taboao da serra": "Taboão da Serra",
  "embu das artes": "Embu das Artes",
  "itaquaquecetuba": "Itaquaquecetuba",
  "valinhos": "Valinhos",
  "vinhedo": "Vinhedo",
  "itatiba": "Itatiba",
  "itapetininga": "Itapetininga",
  "tatui": "Tatuí",
  "botucatu": "Botucatu",
  "jau": "Jaú",
  "aracatuba": "Araçatuba",
  "praia grande": "Praia Grande",
  "sao vicente": "São Vicente",
  "guaruja": "Guarujá",
  "bertioga": "Bertioga",
  "ubatuba": "Ubatuba",
  "caraguatatuba": "Caraguatatuba",
  "sao sebastiao": "São Sebastião",
  "ilhabela": "Ilhabela",
  "ilha bela": "Ilhabela",
  "salto": "Salto",
  "itu": "Itu",
  "votorantim": "Votorantim",
  "santa barbara d oeste": "Santa Bárbara d'Oeste",
  "santa barbara d'oeste": "Santa Bárbara d'Oeste",
  "santa barbara doeste": "Santa Bárbara d'Oeste",
  "aguas de lindoia": "Águas de Lindoia",
  "aguas de sao pedro": "Águas de São Pedro",

  // Outros Estados e Capitais
  "rio de janeiro": "Rio de Janeiro",
  "rj": "Rio de Janeiro",
  "rio de janeiro rj": "Rio de Janeiro",
  "duque de caxias": "Duque de Caxias",
  "niteroi": "Niterói",
  "macae": "Macaé",
  "volta redonda": "Volta Redonda",
  "campos dos goytacazes": "Campos dos Goytacazes",
  "angra dos reis": "Angra dos Reis",
  "resende": "Resende",

  "belo horizonte": "Belo Horizonte",
  "bh": "Belo Horizonte",
  "betim": "Betim",
  "contagem": "Contagem",
  "uberlandia": "Uberlândia",
  "uberaba": "Uberaba",
  "juiz de fora": "Juiz de Fora",
  "montes claros": "Montes Claros",
  "ipatinga": "Ipatinga",
  "governador valadares": "Governador Valadares",
  "pocos de caldas": "Poços de Caldas",
  "pouso alegre": "Pouso Alegre",

  "curitiba": "Curitiba",
  "cwb": "Curitiba",
  "maringa": "Maringá",
  "londrina": "Londrina",
  "cascavel": "Cascavel",
  "ponta grossa": "Ponta Grossa",
  "foz do iguacu": "Foz do Iguaçu",
  "sao jose dos pinhais": "São José dos Pinhais",

  "porto alegre": "Porto Alegre",
  "poa": "Porto Alegre",
  "caxias do sul": "Caxias do Sul",
  "canoas": "Canoas",
  "pelotas": "Pelotas",
  "santa maria": "Santa Maria",

  "florianopolis": "Florianópolis",
  "floripa": "Florianópolis",
  "joinville": "Joinville",
  "blumenau": "Blumenau",
  "chapeco": "Chapecó",
  "itajaí": "Itajaí",
  "itajai": "Itajaí",
  "criciuma": "Criciúma",

  "brasilia": "Brasília",
  "bsb": "Brasília",
  "distrito federal": "Brasília",
  "df": "Brasília",

  "goiania": "Goiânia",
  "aparecida de goiania": "Aparecida de Goiânia",
  "anapolis": "Anápolis",
  "rio verde": "Rio Verde",

  "cuiaba": "Cuiabá",
  "varzea grande": "Várzea Grande",
  "rondonopolis": "Rondonópolis",

  "campo grande": "Campo Grande",
  "dourados": "Dourados",
  "tres lagoas": "Três Lagoas",

  "salvador": "Salvador",
  "feira de santana": "Feira de Santana",
  "vitoria da conquista": "Vitória da Conquista",
  "camacari": "Camaçari",
  "itubuna": "Itabuna",
  "ilheus": "Ilhéus",

  "recife": "Recife",
  "jaboatao dos guararapes": "Jaboatão dos Guararapes",
  "olinda": "Olinda",
  "caruaru": "Caruaru",
  "petrolina": "Petrolina",

  "fortaleza": "Fortaleza",
  "caucaia": "Caucaia",
  "juazeiro do norte": "Juazeiro do Norte",
  "sobral": "Sobral",

  "manaus": "Manaus",
  "belem": "Belém",
  "anandindeua": "Ananindeua",
  "ananindeua": "Ananindeua",
  "santarem": "Santarém",

  "vitoria": "Vitória",
  "vila velha": "Vila Velha",
  "serra": "Serra",
  "cariacica": "Cariacica",

  "natal": "Natal",
  "mossoro": "Mossoró",
  "maceio": "Maceió",
  "arapiraca": "Arapiraca",
  "joao pessoa": "João Pessoa",
  "campina grande": "Campina Grande",
  "teresina": "Teresina",
  "sao luis": "São Luís",
  "imperatriz": "Imperatriz",
  "aracaju": "Aracaju",
  "porto velho": "Porto Velho",
  "macapa": "Macapá",
  "palmas": "Palmas",
  "rio branco": "Rio Branco",
  "boa vista": "Boa Vista"
};

// Constrói mapa normalizado a partir de SP_CITIES para cobertura total de municípios de SP
const SP_CITIES_NORMALIZED_MAP = new Map<string, string>();
SP_CITIES.forEach(city => {
  const normKey = city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  SP_CITIES_NORMALIZED_MAP.set(normKey, city);
});

/**
 * Converte string genérica para Title Case correto em português
 */
export function toPortugueseTitleCase(text: string): string {
  const prepositions = new Set(["de", "da", "do", "dos", "das", "e", "em", "no", "na", "nos", "nas", "com", "por"]);
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && prepositions.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Retorna uma chave de busca padronizada para comparação insensível a acentos, pontuação e maiúsculas
 */
export function getCleanSearchKey(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  let s = text.trim();
  // Remove sufixos de UF como "- SP", "/SP", "(SP)", ", SP"
  s = s.replace(/[\s\-,/(]+(sp|rj|mg|pr|sc|rs|df|go|mt|ms|ba|pe|ce|am|pa|es|rn|al|pb|pi|ma|se|ro|ap|to|ac|rr)\)?$/i, "").trim();
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza e padroniza o nome de qualquer CIDADE no sistema com ortografia oficial garantida.
 * Se for uma cidade de SP ou capital/cidade brasileira conhecida, retorna a grafia com acentos oficial.
 * Ex: "sao paulo" -> "São Paulo", "paulinia" -> "Paulínia", "campinas" -> "Campinas", "hortolandia" -> "Hortolândia"
 */
export function normalizeCidade(rawCity?: string | null, defaultFallback: string = ""): string {
  if (!rawCity || typeof rawCity !== "string") {
    return defaultFallback;
  }

  let cleaned = rawCity.trim();
  if (
    !cleaned ||
    cleaned.toUpperCase() === "N/D" ||
    cleaned.toUpperCase() === "N/A" ||
    cleaned === "-" ||
    cleaned.toUpperCase() === "NÃO INFORMADO" ||
    cleaned.toUpperCase() === "NAO INFORMADO" ||
    cleaned.toUpperCase() === "INDEFINIDO" ||
    cleaned.toUpperCase() === "INDEFINIDA"
  ) {
    return defaultFallback;
  }

  // Remove parênteses com UF, traço de UF no final (ex: "São Paulo - SP", "Paulínia/SP", "Aguaí (SP)")
  cleaned = cleaned.replace(/[\s\-,/(]+(sp|rj|mg|pr|sc|rs|df|go|mt|ms|ba|pe|ce|am|pa|es|rn|al|pb|pi|ma|se|ro|ap|to|ac|rr)\)?$/i, "").trim();
  cleaned = cleaned.replace(/[.,;:\-_/]+$/, "").trim();

  const searchKey = getCleanSearchKey(cleaned);

  // 1. Procura direta no mapa canônico
  if (CANONICAL_CITIES_MAP[searchKey]) {
    return CANONICAL_CITIES_MAP[searchKey];
  }

  // 2. Procura na lista completa de cidades de SP com acentuação oficial
  if (SP_CITIES_NORMALIZED_MAP.has(searchKey)) {
    return SP_CITIES_NORMALIZED_MAP.get(searchKey)!;
  }

  // 3. Casos parciais ou sufixos comuns
  if (searchKey.includes("sao paulo") || searchKey === "sp") {
    return "São Paulo";
  }
  if (searchKey.includes("paulinia")) {
    return "Paulínia";
  }
  if (searchKey.includes("belo horizonte") || searchKey === "bh") {
    return "Belo Horizonte";
  }
  if (searchKey.includes("rio de janeiro") || searchKey === "rj") {
    return "Rio de Janeiro";
  }
  if (searchKey.includes("brasilia") || searchKey === "distrito federal" || searchKey === "bsb") {
    return "Brasília";
  }
  if (searchKey.includes("ribeirao preto")) {
    return "Ribeirão Preto";
  }
  if (searchKey.includes("sao jose dos campos")) {
    return "São José dos Campos";
  }
  if (searchKey.includes("sao jose do rio preto")) {
    return "São José do Rio Preto";
  }
  if (searchKey.includes("ourinhos")) {
    return "Ourinhos";
  }
  if (searchKey.includes("aguai")) {
    return "Aguaí";
  }
  if (searchKey.includes("jales")) {
    return "Jales";
  }
  if (searchKey.includes("capao bonito")) {
    return "Capão Bonito";
  }
  if (searchKey.includes("cubatao")) {
    return "Cubatão";
  }

  // 4. Fallback com Title Case elegante em português
  return toPortugueseTitleCase(cleaned);
}

/**
 * Normaliza e padroniza o nome de BASE OPERACIONAL (Cidades, Matriz, Filiais Risel).
 * @param rawBase Nome bruto da base ou filial
 * @param defaultFallback Valor padrão se não informado (padrão: "Paulínia")
 */
export function normalizeBaseOperacional(rawBase?: string | null, defaultFallback: string = "Paulínia"): string {
  if (!rawBase || typeof rawBase !== "string") {
    return defaultFallback;
  }

  const cleaned = rawBase.trim();
  if (
    !cleaned ||
    cleaned.toUpperCase() === "N/D" ||
    cleaned.toUpperCase() === "N/A" ||
    cleaned === "-" ||
    cleaned.toUpperCase() === "NÃO INFORMADO" ||
    cleaned.toUpperCase() === "NAO INFORMADO" ||
    cleaned.toUpperCase() === "INDEFINIDO" ||
    cleaned.toUpperCase() === "INDEFINIDA"
  ) {
    return defaultFallback;
  }

  const key = getCleanSearchKey(cleaned);

  // Casos específicos de filiais corporativas Risel
  if (key === "matriz" || key === "paulinia matriz" || key === "matriz paulinia") {
    return "Paulínia (Matriz)";
  }
  if (key === "campineira" || key.includes("campineira")) {
    return "Campineira";
  }
  if (key === "frota risel" || key === "risel") {
    return "Frota Risel";
  }
  if (key === "asstam") {
    return "Asstam";
  }

  // Normaliza como cidade
  const normCity = normalizeCidade(cleaned, "");
  if (normCity) {
    return normCity;
  }

  return defaultFallback;
}

/**
 * Verifica se duas cidades ou bases representam o mesmo município/unidade,
 * ignorando diferenças de acentuação, maiúsculas/minúsculas e pontuação.
 */
export function isSameCityOrBase(a?: string | null, b?: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keyA = getCleanSearchKey(a);
  const keyB = getCleanSearchKey(b);
  if (keyA === keyB) return true;
  
  const normA = normalizeCidade(a);
  const normB = normalizeCidade(b);
  return normA.toLowerCase() === normB.toLowerCase();
}
