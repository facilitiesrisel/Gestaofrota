import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { auth, db } from '../firebaseConfig';
import { Vehicle, Reservation, ReservationStatus, DailyTrip, FuelLevel, RacRental } from '../types_reserva';

export { auth }; // Re-export auth for other modules to use

// Helper to safely convert Firestore Timestamps or date strings to JS Date objects.
const convertFirestoreDate = (dateValue: any): Date => {
  if (!dateValue) {
    console.warn('Received a null or undefined required date value from Firestore. Returning a default date.');
    return new Date('1970-01-01T00:00:00Z');
  }
  if (dateValue && typeof dateValue.toDate === 'function') { // Firestore Timestamp
    return dateValue.toDate();
  }
  if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    return new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
  }
  if (dateValue instanceof Date) { // Already a Date
    return dateValue;
  }
  const parsedDate = new Date(dateValue); // String or number
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate;
  }
  console.error('Could not parse required date value from Firestore, returning default:', dateValue);
  return new Date('1970-01-01T00:00:00Z');
};

// Helper for optional dates, returning undefined if invalid.
const convertOptionalFirestoreDate = (dateValue: any): Date | undefined => {
    if (!dateValue) {
        return undefined;
    }
    
    let parsedDate: Date;

    if (dateValue && typeof dateValue.toDate === 'function') { 
      parsedDate = dateValue.toDate();
    } else if (dateValue && typeof dateValue.seconds === 'number') {
      parsedDate = new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000);
    } else if (dateValue instanceof Date) { 
      parsedDate = dateValue;
    } else {
      parsedDate = new Date(dateValue);
    }

    // Filter out invalid dates AND Epoch dates (often defaults in legacy data)
    if (isNaN(parsedDate.getTime()) || parsedDate.getFullYear() <= 1970) {
      return undefined;
    }
    
    return parsedDate;
};

// Helper function to remove undefined fields from an object recursively.
// Firestore throws an error if you try to save 'undefined'.
const removeUndefined = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }

  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    } else {
      newObj[key] = removeUndefined(newObj[key]);
    }
  });
  return newObj;
};


// --- Funções de Autenticação ---
export const resetPassword = async (email: string): Promise<void> => {
    try {
        await auth.sendPasswordResetEmail(email);
    } catch (error: any) {
        console.error("Error sending password reset email:", error);
        if (error.code === 'auth/invalid-email') {
            throw new Error("O formato do e-mail fornecido é inválido. Verifique e tente novamente.");
        }
        throw new Error("Não foi possível enviar o e-mail de redefinição. Por favor, tente novamente mais tarde.");
    }
};

const vehiclesCollection = db.collection('vehicles');
const reservationsCollection = db.collection('reservations');
const dailyUseCollection = db.collection('dailyUse');
const racRentalsCollection = db.collection('racRentals');

// --- Funções de Notificação por E-mail ---

// Helper para escolher ícone baseado no label
const getIconForLabel = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('veículo') || l.includes('veiculo') || l.includes('carro')) return '🚗'; 
    if (l.includes('motorista') || l.includes('solicitante') || l.includes('nome')) return '👤'; 
    if (l.includes('departamento') || l.includes('setor')) return '🏢'; 
    if (l.includes('data') || l.includes('saída') || l.includes('retorno') || l.includes('período') || l.includes('horário')) return '📅'; 
    if (l.includes('destino') || l.includes('local') || l.includes('cidade')) return '📍'; 
    if (l.includes('motivo') || l.includes('status') || l.includes('observação')) return '📝'; 
    if (l.includes('km') || l.includes('distancia')) return '⚡'; 
    if (l.includes('tanque') || l.includes('combustível')) return '⛽'; 
    return '🔹'; 
};

// Gera o HTML para o e-mail com o novo design
export const generateEmailHtml = (
    title: string, 
    details: { label: string, value: string }[], 
    highlightColor: string = '#00753f', // Usado para botões/destaques secundários
    actionLink?: string, // Link opcional para botão de ação
    introText?: string, // Texto introdutório
    footerText?: string, // Texto de rodapé/orientação extra
    borderColor: string = '#eeeeee', // Cor da borda da tabela
    mapImageUrl?: string // URL da imagem estática do mapa (opcional)
) => {
    
    // Construção das linhas da tabela
    const rows = details.map(d => {
        const icon = getIconForLabel(d.label);
        return `
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid ${borderColor}; color: #555555; font-weight: bold; width: 40%; font-size: 13px; vertical-align: middle; background-color: #fcfcfc;">
                <span style="margin-right: 8px; font-size: 16px;">${icon}</span>${d.label}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid ${borderColor}; color: #222222; font-size: 14px; vertical-align: middle;">${d.value}</td>
        </tr>
    `}).join('');

    // Botão com target_blank e fallback de texto simples para garantir acesso
    const buttonHtml = actionLink ? `
        <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
            <a href="${actionLink}" target="_blank" style="background-color: #00753f; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block; cursor: pointer; border-bottom: 3px solid #005a30;">
                📥 Acessar Sistema
            </a>
            <div style="margin-top: 15px; font-size: 12px; color: #666; background-color: #f9f9f9; padding: 10px; border-radius: 4px; word-break: break-all;">
                Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:<br/>
                <a href="${actionLink}" style="color: #00753f; text-decoration: underline;">${actionLink}</a>
            </div>
        </div>
    ` : '';

    const mapHtml = mapImageUrl ? `
        <div style="margin-top: 20px; text-align: center; border: 1px solid #ddd; padding: 5px; background: #fff; border-radius: 8px;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Registro de Deslocamento</p>
            <img src="${mapImageUrl}" alt="Mapa do deslocamento" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 0 auto;" />
        </div>
    ` : '';

    const introHtml = introText ? `
        <p style="color: #444; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${introText}</p>
    ` : '';

    const footerHtml = footerText ? `
        <div style="background-color: #fff8e1; border-left: 4px solid #ffca28; color: #8d6e04; padding: 15px; border-radius: 4px; margin-top: 25px; font-size: 13px; line-height: 1.5;">
            <strong style="display:block; margin-bottom:5px; font-size: 14px;">⚠️ Importante:</strong>
            ${footerText}
        </div>
    ` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
            .email-wrapper { width: 100%; background-color: #f4f4f4; padding: 20px 0; }
            .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
            
            /* Header Atualizado: Fundo Verde, Texto Laranja, Borda Laranja */
            .header { background-color: #00753f; padding: 20px 30px; border-bottom: 4px solid #ff9b00; display: flex; align-items: center; justify-content: space-between; }
            .header-content { text-align: center; width: 100%; }
            .header h1 { color: #ff9b00; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; }
            .header p { color: #ff9b00; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; opacity: 0.9; }

            .content { padding: 30px; }
            .info-table { width: 100%; border-collapse: collapse; border: 1px solid ${borderColor}; border-radius: 6px; overflow: hidden; }
            
            .footer-legal { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; }
            a { color: #00753f; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="email-container">
                <div class="header">
                     <div class="header-content">
                          <h1 style="color: #ff9b00;">Risel Combustíveis</h1>
                          <p style="color: #ff9b00;">${title}</p>
                     </div>
                </div>
               
                <div class="content">
                    ${introHtml}
                     
                    <table class="info-table">
                        ${rows}
                    </table>

                    ${mapHtml}
                    
                    ${footerHtml}
                    ${buttonHtml}
                </div>
               
                <div class="footer-legal">
                    <p style="margin: 3px 0;">&copy; ${new Date().getFullYear()} Risel Combustíveis - Frota Leve</p>
                    <p style="margin: 3px 0;">Este é um e-mail automático. Por favor, não responda diretamente a menos que indicado.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

export const sendEmail = async (
  to: string | string[], 
  subject: string, 
  html: string,
  options?: {
    fromName?: string;
    cc?: string | string[];
    attachments?: Array<{ filename: string; content?: string; path?: string; contentType?: string }>;
  }
): Promise<void> => {
  try {
    if (!to || (Array.isArray(to) && to.length === 0)) {
        console.warn("Tentativa de enviar e-mail sem destinatário válido.");
        return;
    }

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        fromName: options?.fromName || "Gestão de Reservas Risel",
        cc: options?.cc,
        attachments: options?.attachments
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    console.log(`Email enviado com sucesso via API para: ${to}`);
  } catch (error: any) {
    console.error("Erro ao enviar e-mail via API backend:", error);
  }
};

export interface RacEmailOptions {
  actionType?: 'created' | 'approved' | 'rejected' | 'updated';
  cnhAttachedNow?: boolean;
  cnhAlreadyOnRecord?: boolean;
  adminNotes?: string;
  rejectReason?: string;
}

/**
 * Gera HTML formatado para notificação de Solicitação de Locação RAC
 */
export const generateRacEmailHtml = (
  rental: RacRental, 
  cnhAttachedOrOptions?: boolean | RacEmailOptions, 
  cnhAlreadyOnRecordParam?: boolean
): string => {
  let cnhAttachedNow = false;
  let cnhAlreadyOnRecord = false;
  let actionType: 'created' | 'approved' | 'rejected' | 'updated' = 'created';
  let adminNotes = rental.adminNotes || '';
  let rejectReason = rental.rejectReason || '';

  if (typeof cnhAttachedOrOptions === 'boolean') {
    cnhAttachedNow = cnhAttachedOrOptions;
    cnhAlreadyOnRecord = !!cnhAlreadyOnRecordParam;
    if (rental.status === 'Rejeitada' || rental.status === 'Recusada') {
      actionType = 'rejected';
    } else if (rental.status === 'Aguardando retirada' || rental.status === 'Aprovada' || rental.status === 'Em Uso') {
      actionType = 'approved';
    } else {
      actionType = 'created';
    }
  } else if (cnhAttachedOrOptions && typeof cnhAttachedOrOptions === 'object') {
    cnhAttachedNow = !!cnhAttachedOrOptions.cnhAttachedNow;
    cnhAlreadyOnRecord = !!cnhAlreadyOnRecordParam || !!cnhAttachedOrOptions.cnhAlreadyOnRecord;
    actionType = cnhAttachedOrOptions.actionType || 'created';
    if (cnhAttachedOrOptions.adminNotes) adminNotes = cnhAttachedOrOptions.adminNotes;
    if (cnhAttachedOrOptions.rejectReason) rejectReason = cnhAttachedOrOptions.rejectReason;
  }

  const formatDateTime = (d?: Date | string) => {
    if (!d) return 'Não informado';
    const dateObj = new Date(d);
    return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' +
           dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const statusCnhHtml = cnhAttachedNow
    ? `<span style="display:inline-block; padding:4px 8px; border-radius:6px; background-color:#ecfdf5; color:#065f46; font-weight:bold; font-size:12px; border:1px solid #a7f3d0;">📎 CNH ANEXADA NESTE E-MAIL</span>`
    : cnhAlreadyOnRecord
    ? `<span style="display:inline-block; padding:4px 8px; border-radius:6px; background-color:#eff6ff; color:#1e40af; font-weight:bold; font-size:12px; border:1px solid #bfdbfe;">✅ CNH JÁ CADASTRADA NO SISTEMA</span>`
    : `<span style="display:inline-block; padding:4px 8px; border-radius:6px; background-color:#fffbeb; color:#92400e; font-weight:bold; font-size:12px; border:1px solid #fde68a;">⚠️ PENDENTE DE CNH</span>`;

  // Configurações visuais de acordo com o tipo de ação
  let headerTitle = "Nova Solicitação de Locação RAC";
  let headerSubtitle = "Solicitação de veículo terceirizado cadastrada no sistema";
  let headerBg = "linear-gradient(135deg, #114D38 0%, #0c3829 100%)";
  let tagColor = "#F47920";
  let tagText = `Protocolo: ${rental.protocolNumber || rental.reservationNumber || 'RAC-PENDENTE'}`;
  let statusBadgeHtml = `<span style="display:inline-block; padding:5px 12px; border-radius:20px; background-color:#fef3c7; color:#92400e; font-weight:800; font-size:13px; border:1px solid #fde68a;">⏳ SOLICITADA (EM ANÁLISE)</span>`;

  if (actionType === 'approved') {
    headerTitle = "Solicitação de Locação RAC APROVADA";
    headerSubtitle = "Sua solicitação de veículo terceirizado foi aprovada pela Gestão de Frota";
    headerBg = "linear-gradient(135deg, #00753f 0%, #0c3829 100%)";
    tagColor = "#10b981";
    tagText = `Aprovada • ${rental.protocolNumber || rental.reservationNumber || 'RAC-OK'}`;
    statusBadgeHtml = `<span style="display:inline-block; padding:5px 14px; border-radius:20px; background-color:#ecfdf5; color:#065f46; font-weight:800; font-size:13px; border:1px solid #a7f3d0;">✅ APROVADA / AGUARDANDO RETIRADA</span>`;
  } else if (actionType === 'rejected') {
    headerTitle = "Solicitação de Locação RAC RECUSADA";
    headerSubtitle = "Informamos que sua solicitação de locação de veículo terceirizado não foi autorizada";
    headerBg = "linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)";
    tagColor = "#ef4444";
    tagText = `Recusada • ${rental.protocolNumber || rental.reservationNumber || 'RAC-RECUSADA'}`;
    statusBadgeHtml = `<span style="display:inline-block; padding:5px 14px; border-radius:20px; background-color:#fef2f2; color:#991b1b; font-weight:800; font-size:13px; border:1px solid #fecaca;">❌ SOLICITAÇÃO RECUSADA</span>`;
  } else if (actionType === 'updated') {
    headerTitle = "Atualização na Solicitação de Locação RAC";
    headerSubtitle = "Os dados da sua solicitação de locação RAC foram atualizados pela Gestão de Frota";
    headerBg = "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)";
    tagColor = "#3b82f6";
    tagText = `Atualizada • ${rental.protocolNumber || rental.reservationNumber || 'RAC-INFO'}`;
    statusBadgeHtml = `<span style="display:inline-block; padding:5px 14px; border-radius:20px; background-color:#eff6ff; color:#1e40af; font-weight:800; font-size:13px; border:1px solid #bfdbfe;">ℹ️ STATUS: ${(rental.status || 'Atualizada').toUpperCase()}</span>`;
  }

  // Bloco de Observações da Administração (se houver)
  const notesToDisplay = adminNotes || (actionType === 'rejected' ? rejectReason : '');
  const adminNotesHtml = notesToDisplay ? `
    <div style="background-color: ${actionType === 'rejected' ? '#fef2f2' : '#f0fdf4'}; border-left: 5px solid ${actionType === 'rejected' ? '#dc2626' : '#16a34a'}; padding: 16px; border-radius: 8px; margin: 18px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: ${actionType === 'rejected' ? '#991b1b' : '#166534'}; margin-bottom: 6px; letter-spacing: 0.5px;">
        ${actionType === 'rejected' ? '❌ Motivo da Recusa / Parecer da Administração:' : '📝 Observações & Instruções da Gestão de Frota:'}
      </div>
      <div style="font-size: 14px; color: ${actionType === 'rejected' ? '#7f1d1d' : '#14532d'}; line-height: 1.6; font-weight: 600; white-space: pre-wrap;">
        ${notesToDisplay}
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .card { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: ${headerBg}; color: #ffffff; padding: 26px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.92; }
        .tag-proto { display: inline-block; background: ${tagColor}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-top: 12px; letter-spacing: 0.5px; }
        .body { padding: 24px; }
        .status-container { text-align: center; margin-bottom: 18px; }
        .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #114D38; letter-spacing: 0.5px; margin: 18px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
        .grid { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .grid td { padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .grid td.label { font-weight: 700; color: #64748b; width: 38%; }
        .grid td.value { font-weight: 600; color: #0f172a; }
        .route-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin: 16px 0; text-align: center; }
        .route-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
        .route-flow { font-size: 15px; font-weight: 800; color: #0f172a; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
        .btn { display: inline-block; background: #00753f; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 13px; text-decoration: none; margin-top: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>${headerTitle}</h1>
          <p>${headerSubtitle}</p>
          <div class="tag-proto">${tagText}</div>
        </div>
        <div class="body">
          <div class="status-container">
            ${statusBadgeHtml}
          </div>

          ${adminNotesHtml}

          <div class="route-box">
            <div class="route-title">Itinerário de Retirada e Devolução</div>
            <div class="route-flow">
              📍 <strong>${rental.pickupCity || rental.pickupStore || 'A definir'}</strong> 
              &nbsp; ➔ &nbsp; 
              🏁 <strong>${rental.returnCity || rental.returnStore || 'A definir'}</strong>
            </div>
          </div>

          <div class="section-title">Dados do Solicitante & Condutor</div>
          <table class="grid">
            <tr>
              <td class="label">Solicitante:</td>
              <td class="value">${rental.requesterName}</td>
            </tr>
            <tr>
              <td class="label">Setor / Departamento:</td>
              <td class="value">${rental.requesterSector || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">Cargo / Função:</td>
              <td class="value">${rental.requesterRole || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">E-mail:</td>
              <td class="value">${rental.requesterEmail || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">Telefone / Contato:</td>
              <td class="value">${rental.requesterPhone || 'Não informado'}</td>
            </tr>
            <tr>
              <td class="label">Condutor Designado:</td>
              <td class="value"><strong>${rental.driverName}</strong></td>
            </tr>
            <tr>
              <td class="label">Status CNH:</td>
              <td class="value">${statusCnhHtml}</td>
            </tr>
          </table>

          <div class="section-title">Datas e Detalhes da Locação</div>
          <table class="grid">
            ${rental.rentalCompany ? `
            <tr>
              <td class="label">Locadora / Prestador:</td>
              <td class="value"><strong>${rental.rentalCompany}</strong></td>
            </tr>` : ''}
            ${rental.reservationNumber ? `
            <tr>
              <td class="label">Nº Reserva Locadora / Voucher:</td>
              <td class="value"><strong style="color: #00753f;">${rental.reservationNumber}</strong></td>
            </tr>` : ''}
            ${rental.plate ? `
            <tr>
              <td class="label">Placa do Veículo:</td>
              <td class="value"><strong style="font-family:monospace; font-size:14px;">${rental.plate}</strong></td>
            </tr>` : ''}
            <tr>
              <td class="label">Data/Hora de Retirada:</td>
              <td class="value"><strong>${formatDateTime(rental.pickupDate)}</strong></td>
            </tr>
            <tr>
              <td class="label">Cidade de Retirada:</td>
              <td class="value"><strong>${rental.pickupCity || rental.pickupStore || 'Não informada'}</strong></td>
            </tr>
            ${rental.pickupStore ? `
            <tr>
              <td class="label">Loja de Retirada:</td>
              <td class="value">${rental.pickupStore}</td>
            </tr>` : ''}
            <tr>
              <td class="label">Data/Hora de Devolução:</td>
              <td class="value"><strong>${formatDateTime(rental.returnDate)}</strong></td>
            </tr>
            <tr>
              <td class="label">Cidade de Devolução:</td>
              <td class="value"><strong>${rental.returnCity || rental.returnStore || 'Não informada'}</strong></td>
            </tr>
            ${rental.returnStore ? `
            <tr>
              <td class="label">Loja de Devolução:</td>
              <td class="value">${rental.returnStore}</td>
            </tr>` : ''}
            <tr>
              <td class="label">Categoria Pretendida:</td>
              <td class="value">${rental.category || 'Hatch / Compacto'}</td>
            </tr>
            <tr>
              <td class="label">Finalidade / Justificativa:</td>
              <td class="value">${rental.purpose || 'Uso Operacional Corporativo'}</td>
            </tr>
            ${rental.observations ? `
            <tr>
              <td class="label">Observações do Solicitante:</td>
              <td class="value">${rental.observations}</td>
            </tr>` : ''}
          </table>

          <div style="text-align: center; margin-top: 22px;">
            <a href="https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/frota?tab=reservas&sub=racRentals" class="btn" style="color:#ffffff;">Acessar Módulo RAC no Sistema</a>
          </div>
        </div>
        <div class="footer">
          <p style="margin: 0 0 4px;">Risel Combustíveis &bull; Gestão de Frota &bull; Locações RAC</p>
          <p style="margin: 0;">E-mail automático gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};


// --- Funções de Configurações do Administrador (Dashboard) ---

interface AdminSettings {
  dashboardCharts?: any[];
}

// Settings are now shared across all admins.
export const onDashboardSettingsChange = (
  callback: (settings: AdminSettings | null) => void,
  onError: (error: any) => void
): (() => void) => {
  const settingsDoc = db.collection('user_settings').doc('shared');
  const unsubscribe = settingsDoc.onSnapshot((docSnap) => {
    if (docSnap.exists) {
      callback(docSnap.data() as AdminSettings);
    } else {
      callback(null); // Document doesn't exist, no settings saved yet.
    }
  }, (error) => {
      // Permissões insuficientes podem ocorrer se o usuário não estiver logado ainda
      // ou se as regras de segurança estiverem estritas demais na inicialização.
      // Apenas logamos um aviso e retornamos null para evitar crash da UI.
      console.warn("Settings fetch warning (possibly permissions or offline):", error);
      callback(null); 
  });
  return unsubscribe;
};

export const updateDashboardSettings = async (settings: AdminSettings): Promise<void> => {
  try {
      const settingsDoc = db.collection('user_settings').doc('shared');
      // set with merge is used to create or update the document.
      await settingsDoc.set(removeUndefined(settings), { merge: true });
  } catch (error) {
      console.error("Error updating dashboard settings:", error);
      throw new Error("Não foi possível salvar as configurações do dashboard. Verifique sua conexão e permissões.");
  }
};


// --- Helper para converter documentos do Firestore para nossos tipos ---
const docToVehicle = (doc: any): Vehicle | null => {
    const data = doc.data();
    if (!data.model || !data.plate || typeof data.year !== 'number') {
        console.warn(`Skipping malformed vehicle document with id ${doc.id}:`, data);
        return null;
    }
    return {
        id: doc.id,
        model: data.model,
        plate: data.plate,
        year: data.year,
        initialKm: data.initialKm || 0,
        lastKm: data.lastKm,
        lastServiceDate: convertOptionalFirestoreDate(data.lastServiceDate),
        lastServiceKm: data.lastServiceKm,
        lastWashDate: convertOptionalFirestoreDate(data.lastWashDate), 
        isActive: data.isActive !== false, // Default to true if not set
        type: data.type
    };
};

const normalizeStatus = (status: any): ReservationStatus => {
    if (!status) return ReservationStatus.Pending;
    const s = status.toString().trim().toLowerCase();
    if (s === 'completed' || s === 'concluída' || s === 'concluida' || s === 'finalizada' || s === 'finalizado') return ReservationStatus.Completed;
    if (s === 'inuse' || s === 'in_use' || s === 'em uso' || s === 'em_uso') return ReservationStatus.InUse;
    if (s === 'pending' || s === 'pendente') return ReservationStatus.Pending;
    if (s === 'approved' || s === 'aprovada' || s === 'aprovado') return ReservationStatus.Approved;
    if (s === 'rejected' || s === 'rejeitada' || s === 'rejeitado') return ReservationStatus.Rejected;
    if (s === 'cancelled' || s === 'cancelada' || s === 'cancelado') return ReservationStatus.Cancelled;
    return status as ReservationStatus;
};

const docToReservation = (doc: any): Reservation | null => {
    const data = doc.data();
    const requesterName = data.requesterName || data.solicitante || data.username || 'Não Informado';
    const vehicleId = data.vehicleId || data.vehicle || data.placa || data.plate;
    
    if (!vehicleId) {
        return null;
    }

    return {
        id: doc.id,
        requesterName: requesterName,
        department: data.department || data.setor || '',
        role: data.role || data.cargo || 'N/A',
        email: data.email || '',
        departureDateTime: convertFirestoreDate(data.departureDateTime || data.departureDate || data.dataSaida),
        returnDate: convertFirestoreDate(data.returnDate || data.dataRetorno || data.returnDateTime),
        destination: data.destination || data.localDestino || '',
        destinationCity: data.destinationCity || data.cidadeDestino || '',
        distanceKm: data.distanceKm,
        vehicleId: vehicleId,
        status: normalizeStatus(data.status),
        driverName: data.driverName || data.condutor,
        actualReturnDateTime: convertOptionalFirestoreDate(data.actualReturnDateTime || data.dataRetornoEfetiva),
        finalKm: data.finalKm,
        purpose: data.purpose || data.motivo,
        rejectReason: data.rejectReason || data.motivoRejeicao,
        requestTimestamp: convertOptionalFirestoreDate(data.requestTimestamp || data.created)
    };
};

const docToDailyTrip = (doc: any): DailyTrip | null => {
    const data = doc.data();
    const driverName = data.driverName || data.condutor || data.driver || data.requesterName || 'Não Informado';
    const vehicleId = data.vehicleId || data.vehicle || data.placa || data.plate;
    
    if (!vehicleId) return null;

    return {
        id: doc.id,
        requesterName: data.requesterName || driverName,
        department: data.department || data.setor || '',
        driverName: driverName,
        vehicleId: vehicleId,
        departureDateTime: convertFirestoreDate(data.departureDateTime || data.departureDate || data.dataSaida || data.created),
        destination: data.destination || data.localDestino || '',
        destinationCity: data.destinationCity || data.cidadeDestino || '',
        distanceKm: data.distanceKm || data.kmPercorrido,
        status: normalizeStatus(data.status || 'Em Uso') as any,
        actualReturnDateTime: convertOptionalFirestoreDate(data.actualReturnDateTime || data.returnDate || data.dataRetorno),
        finalKm: data.finalKm != null ? Number(data.finalKm) : undefined,
        purpose: data.purpose || data.motivo || '',
        initialKm: data.initialKm != null ? Number(data.initialKm) : undefined,
        initialFuelLevel: data.initialFuelLevel || data.fuelLevel,
        finalFuelLevel: data.finalFuelLevel || data.fuelLevelRetorno,
    };
};

const docToRacRental = (doc: any): RacRental | null => {
    const data = doc.data();
    if (!data) return null;

    const rentalCompany = data.rentalCompany || data.locadora || data.empresaLocadora || data.company || 'Localiza';
    const requesterName = data.requesterName || data.solicitante || data.nomeSolicitante || data.condutor || data.driverName || 'Colaborador';
    const plate = (data.plate || data.placa || '').toUpperCase().trim();

    return {
        id: doc.id,
        rentalCompany: rentalCompany,
        plate: plate,
        requesterName: requesterName,
        requesterSector: data.requesterSector || data.setor || data.departamento || 'Operações',
        requesterRole: data.requesterRole || data.cargo || '',
        requesterEmail: data.requesterEmail || data.email || '',
        requesterPhone: data.requesterPhone || data.telefone || data.phone || '',
        value: data.value !== undefined ? Number(data.value) : (data.valor !== undefined ? Number(data.valor) : 0),
        reservationNumber: data.reservationNumber || data.numeroReserva || data.reserva || data.contrato || '',
        driverName: data.driverName || data.condutor || data.nomeCondutor || requesterName,
        driverRole: data.driverRole || data.cargoCondutor || '',
        status: data.status || 'Em Uso',
        base: data.base || data.filial || 'Matriz',
        createdByUser: data.createdByUser || data.usuario || '',
        reservationDate: convertFirestoreDate(data.reservationDate || data.dataReserva || data.created || new Date()),
        pickupDate: convertFirestoreDate(data.pickupDate || data.dataRetirada || data.dataInicio || data.dataSaida || new Date()),
        pickupStore: data.pickupStore || data.lojaRetirada || '',
        returnDate: convertFirestoreDate(data.returnDate || data.dataDevolucao || data.dataFim || data.dataRetorno || new Date(Date.now() + 7 * 24 * 3600 * 1000)),
        returnStore: data.returnStore || data.lojaDevolucao || '',
        pickupCity: data.pickupCity || data.cidadeRetirada || '',
        returnCity: data.returnCity || data.cidadeDevolucao || '',
        category: data.category || data.categoria || '',
        purpose: data.purpose || data.motivo || data.finalidade || '',
        observations: data.observations || data.observacoes || '',
        hasCnhCopy: !!(data.hasCnhCopy || data.cnhFileName || data.cnhBase64),
        cnhFileName: data.cnhFileName || '',
        cnhBase64: data.cnhBase64 || '',
        cnhUploadDate: data.cnhUploadDate ? convertFirestoreDate(data.cnhUploadDate) : undefined,
        protocolNumber: data.protocolNumber || data.protocolo || ''
    };
};


// --- Funções CRUD para Veículos ---
export const getVehicles = async (): Promise<Vehicle[]> => {
  const snapshot = await vehiclesCollection.orderBy('model').get();
  return snapshot.docs
    .map(docToVehicle)
    .filter((v): v is Vehicle => v !== null);
};

export const subscribeToVehicles = (onUpdate: (data: Vehicle[]) => void, onError: (error: any) => void) => {
    return vehiclesCollection.orderBy('model').onSnapshot(snapshot => {
        const vehicles = snapshot.docs.map(docToVehicle).filter((v): v is Vehicle => v !== null);
        onUpdate(vehicles);
    }, onError);
};

export const addVehicle = (data: Omit<Vehicle, 'id'>) => vehiclesCollection.add(removeUndefined(data));
export const updateVehicle = (id: string, data: Partial<Omit<Vehicle, 'id'>>) => vehiclesCollection.doc(id).update(removeUndefined(data));
export const deleteVehicle = (id: string) => vehiclesCollection.doc(id).delete();


// --- Funções CRUD para Reservas ---
export const getReservations = async (): Promise<Reservation[]> => {
  const snapshot = await reservationsCollection.orderBy('departureDateTime', 'desc').get();
  return snapshot.docs
    .map(docToReservation)
    .filter((r): r is Reservation => r !== null);
};

export const subscribeToReservations = (onUpdate: (data: Reservation[]) => void, onError: (error: any) => void) => {
    return reservationsCollection.orderBy('departureDateTime', 'desc').onSnapshot(snapshot => {
        const reservations = snapshot.docs.map(docToReservation).filter((r): r is Reservation => r !== null);
        onUpdate(reservations);
    }, onError);
};

export const addReservation = (data: Omit<Reservation, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'requestTimestamp'>) => {
    const reservationWithAllFields = {
        ...data,
        status: ReservationStatus.Pending,
        requestTimestamp: new Date(),
    };
    return reservationsCollection.add(removeUndefined(reservationWithAllFields));
}
export const updateReservation = (id: string, data: Partial<Omit<Reservation, 'id'>>) => reservationsCollection.doc(id).update(removeUndefined(data));
export const deleteReservation = (id: string) => reservationsCollection.doc(id).delete();


// --- Funções CRUD para Uso Diário ---
export const getDailyUseTrips = async (): Promise<DailyTrip[]> => {
    const snapshot = await dailyUseCollection.orderBy('departureDateTime', 'desc').get();
    return snapshot.docs
        .map(docToDailyTrip)
        .filter((t): t is DailyTrip => t !== null);
};

export const subscribeToDailyUseTrips = (onUpdate: (data: DailyTrip[]) => void, onError: (error: any) => void) => {
    return dailyUseCollection.orderBy('departureDateTime', 'desc').onSnapshot(snapshot => {
        const trips = snapshot.docs.map(docToDailyTrip).filter((t): t is DailyTrip => t !== null);
        onUpdate(trips);
    }, onError);
};

export const addDailyUseTrip = async (data: Omit<DailyTrip, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'finalFuelLevel'>): Promise<string> => {
    const tripWithStatus = {
        ...data,
        status: ReservationStatus.InUse,
    };
    const docRef = await dailyUseCollection.add(removeUndefined(tripWithStatus));
    return docRef.id;
};

export const endDailyUseTrip = (id: string, data: { actualReturnDateTime: Date; finalKm: number; finalFuelLevel: FuelLevel }) => {
    const tripWithStatus = {
        ...data,
        status: ReservationStatus.Completed,
    };
    return dailyUseCollection.doc(id).update(removeUndefined(tripWithStatus));
};

export const updateDailyUseTrip = (id: string, data: Partial<Omit<DailyTrip, 'id'>>) => dailyUseCollection.doc(id).update(removeUndefined(data));
export const deleteDailyUseTrip = (id: string) => dailyUseCollection.doc(id).delete();

// --- Funções CRUD para Locações RAC ---

export const INITIAL_RAC_RENTALS: RacRental[] = [
  {
    id: 'rac-01',
    rentalCompany: 'Movida',
    plate: 'UBF3H43',
    requesterName: 'Wesley Sidlei Breda',
    requesterSector: 'Comercial & Vendas',
    value: 2850.00,
    reservationNumber: 'MV-984210',
    driverName: 'Wesley Sidlei Breda',
    status: 'Em Uso',
    base: 'Betim',
    createdByUser: 'admin@risel.com.br',
    reservationDate: new Date('2026-06-15T10:00:00'),
    pickupDate: new Date('2026-06-16T08:00:00'),
    pickupStore: 'Movida Aeroporto Confins',
    returnDate: new Date('2026-07-16T18:00:00'),
    returnStore: 'Movida Betim Centro'
  },
  {
    id: 'rac-02',
    rentalCompany: 'Localiza Gestão de Frotas',
    plate: 'RVO9E45',
    requesterName: 'Marcos Vinicius Pereira',
    requesterSector: 'Operações & Logística',
    value: 3420.50,
    reservationNumber: 'LOC-778219',
    driverName: 'Marcos Vinicius Pereira',
    status: 'Em Uso',
    base: 'Campineira',
    createdByUser: 'admin@risel.com.br',
    reservationDate: new Date('2026-06-20T14:30:00'),
    pickupDate: new Date('2026-06-22T09:00:00'),
    pickupStore: 'Localiza Campinas Amoreiras',
    returnDate: new Date('2026-07-22T18:00:00'),
    returnStore: 'Localiza Campinas Amoreiras'
  },
  {
    id: 'rac-03',
    rentalCompany: 'Super Mais',
    plate: 'SGA2C10',
    requesterName: 'Juliana Silveira Dias',
    requesterSector: 'Diretoria Executiva',
    value: 1980.00,
    reservationNumber: 'SM-332190',
    driverName: 'Juliana Silveira Dias',
    status: 'Finalizada',
    base: 'Matriz',
    createdByUser: 'admin@risel.com.br',
    reservationDate: new Date('2026-05-10T11:00:00'),
    pickupDate: new Date('2026-05-12T08:30:00'),
    pickupStore: 'Super Mais BH Centro',
    returnDate: new Date('2026-06-12T17:00:00'),
    returnStore: 'Super Mais BH Centro'
  },
  {
    id: 'rac-04',
    rentalCompany: 'Localiza Gestão de Frotas',
    plate: 'RWS4F88',
    requesterName: 'Carlos Alberto Souza',
    requesterSector: 'Engenharia & Manutenção',
    value: 2150.00,
    reservationNumber: 'LOC-882341',
    driverName: 'Carlos Alberto Souza',
    status: 'Aguardando retirada',
    base: 'Paulínia',
    createdByUser: 'admin@risel.com.br',
    reservationDate: new Date('2026-07-01T09:00:00'),
    pickupDate: new Date('2026-07-10T08:00:00'),
    pickupStore: 'Localiza Paulínia Centro',
    returnDate: new Date('2026-07-25T18:00:00'),
    returnStore: 'Localiza Paulínia Centro'
  },
  {
    id: 'rac-05',
    rentalCompany: 'Unidas Locadora',
    plate: 'TGB5K22',
    requesterName: 'Roberto Carlos Lima',
    requesterSector: 'Operações de Campo',
    value: 3100.00,
    reservationNumber: 'UN-554109',
    driverName: 'Roberto Carlos Lima',
    status: 'Em Uso',
    base: 'Betim',
    createdByUser: 'admin@risel.com.br',
    reservationDate: new Date('2026-06-28T16:00:00'),
    pickupDate: new Date('2026-07-01T08:00:00'),
    pickupStore: 'Unidas Betim Shopping',
    returnDate: new Date('2026-07-31T18:00:00'),
    returnStore: 'Unidas Betim Shopping'
  }
];

let useRacLocalStorageFallback = false;
const racListeners: ((data: RacRental[]) => void)[] = [];

export const isRacRentalUsingFallback = () => useRacLocalStorageFallback;

// Helper to get from local storage
const getRacRentalsFromLocalStorage = (): RacRental[] => {
  try {
    const data = localStorage.getItem('fallback_rac_rentals');
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: any) => ({
          ...r,
          reservationDate: convertFirestoreDate(r.reservationDate),
          pickupDate: convertFirestoreDate(r.pickupDate),
          returnDate: convertFirestoreDate(r.returnDate)
        }));
      }
    }
  } catch (err) {
    console.error("Error reading RAC rentals from localStorage:", err);
  }

  // Seed with default initial RAC rentals if empty
  saveRacRentalsToLocalStorage(INITIAL_RAC_RENTALS);
  return INITIAL_RAC_RENTALS;
};

// Helper to save to local storage
const saveRacRentalsToLocalStorage = (rentals: RacRental[]) => {
  try {
    localStorage.setItem('fallback_rac_rentals', JSON.stringify(rentals));
  } catch (err) {
    console.error("Error saving RAC rentals to localStorage:", err);
  }
};

const notifyRacListeners = () => {
  const data = getRacRentalsFromLocalStorage();
  racListeners.forEach(listener => {
    try {
      listener(data);
    } catch (e) {
      console.error("Error notifying RAC listener:", e);
    }
  });
};

export const getRacRentals = async (): Promise<RacRental[]> => {
  if (useRacLocalStorageFallback) {
    return getRacRentalsFromLocalStorage();
  }
  try {
    const snapshot = await racRentalsCollection.orderBy('pickupDate', 'desc').get();
    const firestoreRentals = snapshot.docs
      .map(docToRacRental)
      .filter((r): r is RacRental => r !== null);
      
    if (firestoreRentals.length === 0) {
      return getRacRentalsFromLocalStorage();
    }
    return firestoreRentals;
  } catch (error) {
    console.warn("getRacRentals failed, falling back to local storage.", error);
    useRacLocalStorageFallback = true;
    return getRacRentalsFromLocalStorage();
  }
};

export const subscribeToRacRentals = (onUpdate: (data: RacRental[]) => void, onError: (error: any) => void) => {
  let isSubscribed = true;

  // Registrar callback na lista de ouvintes locais para garantir reatividade no modo de fallback
  racListeners.push(onUpdate);

  const unsubscribe = racRentalsCollection.orderBy('pickupDate', 'desc').onSnapshot(
    (snapshot) => {
      if (!isSubscribed) return;
      if (useRacLocalStorageFallback) {
        onUpdate(getRacRentalsFromLocalStorage());
        return;
      }
      const rentals = snapshot.docs.map(docToRacRental).filter((r): r is RacRental => r !== null);
      if (rentals.length === 0) {
        onUpdate(getRacRentalsFromLocalStorage());
      } else {
        onUpdate(rentals);
      }
    },
    (error) => {
      if (!isSubscribed) return;
      console.warn("Firestore RAC Rentals subscribe failed. Falling back to local storage.", error);
      useRacLocalStorageFallback = true;
      onUpdate(getRacRentalsFromLocalStorage());
    }
  );

  return () => {
    isSubscribed = false;
    // Remover o callback da lista de ouvintes ao se desinscrever
    const index = racListeners.indexOf(onUpdate);
    if (index !== -1) {
      racListeners.splice(index, 1);
    }
    unsubscribe();
  };
};

export const addRacRental = async (data: Omit<RacRental, 'id'>) => {
  if (useRacLocalStorageFallback) {
    const rentals = getRacRentalsFromLocalStorage();
    const newRental: RacRental = {
      ...data,
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
    };
    rentals.unshift(newRental);
    // Sort by pickupDate descending
    rentals.sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
    saveRacRentalsToLocalStorage(rentals);
    notifyRacListeners();
    return { id: newRental.id };
  }
  try {
    return await racRentalsCollection.add(removeUndefined(data));
  } catch (error) {
    console.warn("addRacRental failed, falling back to local storage.", error);
    useRacLocalStorageFallback = true;
    
    const rentals = getRacRentalsFromLocalStorage();
    const newRental: RacRental = {
      ...data,
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
    };
    rentals.unshift(newRental);
    rentals.sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
    saveRacRentalsToLocalStorage(rentals);
    notifyRacListeners();
    return { id: newRental.id };
  }
};

export const updateRacRental = async (id: string, data: Partial<Omit<RacRental, 'id'>>) => {
  if (useRacLocalStorageFallback || id.startsWith('local_')) {
    const rentals = getRacRentalsFromLocalStorage();
    const idx = rentals.findIndex(r => r.id === id);
    if (idx !== -1) {
      rentals[idx] = {
        ...rentals[idx],
        ...data,
        reservationDate: data.reservationDate ? new Date(data.reservationDate) : rentals[idx].reservationDate,
        pickupDate: data.pickupDate ? new Date(data.pickupDate) : rentals[idx].pickupDate,
        returnDate: data.returnDate ? new Date(data.returnDate) : rentals[idx].returnDate,
      };
      rentals.sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
      saveRacRentalsToLocalStorage(rentals);
      notifyRacListeners();
    }
    return;
  }
  try {
    return await racRentalsCollection.doc(id).update(removeUndefined(data));
  } catch (error) {
    console.warn("updateRacRental failed, falling back to local storage.", error);
    useRacLocalStorageFallback = true;
    
    const rentals = getRacRentalsFromLocalStorage();
    const idx = rentals.findIndex(r => r.id === id);
    if (idx !== -1) {
      rentals[idx] = {
        ...rentals[idx],
        ...data,
        reservationDate: data.reservationDate ? new Date(data.reservationDate) : rentals[idx].reservationDate,
        pickupDate: data.pickupDate ? new Date(data.pickupDate) : rentals[idx].pickupDate,
        returnDate: data.returnDate ? new Date(data.returnDate) : rentals[idx].returnDate,
      };
      rentals.sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
      saveRacRentalsToLocalStorage(rentals);
      notifyRacListeners();
    }
  }
};

export const deleteRacRental = async (id: string) => {
  if (useRacLocalStorageFallback || id.startsWith('local_')) {
    const rentals = getRacRentalsFromLocalStorage();
    const filtered = rentals.filter(r => r.id !== id);
    saveRacRentalsToLocalStorage(filtered);
    notifyRacListeners();
    return;
  }
  try {
    return await racRentalsCollection.doc(id).delete();
  } catch (error) {
    console.warn("deleteRacRental failed, falling back to local storage.", error);
    useRacLocalStorageFallback = true;
    const rentals = getRacRentalsFromLocalStorage();
    const filtered = rentals.filter(r => r.id !== id);
    saveRacRentalsToLocalStorage(filtered);
    notifyRacListeners();
  }
};

export const getLocalRacRentalsCount = (): number => {
  return getRacRentalsFromLocalStorage().length;
};

export const syncLocalRacRentalsWithFirebase = async (): Promise<void> => {
  // Test connection first
  try {
    await racRentalsCollection.limit(1).get();
    useRacLocalStorageFallback = false;
  } catch (error) {
    console.error("Firestore check failed during sync:", error);
    useRacLocalStorageFallback = true;
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`O servidor do Firebase ainda está recusando conexões para Locações RAC. Verifique se as Regras de Segurança foram publicadas e propagadas corretamente. Detalhes: ${detail}`);
  }

  const localRentals = getRacRentalsFromLocalStorage();
  if (localRentals.length === 0) {
    // No local rentals to upload, but since check passed, we cleared the fallback!
    return;
  }

  try {
    for (const rental of localRentals) {
      const { id, ...dataToUpload } = rental;
      
      const cleanedData = {
        ...dataToUpload,
        reservationDate: rental.reservationDate ? new Date(rental.reservationDate) : new Date(),
        pickupDate: rental.pickupDate ? new Date(rental.pickupDate) : new Date(),
        returnDate: rental.returnDate ? new Date(rental.returnDate) : new Date(),
      };
      
      await racRentalsCollection.add(removeUndefined(cleanedData));
    }
    
    localStorage.removeItem('fallback_rac_rentals');
    useRacLocalStorageFallback = false;
  } catch (error) {
    console.error("Error syncing local RAC rentals to Firebase:", error);
    useRacLocalStorageFallback = true;
    throw error;
  }
};

// --- Funções de Checklist ---
export interface ChecklistData {
  placa: string;
  condutor: string;
  data: string;
  odometro: number;
  itens: {
    pneus: "OK" | "Atenção" | "Crítico";
    freios: "OK" | "Atenção" | "Crítico";
    farois: "OK" | "Atenção" | "Crítico";
    seguranca: "OK" | "Atenção" | "Crítico";
    fluidos: "OK" | "Atenção" | "Crítico";
    lataria: "OK" | "Atenção" | "Crítico";
  };
  observacoes: string;
  status: "Aprovado" | "Ressalvas" | "Retido";
  
  timestamp?: string;
  email?: string;
  tipo?: string;
  base?: string;
  marcaModelo?: string;
  cor?: string;
  nivelTanque?: string;
  listaItens?: string[];
  pneuDianteiroDireito?: string;
  pneuDianteiroEsquerdo?: string;
  pneuTraseiroDireito?: string;
  pneuTraseiroEsquerdo?: string;
  pneuEstepe?: string;
  obsDianteira?: string;
  fotoFrente?: string;
  obsMotorista?: string;
  fotoMotorista?: string;
  obsPassageiro?: string;
  fotoPassageiro?: string;
  obsTraseira?: string;
  fotoTraseira?: string;
  entreguePor?: string;
  recebidoPor?: string;
  fotosInterior?: string;
  fotoRetrovisorMotorista?: string;
  fotoRetrovisorPassageiro?: string;
  fotoFaroisTraseiros?: string;
  fotoFaroisDianteiros?: string;
  mergedDocUrl?: string;
  isGoogleSheet?: boolean;
}

const checklistsCollection = db.collection('checklists');

export const addFirebaseChecklist = async (checklist: ChecklistData): Promise<string> => {
  try {
    const docRef = await checklistsCollection.add(removeUndefined(checklist));
    return docRef.id;
  } catch (error) {
    console.error("Error adding checklist to Firebase:", error);
    throw error;
  }
};

export const getFirebaseChecklists = async (): Promise<(ChecklistData & { id: string })[]> => {
  try {
    const snapshot = await checklistsCollection.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));
  } catch (error) {
    console.warn("Aviso ao buscar checklists do Firebase (usando fallback de dados):", error);
    return [];
  }
};

export const deleteFirebaseChecklist = async (id: string): Promise<void> => {
  try {
    await checklistsCollection.doc(id).delete();
  } catch (error) {
    console.error("Error deleting checklist from Firebase:", error);
    throw error;
  }
};

