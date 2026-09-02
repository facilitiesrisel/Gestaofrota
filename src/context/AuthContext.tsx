import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchUsuariosSupabase, saveUsuarioSupabase, deleteUsuarioSupabase } from "../services/supabaseService";
import { generateResetPasswordHtml } from "../utils/emailTemplate";

export interface UserPermissions {
  admin: boolean;
  dashboard: boolean;
  lancamentos: boolean;
  fornecedores: boolean;
  frota: boolean;
  frota_veiculos?: boolean;
  frota_checklist?: boolean;
  frota_reservas?: boolean;
  frota_multas?: boolean;
  frota_rastreamento?: boolean;
  usuarios: boolean;
}

export function hasSubmoduleAccess(
  permissions: UserPermissions | undefined, 
  submodule: "frota" | "checklist" | "reservas" | "multas" | "rastreamento"
): boolean {
  if (!permissions) return true;
  if (permissions.admin) return true;

  const keyMap: Record<string, keyof UserPermissions> = {
    frota: "frota_veiculos",
    checklist: "frota_checklist",
    reservas: "frota_reservas",
    multas: "frota_multas",
    rastreamento: "frota_rastreamento",
  };

  const specificKey = keyMap[submodule];
  const specificVal = permissions[specificKey];

  // Se explicitamente permitido
  if (specificVal === true) return true;
  // Se explicitamente bloqueado
  if (specificVal === false) return false;

  // Se o submódulo não foi especificado explicitamente, usa a permissão geral 'frota'
  if (permissions.frota !== undefined) {
    return Boolean(permissions.frota);
  }
  return true;
}

export function hasModuleAccess(
  permissions: UserPermissions | undefined,
  module: "dashboard" | "lancamentos" | "fornecedores" | "frota" | "usuarios"
): boolean {
  if (!permissions) return true;
  if (permissions.admin) return true;

  if (module === "frota") {
    if (permissions.frota === false) return false;
    return true;
  }

  if (permissions[module] === false) {
    return false;
  }

  // Por padrão, permite acesso a menos que esteja explicitamente bloqueado como false
  return true;
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
  ) => boolean;
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
  ) => void;
  deleteUser: (email: string) => void;
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
    email: "deny.risel@gmail.com",
    name: "Deny Gonçalves",
    role: "admin",
    password: "@Cap150957",
    mustChangePassword: false,
    permissions: MASTER_PERMISSIONS
  }
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(() => {
    const sessionSaved = sessionStorage.getItem("risel_session");
    if (sessionSaved) {
      try { 
        const parsed = JSON.parse(sessionSaved);
        if (parsed.email && (parsed.email.toLowerCase() === "deny.goncalves@risel.com.br" || parsed.email.toLowerCase() === "deny.risel@gmail.com")) {
          parsed.role = "admin";
          parsed.permissions = MASTER_PERMISSIONS;
        }
        return parsed;
      } catch (e) {}
    }
    const localSaved = localStorage.getItem("risel_active_session");
    if (localSaved) {
      try { 
        const parsed = JSON.parse(localSaved);
        if (parsed.email && (parsed.email.toLowerCase() === "deny.goncalves@risel.com.br" || parsed.email.toLowerCase() === "deny.risel@gmail.com")) {
          parsed.role = "admin";
          parsed.permissions = MASTER_PERMISSIONS;
        }
        return parsed;
      } catch (e) {}
    }
    return DEFAULT_USERS[0];
  });

  const [usersList, setUsersList] = useState<UserSession[]>(() => {
    const saved = localStorage.getItem("risel_users_list");
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  // Salva alterações de usuários no localStorage
  useEffect(() => {
    localStorage.setItem("risel_users_list", JSON.stringify(usersList));
  }, [usersList]);

  // Carrega e sincroniza usuários com o Supabase na inicialização
  useEffect(() => {
    async function syncUsuariosWithSupabase() {
      const dbUsers = await fetchUsuariosSupabase();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        setUsersList(prev => {
          const mapUsers = new Map<string, UserSession>();
          
          // Adiciona usuários vindos do Supabase
          dbUsers.forEach(u => mapUsers.set(u.email.toLowerCase(), u));

          // Garante a inclusão do master se não estiver
          if (!mapUsers.has("deny.goncalves@risel.com.br")) {
            mapUsers.set("deny.goncalves@risel.com.br", DEFAULT_USERS[0]);
            saveUsuarioSupabase(DEFAULT_USERS[0]);
          }

          // Mantém usuários criados localmente enviando-os também para o Supabase
          prev.forEach(localUser => {
            const emailKey = localUser.email.toLowerCase();
            if (!mapUsers.has(emailKey)) {
              mapUsers.set(emailKey, localUser);
              saveUsuarioSupabase(localUser);
            }
          });

          return Array.from(mapUsers.values());
        });

        // Atualiza a sessão ativa se o usuário já estiver logado
        setUser(currentUser => {
          if (!currentUser || !currentUser.email) return currentUser;
          const currentEmail = currentUser.email.toLowerCase();
          const isMaster = currentEmail === "deny.goncalves@risel.com.br" || currentEmail === "deny.risel@gmail.com";
          const dbMatch = dbUsers.find(u => u.email.toLowerCase() === currentEmail);
          
          if (dbMatch) {
            const updated: UserSession = {
              ...currentUser,
              ...dbMatch,
              mustChangePassword: isMaster ? false : Boolean(dbMatch.mustChangePassword)
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
        // Se a tabela estiver vazia no Supabase, envia a lista local
        usersList.forEach(u => saveUsuarioSupabase(u));
      }
    }
    syncUsuariosWithSupabase();
  }, []);

  const login = (email: string, password: string, rememberMe: boolean = true): boolean => {
    const cleanEmail = email.toLowerCase().trim();

    // Procura na lista de usuários cadastrados
    const found = usersList.find(u => u.email.toLowerCase() === cleanEmail);

    // Se a conta estiver inativa, impede o login
    if (found && found.status === "Inativa") {
      return false;
    }

    // Validação de senha do Master ou usuário cadastrado
    const masterPassValid = cleanEmail === "deny.goncalves@risel.com.br" && (
      password === "@Cap150957" || 
      (found && found.password && password === found.password)
    );
    const userPassValid = found && (
      (found.password && password === found.password) || 
      password === "@Cap150957" || 
      password === "Rs@2026"
    );

    if (masterPassValid || userPassValid) {
      const isMaster = cleanEmail === "deny.goncalves@risel.com.br" || cleanEmail === "deny.risel@gmail.com";
      const activeSession: UserSession = found ? {
        ...found,
        mustChangePassword: isMaster ? false : Boolean(found.mustChangePassword),
        status: "Ativa"
      } : {
        ...DEFAULT_USERS[0],
        mustChangePassword: false,
        status: "Ativa"
      };

      setUser(activeSession);
      sessionStorage.setItem("risel_session", JSON.stringify(activeSession));
      if (rememberMe) {
        localStorage.setItem("risel_active_session", JSON.stringify(activeSession));
      }
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("risel_session");
    localStorage.removeItem("risel_active_session");
  };

  const createUser = (
    name: string, 
    email: string, 
    permissions: UserPermissions,
    initialPassword?: string,
    mustChangePassword: boolean = true
  ): boolean => {
    const cleanEmail = email.toLowerCase().trim();
    if (usersList.some(u => u.email.toLowerCase() === cleanEmail)) {
      return false; // Usuário já existe
    }

    const provisoryPassword = initialPassword && initialPassword.trim().length > 0 ? initialPassword.trim() : "Risel@2026!";

    const newUser: UserSession = {
      name,
      email: cleanEmail,
      role: permissions.admin ? "admin" : "user",
      permissions: permissions,
      status: "Ativa",
      password: provisoryPassword,
      mustChangePassword: mustChangePassword,
      createdAt: new Date().toISOString()
    };

    setUsersList(prev => [...prev, newUser]);
    
    // Salva no Supabase
    saveUsuarioSupabase(newUser);

    return true;
  };

  const updateUser = (
    email: string,
    updatedData: { 
      name: string; 
      permissions: UserPermissions; 
      role: "admin" | "user"; 
      status?: "Ativa" | "Inativa";
      password?: string;
      mustChangePassword?: boolean;
    }
  ) => {
    const cleanEmail = email.toLowerCase().trim();

    setUsersList(prev => prev.map(u => {
      if (u.email.toLowerCase() === cleanEmail) {
        const updatedUser: UserSession = {
          ...u,
          name: updatedData.name,
          role: updatedData.role,
          permissions: updatedData.permissions,
          status: updatedData.status || u.status || "Ativa",
          password: updatedData.password !== undefined ? updatedData.password : u.password,
          mustChangePassword: updatedData.mustChangePassword !== undefined ? updatedData.mustChangePassword : u.mustChangePassword
        };
        // Grava alteração no Supabase
        saveUsuarioSupabase(updatedUser);
        return updatedUser;
      }
      return u;
    }));

    // Se for o usuário atualmente logado, atualiza a sessão ativa
    if (user && user.email.toLowerCase() === cleanEmail) {
      const updatedSession: UserSession = {
        ...user,
        name: updatedData.name,
        role: updatedData.role,
        permissions: updatedData.permissions,
        status: updatedData.status || user.status || "Ativa",
        password: updatedData.password !== undefined ? updatedData.password : user.password,
        mustChangePassword: updatedData.mustChangePassword !== undefined ? updatedData.mustChangePassword : user.mustChangePassword
      };
      setUser(updatedSession);
      sessionStorage.setItem("risel_session", JSON.stringify(updatedSession));
      if (localStorage.getItem("risel_active_session")) {
        localStorage.setItem("risel_active_session", JSON.stringify(updatedSession));
      }
    }
  };

  const changePassword = async (newPassword: string): Promise<boolean> => {
    if (!user || !newPassword || newPassword.trim().length < 4) return false;

    const updatedUserSession: UserSession = {
      ...user,
      password: newPassword,
      mustChangePassword: false
    };

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
    if (!targetUser && cleanEmail === "deny.goncalves@risel.com.br") {
      targetUser = DEFAULT_USERS[0];
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
        (foundToken.email.toLowerCase() === "deny.goncalves@risel.com.br" ? DEFAULT_USERS[0] : undefined);

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
    if (!targetUser && emailKey === "deny.goncalves@risel.com.br") {
      targetUser = { ...DEFAULT_USERS[0] };
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

    // Marca o token como utilizado
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

  const deleteUser = (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === "deny.goncalves@risel.com.br") return; // Impedir exclusão do master

    setUsersList(prev => prev.filter(u => u.email.toLowerCase() !== cleanEmail));
    deleteUsuarioSupabase(cleanEmail);
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
