import { getReservasEmailRecipients } from '../constants_reserva';

/**
 * Retorna os e-mails de todos os administradores e gestores cadastrados no sistema
 */
export function getAllSystemAdminEmails(): string[] {
  const adminsSet = new Set<string>([
    'deny.goncalves@risel.com.br',
    'lorena.padilha@risel.com.br',
    'deny.risel@gmail.com'
  ]);

  // 1. Destinatários configurados para o módulo de reservas
  try {
    const reservasRecipients = getReservasEmailRecipients();
    reservasRecipients.forEach(email => {
      if (email && email.includes('@')) {
        adminsSet.add(email.trim().toLowerCase());
      }
    });
  } catch (e) {}

  // 2. Busca todos os usuários do sistema com perfil de Administrador ('admin')
  try {
    if (typeof window !== 'undefined') {
      const storedUsers = localStorage.getItem('risel_users_list');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => {
            const email = (u?.email || '').trim().toLowerCase();
            const role = (u?.role || '').toLowerCase();
            if (email && email.includes('@') && (role === 'admin' || role === 'gestor' || role === 'diretoria')) {
              adminsSet.add(email);
            }
          });
        }
      }

      // Usuário atualmente autenticado se for admin
      const currentUser = localStorage.getItem('risel_user');
      if (currentUser) {
        try {
          const parsedUser = JSON.parse(currentUser);
          const email = (parsedUser?.email || '').trim().toLowerCase();
          const role = (parsedUser?.role || '').toLowerCase();
          if (email && email.includes('@') && role === 'admin') {
            adminsSet.add(email);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return Array.from(adminsSet);
}

/**
 * Localiza o e-mail do usuário no cadastro do sistema a partir do nome
 */
export function findUserEmailByName(userName: string): string | null {
  if (!userName || typeof userName !== 'string') return null;
  const cleanTarget = userName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!cleanTarget) return null;

  try {
    if (typeof window !== 'undefined') {
      const storedUsers = localStorage.getItem('risel_users_list');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          // Busca por correspondência exata
          for (const u of parsed) {
            const uName = (u?.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const uEmail = (u?.email || '').trim().toLowerCase();
            if (uEmail && uEmail.includes('@') && uName === cleanTarget) {
              return uEmail;
            }
          }
          // Busca por inclusão de primeiro e último nome
          for (const u of parsed) {
            const uName = (u?.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const uEmail = (u?.email || '').trim().toLowerCase();
            if (uEmail && uEmail.includes('@') && (uName.includes(cleanTarget) || cleanTarget.includes(uName))) {
              return uEmail;
            }
          }
        }
      }
    }
  } catch (e) {}

  return null;
}

export interface ResolvedRecipients {
  primaryTo: string[];
  ccList: string[] | undefined;
  requesterEmail: string;
  adminEmails: string[];
  isRequesterValid: boolean;
}

/**
 * Resolve e garante com precisão os destinatários (Solicitante no 'To' e Administradores no 'CC')
 */
export function resolveReservationRecipients(
  reservation: any,
  additionalEmails: string[] = []
): ResolvedRecipients {
  if (!reservation) {
    const defaultAdmins = getAllSystemAdminEmails();
    return {
      primaryTo: defaultAdmins,
      ccList: undefined,
      requesterEmail: '',
      adminEmails: defaultAdmins,
      isRequesterValid: false
    };
  }

  // 1. Resolve o e-mail do solicitante
  let reqEmail = (
    reservation.email || 
    reservation.requesterEmail || 
    reservation.userEmail || 
    reservation.solicitanteEmail || 
    ''
  ).trim().toLowerCase();

  // Se não encontrou e-mail direto na reserva, tenta localizar pelo nome do solicitante
  if (!reqEmail || !reqEmail.includes('@')) {
    const foundEmail = findUserEmailByName(reservation.requesterName || reservation.driverName);
    if (foundEmail) {
      reqEmail = foundEmail;
    }
  }

  const isRequesterValid = Boolean(reqEmail && reqEmail.includes('@'));

  // 2. Resolve a lista completa de Administradores e Gestores
  const allAdmins = getAllSystemAdminEmails();
  const cleanAdditional = additionalEmails
    .map(e => String(e).trim().toLowerCase())
    .filter(e => e && e.includes('@'));

  const adminCcSet = new Set<string>([
    ...allAdmins,
    ...cleanAdditional
  ]);

  const allAdminEmails = Array.from(adminCcSet);

  // 3. Monta a separação estrita: Solicitante como 'To' e Admins como 'CC'
  if (isRequesterValid) {
    const primaryTo = [reqEmail];
    // Remove o solicitante da lista de cópia para evitar duplicidade na caixa de entrada
    const filteredCc = allAdminEmails.filter(adminEmail => adminEmail !== reqEmail);
    const ccList = filteredCc.length > 0 ? filteredCc : undefined;

    return {
      primaryTo,
      ccList,
      requesterEmail: reqEmail,
      adminEmails: allAdminEmails,
      isRequesterValid: true
    };
  } else {
    // Se o solicitante não possui e-mail cadastrado, envia para todos os admins diretamente
    return {
      primaryTo: allAdminEmails,
      ccList: undefined,
      requesterEmail: '',
      adminEmails: allAdminEmails,
      isRequesterValid: false
    };
  }
}
