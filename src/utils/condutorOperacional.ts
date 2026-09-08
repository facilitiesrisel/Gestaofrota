/**
 * Utilitário de normalização e unificação do Condutor Responsável / Motorista.
 * Risel Combustíveis - Módulo de Checklist e Gestão de Frota.
 *
 * Garante que nomes digitados de forma incompleta, abreviada, sem sobrenome,
 * com letras maiúsculas/minúsculas divergentes ou sem acentos sejam unificados
 * com base no NOME COMPLETO canônico.
 */

import { VEICULOS_REAIS } from "../data/veiculos_reais";

// Conectores em português que devem ficar em minúsculo no meio do nome
const LOWERCASE_PARTICLES = new Set(["de", "da", "do", "dos", "das", "e", "del", "du", "van", "von"]);

// Mapa de correspondência canônica para variações, abreviações e nomes parciais
const CANONICAL_DRIVERS_MAP: Record<string, string> = {
  // Werllyson
  "werllyson": "Werllyson Edimilson de Carvalho",
  "werlyson": "Werllyson Edimilson de Carvalho",
  "werllyson edimilson": "Werllyson Edimilson de Carvalho",
  "werllyson carvalho": "Werllyson Edimilson de Carvalho",
  "werllyson edimilson de carvalho": "Werllyson Edimilson de Carvalho",
  "werlyson edimilson": "Werllyson Edimilson de Carvalho",

  // Ricardo Filipe
  "ricardo": "Ricardo Filipe Viana Leite Oliveira",
  "ricardo filipe": "Ricardo Filipe Viana Leite Oliveira",
  "ricardo oliveira": "Ricardo Filipe Viana Leite Oliveira",
  "ricardo viana": "Ricardo Filipe Viana Leite Oliveira",
  "ricardo leite": "Ricardo Filipe Viana Leite Oliveira",
  "ricardo filipe viana": "Ricardo Filipe Viana Leite Oliveira",
  "ricardo filipe viana leite oliveira": "Ricardo Filipe Viana Leite Oliveira",

  // Marcela Carvalho
  "marcela": "Marcela Carvalho D.",
  "marcela carvalho": "Marcela Carvalho D.",
  "marcela carvalho d": "Marcela Carvalho D.",
  "marcela carvalho d.": "Marcela Carvalho D.",
  "marcela carvalho dias": "Marcela Carvalho D.",

  // João José
  "joao jose": "João José Junqueira Puliti Júnior",
  "joao jose junqueira": "João José Junqueira Puliti Júnior",
  "joao puliti": "João José Junqueira Puliti Júnior",
  "joao junqueira": "João José Junqueira Puliti Júnior",
  "joao jose junqueira puliti junior": "João José Junqueira Puliti Júnior",
  "joao jose junqueira puliti jr": "João José Junqueira Puliti Júnior",

  // Cleiton Alexandre
  "cleiton": "Cleiton Alexandre Ribeiro Gonzaga",
  "cleiton alexandre": "Cleiton Alexandre Ribeiro Gonzaga",
  "cleiton gonzaga": "Cleiton Alexandre Ribeiro Gonzaga",
  "cleiton ribeiro": "Cleiton Alexandre Ribeiro Gonzaga",
  "cleiton alexandre ribeiro gonzaga": "Cleiton Alexandre Ribeiro Gonzaga",

  // Francisco Alexandre
  "francisco": "Francisco Alexandre Correa Franco",
  "francisco alexandre": "Francisco Alexandre Correa Franco",
  "francisco franco": "Francisco Alexandre Correa Franco",
  "francisco correa": "Francisco Alexandre Correa Franco",
  "francisco alexandre correa franco": "Francisco Alexandre Correa Franco",

  // Wagner João
  "wagner": "Wagner João Domingues de Almeida",
  "wagner joao": "Wagner João Domingues de Almeida",
  "wagner almeida": "Wagner João Domingues de Almeida",
  "wagner domingues": "Wagner João Domingues de Almeida",
  "wagner joao domingues de almeida": "Wagner João Domingues de Almeida",

  // Moisés Guimarães / Moisés Silva
  "moises guimaraes": "Moisés Guimarães Pereira",
  "moises guimaraes pereira": "Moisés Guimarães Pereira",
  "moises silva": "Moisés Silva de Almeida",
  "moises silva de almeida": "Moisés Silva de Almeida",

  // José ...
  "jose alexandre": "José Alexandre de Amorim",
  "jose amorim": "José Alexandre de Amorim",
  "jose alexandre de amorim": "José Alexandre de Amorim",

  "jose antunes": "José Antunes Bernardes Neto",
  "jose bernardes": "José Antunes Bernardes Neto",
  "jose antunes bernardes neto": "José Antunes Bernardes Neto",

  "jose aparecido": "José Aparecido Roris",
  "jose roris": "José Aparecido Roris",
  "jose aparecido roris": "José Aparecido Roris",

  "jose benedito": "José Benedito Castro",
  "jose castro": "José Benedito Castro",
  "jose benedito castro": "José Benedito Castro",

  "jose fernando": "José Fernando Justo",
  "jose justo": "José Fernando Justo",
  "jose fernando justo": "José Fernando Justo",

  // Paulo Fernandes
  "paulo fernandes": "Paulo Fernandes da Cruz",
  "paulo cruz": "Paulo Fernandes da Cruz",
  "paulo fernandes da cruz": "Paulo Fernandes da Cruz",

  // Rogério de Morais / Rogério Fuchs
  "rogerio morais": "Rogério de Morais Silva",
  "rogerio de morais": "Rogério de Morais Silva",
  "rogerio de morais silva": "Rogério de Morais Silva",
  "rogerio fuchs": "Rogério Fuchs de Jesus",
  "rogerio fuchs de jesus": "Rogério Fuchs de Jesus",

  // Wander Guimarães
  "wander": "Wander Guimarães Bandeira",
  "wander guimaraes": "Wander Guimarães Bandeira",
  "wander bandeira": "Wander Guimarães Bandeira",
  "wander guimaraes bandeira": "Wander Guimarães Bandeira",

  // Alexandre das Dores / Alexandre Stievano
  "alexandre das dores": "Alexandre das Dores Alves",
  "alexandre dores": "Alexandre das Dores Alves",
  "alexandre das dores alves": "Alexandre das Dores Alves",
  "alexandre stievano": "Alexandre Stievano",

  // Anderson Vaz / Anderson Kuasne
  "anderson vaz": "Anderson Luiz Vaz",
  "anderson luiz vaz": "Anderson Luiz Vaz",
  "anderson kuasne": "Anderson Vieira Kuasne",
  "anderson vieira kuasne": "Anderson Vieira Kuasne",

  // Antonio Vieira Davis
  "antonio davis": "Antonio Vieira Davis",
  "antonio vieira davis": "Antonio Vieira Davis",

  // Amaurir Bueno
  "amaurir": "Amaurir Bueno de Godoy",
  "amaurir bueno": "Amaurir Bueno de Godoy",
  "amaurir bueno de godoy": "Amaurir Bueno de Godoy",

  // Bruno Buzxolin Pegorer
  "bruno buzxolin": "Bruno Buzxolin Pegorer",
  "bruno pegorer": "Bruno Buzxolin Pegorer",
  "bruno buzxolin pegorer": "Bruno Buzxolin Pegorer",

  // Celso Oliveira
  "celso oliveira": "Celso Oliveira",

  // Cesar Henrique
  "cesar henrique": "Cesar Henrique",

  // Claudinei Santiago
  "claudinei": "Claudinei Santiago",
  "claudinei santiago": "Claudinei Santiago",

  // Claudio da Silva Prado
  "claudio prado": "Claudio da Silva Prado",
  "claudio da silva prado": "Claudio da Silva Prado",

  // Cristiano Alexandre da Silva
  "cristiano silva": "Cristiano Alexandre da Silva",
  "cristiano alexandre da silva": "Cristiano Alexandre da Silva",

  // Ederson Alberto Figueiredo
  "ederson": "Ederson Alberto Figueiredo",
  "ederson figueiredo": "Ederson Alberto Figueiredo",
  "ederson alberto figueiredo": "Ederson Alberto Figueiredo",

  // Fabiano Cesario Cavassan
  "fabiano": "Fabiano Cesario Cavassan",
  "fabiano cavassan": "Fabiano Cesario Cavassan",
  "fabiano cesario cavassan": "Fabiano Cesario Cavassan",

  // Felipe Vieira
  "felipe vieira": "Felipe Vieira",

  // Gabriela
  "gabriela": "Gabriela",

  // Guilherme Abreu
  "guilherme abreu": "Guilherme Abreu",

  // Heidy Emanuela
  "heidy emanuela": "Heidy Emanuela",

  // Joaquim Marinho
  "joaquim marinho": "Joaquim Marinho",

  // Jorge Siqueira
  "jorge siqueira": "Jorge Siqueira",

  // Leonardo Henrique
  "leonardo henrique": "Leonardo Henrique",

  // Lucas Daniel
  "lucas daniel": "Lucas Daniel",

  // Luciano José do Nascimento
  "luciano nascimento": "Luciano José do Nascimento",
  "luciano jose do nascimento": "Luciano José do Nascimento",

  // Marcos Paulo Zuccari
  "marcos zuccari": "Marcos Paulo Zuccari",
  "marcos paulo": "Marcos Paulo Zuccari",
  "marcos paulo zuccari": "Marcos Paulo Zuccari",

  // Mário Luis Borgonovi
  "mario borgonovi": "Mário Luis Borgonovi",
  "mario luis borgonovi": "Mário Luis Borgonovi",

  // Michel de Moraes Ribeiro
  "michel ribeiro": "Michel de Moraes Ribeiro",
  "michel de moraes ribeiro": "Michel de Moraes Ribeiro",

  // Otavio Dinalli
  "otavio dinalli": "Otavio Dinalli",

  // Rafael Dornelas Cruz / Rafael Monteiro Alves
  "rafael dornelas": "Rafael Dornelas Cruz",
  "rafael dornelas cruz": "Rafael Dornelas Cruz",
  "rafael monteiro": "Rafael Monteiro Alves",
  "rafael monteiro alves": "Rafael Monteiro Alves",

  // Robson Rodrigues
  "robson rodrigues": "Robson Rodrigues",

  // Sandro Oliveira
  "sandro oliveira": "Sandro Oliveira",

  // Silvio Antonio da Cruz
  "silvio cruz": "Silvio Antonio da Cruz",
  "silvio antonio da cruz": "Silvio Antonio da Cruz",

  // Tiago Borges
  "tiago borges": "Tiago Borges",

  // Valdecir
  "valdecir": "Valdecir",
  "valdecir de": "Valdecir",
  "valdecir (de)": "Valdecir",

  // Valter Antonio da Silva
  "valter silva": "Valter Antonio da Silva",
  "valter antonio da silva": "Valter Antonio da Silva",

  // Welington Rostelato
  "welington": "Welington Rostelato",
  "welington rostelato": "Welington Rostelato",

  // Willians Rodrigues
  "willians": "Willians Rodrigues",
  "willians rodrigues": "Willians Rodrigues"
};

/**
 * Remove acentos e normaliza para caixa baixa para comparações robustas.
 */
export function removeAccents(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Formata um nome em Title Case seguindo as regras da língua portuguesa
 * (mantendo partículas de/da/do/dos/das/e em minúsculo).
 */
export function toTitleCase(name: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      // Não capitalizar conectores a menos que seja a primeira palavra
      if (index > 0 && LOWERCASE_PARTICLES.has(lower)) {
        return lower;
      }
      // Trata sufixos como Jr, Jr., D., etc.
      if (lower === "jr" || lower === "jr.") return "Jr.";
      if (lower === "d" || lower === "d.") return "D.";
      if (lower === "neto") return "Neto";
      if (lower === "filho") return "Filho";
      if (lower === "sobrinho") return "Sobrinho";
      if (lower === "junior" || lower === "júnior") return "Júnior";

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Valida se um valor de condutor é apenas um placeholder ou valor nulo.
 */
export function isInvalidDriverName(name?: string): boolean {
  if (!name) return true;
  const clean = removeAccents(name);
  if (!clean || clean === "-" || clean === "--" || clean === "---") return true;
  if (
    clean === "n/d" ||
    clean === "nd" ||
    clean === "n/a" ||
    clean === "na" ||
    clean === "nao informado" ||
    clean === "sem condutor" ||
    clean === "sem motorista" ||
    clean === "condutor" ||
    clean === "motorista" ||
    clean === "vago" ||
    clean === "devolvido" ||
    clean === "operacao pln" ||
    clean.startsWith("fiat/") ||
    clean.startsWith("fiorino/")
  ) {
    return true;
  }
  return false;
}

// Lista base de condutores cadastrados estaticamente para busca sem recursão
const STATIC_KNOWN_DRIVERS: string[] = Array.from(
  new Set(
    VEICULOS_REAIS.map(v => v.condutor)
      .filter(c => c && !isInvalidDriverName(c))
      .map(c => {
        const key = removeAccents(c);
        return CANONICAL_DRIVERS_MAP[key] || toTitleCase(c);
      })
  )
);

/**
 * Extrai todos os nomes completos cadastrados na frota e no sistema (sem recursão).
 */
export function getRegisteredFleetDrivers(vehicles?: any[]): string[] {
  const driverSet = new Set<string>(STATIC_KNOWN_DRIVERS);

  if (vehicles && Array.isArray(vehicles)) {
    vehicles.forEach(v => {
      const raw = v.condutor || (v as any).motorista;
      if (raw && !isInvalidDriverName(raw)) {
        const key = removeAccents(raw);
        const canonical = CANONICAL_DRIVERS_MAP[key] || toTitleCase(raw);
        driverSet.add(canonical);
      }
    });
  }

  return Array.from(driverSet).filter(Boolean);
}

/**
 * Função principal de normalização de nome de condutor:
 * Converte nomes parciais, abreviados ou com variações ortográficas
 * para o NOME COMPLETO canônico como base.
 *
 * @param rawName Nome bruto informado ou extraído do checklist
 * @param vehiclePlate Placa do veículo associado (opcional para desambiguação contextual)
 * @param vehicles Lista de veículos da frota (opcional)
 */
export function normalizeNomeCondutor(
  rawName?: string,
  vehiclePlate?: string,
  vehicles?: any[]
): string {
  // Caso 1: Nome ausente ou vazio
  if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
    if (vehiclePlate) {
      const cleanPlate = vehiclePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
      let vehicleCondutor: string | undefined;

      if (vehicles && Array.isArray(vehicles)) {
        const found = vehicles.find(v => v.placa && v.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanPlate);
        if (found && (found.condutor || found.motorista)) {
          vehicleCondutor = found.condutor || found.motorista;
        }
      }

      if (!vehicleCondutor) {
        const foundReal = VEICULOS_REAIS.find(v => v.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanPlate);
        if (foundReal && foundReal.condutor) {
          vehicleCondutor = foundReal.condutor;
        }
      }

      if (vehicleCondutor && !isInvalidDriverName(vehicleCondutor)) {
        const vKey = removeAccents(vehicleCondutor);
        return CANONICAL_DRIVERS_MAP[vKey] || toTitleCase(vehicleCondutor);
      }
    }
    return "Não Informado";
  }

  let cleaned = rawName.trim();

  // Remove prefixos comuns como "Condutor: ", "Motorista: ", "Nome: ", etc.
  cleaned = cleaned.replace(/^(condutor|motorista|recebido\s*por|entregue\s*por|nome)\s*[:\-–]\s*/i, "").trim();

  if (isInvalidDriverName(cleaned)) {
    if (vehiclePlate) {
      const cleanPlate = vehiclePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
      let vehicleCondutor: string | undefined;

      if (vehicles && Array.isArray(vehicles)) {
        const found = vehicles.find(v => v.placa && v.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanPlate);
        if (found && (found.condutor || found.motorista)) {
          vehicleCondutor = found.condutor || found.motorista;
        }
      }

      if (!vehicleCondutor) {
        const foundReal = VEICULOS_REAIS.find(v => v.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanPlate);
        if (foundReal && foundReal.condutor) {
          vehicleCondutor = foundReal.condutor;
        }
      }

      if (vehicleCondutor && !isInvalidDriverName(vehicleCondutor)) {
        const vKey = removeAccents(vehicleCondutor);
        return CANONICAL_DRIVERS_MAP[vKey] || toTitleCase(vehicleCondutor);
      }
    }
    return "Não Informado";
  }

  const normalizedKey = removeAccents(cleaned);

  // 1. Verificação direta no dicionário canônico
  if (CANONICAL_DRIVERS_MAP[normalizedKey]) {
    return CANONICAL_DRIVERS_MAP[normalizedKey];
  }

  // 2. Se temos placa informada, verifica se o motorista do veículo combina com o texto digitado
  if (vehiclePlate) {
    const cleanPlate = vehiclePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let vehicleCondutor: string | undefined;

    if (vehicles && Array.isArray(vehicles)) {
      const found = vehicles.find(v => v.placa && v.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanPlate);
      if (found && (found.condutor || found.motorista)) {
        vehicleCondutor = found.condutor || found.motorista;
      }
    }

    if (!vehicleCondutor) {
      const foundReal = VEICULOS_REAIS.find(v => v.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanPlate);
      if (foundReal && foundReal.condutor) {
        vehicleCondutor = foundReal.condutor;
      }
    }

    if (vehicleCondutor && !isInvalidDriverName(vehicleCondutor)) {
      const vNormKey = removeAccents(vehicleCondutor);
      if (vNormKey.includes(normalizedKey) || normalizedKey.includes(vNormKey)) {
        return CANONICAL_DRIVERS_MAP[vNormKey] || toTitleCase(vehicleCondutor);
      }
    }
  }

  // 3. Busca por correspondência nos condutores conhecidos (sem chamadas recursivas)
  for (const driver of STATIC_KNOWN_DRIVERS) {
    const driverKey = removeAccents(driver);
    if (driverKey === normalizedKey) {
      return driver;
    }
  }

  // 4. Busca por tokens/palavras: se o usuário digitou primeiro nome ou primeiro+sobrenome
  const inputWords = normalizedKey.split(/\s+/).filter(w => w.length > 2 && !LOWERCASE_PARTICLES.has(w));
  if (inputWords.length > 0) {
    const candidates = STATIC_KNOWN_DRIVERS.filter(driver => {
      const driverWords = removeAccents(driver).split(/\s+/);
      return inputWords.every(word => driverWords.some(dw => dw.startsWith(word) || dw === word));
    });

    if (candidates.length === 1) {
      return candidates[0];
    }
  }

  // 5. Formata o nome em Title Case padrão
  return toTitleCase(cleaned);
}

/**
 * Compara se dois nomes de condutor referem-se à mesma pessoa
 * (mesmo com variações de grafia, abreviação ou ausência de sobrenome).
 */
export function isSameDriver(
  driverA?: string,
  driverB?: string,
  vehicles?: any[]
): boolean {
  if (!driverA || !driverB) return false;
  if (isInvalidDriverName(driverA) || isInvalidDriverName(driverB)) return false;

  const keyA = removeAccents(driverA);
  const keyB = removeAccents(driverB);

  if (keyA === keyB) return true;

  const normA = normalizeNomeCondutor(driverA, undefined, vehicles);
  const normB = normalizeNomeCondutor(driverB, undefined, vehicles);

  if (normA.toLowerCase() === normB.toLowerCase()) {
    return true;
  }

  const normKeyA = removeAccents(normA);
  const normKeyB = removeAccents(normB);

  if (normKeyA === normKeyB) return true;

  // Se um contém o outro com mais de 4 caracteres
  if (keyA.length >= 4 && keyB.length >= 4) {
    if (keyA.includes(keyB) || keyB.includes(keyA)) {
      return true;
    }
  }

  return false;
}
