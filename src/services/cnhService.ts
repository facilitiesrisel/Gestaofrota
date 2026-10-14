/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const RAC_CNH_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1nmuczx-AwkUIlj48mj8toAdzKlJM9u9U?hl=pt-br';
export const RAC_CNH_DRIVE_FOLDER_ID = '1nmuczx-AwkUIlj48mj8toAdzKlJM9u9U';

export interface DriverCnhRecord {
  driverName: string;
  email?: string;
  phone?: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  cnhData?: string; // base64 / data URL (otimizado e leve)
  cnhDriveUrl?: string; // Link direto oficial para a CNH no Google Drive
  cnhDriveFolderUrl?: string; // Link oficial da pasta do Google Drive
  cnhDriveFileId?: string; // ID do arquivo no Google Drive
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
 * Evita armazenar strings base64 pesadas no localStorage para não estourar a memória do navegador,
 * priorizando o link da pasta do Google Drive.
 */
export function saveDriverCnhRecord(record: DriverCnhRecord): void {
  try {
    const records = getAllCnhRecords();
    
    // Padroniza nome do arquivo: CNH - [Nome do Condutor].[ext]
    const cleanName = (record.driverName || 'Condutor').trim();
    const ext = (record.fileName && record.fileName.toLowerCase().endsWith('.pdf')) ? 'pdf' : 'jpg';
    const standardizedFileName = `CNH - ${cleanName}.${ext}`;

    const safeRecord: DriverCnhRecord = {
      ...record,
      fileName: standardizedFileName,
      cnhDriveFolderUrl: RAC_CNH_DRIVE_FOLDER_URL,
      cnhDriveUrl: record.cnhDriveUrl || RAC_CNH_DRIVE_FOLDER_URL,
      // Se a imagem for maior que 80KB, limpa o base64 para evitar QuotaExceededError
      cnhData: (record.cnhData && record.cnhData.length > 80000) ? undefined : record.cnhData
    };
    
    if (safeRecord.email) {
      const emailKey = `email_${normalizeKey(safeRecord.email)}`;
      records[emailKey] = safeRecord;
    }
    
    if (safeRecord.driverName) {
      const nameKey = `name_${normalizeKey(safeRecord.driverName)}`;
      records[nameKey] = safeRecord;
    }

    localStorage.setItem(CNH_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Aviso ao salvar registro de CNH no cofre (cota prevenida):', err);
  }
}

/**
 * Migra e audita todos os registros do cofre de CNHs para a pasta oficial do Google Drive
 * removendo base64 pesado para evitar superlotação do Supabase e do localStorage.
 */
export function cleanAndMigrateVaultToGoogleDrive(): { migratedCount: number; freedBytesEstimate: number } {
  let migratedCount = 0;
  let freedBytesEstimate = 0;

  try {
    const records = getAllCnhRecords();
    const updated: Record<string, DriverCnhRecord> = {};

    Object.entries(records).forEach(([key, rec]) => {
      const cleanName = (rec.driverName || 'Condutor').trim();
      const ext = (rec.fileName && rec.fileName.toLowerCase().endsWith('.pdf')) ? 'pdf' : 'jpg';
      const standardizedFileName = `CNH - ${cleanName}.${ext}`;

      if (rec.cnhData && rec.cnhData.length > 500) {
        freedBytesEstimate += rec.cnhData.length;
        migratedCount++;
      }

      updated[key] = {
        ...rec,
        fileName: standardizedFileName,
        cnhDriveFolderUrl: RAC_CNH_DRIVE_FOLDER_URL,
        cnhDriveUrl: rec.cnhDriveUrl || RAC_CNH_DRIVE_FOLDER_URL,
        cnhData: undefined // Purga base64 pesado
      };
    });

    localStorage.setItem(CNH_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Erro ao migrar cofre de CNHs para o Google Drive:', e);
  }

  return { migratedCount, freedBytesEstimate };
}

