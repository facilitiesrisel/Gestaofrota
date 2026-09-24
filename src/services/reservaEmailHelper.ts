import { getReservasEmailRecipients } from '../constants_reserva';

/**
 * Retorna os e-mails de todos os administradores e gestores cadastrados no sistema
 * REGRA MANDATÓRIA RISEL: deny.risel@gmail.com nunca deve receber nenhum e-mail.
 */
export function getAllSystemAdminEmails(): string[] {
  const adminsSet = new Set<string>([
    'deny.goncalves@risel.com.br',
    'lorena.padilha@risel.com.br'
  ]);

  // 1. Destinatários configurados para o módulo de reservas
  try {
    const reservasRecipients = getReservasEmailRecipients();
    reservasRecipients.forEach(email => {
      const clean = (email || '').trim().toLowerCase();
      if (clean && clean.includes('@') && clean !== 'deny.risel@gmail.com') {
        adminsSet.add(clean);
      }
    });
  } catch (e) {}

  // 2. Busca todos os usuários do sistema com perfil de Administrador ou Gestor
  try {
    if (typeof window !== 'undefined') {
      const storedUsers = localStorage.getItem('risel_users_list');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => {
            const email = (u?.email || '').trim().toLowerCase();
            const role = (u?.role || '').toLowerCase();
            if (email && email.includes('@') && email !== 'deny.risel@gmail.com' && (role === 'admin' || role === 'gestor' || role === 'diretoria')) {
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
          if (email && email.includes('@') && email !== 'deny.risel@gmail.com' && role === 'admin') {
            adminsSet.add(email);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Garantia absoluta de exclusão de deny.risel@gmail.com
  adminsSet.delete('deny.risel@gmail.com');

  return Array.from(adminsSet);
}

/**
 * Localiza o e-mail do usuário no cadastro do sistema, reservas prévias ou locações RAC a partir do nome
 */
export function findUserEmailByName(userName: string): string | null {
  if (!userName || typeof userName !== 'string') return null;
  const cleanTarget = userName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!cleanTarget) return null;

  try {
    if (typeof window !== 'undefined') {
      // 1. Busca no cadastro oficial de usuários (risel_users_list)
      const storedUsers = localStorage.getItem('risel_users_list');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          // Busca por correspondência exata de nome
          for (const u of parsed) {
            const uName = (u?.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const uEmail = (u?.email || '').trim().toLowerCase();
            if (uEmail && uEmail.includes('@') && uEmail !== 'deny.risel@gmail.com' && uName === cleanTarget) {
              return uEmail;
            }
          }
          // Busca por inclusão de primeiro e último nome
          for (const u of parsed) {
            const uName = (u?.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const uEmail = (u?.email || '').trim().toLowerCase();
            if (uEmail && uEmail.includes('@') && uEmail !== 'deny.risel@gmail.com' && (uName.includes(cleanTarget) || cleanTarget.includes(uName))) {
              return uEmail;
            }
          }
        }
      }

      // 2. Busca no histórico de reservas da frota
      const storedReservations = localStorage.getItem('risel_reservations');
      if (storedReservations) {
        const resList = JSON.parse(storedReservations);
        if (Array.isArray(resList)) {
          for (const r of resList) {
            const rName = (r?.requesterName || r?.driverName || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const rEmail = (r?.email || r?.requesterEmail || r?.userEmail || '').trim().toLowerCase();
            if (rEmail && rEmail.includes('@') && rEmail !== 'deny.risel@gmail.com' && (rName === cleanTarget || rName.includes(cleanTarget))) {
              return rEmail;
            }
          }
        }
      }

      // 3. Busca no histórico de locações RAC
      const storedRac = localStorage.getItem('risel_rac_rentals');
      if (storedRac) {
        const racList = JSON.parse(storedRac);
        if (Array.isArray(racList)) {
          for (const r of racList) {
            const rName = (r?.requesterName || r?.driverName || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const rEmail = (r?.email || r?.requesterEmail || r?.userEmail || '').trim().toLowerCase();
            if (rEmail && rEmail.includes('@') && rEmail !== 'deny.risel@gmail.com' && (rName === cleanTarget || rName.includes(cleanTarget))) {
              return rEmail;
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
 * Regras:
 * - O solicitante é SEMPRE incluído no 'primaryTo'
 * - deny.risel@gmail.com é ESTRITAMENTE BANIDO de qualquer lista (To, CC, BCC)
 * - Funciona identicamente para ações feitas por qualquer admin ou gestor do sistema
 */
export function resolveReservationRecipients(
  reservation: any,
  additionalEmails: string[] = []
): ResolvedRecipients {
  const allAdmins = getAllSystemAdminEmails();

  if (!reservation) {
    return {
      primaryTo: allAdmins,
      ccList: undefined,
      requesterEmail: '',
      adminEmails: allAdmins,
      isRequesterValid: false
    };
  }

  // 1. Resolve o e-mail do solicitante em todas as propriedades possíveis
  let reqEmail = (
    reservation.email || 
    reservation.requesterEmail || 
    reservation.userEmail || 
    reservation.solicitanteEmail || 
    reservation.driverEmail ||
    reservation.contatoEmail ||
    reservation.autorEmail ||
    (typeof reservation.createdByUser === 'string' && reservation.createdByUser.includes('@') ? reservation.createdByUser : '') ||
    (typeof reservation.createdBy === 'string' && reservation.createdBy.includes('@') ? reservation.createdBy : '') ||
    ''
  ).trim().toLowerCase();

  // Se o e-mail cadastrado for deny.risel@gmail.com, redireciona para a conta corporativa oficial
  if (reqEmail === 'deny.risel@gmail.com') {
    reqEmail = 'deny.goncalves@risel.com.br';
  }

  // Se não encontrou e-mail direto na reserva, tenta localizar pelo nome do solicitante ou condutor
  if (!reqEmail || !reqEmail.includes('@')) {
    const foundEmail = findUserEmailByName(reservation.requesterName || reservation.driverName);
    if (foundEmail) {
      reqEmail = foundEmail;
    }
  }

  // Se ainda assim não encontrou e o solicitante tem formato corporativo Risel (ex: nome e sobrenome)
  if (!reqEmail || !reqEmail.includes('@')) {
    const nameParts = (reservation.requesterName || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/);
    if (nameParts.length >= 2 && nameParts[0] && nameParts[nameParts.length - 1]) {
      const candidateEmail = `${nameParts[0]}.${nameParts[nameParts.length - 1]}@risel.com.br`;
      // Verifica se existe um usuário correspondente
      const foundCandidate = findUserEmailByName(nameParts[0]);
      reqEmail = foundCandidate || candidateEmail;
    }
  }

  const isRequesterValid = Boolean(reqEmail && reqEmail.includes('@') && reqEmail !== 'deny.risel@gmail.com');

  // 2. Resolve a lista completa de Administradores e Destinatários adicionais (sem deny.risel@gmail.com)
  const cleanAdditional = additionalEmails
    .map(e => String(e).trim().toLowerCase())
    .filter(e => e && e.includes('@') && e !== 'deny.risel@gmail.com');

  const adminCcSet = new Set<string>([
    ...allAdmins,
    ...cleanAdditional
  ]);

  // Remove deny.risel@gmail.com com certeza absoluta
  adminCcSet.delete('deny.risel@gmail.com');

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
    // Se por acaso o solicitante não possui e-mail cadastrado, envia para os administradores
    return {
      primaryTo: allAdminEmails,
      ccList: undefined,
      requesterEmail: '',
      adminEmails: allAdminEmails,
      isRequesterValid: false
    };
  }
}
