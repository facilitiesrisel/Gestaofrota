import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Settings, KeyRound, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface UserProfileBadgeProps {
  className?: string;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({ className = "" }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Gerar iniciais do nome (ex: "DG" para Deny Gonçalves)
  const getInitials = (name?: string) => {
    if (!name) return "DG";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const displayName = user?.name || "Deny Gonçalves";
  const displayEmail = user?.email || "deny.goncalves@risel.com.br";
  const initials = getInitials(displayName);

  return (
    <>
      <div className={`relative shrink-0 select-none ${className}`} ref={profileRef}>
        <button 
          type="button"
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="flex items-center gap-2 bg-white pl-1.5 pr-3 py-1 rounded-full shadow-2xs border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group text-left outline-none"
          title="Opções do Usuário"
        >
          {/* Avatar Circular com Iniciais no padrão Risel */}
          <div className="w-7 h-7 rounded-full bg-[#114D38] text-white flex items-center justify-center font-bold text-[11px] tracking-tight border border-emerald-700/40 shrink-0 shadow-2xs">
            {initials}
          </div>

          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-slate-800 leading-tight group-hover:text-emerald-800 transition-colors">
              {displayName}
            </span>
            <span className="text-[8.5px] font-semibold text-slate-400 tracking-wide leading-none mt-0.5">
              {displayEmail}
            </span>
          </div>

          <ChevronDown className={`w-3 h-3 text-slate-400 ml-0.5 transition-transform duration-200 ${isProfileOpen ? "rotate-180 text-emerald-700" : ""}`} />
        </button>

        {isProfileOpen && (
          <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-150 p-2 z-[999] animate-in fade-in slide-in-from-top-2 duration-200 text-left">
            <div className="px-3 py-2.5 border-b border-slate-100 mb-1 bg-slate-50/60 rounded-xl">
              <span className="text-[9px] font-extrabold text-[#114D38] uppercase tracking-wider block">Nível de Acesso</span>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                {user?.role === "admin" ? "Administrador Master" : "Acesso Customizado"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                navigate("/documentos/usuarios");
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-650 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-400" /> Configurar Acessos
            </button>

            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                setIsChangePasswordOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-emerald-600" /> Alterar Minha Senha
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 mt-1 border-t border-slate-100 pt-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-500" /> Desconectar ERP
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
};
