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
          const stdName = match.cnhFileName || `CNH - ${match.driverName || driverName || 'Condutor'}.jpg`;
          const record: DriverCnhRecord = {
            driverName: match.driverName || match.condutor || driverName || '',
            email: match.requesterEmail || match.email || email || '',
            fileName: stdName,
            cnhData: match.cnhBase64 || `/api/rac/cnh/${encodeURIComponent(stdName)}`,
            uploadDate: match.cnhUploadDate ? new Date(match.cnhUploadDate).toISOString() : new Date().toISOString(),
            lastRacProtocol: match.protocolNumber || match.reservationNumber
          };
          saveDriverCnhRecord(record);
          return { hasCnh: true, cnhRecord: record };
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao checar CNH em fallback_rac_rentals:', err);
  }

  // 4. Busca no Controle de Frota Leve (risel_frota_veiculos_v2)
  try {
    const rawFrota = localStorage.getItem('risel_frota_veiculos_v2');
    if (rawFrota) {
      const parsed = JSON.parse(rawFrota);
      if (Array.isArray(parsed)) {
        const vMatch = parsed.find((v: any) => {
          const vEmail = normalizeKey(v.email || '');
          const vCond = normalizeKey(v.condutor || '');
          const hasCnh = Boolean(v.cnhNomeArquivo || (v.cnhAnexoBase64 && (v.cnhAnexoBase64.startsWith('data:') || v.cnhNomeArquivo)) || v.cnhNumero || v.cnhValidade);
          return hasCnh && ((cleanEmail && vEmail === cleanEmail) || (cleanName && vCond === cleanName));
        });
        if (vMatch) {
          const cleanP = String(vMatch.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const record: DriverCnhRecord = {
            driverName: vMatch.condutor || driverName || '',
            email: vMatch.email || email || '',
            fileName: vMatch.cnhNomeArquivo || `CNH_${cleanP}.pdf`,
            cnhData: (vMatch.cnhAnexoBase64 && vMatch.cnhAnexoBase64.startsWith('data:')) ? vMatch.cnhAnexoBase64 : `/api/cnh/${cleanP}`,
            uploadDate: new Date().toISOString()
          };
          return { hasCnh: true, cnhRecord: record };
        }
      }
    }
  } catch (_) {}

  return { hasCnh: false };
}

/**
 * Busca unificada de CNH por condutor, e-mail ou placa em todo o ecossistema (Cofre RAC, Frota Leve e Servidor)
 */
export function findDriverCnhInVaultOrFleet(
  driverName?: string,
  email?: string,
  plate?: string
): { hasCnh: boolean; url: string; fileName: string; condutor: string; placa: string } {
  const cleanPlate = String(plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanDriver = (driverName || '').trim();

  // 1. Checa por placa ou condutor na Frota Leve
  try {
    const rawFrota = localStorage.getItem('risel_frota_veiculos_v2');
    if (rawFrota) {
      const parsed = JSON.parse(rawFrota);
      if (Array.isArray(parsed)) {
        const normDriver = normalizeKey(cleanDriver);
        const byDriverOrPlate = parsed.find((v: any) => {
          const p = String(v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const c = normalizeKey(v.condutor || '');
          if (normDriver && c === normDriver && (v.cnhAnexoBase64 || v.cnhNomeArquivo)) return true;
          if (cleanPlate && p === cleanPlate && (v.cnhAnexoBase64 || v.cnhNomeArquivo)) return true;
          return false;
        });
        if (byDriverOrPlate) {
          const p = String(byDriverOrPlate.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const url = (byDriverOrPlate.cnhAnexoBase64 && byDriverOrPlate.cnhAnexoBase64.startsWith('data:'))
            ? byDriverOrPlate.cnhAnexoBase64
            : `/api/cnh/${p}`;
          return {
            hasCnh: true,
            url,
            fileName: byDriverOrPlate.cnhNomeArquivo || `CNH - ${byDriverOrPlate.condutor || p}.pdf`,
            condutor: byDriverOrPlate.condutor || cleanDriver || 'Condutor',
            placa: p
          };
        }
      }
    }
  } catch (_) {}

  // 2. Checa no cofre de CNHs / RAC
  const status = checkDriverCnhStatus(email, cleanDriver);
  if (status.hasCnh && status.cnhRecord) {
    const rec = status.cnhRecord;
    const url = (rec.cnhData && (rec.cnhData.startsWith('data:') || rec.cnhData.startsWith('/api/')))
      ? rec.cnhData
      : `/api/cnh/resolve?condutor=${encodeURIComponent(rec.driverName || cleanDriver)}&nome=${encodeURIComponent(rec.fileName || '')}&placa=${encodeURIComponent(cleanPlate)}`;
    return {
      hasCnh: true,
      url,
      fileName: rec.fileName || `CNH - ${rec.driverName || cleanDriver}.pdf`,
      condutor: rec.driverName || cleanDriver || 'Condutor',
      placa: cleanPlate
    };
  }

  // 3. Fallback para rota de resolução dinâmica do servidor
  const fallbackUrl = `/api/cnh/resolve?condutor=${encodeURIComponent(cleanDriver)}&placa=${encodeURIComponent(cleanPlate)}`;
  return {
    hasCnh: false,
    url: fallbackUrl,
    fileName: cleanDriver ? `CNH - ${cleanDriver}.pdf` : `CNH_${cleanPlate || 'Condutor'}.pdf`,
    condutor: cleanDriver || 'Condutor',
    placa: cleanPlate
  };
}

/**
 * Salva ou atualiza o registro de CNH de um condutor/solicitante
 */
export function saveDriverCnhRecord(record: DriverCnhRecord): void {
  try {
    const records = getAllCnhRecords();
    
    const cleanName = (record.driverName || 'Condutor').trim();
    const ext = (record.fileName && record.fileName.toLowerCase().endsWith('.pdf')) ? 'pdf' : 'jpg';
    const standardizedFileName = record.fileName || `CNH - ${cleanName}.${ext}`;
    const serverFallbackUrl = `/api/rac/cnh/${encodeURIComponent(standardizedFileName)}`;

    const safeRecord: DriverCnhRecord = {
      ...record,
      fileName: standardizedFileName,
      cnhDriveFolderUrl: RAC_CNH_DRIVE_FOLDER_URL,
      cnhDriveUrl: record.cnhDriveUrl || serverFallbackUrl,
      // Preserva base64 até 650KB no cofre local ou usa a URL direta do servidor
      cnhData: (record.cnhData && record.cnhData.length > 650000) ? serverFallbackUrl : (record.cnhData || serverFallbackUrl)
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
    console.warn('Aviso ao salvar registro de CNH no cofre:', err);
  }
}

/**
 * Sincroniza o cofre de CNHs preservando a capacidade de visualização interna
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
      const standardizedFileName = rec.fileName || `CNH - ${cleanName}.${ext}`;
      const serverUrl = `/api/rac/cnh/${encodeURIComponent(standardizedFileName)}`;

      updated[key] = {
        ...rec,
        fileName: standardizedFileName,
        cnhDriveFolderUrl: RAC_CNH_DRIVE_FOLDER_URL,
        cnhDriveUrl: rec.cnhDriveUrl || serverUrl,
        cnhData: rec.cnhData || serverUrl
      };
    });

    localStorage.setItem(CNH_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Erro ao sincronizar cofre de CNHs:', e);
  }

  return { migratedCount, freedBytesEstimate };
}

