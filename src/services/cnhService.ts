/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DriverCnhRecord {
  driverName: string;
  email?: string;
  phone?: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  cnhData?: string; // base64 / data URL
  uploadDate: string; // ISO date string
  lastRacProtocol?: string;
}

const CNH_STORAGE_KEY = 'risel_driver_cnh_vault';

/**
 * Recupera todos os registros de CNH salvos
 */
export function getAllCnhRecords(): Record<string, DriverCnhRecord> {
  try {
    const raw = localStorage.getItem(CNH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Erro ao ler registros de CNH do cofre:', err);
  }
  return {};
}

/**
 * Normaliza chave de identificação (e-mail ou nome)
 */
function normalizeKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Verifica se o condutor ou solicitante já possui CNH cadastrada no sistema
 */
export function checkDriverCnhStatus(
  email?: string,
  driverName?: string
): { hasCnh: boolean; cnhRecord?: DriverCnhRecord } {
  const records = getAllCnhRecords();

  const cleanEmail = email ? normalizeKey(email) : '';
  const cleanName = driverName ? normalizeKey(driverName) : '';

  // 1. Busca por e-mail no cofre de CNHs
  if (cleanEmail && records[`email_${cleanEmail}`]) {
    return { hasCnh: true, cnhRecord: records[`email_${cleanEmail}`] };
  }

  // 2. Busca por nome do condutor no cofre de CNHs
  if (cleanName && records[`name_${cleanName}`]) {
    return { hasCnh: true, cnhRecord: records[`name_${cleanName}`] };
  }

  // 3. Busca nas locações RAC em fallback_rac_rentals caso ainda não conste no cofre específico
  try {
    const fallbackRac = localStorage.getItem('fallback_rac_rentals');
    if (fallbackRac) {
      const parsed = JSON.parse(fallbackRac);
      if (Array.isArray(parsed)) {
        const match = parsed.find((r: any) => {
          const rEmail = normalizeKey(r.requesterEmail || r.email || '');
          const rDriver = normalizeKey(r.driverName || r.condutor || '');
          const hasCopy = r.hasCnhCopy || !!r.cnhFileName || !!r.cnhBase64;
          return hasCopy && ((cleanEmail && rEmail === cleanEmail) || (cleanName && rDriver === cleanName));
        });

        if (match) {
          const record: DriverCnhRecord = {
            driverName: match.driverName || match.condutor || driverName || '',
            email: match.requesterEmail || match.email || email || '',
            fileName: match.cnhFileName || 'CNH_Cadastrada.pdf',
            cnhData: match.cnhBase64,
            uploadDate: match.cnhUploadDate ? new Date(match.cnhUploadDate).toISOString() : new Date().toISOString(),
            lastRacProtocol: match.protocolNumber || match.reservationNumber
          };
          // Salva para consultas rápidas subsequentes
          saveDriverCnhRecord(record);
          return { hasCnh: true, cnhRecord: record };
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao checar CNH em fallback_rac_rentals:', err);
  }

  return { hasCnh: false };
}

/**
 * Salva ou atualiza o registro de CNH de um condutor/solicitante
 */
export function saveDriverCnhRecord(record: DriverCnhRecord): void {
  try {
    const records = getAllCnhRecords();
    
    if (record.email) {
      const emailKey = `email_${normalizeKey(record.email)}`;
      records[emailKey] = record;
    }
    
    if (record.driverName) {
      const nameKey = `name_${normalizeKey(record.driverName)}`;
      records[nameKey] = record;
    }

    localStorage.setItem(CNH_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Erro ao salvar registro de CNH:', err);
  }
}
