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

