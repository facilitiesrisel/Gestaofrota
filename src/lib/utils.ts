import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte um texto para o estilo Capitalização de Título (Title Case em Português)
 * Exemplo: "CAMPINEIRA" -> "Campineira", "FIAT MOBI" -> "Fiat Mobi", "SILVIO DE SOUZA" -> "Silvio de Souza"
 */
export function toTitleCase(str: string | undefined | null): string {
  if (!str) return "";
  const clean = String(str).trim();
  if (!clean) return "";

  // Se for código de placa (ex: ABC1D23 ou ABC1234), mantém maiúsculo
  const isPlate = /^[A-Za-z]{3}[0-9][A-Za-z0-9][0-9]{2}$/.test(clean.replace(/[^a-zA-Z0-9]/g, ''));
  if (isPlate) {
    return clean.toUpperCase();
  }

  const lowercaseWords = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "por", "a", "o", "as", "os", "na", "no", "nas", "nos"]);
  const uppercaseWords = new Set([
    "EC", "UF", "KM", "R$", "BR", "SP", "RJ", "MG", "ES", "PR", "SC", "RS", "BA", "PE", "CE", "PA", "GO", "MA", "PB", "AM", "RN", "AL", "PI", "MT", "MS", "DF", "SE", "RO", "TO", "AC", "AP", "RR"
  ]);

  return clean
    .split(/(\s+|-|\/)/) // Preserva espaços e separadores como hífen e barra
    .map((part, idx) => {
      if (!part || /^\s+|-|\/$/.test(part)) return part;

      const upperPart = part.toUpperCase();
      if (uppercaseWords.has(upperPart)) {
        return upperPart;
      }

      const lowerPart = part.toLowerCase();
      if (idx > 0 && lowercaseWords.has(lowerPart)) {
        return lowerPart;
      }

      return lowerPart.charAt(0).toUpperCase() + lowerPart.slice(1);
    })
    .join("");
}

/**
 * Formata nomes próprios de pessoas para o padrão estrito "Nome Sobrenome" (Capitalização Correta Brasileira).
 * Mantém preposições em minúsculas (de, da, do, das, dos, e) e capitaliza nomes próprios.
 * Exemplo: "JOÃO DA SILVA" -> "João da Silva", "lucas e silva" -> "Lucas e Silva"
 */
export function formatNomeProprio(name: string | undefined | null): string {
  if (!name) return "";
  const clean = String(name).trim();
  if (!clean) return "";

  const preposicoes = new Set(["de", "da", "do", "das", "dos", "e", "d'"]);
  const algarismosRomanos = new Set(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
  const palavras = clean.split(/\s+/);

  return palavras
    .map((palavra, index) => {
      if (!palavra) return "";
      const upper = palavra.toUpperCase();
      if (algarismosRomanos.has(upper)) {
        return upper;
      }
      const lower = palavra.toLowerCase();
      if (lower.startsWith("d'") && lower.length > 2) {
        return "d'" + lower.charAt(2).toUpperCase() + lower.slice(3);
      }
      if (index > 0 && preposicoes.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .filter(Boolean)
    .join(" ");
}

