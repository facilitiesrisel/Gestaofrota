import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { auth, db } from '../firebaseConfig';
import { Vehicle, Reservation, ReservationStatus, DailyTrip, FuelLevel, RacRental } from '../types_reserva';
import { normalizeNomeSetor } from '../utils/setorOperacional';

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

// Gera o HTML para o e-mail com layout institucional premium e logo da Risel (Padrão Oficial de Alta Qualidade)
export const generateEmailHtml = (
    title: string, 
    details: { label: string, value: string }[], 
    highlightColor: string = '#00753f', // Usado para botões/destaques secundários
    actionLink?: string, // Link opcional para botão de ação
    introText?: string, // Texto introdutório
    footerText?: string, // Texto de rodapé/orientação extra
    borderColor: string = '#e2e8f0', // Cor da borda da tabela
    mapImageUrl?: string // URL da imagem estática do mapa (opcional)
) => {
    
    // Construção das linhas da tabela estruturada de detalhes
    const rows = details.map((d, index) => {
        const icon = getIconForLabel(d.label);
        const isEven = index % 2 === 0;
        const isStatus = d.label.toLowerCase().includes('status');
        const isApproved = isStatus && (d.value.toLowerCase().includes('aprovad') || d.value.includes('✅'));
        const isPending = isStatus && (d.value.toLowerCase().includes('pendente') || d.value.includes('⏳'));
        const isRejected = isStatus && (d.value.toLowerCase().includes('rejeitad') || d.value.toLowerCase().includes('cancelad') || d.value.includes('❌'));

        let valueDisplay = d.value;
        if (isApproved) {
            valueDisplay = `<span style="background-color: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 13px; display: inline-block; border: 1px solid #bbf7d0;">${d.value}</span>`;
        } else if (isPending) {
            valueDisplay = `<span style="background-color: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 13px; display: inline-block; border: 1px solid #fde68a;">${d.value}</span>`;
        } else if (isRejected) {
            valueDisplay = `<span style="background-color: #fee2e2; color: #b91c1c; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 13px; display: inline-block; border: 1px solid #fecaca;">${d.value}</span>`;
        }

        return `
        <tr style="background-color: ${isEven ? '#f8fafc' : '#ffffff'};">
            <td style="padding: 11px 16px; border-bottom: 1px solid ${borderColor}; color: #0d4a36; font-weight: 700; width: 38%; font-size: 13px; vertical-align: middle; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                <span style="margin-right: 8px; font-size: 15px;">${icon}</span>${d.label}:
            </td>
            <td style="padding: 11px 16px; border-bottom: 1px solid ${borderColor}; color: #0f172a; font-size: 13.5px; vertical-align: middle; font-weight: 700; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                ${valueDisplay}
            </td>
        </tr>
    `}).join('');

    // Botão Bulletproof com suporte a Outlook e todos os clientes de email (garante fundo verde e texto 100% visível)
    const buttonHtml = actionLink ? `
        <div style="text-align: center; margin-top: 30px; margin-bottom: 16px;">
            <!-- Tabela Bulletproof para o Botão do Foguete (Impede fundo branco no Outlook/Office 365) -->
            <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
              <tr>
                <td align="center" bgcolor="#0d4a36" style="border-radius: 8px; background-color: #0d4a36; background: linear-gradient(135deg, #09392b 0%, #00753f 100%);">
                  <a href="${actionLink}" target="_blank" style="font-size: 14px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-weight: 800; color: #ffffff !important; text-decoration: none; padding: 14px 34px; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #00753f;">
                    <span style="color: #ffffff !important;">🚀 Acessar Sistema Risel</span>
                  </a>
                </td>
              </tr>
            </table>
            <!-- Link alternativo de contingência -->
            <div style="margin-top: 14px; font-size: 11px; color: #64748b; background-color: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px dashed #cbd5e1; word-break: break-all; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                Se preferir, utilize o link direto: <a href="${actionLink}" target="_blank" style="color: #00753f; text-decoration: underline; font-weight: 700;">${actionLink}</a>
            </div>
        </div>
    ` : '';

    const mapHtml = mapImageUrl ? `
        <div style="margin-top: 24px; text-align: center; border: 1px solid #e2e8f0; padding: 12px; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #0d4a36; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">📍 Registro de Localização e Rota</p>
            <img src="${mapImageUrl}" alt="Mapa do deslocamento" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 0 auto;" />
        </div>
    ` : '';

    const introHtml = introText ? `
        <div style="background-color: #f0fdf4; padding: 14px 18px; border-left: 4px solid #16a34a; border-radius: 8px; margin-bottom: 22px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <p style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 600;">${introText}</p>
        </div>
    ` : '';

    const footerHtml = footerText ? `
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; color: #92400e; padding: 14px 18px; border-radius: 8px; margin-top: 24px; font-size: 13px; line-height: 1.5; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <strong style="display: block; margin-bottom: 4px; font-size: 13.5px; color: #b45309;">⚠️ Atenção & Recomendações:</strong>
            ${footerText}
        </div>
    ` : '';

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body, table, td, p, h1, h2, h3, div, span, strong, a, li, b { 
                font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; 
            }
            body { 
                background-color: #f1f5f9; 
                margin: 0; 
                padding: 0; 
                -webkit-font-smoothing: antialiased;
            }
        </style>
    </head>
    <body style="background-color: #f1f5f9; padding: 20px 10px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            
            <!-- Header Corporativo Risel com Fundo Verde Gradiente e Suporte a Todos os Clientes de Email (Outlook, Office 365, Gmail) -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
              <tr>
                <td bgcolor="#09392b" style="padding: 24px 28px; background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%);">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    <tr>
                      <td width="56" valign="middle" style="width: 56px; vertical-align: middle;">
                        <img src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" alt="Logo Risel" width="50" height="50" style="width: 50px; height: 50px; border-radius: 10px; display: block; border: 2px solid rgba(255,255,255,0.25); object-fit: cover;" />
                      </td>
                      <td valign="middle" style="padding-left: 16px; vertical-align: middle;">
                        <h1 style="color: #ffffff !important; margin: 0; font-size: 19px; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">${title}</h1>
                        <p style="color: #86efac !important; margin: 4px 0 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">Risel Combustíveis Ltda • Gestão de Frotas</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
           
            <div style="padding: 28px 28px 24px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                ${introHtml}
                 
                <!-- Tabela Estruturada de Informações -->
                <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; border: 1px solid ${borderColor}; border-radius: 10px; overflow: hidden; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                    ${rows}
                </table>

                ${mapHtml}
                
                ${footerHtml}
                ${buttonHtml}
            </div>
           
            <!-- Rodapé Institucional Oficial Risel -->
            <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                <p style="margin: 0; font-size: 11px; font-weight: 700; color: #64748b; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">&copy; ${new Date().getFullYear()} Risel Combustíveis Ltda • Sistema de Gestão de Frotas</p>
                <p style="margin: 4px 0 0 0; font-size: 10px; color: #94a3b8; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">Mensagem corporativa gerada automaticamente pelo Sistema Risel ERP.</p>
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

    // Lê eventuais preferências SMTP salvas pelo usuário no painel de configurações
    const rawHost = typeof window !== 'undefined' ? localStorage.getItem("risel_smtp_host") : null;
    const rawPort = typeof window !== 'undefined' ? localStorage.getItem("risel_smtp_port") : null;
    const rawEmail = typeof window !== 'undefined' ? localStorage.getItem("risel_smtp_email") : null;
    const rawPassword = typeof window !== 'undefined' ? localStorage.getItem("risel_smtp_password") : null;

    const smtpHost = rawHost?.trim() || undefined;
    const smtpPort = rawPort?.trim() || undefined;
    const smtpEmail = rawEmail?.trim() || undefined;
    const smtpPassword = rawPassword?.trim() || undefined;

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
        attachments: options?.attachments,
        smtpHost,
        smtpPort,
        smtpEmail,
        smtpPassword
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    console.log(`Email enviado com sucesso via API para: ${to}`);
  } catch (error: any) {
    console.error("Erro ao enviar e-mail via API backend:", error);
    throw error;
  }
};

export interface RacEmailOptions {
  actionType?: 'created' | 'approved' | 'rejected' | 'updated';
  cnhAttachedNow?: boolean;
  cnhAlreadyOnRecord?: boolean;
  voucherAttachedNow?: boolean;
  adminNotes?: string;
  rejectReason?: string;
}

/**
 * Gera HTML formatado Premium CRM para notificação de Solicitação e Respostas de Locação RAC
 * - Cabeçalho verde gradiente com logotipo da Risel
 * - Tipografia Aptos Narrow 11 nos dados das solicitações
 * - Formatações condicionais (Status, CNH, Itinerário, Voucher e Parecer)
 * - Ícones elegantes e layout estilo CRM corporativo
 */
export const generateRacEmailHtml = (
  rental: RacRental, 
  cnhAttachedOrOptions?: boolean | RacEmailOptions, 
  cnhAlreadyOnRecordParam?: boolean
): string => {
  let cnhAttachedNow = false;
  let cnhAlreadyOnRecord = false;
  let voucherAttachedNow = !!rental.hasVoucher || !!rental.voucherFileName || !!rental.voucherBase64;
  let actionType: 'created' | 'approved' | 'rejected' | 'updated' = 'created';
  let adminNotes = rental.adminNotes || '';
  let rejectReason = rental.rejectReason || '';

  if (typeof cnhAttachedOrOptions === 'boolean') {
    cnhAttachedNow = cnhAttachedOrOptions;
    cnhAlreadyOnRecord = !!cnhAlreadyOnRecordParam || !!rental.cnhAlreadyOnRecord;
    if (rental.status === 'Rejeitada' || rental.status === 'Recusada') {
      actionType = 'rejected';
    } else if (rental.status === 'Aguardando retirada' || rental.status === 'Aprovada' || rental.status === 'Em Uso') {
      actionType = 'approved';
    } else {
      actionType = 'created';
    }
  } else if (cnhAttachedOrOptions && typeof cnhAttachedOrOptions === 'object') {
    cnhAttachedNow = !!cnhAttachedOrOptions.cnhAttachedNow;
    cnhAlreadyOnRecord = !!cnhAlreadyOnRecordParam || !!cnhAttachedOrOptions.cnhAlreadyOnRecord || !!rental.cnhAlreadyOnRecord;
    if (cnhAttachedOrOptions.voucherAttachedNow !== undefined) {
      voucherAttachedNow = cnhAttachedOrOptions.voucherAttachedNow;
    }
    actionType = cnhAttachedOrOptions.actionType || 'created';
    if (cnhAttachedOrOptions.adminNotes) adminNotes = cnhAttachedOrOptions.adminNotes;
    if (cnhAttachedOrOptions.rejectReason) rejectReason = cnhAttachedOrOptions.rejectReason;
  }

  const formatDateTime = (d?: Date | string) => {
    if (!d) return 'Não informado';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return 'Não informado';
    return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' +
           dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDays = (d1?: Date | string, d2?: Date | string): number => {
    if (!d1 || !d2) return 1;
    const start = new Date(d1).getTime();
    const end = new Date(d2).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return 1;
    const diffHours = (end - start) / (1000 * 60 * 60);
    return Math.max(1, Math.ceil(diffHours / 24));
  };

  const formatMoney = (val?: number | string) => {
    if (val === undefined || val === null || val === '' || val === 0 || val === '0') return null;
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
    if (isNaN(num) || num <= 0) return null;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const totalDays = calculateDays(rental.pickupDate, rental.returnDate);
  const formattedValue = formatMoney(rental.value);
  const protocolText = rental.protocolNumber || rental.protocol || rental.reservationNumber || 'RAC-PENDENTE';

  // Identificação do Itinerário (Municipal vs Intermunicipal)
  const pickupCityNorm = (rental.pickupCity || rental.pickupStore || '').trim().toUpperCase();
  const returnCityNorm = (rental.returnCity || rental.returnStore || '').trim().toUpperCase();
  const isIntercity = pickupCityNorm && returnCityNorm && pickupCityNorm !== returnCityNorm;
  const itineraryBadge = isIntercity
    ? `<span style="display:inline-block; padding:3px 10px; border-radius:12px; background-color:#eff6ff; color:#1d4ed8; font-weight:700; font-size:10pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1px solid #bfdbfe;">🛣️ Deslocamento Intermunicipal</span>`
    : `<span style="display:inline-block; padding:3px 10px; border-radius:12px; background-color:#f0fdf4; color:#166534; font-weight:700; font-size:10pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1px solid #bbf7d0;">🏙️ Trajeto Municipal / Local</span>`;

  // Formatação Condicional da CNH
  const statusCnhHtml = cnhAttachedNow
    ? `<span style="display:inline-block; padding:4px 12px; border-radius:8px; background-color:#ecfdf5; color:#065f46; font-weight:700; font-size:11pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1px solid #a7f3d0;">📎 CNH Anexa a esta Mensagem</span>`
    : cnhAlreadyOnRecord || rental.hasCnhCopy
    ? `<span style="display:inline-block; padding:4px 12px; border-radius:8px; background-color:#eff6ff; color:#1e40af; font-weight:700; font-size:11pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1px solid #bfdbfe;">✅ CNH em Arquivo Digital Ativo</span>`
    : `<span style="display:inline-block; padding:4px 12px; border-radius:8px; background-color:#fffbeb; color:#92400e; font-weight:700; font-size:11pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1px solid #fde68a;">⚠️ Pendente de Regularização de CNH</span>`;

  // Configurações Visuais Dinâmicas por Status / Ação (CRM Status)
  let headerTitle = "SOLICITAÇÃO DE LOCAÇÃO RAC";
  let headerSubtitle = "Novo pedido de veículo terceirizado registrado na fila operacional";
  let statusHeroBadge = `<div style="display:inline-block; padding:8px 18px; border-radius:30px; background-color:#fef3c7; color:#92400e; font-weight:800; font-size:11pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1.5px solid #f59e0b; box-shadow:0 2px 8px rgba(245,158,11,0.15);">⏳ SOLICITAÇÃO RECEBIDA (EM ANÁLISE PELA GESTÃO)</div>`;
  let statusColorAccent = "#f59e0b";

  if (actionType === 'approved') {
    headerTitle = "SOLICITAÇÃO DE LOCAÇÃO RAC APROVADA";
    headerSubtitle = "Reserva confirmada pela Gestão de Frota • Documentos e voucher disponíveis";
    statusHeroBadge = `<div style="display:inline-block; padding:8px 20px; border-radius:30px; background-color:#ecfdf5; color:#065f46; font-weight:800; font-size:11pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1.5px solid #10b981; box-shadow:0 2px 8px rgba(16,185,129,0.18);">✅ RESERVA APROVADA / AGUARDANDO RETIRADA</div>`;
    statusColorAccent = "#10b981";
  } else if (actionType === 'rejected') {
    headerTitle = "SOLICITAÇÃO DE LOCAÇÃO RAC RECUSADA";
    headerSubtitle = "Informamos que a solicitação não foi autorizada pela Gestão de Frota";
    statusHeroBadge = `<div style="display:inline-block; padding:8px 20px; border-radius:30px; background-color:#fef2f2; color:#991b1b; font-weight:800; font-size:11pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1.5px solid #ef4444; box-shadow:0 2px 8px rgba(239,68,68,0.18);">❌ SOLICITAÇÃO NÃO AUTORIZADA PELA GESTÃO</div>`;
    statusColorAccent = "#ef4444";
  } else if (actionType === 'updated') {
    headerTitle = "ATUALIZAÇÃO DE LOCAÇÃO RAC";
    headerSubtitle = "Os dados da sua solicitação foram atualizados pela Gestão de Frota";
    statusHeroBadge = `<div style="display:inline-block; padding:8px 20px; border-radius:30px; background-color:#eff6ff; color:#1e40af; font-weight:800; font-size:11pt; font-family:'Aptos Narrow', Calibri, sans-serif; border:1.5px solid #3b82f6; box-shadow:0 2px 8px rgba(59,130,246,0.18);">ℹ️ STATUS OPERACIONAL: ${(rental.status || 'Atualizada').toUpperCase()}</div>`;
    statusColorAccent = "#3b82f6";
  }

  // Bloco de Parecer / Despacho da Gestão de Frota (se houver observação ou recusa)
  const notesToDisplay = adminNotes || (actionType === 'rejected' ? rejectReason : '');
  const dispatchBoxHtml = notesToDisplay ? `
    <div style="background-color: ${actionType === 'rejected' ? '#fff1f2' : '#f0fdf4'}; border-left: 5px solid ${actionType === 'rejected' ? '#e11d48' : '#16a34a'}; border-radius: 12px; padding: 18px 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.03); border-top: 1px solid ${actionType === 'rejected' ? '#ffe4e6' : '#dcfce7'}; border-right: 1px solid ${actionType === 'rejected' ? '#ffe4e6' : '#dcfce7'}; border-bottom: 1px solid ${actionType === 'rejected' ? '#ffe4e6' : '#dcfce7'};">
      <div style="font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 800; text-transform: uppercase; color: ${actionType === 'rejected' ? '#9f1239' : '#14532d'}; margin-bottom: 8px; letter-spacing: 0.5px;">
        ${actionType === 'rejected' ? '❌ Parecer de Recusa da Gestão de Frota:' : '💬 Despacho & Orientações da Gestão de Frota:'}
      </div>
      <div style="font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; color: ${actionType === 'rejected' ? '#881337' : '#166534'}; line-height: 1.5; font-weight: 600; white-space: pre-wrap;">
        ${notesToDisplay}
      </div>
    </div>
  ` : '';

  // Bloco de Dados Confirmados da Locadora (quando aprovada / com dados preenchidos)
  const hasRentalCompanyData = rental.rentalCompany || rental.reservationNumber || rental.plate;
  const isApprovedOrUpdated = actionType === 'approved' || actionType === 'updated';

  const rentalCompanyBlockHtml = (isApprovedOrUpdated && hasRentalCompanyData) ? `
    <div style="background-color: #ffffff; border: 1.5px solid #10b981; border-radius: 14px; padding: 18px 20px; margin: 22px 0; box-shadow: 0 4px 14px rgba(16,185,129,0.08);">
      <div style="font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 800; text-transform: uppercase; color: #065f46; letter-spacing: 0.5px; border-bottom: 1px solid #d1fae5; padding-bottom: 8px; margin-bottom: 14px; display: flex; align-items: center;">
        🏢 Dados Oficiais Confirmados da Reserva (Locadora)
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${rental.rentalCompany ? `
        <tr>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 700; color: #475569; width: 42%;">Locadora Parceira:</td>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 800; color: #0f172a;">${rental.rentalCompany}</td>
        </tr>` : ''}
        ${rental.reservationNumber ? `
        <tr>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 700; color: #475569;">Nº Reserva / Localizador:</td>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 800; color: #00753f; font-family: monospace;">${rental.reservationNumber}</td>
        </tr>` : ''}
        ${rental.plate && rental.plate !== 'A DEFINIR' ? `
        <tr>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 700; color: #475569;">Placa Atribuída:</td>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 800; color: #0f172a; font-family: monospace;">${rental.plate}</td>
        </tr>` : ''}
        ${rental.pickupStore ? `
        <tr>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 700; color: #475569;">Loja de Retirada:</td>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 600; color: #0f172a;">${rental.pickupStore}</td>
        </tr>` : ''}
        ${rental.returnStore ? `
        <tr>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 700; color: #475569;">Loja de Devolução:</td>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 600; color: #0f172a;">${rental.returnStore}</td>
        </tr>` : ''}
        ${formattedValue ? `
        <tr>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 700; color: #475569;">Custo Contratado / Aprovado:</td>
          <td style="padding: 7px 0; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 800; color: #059669;">${formattedValue}</td>
        </tr>` : ''}
      </table>
    </div>
  ` : '';

  // Bloco de Anexos Vinculados (Voucher da Locadora e CNH do Condutor)
  const hasVoucherAttached = voucherAttachedNow || rental.hasVoucher || rental.voucherFileName;
  const hasCnhAttached = cnhAttachedNow || rental.hasCnhCopy || rental.cnhFileName;
  
  const attachmentsModuleHtml = (hasVoucherAttached || hasCnhAttached) ? `
    <div style="background-color: #f8fafc; border: 1.5px dashed #0d9488; border-radius: 14px; padding: 18px 20px; margin: 22px 0;">
      <div style="font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; font-weight: 800; text-transform: uppercase; color: #0f766e; letter-spacing: 0.5px; margin-bottom: 12px;">
        📎 Documentos e Anexos Vinculados à Reserva
      </div>
      <div style="font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; color: #334155; line-height: 1.5; margin-bottom: 12px;">
        Os seguintes documentos estão oficialmente anexados a esta mensagem de resposta para download imediato:
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${hasVoucherAttached ? `
        <div style="background-color: #ffffff; border: 1px solid #ccfbf1; border-radius: 8px; padding: 10px 14px; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; color: #0f172a; font-weight: 700;">
          🎫 <span style="color: #0f766e;">Voucher Oficial da Reserva:</span> ${rental.voucherFileName || 'Voucher_Reserva.pdf'} 
          <span style="font-size: 10pt; color: #059669; font-weight: 800; background: #ecfdf5; padding: 2px 8px; border-radius: 6px; margin-left: 6px;">[Anexo Incluso]</span>
          <div style="font-size: 10pt; color: #64748b; font-weight: 500; margin-top: 4px;">
            ⚠️ Apresente este voucher no balcão da locadora juntamente com sua CNH física original.
          </div>
        </div>` : ''}
        ${hasCnhAttached ? `
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-family: 'Aptos Narrow', Calibri, sans-serif; font-size: 11pt; color: #0f172a; font-weight: 700;">
          🪪 <span style="color: #1e40af;">Habilitação do Condutor (CNH):</span> ${rental.cnhFileName || 'CNH_Condutor.pdf'}
          <span style="font-size: 10pt; color: #2563eb; font-weight: 800; background: #eff6ff; padding: 2px 8px; border-radius: 6px; margin-left: 6px;">[Arquivo Vinculado]</span>
        </div>` : ''}
      </div>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle} - Risel ERP</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 25px 12px;
    }
    .container {
      max-width: 660px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #022318 0%, #0b5138 45%, #053b27 100%);
      padding: 34px 24px 30px;
      text-align: center;
      border-top: 5px solid #10b981;
      position: relative;
    }
    .logo-container {
      display: inline-block;
      background: #ffffff;
      padding: 6px 8px;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.5);
      margin-bottom: 12px;
    }
    .logo-img {
      width: 64px;
      height: 64px;
      border-radius: 10px;
      display: block;
      object-fit: cover;
    }
    .company-tag {
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 11px;
      font-weight: 800;
      color: #6ee7b7;
      text-transform: uppercase;
      letter-spacing: 1.8px;
      margin: 0 0 6px 0;
    }
    .header-title {
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 21px;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: -0.3px;
      line-height: 1.25;
    }
    .header-subtitle {
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 13px;
      color: #d1fae5;
      font-weight: 500;
      margin: 6px 0 0;
      line-height: 1.4;
    }
    .protocol-pill {
      display: inline-block;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: #ffffff;
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 11.5px;
      font-weight: 800;
      padding: 6px 18px;
      border-radius: 20px;
      margin-top: 14px;
      letter-spacing: 0.8px;
    }
    .protocol-code {
      color: #fde68a;
      font-family: monospace;
    }
    .body {
      padding: 26px 24px;
    }
    .hero-status {
      text-align: center;
      margin-bottom: 22px;
    }
    .kpi-row {
      display: table;
      width: 100%;
      margin-bottom: 22px;
      border-collapse: separate;
      border-spacing: 8px 0;
    }
    .kpi-col {
      display: table-cell;
      width: 33.33%;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 10px;
      text-align: center;
      vertical-align: top;
    }
    .kpi-label {
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 10pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
    }
    .section-header {
      background: #f8fafc;
      border-left: 4px solid #114D38;
      padding: 8px 14px;
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #114D38;
      letter-spacing: 0.5px;
      margin: 22px 0 10px;
      border-radius: 4px 8px 8px 4px;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .grid-table tr:nth-child(even) {
      background-color: #fafbfd;
    }
    .grid-table td {
      padding: 8px 12px;
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      border-bottom: 1px solid #f1f5f9;
    }
    .grid-table td.label-col {
      width: 38%;
      font-weight: 700;
      color: #475569;
    }
    .grid-table td.val-col {
      font-weight: 600;
      color: #0f172a;
    }
    .route-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 14px 18px;
      margin: 16px 0;
      text-align: center;
    }
    .route-title {
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 10pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 6px;
    }
    .route-display {
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 12pt;
      font-weight: 800;
      color: #0f172a;
    }
    .btn-action {
      display: inline-block;
      background: #00753f;
      color: #ffffff !important;
      padding: 13px 32px;
      border-radius: 10px;
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-weight: 800;
      font-size: 11.5pt;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      box-shadow: 0 4px 12px rgba(0, 117, 63, 0.25);
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 22px 24px;
      text-align: center;
      font-family: 'Aptos Narrow', Calibri, sans-serif;
      font-size: 10pt;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- CABEÇALHO VERDE GRADIENTE COM LOGOTIPO DA RISEL -->
      <div class="header">
        <div class="logo-container">
          <img 
            src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" 
            alt="Risel Combustíveis" 
            class="logo-img"
          />
        </div>
        <p class="company-tag">RISEL COMBUSTÍVEIS &bull; GESTÃO DE FROTAS</p>
        <h1 class="header-title">${headerTitle}</h1>
        <p class="header-subtitle">${headerSubtitle}</p>
        <div class="protocol-pill">
          📋 PROTOCOLO CRM: <span class="protocol-code">${protocolText}</span>
        </div>
      </div>

      <!-- CORPO PRINCIPAL ESTILO CRM -->
      <div class="body">
        
        <!-- STATUS CONDICIONAL EM DESTAQUE -->
        <div class="hero-status">
          ${statusHeroBadge}
        </div>

        <!-- RESUMO RÁPIDO EXECUTIVO (KPIS DO ATENDIMENTO) -->
        <div class="kpi-row">
          <div class="kpi-col">
            <div class="kpi-label">Duração Prevista</div>
            <div class="kpi-value" style="color: #00753f;">⏱️ ${totalDays} diária(s)</div>
          </div>
          <div class="kpi-col">
            <div class="kpi-label">Condutor Designado</div>
            <div class="kpi-value" style="font-size: 10.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              👤 ${rental.driverName || rental.requesterName}
            </div>
          </div>
          <div class="kpi-col">
            <div class="kpi-label">Tipo de Trajeto</div>
            <div class="kpi-value" style="font-size: 10pt;">${itineraryBadge}</div>
          </div>
        </div>

        <!-- PARECER / DESPACHO DA GESTÃO DE FROTA (SE HOUVER) -->
        ${dispatchBoxHtml}

        <!-- DADOS DA LOCADORA CONFIRMADA & VOUCHER (SE HOUVER) -->
        ${rentalCompanyBlockHtml}

        <!-- ANEXOS VINCULADOS (VOUCHER E CNH) -->
        ${attachmentsModuleHtml}

        <!-- ITINERÁRIO EM DESTAQUE -->
        <div class="route-card">
          <div class="route-title">Itinerário de Retirada & Devolução</div>
          <div class="route-display">
            📍 <strong>${rental.pickupCity || rental.pickupStore || 'Origem a definir'}</strong> 
            &nbsp; ➔ &nbsp; 
            🏁 <strong>${rental.returnCity || rental.returnStore || 'Destino a definir'}</strong>
          </div>
        </div>

        <!-- 1. SOLICITANTE & CONTATO CORPORATIVO -->
        <div class="section-header">
          👤 1. Solicitante & Contato Corporativo
        </div>
        <table class="grid-table">
          <tr>
            <td class="label-col">Solicitante Responsável:</td>
            <td class="val-col"><strong>${rental.requesterName}</strong></td>
          </tr>
          <tr>
            <td class="label-col">Setor / Departamento:</td>
            <td class="val-col">${rental.requesterSector || 'Geral'}</td>
          </tr>
          <tr>
            <td class="label-col">Cargo / Função:</td>
            <td class="val-col">${rental.requesterRole || 'Não informado'}</td>
          </tr>
          <tr>
            <td class="label-col">E-mail Corporativo:</td>
            <td class="val-col"><a href="mailto:${rental.requesterEmail}" style="color: #00753f; text-decoration: none; font-weight: 700;">${rental.requesterEmail || 'Não informado'}</a></td>
          </tr>
          <tr>
            <td class="label-col">Telefone / WhatsApp:</td>
            <td class="val-col">${rental.requesterPhone || 'Não informado'}</td>
          </tr>
        </table>

        <!-- 2. CONDUTOR AUTORIZADO & CNH -->
        <div class="section-header">
          🪪 2. Condutor Designado & Habilitação
        </div>
        <table class="grid-table">
          <tr>
            <td class="label-col">Nome do Condutor:</td>
            <td class="val-col"><strong>${rental.driverName || rental.requesterName}</strong></td>
          </tr>
          <tr>
            <td class="label-col">Cargo do Condutor:</td>
            <td class="val-col">${rental.driverRole || rental.requesterRole || 'Condutor Corporativo'}</td>
          </tr>
          <tr>
            <td class="label-col">Situação da Habilitação:</td>
            <td class="val-col">${statusCnhHtml}</td>
          </tr>
        </table>

        <!-- 3. CRONOGRAMA, DATAS & LOCALIDADES -->
        <div class="section-header">
          📅 3. Cronograma & Detalhes de Retirada e Devolução
        </div>
        <table class="grid-table">
          <tr>
            <td class="label-col">Data/Hora de Retirada:</td>
            <td class="val-col"><strong style="color: #047857;">${formatDateTime(rental.pickupDate)}</strong></td>
          </tr>
          <tr>
            <td class="label-col">Cidade de Retirada:</td>
            <td class="val-col">${rental.pickupCity || 'Não informada'}</td>
          </tr>
          <tr>
            <td class="label-col">Ponto / Loja de Retirada:</td>
            <td class="val-col">${rental.pickupStore || 'A definir na locadora'}</td>
          </tr>
          <tr>
            <td class="label-col">Data/Hora de Devolução:</td>
            <td class="val-col"><strong style="color: #b91c1c;">${formatDateTime(rental.returnDate)}</strong></td>
          </tr>
          <tr>
            <td class="label-col">Cidade de Devolução:</td>
            <td class="val-col">${rental.returnCity || 'Não informada'}</td>
          </tr>
          <tr>
            <td class="label-col">Ponto / Loja de Devolução:</td>
            <td class="val-col">${rental.returnStore || 'A definir na locadora'}</td>
          </tr>
          <tr>
            <td class="label-col">Período Total Contratado:</td>
            <td class="val-col"><strong>${totalDays} diária(s)</strong></td>
          </tr>
        </table>

        <!-- 4. ESPECIFICAÇÕES DO VEÍCULO & JUSTIFICATIVA -->
        <div class="section-header">
          🚗 4. Veículo Solicitado & Finalidade do Uso
        </div>
        <table class="grid-table">
          <tr>
            <td class="label-col">Categoria Solicitada:</td>
            <td class="val-col"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-weight: 700; border: 1px solid #e2e8f0;">${rental.category || 'Hatch / Compacto'}</span></td>
          </tr>
          <tr>
            <td class="label-col">Finalidade Operacional:</td>
            <td class="val-col">${rental.purpose || 'Uso Operacional Corporativo'}</td>
          </tr>
          ${rental.observations ? `
          <tr>
            <td class="label-col">Observações do Solicitante:</td>
            <td class="val-col" style="white-space: pre-wrap; color: #334155;">${rental.observations}</td>
          </tr>` : ''}
          ${rental.base ? `
          <tr>
            <td class="label-col">Base Operacional Vinculada:</td>
            <td class="val-col">${rental.base}</td>
          </tr>` : ''}
        </table>

        <!-- BOTÃO DE ACESSO AO CRM NO SISTEMA -->
        <div style="text-align: center; margin-top: 28px; margin-bottom: 12px;">
          <a href="https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/frota?tab=reservas&sub=racRentals" class="btn-action">
            Acessar Módulo RAC no Risel ERP &rarr;
          </a>
        </div>

      </div>

      <!-- RODAPÉ CORPORATIVO -->
      <div class="footer">
        <p style="margin: 0 0 6px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">
          Risel Combustíveis Ltda &bull; Sistema Integrado de Gestão de Frota (ERP)
        </p>
        <p style="margin: 0; font-size: 9.5pt;">
          Mensagem automática emitida em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} &bull; Protocolo: ${protocolText}
        </p>
      </div>

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
        department: normalizeNomeSetor(data.department || data.setor || '', 'Operações'),
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
        department: normalizeNomeSetor(data.department || data.setor || '', 'Operações'),
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
        requesterSector: normalizeNomeSetor(data.requesterSector || data.setor || data.departamento || 'Operações', 'Operações'),
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
export const deleteVehicle = async (id: string) => {
    try {
        if (!id || id.startsWith('local_')) return;
        return await vehiclesCollection.doc(id).delete();
    } catch (error) {
        console.warn("deleteVehicle remoto falhou:", error);
    }
};


// --- Funções CRUD para Reservas com Fallback e Cache Resiliente ---
const RESERVATIONS_STORAGE_KEY = 'risel_reservas_cache_v2';
let useReservationsLocalStorageFallback = false;
const reservationListeners: ((data: Reservation[]) => void)[] = [];

const notifyReservationListeners = () => {
  const data = getReservationsFromLocalStorage();
  reservationListeners.forEach(listener => {
    try {
      listener(data);
    } catch (e) {
      console.error("Erro ao notificar ouvinte de reservas:", e);
    }
  });
};

export const getReservationsFromLocalStorage = (): Reservation[] => {
  try {
    const raw = localStorage.getItem(RESERVATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        ...item,
        departureDateTime: item.departureDateTime ? new Date(item.departureDateTime) : new Date(),
        returnDate: item.returnDate ? new Date(item.returnDate) : new Date(),
        actualReturnDateTime: item.actualReturnDateTime ? new Date(item.actualReturnDateTime) : undefined,
        requestTimestamp: item.requestTimestamp ? new Date(item.requestTimestamp) : undefined
      }));
    }
    return [];
  } catch (err) {
    console.error("Erro ao ler reservas do localStorage:", err);
    return [];
  }
};

// Mapa em memória e armazenamento persistente para rastrear atualizações locais e evitar que snapshots remotos defasados revertam status
const recentReservationUpdates = new Map<string, { timestamp: number; data: any }>();
const RESERVATIONS_OVERRIDES_STORAGE_KEY = 'risel_reservas_overrides_v2';

export const getPersistentReservationOverrides = (): Record<string, any> => {
  try {
    const raw = localStorage.getItem(RESERVATIONS_OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const setPersistentReservationOverride = (id: string, data: any) => {
  if (!id) return;
  try {
    const current = getPersistentReservationOverrides();
    current[id] = {
      ...(current[id] || {}),
      ...data,
      timestamp: Date.now()
    };
    localStorage.setItem(RESERVATIONS_OVERRIDES_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {}
};

// Sincroniza e carrega reservas do backend (/api/reservations)
export const fetchBackendReservations = async (): Promise<Reservation[]> => {
  try {
    const res = await fetch('/api/reservations');
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item && item.id && item.status) {
            setPersistentReservationOverride(item.id, item);
          }
        });
        return items.map(item => ({
          ...item,
          departureDateTime: item.departureDateTime ? new Date(item.departureDateTime) : new Date(),
          returnDate: item.returnDate ? new Date(item.returnDate) : new Date(),
          actualReturnDateTime: item.actualReturnDateTime ? new Date(item.actualReturnDateTime) : undefined,
          requestTimestamp: item.requestTimestamp ? new Date(item.requestTimestamp) : undefined
        }));
      }
    }
  } catch (e) {
    console.warn("Aviso ao sincronizar reservas com o backend /api/reservations:", e);
  }
  return [];
};

let isAuthenticatingAdmin = false;
export const ensureAdminFirebaseAuth = async () => {
    if (isAuthenticatingAdmin) return;
    try {
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            isAuthenticatingAdmin = true;
            await auth.signInWithEmailAndPassword('deny.goncalves@risel.com.br', '@Cap150957');
            console.log('[Firebase Auth] Sessão administrativa autenticada com sucesso');
        }
    } catch (e: any) {
        console.warn('[Firebase Auth] Aviso na autenticação de serviço:', e.message);
    } finally {
        isAuthenticatingAdmin = false;
    }
};

export const saveReservationsToLocalStorage = (reservations: Reservation[]) => {
  try {
    localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
  } catch (err) {
    console.error("Erro ao salvar reservas no localStorage:", err);
  }
};

export const getReservations = async (): Promise<Reservation[]> => {
  ensureAdminFirebaseAuth().catch(() => {});
  
  // Tenta carregar do backend em paralelo
  fetchBackendReservations().catch(() => {});

  if (useReservationsLocalStorageFallback) {
    return getReservationsFromLocalStorage();
  }
  try {
    const snapshot = await reservationsCollection.orderBy('departureDateTime', 'desc').get();
    const firestoreReservations = snapshot.docs
      .map(docToReservation)
      .filter((r): r is Reservation => r !== null);
      
    if (firestoreReservations.length === 0) {
      return getReservationsFromLocalStorage();
    }
    
    const persistentOverrides = getPersistentReservationOverrides();

    // Sincroniza o cache local com os dados remotos respeitando atualizações recentes e status persistidos
    const reconciled = firestoreReservations.map(remoteRes => {
        const recent = recentReservationUpdates.get(remoteRes.id);
        const persistent = persistentOverrides[remoteRes.id];
        
        let finalStatus = remoteRes.status;
        let finalNotes = remoteRes.adminNotes;

        // Se houver alteração persistida (ex: Aprovada, Em Uso, Rejeitada, Cancelada), nunca retrocede para Pendente
        if (persistent && persistent.status && persistent.status !== ReservationStatus.Pending) {
            finalStatus = persistent.status;
            if (persistent.adminNotes) finalNotes = persistent.adminNotes;
        }

        if (recent && recent.data) {
            if (recent.data.status) finalStatus = recent.data.status;
            if (recent.data.adminNotes !== undefined) finalNotes = recent.data.adminNotes;
            return {
                ...remoteRes,
                ...recent.data,
                status: finalStatus,
                adminNotes: finalNotes
            };
        }

        return {
            ...remoteRes,
            status: finalStatus,
            adminNotes: finalNotes
        };
    });
    saveReservationsToLocalStorage(reconciled);
    return reconciled;
  } catch (error) {
    console.warn("getReservations falhou, usando fallback do localStorage:", error);
    useReservationsLocalStorageFallback = true;
    return getReservationsFromLocalStorage();
  }
};

export const subscribeToReservations = (onUpdate: (data: Reservation[]) => void, onError: (error: any) => void) => {
    let isSubscribed = true;
    reservationListeners.push(onUpdate);

    // Garante que o Firebase Auth esteja autenticado com a conta administrativa de serviço
    ensureAdminFirebaseAuth().catch(() => {});

    // Imediatamente fornece os dados do cache local para carregamento instantâneo
    const initialLocal = getReservationsFromLocalStorage();
    if (initialLocal.length > 0) {
        onUpdate(initialLocal);
    }

    // Busca atualizações do backend e notifica caso haja novidades
    fetchBackendReservations().then(backendItems => {
        if (isSubscribed && backendItems.length > 0) {
            const currentCached = getReservationsFromLocalStorage();
            const persistentOverrides = getPersistentReservationOverrides();
            const merged = currentCached.map(r => {
                const over = persistentOverrides[r.id];
                return over ? { ...r, ...over, status: over.status || r.status } : r;
            });
            saveReservationsToLocalStorage(merged);
            onUpdate(merged);
        }
    }).catch(() => {});

    const unsubscribe = reservationsCollection.orderBy('departureDateTime', 'desc').onSnapshot(
      snapshot => {
        if (!isSubscribed) return;
        const reservations = snapshot.docs.map(docToReservation).filter((r): r is Reservation => r !== null);
        if (reservations.length > 0) {
            const persistentOverrides = getPersistentReservationOverrides();

            // Reconciliação inteligente: preserva aprovações e alterações recentes
            const reconciled = reservations.map(remoteRes => {
                const recent = recentReservationUpdates.get(remoteRes.id);
                const persistent = persistentOverrides[remoteRes.id];
                
                let finalStatus = remoteRes.status;
                let finalNotes = remoteRes.adminNotes;

                if (persistent && persistent.status && persistent.status !== ReservationStatus.Pending) {
                    finalStatus = persistent.status;
                    if (persistent.adminNotes) finalNotes = persistent.adminNotes;
                }

                if (recent && recent.data) {
                    if (recent.data.status) finalStatus = recent.data.status;
                    if (recent.data.adminNotes !== undefined) finalNotes = recent.data.adminNotes;
                    return {
                        ...remoteRes,
                        ...recent.data,
                        status: finalStatus,
                        adminNotes: finalNotes
                    };
                }

                return {
                    ...remoteRes,
                    status: finalStatus,
                    adminNotes: finalNotes
                };
            });
            saveReservationsToLocalStorage(reconciled);
            onUpdate(reconciled);
        } else {
            const cached = getReservationsFromLocalStorage();
            if (cached.length > 0) {
                onUpdate(cached);
            } else {
                onUpdate([]);
            }
        }
      }, 
      error => {
        if (!isSubscribed) return;
        console.warn("Sincronização de reservas remota falhou, ativando cache local:", error);
        useReservationsLocalStorageFallback = true;
        onUpdate(getReservationsFromLocalStorage());
        if (onError) onError(error);
      }
    );

    return () => {
      isSubscribed = false;
      const index = reservationListeners.indexOf(onUpdate);
      if (index !== -1) {
        reservationListeners.splice(index, 1);
      }
      unsubscribe();
    };
};

export const addReservation = async (data: Omit<Reservation, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'requestTimestamp'>) => {
    const reservationWithAllFields: Omit<Reservation, 'id'> = {
        ...data,
        department: normalizeNomeSetor(data.department, 'Operações'),
        status: ReservationStatus.Pending,
        requestTimestamp: new Date(),
    };

    // Atualiza imediatamente no cache local
    const currentList = getReservationsFromLocalStorage();
    const tempId = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newReservation: Reservation = {
        ...reservationWithAllFields,
        id: tempId,
    };
    currentList.unshift(newReservation);
    saveReservationsToLocalStorage(currentList);
    notifyReservationListeners();

    ensureAdminFirebaseAuth().catch(() => {});

    try {
        // Envia ao endpoint de contingência no servidor com credenciais de produção
        fetch('/api/reservations/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: removeUndefined(reservationWithAllFields) }),
        }).catch(err => console.warn("Endpoint /api/reservations/add aviso:", err));

        const addPromise = reservationsCollection.add(removeUndefined(reservationWithAllFields));
        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout Firestore")), 2500));
        const docRef = await Promise.race([addPromise, timeoutPromise]);
        if (docRef && docRef.id) {
            // Substitui o ID temporário pelo ID real do Firestore
            const updatedList = getReservationsFromLocalStorage().map(r => r.id === tempId ? { ...r, id: docRef.id } : r);
            saveReservationsToLocalStorage(updatedList);
            notifyReservationListeners();
            return { id: docRef.id };
        }
        return { id: tempId };
    } catch (err) {
        console.warn("Adição no Firestore falhou ou expirou, reserva mantida no cache local:", err);
        useReservationsLocalStorageFallback = true;
        return { id: tempId };
    }
};

export const updateReservation = async (id: string, data: Partial<Omit<Reservation, 'id'>>) => {
    const sanitizedData = { ...data };
    if (sanitizedData.department !== undefined) {
        sanitizedData.department = normalizeNomeSetor(sanitizedData.department, 'Operações');
    }

    // Registra a atualização recente no mapa de concorrência e no override persistente
    recentReservationUpdates.set(id, { timestamp: Date.now(), data: sanitizedData });
    setPersistentReservationOverride(id, sanitizedData);

    // 1. Atualização imediata no cache local e notificação de ouvintes (UI Instantânea)
    const currentList = getReservationsFromLocalStorage();
    const idx = currentList.findIndex(r => r.id === id);
    if (idx !== -1) {
        currentList[idx] = {
            ...currentList[idx],
            ...sanitizedData,
            departureDateTime: sanitizedData.departureDateTime ? new Date(sanitizedData.departureDateTime) : currentList[idx].departureDateTime,
            returnDate: sanitizedData.returnDate ? new Date(sanitizedData.returnDate) : currentList[idx].returnDate,
            actualReturnDateTime: sanitizedData.actualReturnDateTime ? new Date(sanitizedData.actualReturnDateTime) : currentList[idx].actualReturnDateTime,
        };
        saveReservationsToLocalStorage(currentList);
        notifyReservationListeners();
    }

    // 2. Envia ao endpoint no servidor para persistência física no backend
    try {
        fetch('/api/reservations/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, data: removeUndefined(sanitizedData) }),
        }).catch(err => console.warn("Endpoint /api/reservations/update aviso:", err));
    } catch (apiErr) {
        console.warn("Aviso ao disparar /api/reservations/update:", apiErr);
    }

    // 3. Se for ID temporário local, não tenta atualizar no Firestore diretamente
    if (id.startsWith('res_') || id.startsWith('local_')) {
        return;
    }

    // 4. Tenta garantir autenticação do cliente se necessário
    ensureAdminFirebaseAuth().catch(() => {});

    // 5. Executa persistência no Firestore do cliente
    try {
        const payload = removeUndefined(sanitizedData);
        const updatePromise = reservationsCollection.doc(id).set(payload, { merge: true });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Firestore")), 2500));
        await Promise.race([updatePromise, timeoutPromise]);
    } catch (error) {
        console.warn(`Atualização remota no Firestore da reserva ${id} falhou ou expirou, persistida com segurança via API/Cache:`, error);
    }
};

export const deleteReservation = async (id: string) => {
    // Remove do cache local e do override persistente
    const currentList = getReservationsFromLocalStorage().filter(r => r.id !== id);
    saveReservationsToLocalStorage(currentList);
    notifyReservationListeners();

    try {
      const overrides = getPersistentReservationOverrides();
      if (overrides[id]) {
        delete overrides[id];
        localStorage.setItem(RESERVATIONS_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
      }
    } catch (e) {}

    if (id.startsWith('res_') || id.startsWith('local_')) return;

    ensureAdminFirebaseAuth().catch(() => {});

    try {
        fetch('/api/reservations/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        }).catch(err => console.warn("Endpoint /api/reservations/delete aviso:", err));

        const deletePromise = reservationsCollection.doc(id).delete();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Firestore")), 2500));
        await Promise.race([deletePromise, timeoutPromise]);
    } catch (error) {
        console.warn("deleteReservation remoto falhou ou expirou:", error);
    }
};


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
        department: normalizeNomeSetor(data.department, 'Operações'),
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

export const updateDailyUseTrip = (id: string, data: Partial<Omit<DailyTrip, 'id'>>) => {
    const sanitizedData = { ...data };
    if (sanitizedData.department !== undefined) {
        sanitizedData.department = normalizeNomeSetor(sanitizedData.department, 'Operações');
    }
    return dailyUseCollection.doc(id).update(removeUndefined(sanitizedData));
};
export const deleteDailyUseTrip = async (id: string) => {
    try {
        if (!id || id.startsWith('local_')) return;
        return await dailyUseCollection.doc(id).delete();
    } catch (error) {
        console.warn("deleteDailyUseTrip remoto falhou:", error);
    }
};

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
  const sanitized = {
    ...data,
    requesterSector: normalizeNomeSetor(data.requesterSector, 'Operações')
  };
  if (useRacLocalStorageFallback) {
    const rentals = getRacRentalsFromLocalStorage();
    const newRental: RacRental = {
      ...sanitized,
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
    return await racRentalsCollection.add(removeUndefined(sanitized));
  } catch (error) {
    console.warn("addRacRental failed, falling back to local storage.", error);
    useRacLocalStorageFallback = true;
    
    const rentals = getRacRentalsFromLocalStorage();
    const newRental: RacRental = {
      ...sanitized,
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
  const sanitizedData = { ...data };
  if (sanitizedData.requesterSector !== undefined) {
    sanitizedData.requesterSector = normalizeNomeSetor(sanitizedData.requesterSector, 'Operações');
  }
  if (useRacLocalStorageFallback || id.startsWith('local_')) {
    const rentals = getRacRentalsFromLocalStorage();
    const idx = rentals.findIndex(r => r.id === id);
    if (idx !== -1) {
      rentals[idx] = {
        ...rentals[idx],
        ...sanitizedData,
        reservationDate: sanitizedData.reservationDate ? new Date(sanitizedData.reservationDate) : rentals[idx].reservationDate,
        pickupDate: sanitizedData.pickupDate ? new Date(sanitizedData.pickupDate) : rentals[idx].pickupDate,
        returnDate: sanitizedData.returnDate ? new Date(sanitizedData.returnDate) : rentals[idx].returnDate,
      };
      rentals.sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
      saveRacRentalsToLocalStorage(rentals);
      notifyRacListeners();
    }
    return;
  }
  try {
    const payload = removeUndefined(sanitizedData);
    const updatePromise = racRentalsCollection.doc(id).set(payload, { merge: true });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Firestore")), 2000));
    return await Promise.race([updatePromise, timeoutPromise]);
  } catch (error) {
    console.warn("updateRacRental failed, falling back to local storage.", error);
    useRacLocalStorageFallback = true;
    
    const rentals = getRacRentalsFromLocalStorage();
    const idx = rentals.findIndex(r => r.id === id);
    if (idx !== -1) {
      rentals[idx] = {
        ...rentals[idx],
        ...sanitizedData,
        reservationDate: sanitizedData.reservationDate ? new Date(sanitizedData.reservationDate) : rentals[idx].reservationDate,
        pickupDate: sanitizedData.pickupDate ? new Date(sanitizedData.pickupDate) : rentals[idx].pickupDate,
        returnDate: sanitizedData.returnDate ? new Date(sanitizedData.returnDate) : rentals[idx].returnDate,
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

