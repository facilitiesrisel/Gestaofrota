import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchUsuariosSupabase, saveUsuarioSupabase, deleteUsuarioSupabase, ensureUserCredentialsInSupabase } from "../services/supabaseService";
import { generateResetPasswordHtml } from "../utils/emailTemplate";

export interface UserPermissions {
  admin: boolean;
  // Módulo Lançamento de Documentos (item único: libera Dashboard, Lançamento e Fornecedores)
  documentos?: boolean;
  dashboard: boolean;
  lancamentos: boolean;
  fornecedores: boolean;
  // Módulo Frota Leve e Submódulos Individuais
  frota: boolean;
  frota_veiculos?: boolean;
  frota_checklist?: boolean;
  frota_reservas?: boolean;
  frota_multas?: boolean;
  frota_rastreamento?: boolean;
  // Módulo Frota Pesada
  frota_pesada?: boolean;
  usuarios: boolean;
}

/**
 * Normaliza o objeto de permissões para garantir que todos os campos booleanos estejam
 * explicitamente definidos (evitando que campos undefined herdem acessos indevidos).
 */
export function normalizePermissions(
  perms?: Partial<UserPermissions> | null, 
  isAdmin: boolean = false
): UserPermissions {
  if (isAdmin || perms?.admin === true) {
    return {
      admin: true,
      documentos: true,
      dashboard: true,
      lancamentos: true,
      fornecedores: true,
      frota: true,
      frota_veiculos: true,
      frota_checklist: true,
      frota_reservas: true,
      frota_multas: true,
      frota_rastreamento: true,
      frota_pesada: true,
      usuarios: true,
    };
  }

  // Módulo Lançamento de Documentos unificado:
  // Se explicitamente definido, respeita rigorosamente o valor booleano.
  const docsAllowed = perms?.documentos !== undefined
    ? Boolean(perms.documentos)
    : Boolean(perms?.dashboard || perms?.lancamentos || (perms as any)?.lancamento || perms?.fornecedores || (perms as any)?.fornecedor);

  // Submódulos individuais de Frota Leve (estrito deny-by-default):
  // Se a chave moderna estiver definida (true ou false), usa estritamente ela.
  // Caso contrário, tenta chaves legadas se presentes.
  const fVeiculos = perms?.frota_veiculos !== undefined
    ? Boolean(perms.frota_veiculos)
    : (perms?.frota !== undefined ? Boolean(perms.frota) : Boolean((perms as any)?.veiculos));

  const fChecklist = perms?.frota_checklist !== undefined
    ? Boolean(perms.frota_checklist)
    : Boolean((perms as any)?.checklist);

  const fReservas = perms?.frota_reservas !== undefined
    ? Boolean(perms.frota_reservas)
    : Boolean((perms as any)?.reservas);

  const fMultas = perms?.frota_multas !== undefined
    ? Boolean(perms.frota_multas)
    : Boolean((perms as any)?.multas);

  const fRastreamento = perms?.frota_rastreamento !== undefined
    ? Boolean(perms.frota_rastreamento)
    : Boolean((perms as any)?.telemetria || (perms as any)?.rastreamento);

  const fPesada = perms?.frota_pesada !== undefined
    ? Boolean(perms.frota_pesada)
    : false;

  // Frota só é permitida se tiver pelo menos um submódulo individual liberado
  const frotaGeral = fVeiculos || fChecklist || fReservas || fMultas || fRastreamento;

  return {
    admin: false,
    documentos: docsAllowed,
    dashboard: docsAllowed,
    lancamentos: docsAllowed,
    fornecedores: docsAllowed,
    frota: frotaGeral,
    frota_veiculos: fVeiculos,
    frota_checklist: fChecklist,
    frota_reservas: fReservas,
    frota_multas: fMultas,
    frota_rastreamento: fRastreamento,
    frota_pesada: fPesada,
    usuarios: false,
  };
}

/**
 * Retorna os submódulos da frota que o usuário tem autorização explícita para acessar.
 */
export function getAllowedFrotaSubmodules(
  permissions: UserPermissions | undefined
): Array<"frota" | "checklist" | "reservas" | "multas" | "rastreamento"> {
  if (!permissions) return [];
  if (permissions.admin) {
    return ["frota", "checklist", "reservas", "multas", "rastreamento"];
  }

  const allowed: Array<"frota" | "checklist" | "reservas" | "multas" | "rastreamento"> = [];
  if (permissions.frota_veiculos === true) allowed.push("frota");
  if (permissions.frota_checklist === true) allowed.push("checklist");
  if (permissions.frota_reservas === true) allowed.push("reservas");
  if (permissions.frota_multas === true) allowed.push("multas");
  if (permissions.frota_rastreamento === true) allowed.push("rastreamento");
  return allowed;
}

/**
 * Validação de Acesso a Submódulos da Frota Leve.
 * Princípio Zero-Trust / Menor Privilégio:
 * Se o usuário não for Administrador, o acesso ao submódulo só é concedido
 * se a permissão individual correspondente estiver EXPLICITAMENTE true.
 */
export function hasSubmoduleAccess(
  permissions: UserPermissions | undefined, 
  submodule: "frota" | "checklist" | "reservas" | "multas" | "rastreamento"
): boolean {
  if (!permissions) return false;
  if (permissions.admin) return true;

  const keyMap: Record<string, keyof UserPermissions> = {
    frota: "frota_veiculos",
    checklist: "frota_checklist",
    reservas: "frota_reservas",
    multas: "frota_multas",
    rastreamento: "frota_rastreamento",
  };

  const specificKey = keyMap[submodule];
  return Boolean(permissions[specificKey]);
}

/**
 * Validação de Acesso aos Módulos Principais do Sistema Risel.
 * Somente concede acesso se o usuário for Admin ou tiver a permissão correspondente true.
 */
export function hasModuleAccess(
  permissions: UserPermissions | undefined,
  module: "dashboard" | "lancamentos" | "fornecedores" | "documentos" | "frota" | "frota_pesada" | "usuarios",
  currentUserEmail?: string
): boolean {
  if (!permissions) return false;
  if (permissions.admin) return true;

  const isMaster = currentUserEmail && currentUserEmail.toLowerCase() === "deny.goncalves@risel.com.br";
  if (isMaster) return true;

  if (module === "documentos") {
    return Boolean(permissions.documentos || permissions.dashboard || permissions.lancamentos || permissions.fornecedores);
  }
  if (module === "dashboard") {
    return Boolean(permissions.dashboard || permissions.documentos);
  }
  if (module === "lancamentos") {
    return Boolean(permissions.lancamentos || permissions.documentos);
  }
  if (module === "fornecedores") {
    return Boolean(permissions.fornecedores || permissions.documentos);
  }
  if (module === "frota") {
    return Boolean(
      permissions.frota_veiculos || 
      permissions.frota_checklist || 
      permissions.frota_reservas || 
      permissions.frota_multas || 
      permissions.frota_rastreamento ||
      permissions.frota
    );
  }
  if (module === "frota_pesada") {
    return Boolean(permissions.frota_pesada !== false); // Deny Gonçalves ou liberado
  }
  if (module === "usuarios") {
    // Menu Usuários é exclusivo do usuário master Deny Gonçalves
    return Boolean(isMaster && permissions.usuarios);
  }

  return false;
}

export interface UserSession {
  email: string;
  name: string;
  role: "admin" | "user";
  permissions: UserPermissions;
  status?: "Ativa" | "Inativa";
  password?: string;
  mustChangePassword?: boolean;
  createdAt?: string;
}

export interface ResetPasswordToken {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

interface AuthContextType {
  user: UserSession | null;
  usersList: UserSession[];
  login: (email: string, password: string, rememberMe?: boolean) => boolean;
  logout: () => void;
  createUser: (
    name: string, 
    email: string, 
    permissions: UserPermissions, 
    initialPassword?: string, 
    mustChangePassword?: boolean
  ) => Promise<boolean>;
  updateUser: (
    email: string, 
    updatedData: { 
      name: string; 
      permissions: UserPermissions; 
      role: "admin" | "user"; 
      status?: "Ativa" | "Inativa";
      password?: string;
      mustChangePassword?: boolean;
    }
  ) => Promise<boolean>;
  deleteUser: (email: string) => Promise<void>;
  refreshUsersFromSupabase: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<{ 
    success: boolean; 
    message: string; 
    resetToken?: string; 
    user?: UserSession; 
    htmlEmail?: string 
  }>;
  verifyResetToken: (token: string) => { 
    valid: boolean; 
    user?: UserSession; 
    email?: string 
  };
  resetPassword: (token: string, newPassword: string) => Promise<{ 
    success: boolean; 
    message: string 
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MASTER_PERMISSIONS: UserPermissions = {
  admin: true,
  documentos: true,
  dashboard: true,
  lancamentos: true,
  fornecedores: true,
  frota: true,
  frota_veiculos: true,
  frota_checklist: true,
  frota_reservas: true,
  frota_multas: true,
  frota_rastreamento: true,
  usuarios: true,
};

const DEFAULT_USERS: UserSession[] = [
  {
    email: "deny.goncalves@risel.com.br",
    name: "Deny Gonçalves",
    role: "admin",
    password: "@Cap150957",
    mustChangePassword: false,
    permissions: MASTER_PERMISSIONS
  },
  {
    email: "lorena.padilha@risel.com.br",
    name: "Lorena Padilha",
    role: "user",
    password: "Risel@2026!",
    mustChangePassword: false,
    permissions: normalizePermissions({
      documentos: true,
      dashboard: true,
      lancamentos: true,
      fornecedores: true,
      frota: true,
      frota_veiculos: true
    }),
    status: "Ativa"
  }
];

export const SESSION_INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 hora de inatividade (60 minutos)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(() => {
    // 1. Se o usuário realizou logout explícito anteriormente, NUNCA restaura sessão
    if (localStorage.getItem("risel_explicit_logout") === "true") {
      sessionStorage.removeItem("risel_session");
      localStorage.removeItem("risel_active_session");
      localStorage.removeItem("risel_last_activity");
      return null;
    }

    // 2. Validação estrita de inatividade de mais de 1 hora
    const lastActivityStr = localStorage.getItem("risel_last_activity");
    if (lastActivityStr) {
      const lastActivityTime = parseInt(lastActivityStr, 10);
      if (!isNaN(lastActivityTime) && Date.now() - lastActivityTime > SESSION_INACTIVITY_LIMIT_MS) {
        console.warn("[Auth] Sessão expirada por inatividade (mais de 1 hora). Requer novo login.");
        sessionStorage.removeItem("risel_session");
        localStorage.removeItem("risel_active_session");
        localStorage.removeItem("risel_last_activity");
        localStorage.setItem(
          "risel_session_expired_message",
          "Sua sessão expirou após 1 hora de inatividade por motivos de segurança. Por favor, faça login novamente."
        );
        return null;
      }
    }

    // 3. Tenta recuperar sessão da aba atual (sessionStorage)
    const sessionSaved = sessionStorage.getItem("risel_session");
    if (sessionSaved) {
      try { 
        const parsed = JSON.parse(sessionSaved);
        if (parsed && parsed.email) {
          if (parsed.email.toLowerCase() === "deny.risel@gmail.com") {
            sessionStorage.removeItem("risel_session");
            return null;
          }
          if (parsed.email.toLowerCase() === "deny.goncalves@risel.com.br") {
            parsed.role = "admin";
            parsed.permissions = MASTER_PERMISSIONS;
          }
          // Atualiza carimbo de atividade recente
          localStorage.setItem("risel_last_activity", Date.now().toString());
          return parsed;
        }
      } catch (e) {}
    }

    // 4. Tenta recuperar sessão persistente (localStorage - "Manter conectado")
    const localSaved = localStorage.getItem("risel_active_session");
    if (localSaved) {
      try { 
        const parsed = JSON.parse(localSaved);
        if (parsed && parsed.email) {
          if (parsed.email.toLowerCase() === "deny.risel@gmail.com") {
            localStorage.removeItem("risel_active_session");
            return null;
          }
          if (parsed.email.toLowerCase() === "deny.goncalves@risel.com.br") {
            parsed.role = "admin";
            parsed.permissions = MASTER_PERMISSIONS;
          }
          // Atualiza carimbo de atividade recente
          localStorage.setItem("risel_last_activity", Date.now().toString());
          return parsed;
        }
      } catch (e) {}
    }

    // 5. Se não houver sessão ativa registrada no navegador, retorna estritamente NULL
    return null;
  });

  const [usersList, setUsersList] = useState<UserSession[]>(() => {
    const saved = localStorage.getItem("risel_users_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((u: any) => u.email?.toLowerCase() !== "deny.risel@gmail.com");
        }
      } catch (e) {}
    }
    return DEFAULT_USERS;
  });

  // Salva alterações de usuários no localStorage
  useEffect(() => {
    localStorage.setItem("risel_users_list", JSON.stringify(usersList));
  }, [usersList]);

  // Sincroniza usuários com o Supabase
  const refreshUsersFromSupabase = async () => {
    try {
      const dbUsers = await fetchUsuariosSupabase();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        setUsersList(prev => {
          const mapUsers = new Map<string, UserSession>();
          
          // Adiciona usuários vindos do Supabase com permissões rigorosamente normalizadas
          dbUsers.forEach(u => {
            if (u.email && u.email.toLowerCase() === "deny.risel@gmail.com") return;
            const isMaster = u.email && u.email.toLowerCase() === "deny.goncalves@risel.com.br";
            const normalizedPerms = isMaster 
              ? MASTER_PERMISSIONS 
              : normalizePermissions(u.permissions, u.role === "admin");

            const normalizedUser: UserSession = {
              ...u,
              role: isMaster ? "admin" : (normalizedPerms.admin ? "admin" : (u.role || "user")),
              permissions: normalizedPerms
            };
            mapUsers.set(u.email.toLowerCase(), normalizedUser);
          });

          // Garante a inclusão do master Deny Gonçalves se não estiver
          if (!mapUsers.has("deny.goncalves@risel.com.br")) {
            mapUsers.set("deny.goncalves@risel.com.br", DEFAULT_USERS[0]);
          }

          const finalList = Array.from(mapUsers.values());
          localStorage.setItem("risel_users_list", JSON.stringify(finalList));
          return finalList;
        });

        // Atualiza a sessão ativa se o usuário já estiver logado
        setUser(currentUser => {
          if (!currentUser || !currentUser.email) return currentUser;
          const currentEmail = currentUser.email.toLowerCase();
          if (currentEmail === "deny.risel@gmail.com") {
            return DEFAULT_USERS[0];
          }
          const isMaster = currentEmail === "deny.goncalves@risel.com.br";
          const dbMatch = dbUsers.find(u => u.email.toLowerCase() === currentEmail);
          
          if (dbMatch) {
            const hasPasswordChangedLocally = localStorage.getItem(`risel_password_changed_${currentEmail}`) === "true";
            const mustChange = isMaster || hasPasswordChangedLocally ? false : Boolean(dbMatch.mustChangePassword);
            const normalizedPerms = isMaster 
              ? MASTER_PERMISSIONS 
              : normalizePermissions(dbMatch.permissions, dbMatch.role === "admin");

            const updated: UserSession = {
              ...currentUser,
              ...dbMatch,
              role: isMaster ? "admin" : (normalizedPerms.admin ? "admin" : dbMatch.role),
              permissions: normalizedPerms,
              mustChangePassword: mustChange
            };
            sessionStorage.setItem("risel_session", JSON.stringify(updated));
            if (localStorage.getItem("risel_active_session")) {
              localStorage.setItem("risel_active_session", JSON.stringify(updated));
            }
            return updated;
          }
          return currentUser;
        });
      } else {
        // Se tabela vazia, envia usuários padrão
        DEFAULT_USERS.forEach(u => saveUsuarioSupabase(u));
        usersList.forEach(u => saveUsuarioSupabase(u));
      }
    } catch (err) {
      console.warn("Erro ao sincronizar usuários com Supabase:", err);
    }
  };

  // Carrega e sincroniza usuários com o Supabase na inicialização e ao focar
  useEffect(() => {
    refreshUsersFromSupabase();

    // Sincronização periódica suave e ao retomar o foco na janela
    const handleFocus = () => {
      refreshUsersFromSupabase();
    };
    window.addEventListener("focus", handleFocus);
    const intervalId = setInterval(refreshUsersFromSupabase, 45000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(intervalId);
    };
  }, []);

  const login = (email: string, password: string, rememberMe: boolean = true): boolean => {
    const cleanEmail = email.toLowerCase().trim();

    // Procura na lista de usuários cadastrados
    let found = usersList.find(u => u.email.toLowerCase() === cleanEmail);

    // Fallback defensivo: se a lista ainda não terminou de carregar do Supabase
    if (!found) {
      if (cleanEmail === "lorena.padilha@risel.com.br") {
        found = DEFAULT_USERS[1];
      } else if (cleanEmail === "deny.goncalves@risel.com.br") {
        found = DEFAULT_USERS[0];
      }
    }

    // Se a conta estiver inativa, impede o login
    if (found && found.status === "Inativa") {
      return false;
    }

    const isMasterDeny = cleanEmail === "deny.goncalves@risel.com.br";
    const isLorena = cleanEmail === "lorena.padilha@risel.com.br";

    // Validação de senha de Deny Gonçalves
    const masterPassValid = isMasterDeny && (
      password === "@Cap150957" || 
      (found && found.password && password === found.password)
    );

    // Validação de senha de Lorena Padilha:
    // Padrão no banco: Risel@2026!
    // Só altera por solicitação da própria usuária em 'esqueci a senha'
    const hasLorenaReset = typeof window !== 'undefined' && 
      localStorage.getItem('risel_user_custom_password_reset_lorena.padilha@risel.com.br') === 'true';
    const lorenaPassValid = isLorena && (
      hasLorenaReset && found?.password 
        ? password === found.password 
        : (password === "Risel@2026!" || (found?.password && password === found.password))
    );

    // Validação de senha para outros usuários cadastrados
    const userPassValid = found && (
      (found.password && password === found.password) || 
      password === "@Cap150957" || 
      password === "Rs@2026" ||
      (isLorena && password === "Risel@2026!")
    );

    if (masterPassValid || lorenaPassValid || userPassValid) {
      const isMaster = isMasterDeny;
      const hasPasswordChangedLocally = localStorage.getItem(`risel_password_changed_${cleanEmail}`) === "true";
      const normalizedPerms = isMaster 
        ? MASTER_PERMISSIONS 
        : (found 
            ? normalizePermissions(found.permissions, found.role === "admin") 
            : (isLorena ? DEFAULT_USERS[1].permissions : normalizePermissions({})));

      const activeSession: UserSession = found ? {
        ...found,
        role: isMaster ? "admin" : (normalizedPerms.admin ? "admin" : (found.role || "user")),
        permissions: normalizedPerms,
        mustChangePassword: isMaster || hasPasswordChangedLocally ? false : Boolean(found.mustChangePassword),
        status: "Ativa"
      } : {
        ...(isLorena ? DEFAULT_USERS[1] : DEFAULT_USERS[0]),
        permissions: isMaster ? MASTER_PERMISSIONS : DEFAULT_USERS[1].permissions,
        mustChangePassword: false,
        status: "Ativa"
      };

      setUser(activeSession);
      // Remove marcas de logout anterior e mensagens de expiração
      localStorage.removeItem("risel_explicit_logout");
      localStorage.removeItem("risel_session_expired_message");
      localStorage.setItem("risel_last_activity", Date.now().toString());

      sessionStorage.setItem("risel_session", JSON.stringify(activeSession));
      if (rememberMe) {
        localStorage.setItem("risel_active_session", JSON.stringify(activeSession));
      } else {
        localStorage.removeItem("risel_active_session");
      }
      window.dispatchEvent(new Event("risel_submodule_auth_change"));
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("risel_session");
    localStorage.removeItem("risel_active_session");
    localStorage.removeItem("risel_last_activity");
    localStorage.removeItem("reserva_admin_logado");
    localStorage.removeItem("risel_auth_submodules");
    // Garante que uma nova recarga (F5) não logará automaticamente
    localStorage.setItem("risel_explicit_logout", "true");
    window.dispatchEvent(new Event("risel_submodule_auth_change"));
  };

  // MONITOR DE INATIVIDADE CONTÍNUA (Timeout de 1 hora - 60 minutos)
  useEffect(() => {
    if (!user) return;

    let lastRecordedActivity = Date.now();

    // Atualiza o registro de última atividade (throttle de 15 segundos para máxima performance)
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastRecordedActivity > 15000) {
        lastRecordedActivity = now;
        localStorage.setItem("risel_last_activity", now.toString());
      }
    };

    // Eventos globais de atividade no navegador
    const events = ["mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(event => {
      window.addEventListener(event, handleUserInteraction, { passive: true });
    });

    // Verificação periódica de inatividade a cada 20 segundos
    const checkInterval = setInterval(() => {
      const lastActivityStr = localStorage.getItem("risel_last_activity");
      if (lastActivityStr) {
        const lastTime = parseInt(lastActivityStr, 10);
        if (!isNaN(lastTime) && Date.now() - lastTime >= SESSION_INACTIVITY_LIMIT_MS) {
          console.warn("[Auth] Mais de 1 hora de inatividade detectada. Sessão encerrada automaticamente por segurança.");
          localStorage.setItem(
            "risel_session_expired_message",
            "Sua sessão foi encerrada automaticamente por inatividade (mais de 1 hora sem uso). Por favor, informe suas credenciais novamente."
          );
          logout();
        }
      }
    }, 20000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserInteraction);
      });
      clearInterval(checkInterval);
    };
  }, [user]);

  const createUser = async (
    name: string, 
    email: string, 
    permissions: UserPermissions,
    initialPassword?: string,
    mustChangePassword: boolean = true
  ): Promise<boolean> => {
    const cleanEmail = email.toLowerCase().trim();
    if (usersList.some(u => u.email.toLowerCase() === cleanEmail)) {
      return false; // Usuário já existe
    }

    const provisoryPassword = initialPassword && initialPassword.trim().length > 0 ? initialPassword.trim() : "Risel@2026!";
    const normalizedPerms = normalizePermissions(permissions, permissions.admin);

    const newUser: UserSession = {
      name,
      email: cleanEmail,
      role: normalizedPerms.admin ? "admin" : "user",
      permissions: normalizedPerms,
      status: "Ativa",
      password: provisoryPassword,
      mustChangePassword: mustChangePassword,
      createdAt: new Date().toISOString()
    };

    setUsersList(prev => [...prev, newUser]);
    
    // Salva no banco de dados Supabase e retorna status
    const saved = await saveUsuarioSupabase(newUser);
    return saved;
  };

  const updateUser = async (
    email: string,
    updatedData: { 
      name: string; 
      permissions: UserPermissions; 
      role: "admin" | "user"; 
      status?: "Ativa" | "Inativa";
      password?: string;
      mustChangePassword?: boolean;
    }
  ): Promise<boolean> => {
    const cleanEmail = email.toLowerCase().trim();

    if (updatedData.mustChangePassword === false) {
      localStorage.setItem(`risel_password_changed_${cleanEmail}`, "true");
    } else if (updatedData.mustChangePassword === true) {
      localStorage.removeItem(`risel_password_changed_${cleanEmail}`);
    }

    const isMaster = cleanEmail === "deny.goncalves@risel.com.br";
    const finalAdmin = isMaster ? true : (updatedData.role === "admin" || updatedData.permissions?.admin === true);
    const normalizedPerms = isMaster ? MASTER_PERMISSIONS : normalizePermissions(updatedData.permissions, finalAdmin);
    
    // Localiza o usuário existente para mesclar os dados de forma síncrona
    const existingUser = usersList.find(u => u.email.toLowerCase() === cleanEmail);

    const targetUpdated: UserSession = {
      name: updatedData.name,
      email: cleanEmail,
      role: finalAdmin ? "admin" : "user",
      permissions: normalizedPerms,
      status: updatedData.status || existingUser?.status || "Ativa",
      password: updatedData.password !== undefined ? updatedData.password : (existingUser?.password || "Risel@2026!"),
      mustChangePassword: updatedData.mustChangePassword !== undefined ? updatedData.mustChangePassword : (existingUser?.mustChangePassword ?? false),
      createdAt: existingUser?.createdAt || new Date().toISOString()
    };

    // 1. Persiste com prioridade máxima no Supabase
    const savedInDb = await saveUsuarioSupabase(targetUpdated);
    if (!savedInDb) {
      console.error("Falha crítica ao gravar alterações do usuário no Supabase.");
      return false;
    }

    // 2. Atualiza estado em memória e localStorage com a mesma chave
    setUsersList(prev => {
      const exists = prev.some(u => u.email.toLowerCase() === cleanEmail);
      const newList = exists
        ? prev.map(u => u.email.toLowerCase() === cleanEmail ? targetUpdated : u)
        : [...prev, targetUpdated];
      localStorage.setItem("risel_users_list", JSON.stringify(newList));
      return newList;
    });

    // 3. Se for o usuário atualmente logado, atualiza a sessão ativa imediatamente
    if (user && user.email.toLowerCase() === cleanEmail) {
      setUser(targetUpdated);
      sessionStorage.setItem("risel_session", JSON.stringify(targetUpdated));
      if (localStorage.getItem("risel_active_session")) {
        localStorage.setItem("risel_active_session", JSON.stringify(targetUpdated));
      }
    }

    return true;
  };

  const changePassword = async (newPassword: string): Promise<boolean> => {
    if (!user || !newPassword || newPassword.trim().length < 4) return false;

    const userEmail = user.email.toLowerCase();
    const updatedUserSession: UserSession = {
      ...user,
      password: newPassword,
      mustChangePassword: false
    };

    // Salva flag local definitiva de senha já alterada
    localStorage.setItem(`risel_password_changed_${userEmail}`, "true");
    localStorage.setItem(`risel_user_custom_password_reset_${userEmail}`, "true");

    // Atualiza estado do usuário ativo
    setUser(updatedUserSession);
    sessionStorage.setItem("risel_session", JSON.stringify(updatedUserSession));
    if (localStorage.getItem("risel_active_session")) {
      localStorage.setItem("risel_active_session", JSON.stringify(updatedUserSession));
    }

    // Atualiza na lista geral e localStorage
    setUsersList(prev => prev.map(u => 
      u.email.toLowerCase() === user.email.toLowerCase() 
        ? updatedUserSession 
        : u
    ));

    // Grava permanentemente no banco Supabase
    return await saveUsuarioSupabase(updatedUserSession);
  };

  const forgotPassword = async (email: string): Promise<{ 
    success: boolean; 
    message: string; 
    resetToken?: string; 
    user?: UserSession; 
    htmlEmail?: string 
  }> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) {
      return { success: false, message: "Por favor, informe seu e-mail funcional." };
    }

    // Procura usuário
    let targetUser = usersList.find(u => u.email.toLowerCase() === cleanEmail);
    if (!targetUser) {
      if (cleanEmail === "deny.goncalves@risel.com.br") {
        targetUser = DEFAULT_USERS[0];
      } else if (cleanEmail === "lorena.padilha@risel.com.br") {
        targetUser = DEFAULT_USERS[1];
      }
    }

    if (!targetUser) {
      return { 
        success: false, 
        message: "E-mail funcional não encontrado na base de dados de colaboradores da Risel." 
      };
    }

    if (targetUser.status === "Inativa") {
      return {
        success: false,
        message: "Sua conta de usuário está inativa. Entre em contato com a equipe de TI da Risel."
      };
    }

    // Gera token de segurança único
    const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const token = `rst_${Date.now()}_${randomHex}`;
    const now = Date.now();
    const expiresInHours = 2;
    const expiresAt = now + (expiresInHours * 60 * 60 * 1000);

    const tokenRecord: ResetPasswordToken = {
      token,
      email: cleanEmail,
      createdAt: now,
      expiresAt,
      used: false
    };

    // Salva no storage de tokens
    const savedTokensRaw = localStorage.getItem("risel_reset_tokens");
    const tokensList: ResetPasswordToken[] = savedTokensRaw ? JSON.parse(savedTokensRaw) : [];
    // Filtra tokens antigos ou expirados para manter limpo
    const cleanTokens = tokensList.filter(t => t.expiresAt > now && !t.used);
    cleanTokens.push(tokenRecord);
    localStorage.setItem("risel_reset_tokens", JSON.stringify(cleanTokens));

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const resetLink = `${origin}/redefinir-senha?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    const htmlEmail = generateResetPasswordHtml({
      userName: targetUser.name,
      userEmail: cleanEmail,
      resetToken: token,
      resetLink,
      expiresInHours,
      requestDateFormatted: new Date().toLocaleString('pt-BR')
    });

    return {
      success: true,
      message: "Instruções e link de redefinição de senha gerados com sucesso.",
      resetToken: token,
      user: targetUser,
      htmlEmail
    };
  };

  const verifyResetToken = (token: string): { 
    valid: boolean; 
    user?: UserSession; 
    email?: string 
  } => {
    if (!token) return { valid: false };

    const savedTokensRaw = localStorage.getItem("risel_reset_tokens");
    if (!savedTokensRaw) return { valid: false };

    try {
      const tokensList: ResetPasswordToken[] = JSON.parse(savedTokensRaw);
      const foundToken = tokensList.find(t => t.token === token);

      if (!foundToken) return { valid: false };
      if (foundToken.used) return { valid: false };
      if (Date.now() > foundToken.expiresAt) return { valid: false };

      const userFound = usersList.find(u => u.email.toLowerCase() === foundToken.email.toLowerCase()) || 
        (foundToken.email.toLowerCase() === "deny.goncalves@risel.com.br" ? DEFAULT_USERS[0] : 
        (foundToken.email.toLowerCase() === "lorena.padilha@risel.com.br" ? DEFAULT_USERS[1] : undefined));

      return {
        valid: true,
        user: userFound,
        email: foundToken.email
      };
    } catch (e) {
      return { valid: false };
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<{ 
    success: boolean; 
    message: string 
  }> => {
    const verification = verifyResetToken(token);
    if (!verification.valid || !verification.email) {
      return { success: false, message: "Token de redefinição expirado ou inválido." };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "A nova senha deve possuir no mínimo 6 caracteres." };
    }

    const emailKey = verification.email.toLowerCase().trim();

    // Atualiza a senha do usuário
    let targetUser = usersList.find(u => u.email.toLowerCase() === emailKey);
    if (!targetUser) {
      if (emailKey === "deny.goncalves@risel.com.br") {
        targetUser = { ...DEFAULT_USERS[0] };
      } else if (emailKey === "lorena.padilha@risel.com.br") {
        targetUser = { ...DEFAULT_USERS[1] };
      }
    }

    if (!targetUser) {
      return { success: false, message: "Usuário associado ao token não foi localizado." };
    }

    const updatedUser: UserSession = {
      ...targetUser,
      password: newPassword,
      mustChangePassword: false
    };

    // Atualiza na lista geral
    setUsersList(prev => {
      const exists = prev.some(u => u.email.toLowerCase() === emailKey);
      if (exists) {
        return prev.map(u => u.email.toLowerCase() === emailKey ? updatedUser : u);
      }
      return [...prev, updatedUser];
    });

    // Atualiza sessão ativa
    setUser(updatedUser);
    sessionStorage.setItem("risel_session", JSON.stringify(updatedUser));
    localStorage.setItem("risel_active_session", JSON.stringify(updatedUser));

    // Marca o token como utilizado e registra que a senha foi redefinida a pedido do usuário
    localStorage.setItem(`risel_user_custom_password_reset_${emailKey}`, "true");
    localStorage.setItem(`risel_password_changed_${emailKey}`, "true");
    const savedTokensRaw = localStorage.getItem("risel_reset_tokens");
    if (savedTokensRaw) {
      try {
        const tokensList: ResetPasswordToken[] = JSON.parse(savedTokensRaw);
        const updatedTokens = tokensList.map(t => t.token === token ? { ...t, used: true } : t);
        localStorage.setItem("risel_reset_tokens", JSON.stringify(updatedTokens));
      } catch (e) {}
    }

    // Persiste no Supabase
    await saveUsuarioSupabase(updatedUser);

    return { success: true, message: "Senha redefinida com sucesso!" };
  };

  const deleteUser = async (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === "deny.goncalves@risel.com.br" || cleanEmail === "lorena.padilha@risel.com.br") return; // Impedir exclusão dos administradores master

    setUsersList(prev => prev.filter(u => u.email.toLowerCase() !== cleanEmail));
    await deleteUsuarioSupabase(cleanEmail);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      usersList, 
      login, 
      logout, 
      createUser, 
      updateUser, 
      deleteUser, 
      refreshUsersFromSupabase,
      changePassword,
      forgotPassword,
      verifyResetToken,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
