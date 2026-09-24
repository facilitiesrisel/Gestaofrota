import firebase from "firebase/compat/app";
import { auth } from "../firebaseConfig";
import { getAccessToken, setAccessToken } from "./googleSheetsService";

// Pasta corporativa oficial do Google Drive para Sinistros da Risel Combustíveis
export const GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_ID = "1A62QNaC-5m7xMVzZtUxvXxBCHREp_jse";
export const GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_ID}?hl=pt-br`;

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  size?: number | string;
  createdTime?: string;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  webViewLink: string;
}

/**
 * Formata o nome da pasta do evento no padrão brasileiro estipulado:
 * [PLACA] - [BASE] - [DD/MM/AAAA] [HH:mm]
 * Exemplo: "BRL2E19 - Paulínia - 24/09/2026 14:30"
 */
export function formatEventFolderName(placa: string, base: string, dataHora: string): string {
  const placaLimpa = (placa || "SEM_PLACA").trim().toUpperCase();
  const baseLimpa = (base || "Geral").trim();

  let dataFormatada = "";
  let horaFormatada = "";

  if (dataHora) {
    if (dataHora.includes("T")) {
      const [d, t] = dataHora.split("T");
      if (d.includes("-")) {
        const [ano, mes, dia] = d.split("-");
        dataFormatada = `${dia}/${mes}/${ano}`;
      } else {
        dataFormatada = d;
      }
      horaFormatada = t ? t.substring(0, 5) : "";
    } else if (dataHora.includes("/")) {
      const parts = dataHora.trim().split(" ");
      dataFormatada = parts[0];
      horaFormatada = parts[1] ? parts[1].substring(0, 5) : "";
    } else {
      dataFormatada = dataHora;
    }
  }

  if (!dataFormatada) {
    dataFormatada = new Date().toLocaleDateString("pt-BR");
  }

  const horaFinal = horaFormatada ? ` ${horaFormatada}` : "";
  return `${placaLimpa} - ${baseLimpa} - ${dataFormatada}${horaFinal}`;
}

/**
 * Conecta e obtém token OAuth do Google com escopo de Google Drive
 */
export async function connectGoogleDrive(): Promise<string> {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive");
    provider.addScope("https://www.googleapis.com/auth/drive.file");

    const result = await auth.signInWithPopup(provider);
    const credential = result.credential as firebase.auth.OAuthCredential;

    if (!credential || !credential.accessToken) {
      throw new Error("Não foi possível obter o token de acesso da conta Google.");
    }

    setAccessToken(credential.accessToken);
    localStorage.setItem("google_drive_token", credential.accessToken);
    localStorage.setItem("google_drive_connected", "true");
    return credential.accessToken;
  } catch (error: any) {
    console.error("Erro ao conectar Google Drive:", error);
    throw error;
  }
}

/**
 * Obtém token válido do Google Drive
 */
export async function getValidDriveToken(): Promise<string | null> {
  const token = localStorage.getItem("google_drive_token") || getAccessToken();
  if (token) return token;
  return null;
}

/**
 * Localiza ou cria a pasta específica do sinistro dentro da pasta raiz corporativa
 */
export async function createOrGetEventFolder(
  placa: string,
  base: string,
  dataHora: string,
  token?: string | null
): Promise<GoogleDriveFolder> {
  const accessToken = token || (await getValidDriveToken());
  const folderName = formatEventFolderName(placa, base, dataHora);

  if (!accessToken) {
    // Retorna fallback simulado com URL direta caso o usuário não tenha clicado para autenticar ainda
    return {
      id: `local_${Date.now()}`,
      name: folderName,
      webViewLink: GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL
    };
  }

  try {
    // 1. Pesquisar se a pasta já existe dentro da pasta raiz
    const query = `'${GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_ID}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const found = data.files[0];
        return {
          id: found.id,
          name: found.name,
          webViewLink: found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`
        };
      }
    }

    // 2. Se não existir, cria a nova pasta dentro da pasta raiz corporativa
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_ID],
        description: `Pasta de Anexos do Sinistro: Placa ${placa} - Base ${base} - Evento em ${dataHora}`
      })
    });

    if (createRes.ok) {
      const created = await createRes.json();
      return {
        id: created.id,
        name: folderName,
        webViewLink: `https://drive.google.com/drive/folders/${created.id}`
      };
    } else {
      const err = await createRes.json().catch(() => ({}));
      console.warn("Aviso ao criar pasta no Google Drive:", err);
      return {
        id: `folder_${Date.now()}`,
        name: folderName,
        webViewLink: GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL
      };
    }
  } catch (error) {
    console.error("Falha ao criar pasta de sinistro no Google Drive:", error);
    return {
      id: `folder_${Date.now()}`,
      name: folderName,
      webViewLink: GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL
    };
  }
}

/**
 * Faz upload de um arquivo diretamente para a pasta do evento no Google Drive
 */
export async function uploadSinistroAttachmentToDrive(
  folderId: string,
  file: File,
  customName?: string,
  token?: string | null
): Promise<GoogleDriveFile> {
  const accessToken = token || (await getValidDriveToken());

  if (!accessToken) {
    throw new Error("Faça login com a conta Google corporativa para enviar anexos diretamente ao Drive.");
  }

  const targetFolder = folderId && !folderId.startsWith("local_") && !folderId.startsWith("folder_")
    ? folderId
    : GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_ID;

  const fileName = customName || file.name;
  const metadata = {
    name: fileName,
    parents: [targetFolder]
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const fileContent = reader.result;
        const multipartRequestBody =
          delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${file.type || "application/octet-stream"}\r\n` +
          "Content-Transfer-Encoding: base64\r\n\r\n" +
          (fileContent as string).split(",")[1] +
          closeDelimiter;

        const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || "Erro no upload para o Google Drive");
        }

        const data: GoogleDriveFile = await res.json();
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/**
 * Lista os arquivos contidos na pasta de um sinistro
 */
export async function listFilesInDriveFolder(folderId: string, token?: string | null): Promise<GoogleDriveFile[]> {
  const accessToken = token || (await getValidDriveToken());
  if (!accessToken || !folderId || folderId.startsWith("local_") || folderId.startsWith("folder_")) {
    return [];
  }

  try {
    const query = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size,createdTime)&pageSize=100`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    if (res.ok) {
      const data = await res.json();
      return data.files || [];
    }
    return [];
  } catch (err) {
    console.warn("Aviso ao listar arquivos da pasta do Google Drive:", err);
    return [];
  }
}
