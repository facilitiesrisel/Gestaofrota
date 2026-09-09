/**
 * Helper para detecção e autorização do usuário Master / Gestor Executivo (Deny Gonçalves)
 */

export const isDenyUser = (currentUser?: any): boolean => {
  // Se o usuário deslogou ou a sessão expirou por inatividade (> 1 hora), bloqueia autorização automática
  if (typeof window !== 'undefined') {
    if (localStorage.getItem("risel_explicit_logout") === "true") {
      return false;
    }
    const lastActivity = localStorage.getItem("risel_last_activity");
    if (lastActivity) {
      const lastTime = parseInt(lastActivity, 10);
      if (!isNaN(lastTime) && Date.now() - lastTime > 3600000) {
        return false;
      }
    }
  }

  // 1. Verifica pelo objeto de usuário passado via prop ou hook useAuth
  if (currentUser) {
    const email = (currentUser.email || currentUser.username || '').toLowerCase().trim();
    if (
      email === 'deny.goncalves@risel.com.br' ||
      email.includes('deny') ||
      email === 'lorena.padilha@risel.com.br' ||
      email.includes('lorena') ||
      currentUser.role === 'admin'
    ) {
      return true;
    }
  }

  // 2. Verifica pelas múltiplas chaves de sessão salvas no navegador
  try {
    const sessionKeys = [
      'risel_session',
      'risel_active_session',
      'risel_auth_user',
      'currentUser',
      'risel_user',
      'user'
    ];

    for (const key of sessionKeys) {
      const stored = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const email = (parsed.email || parsed.username || parsed.name || '').toLowerCase().trim();
          if (
            email === 'deny.goncalves@risel.com.br' ||
            email.includes('deny') ||
            email === 'lorena.padilha@risel.com.br' ||
            email.includes('lorena') ||
            parsed.role === 'admin' ||
            parsed.permissions?.admin === true
          ) {
            return true;
          }
        } catch (e) {
          if (stored.toLowerCase().includes('deny') || stored.toLowerCase().includes('lorena') || stored.toLowerCase().includes('admin')) {
            return true;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Erro ao verificar sessão do gestor:", e);
  }

  // Se não encontrar nenhuma restrição de sessão ou estiver no ambiente direto
  return false;
};
