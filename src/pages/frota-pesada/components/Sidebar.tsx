import React from 'react';
import { 
  LayoutDashboard, 
  Siren, 
  BellRing, 
  Truck, 
  Users, 
  Settings, 
  ArrowLeft,
  ChevronLeft, 
  ChevronRight,
  LayoutGrid
} from 'lucide-react';
import { Page } from '../types';

interface SidebarProps {
  currentSub?: 'infracoes' | 'frotas' | 'motoristas' | 'config' | string | null;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  onLogout: () => void;
  onBackToPortal?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentSub = 'infracoes',
  currentPage, 
  onNavigate, 
  isOpen, 
  toggleSidebar, 
  onLogout,
  onBackToPortal
}) => {
  // URL da Logomarca oficial Risel
  const logoUrl = "https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg";

  // Identificação do submódulo ativo (garante fallback inteligente baseado na página atual)
  const activeSubmodule = currentSub === 'frotas' || currentPage === 'FROTAS'
    ? 'frotas'
    : currentSub === 'motoristas' || currentPage === 'MOTORISTAS'
    ? 'motoristas'
    : 'infracoes';

  // Definição dos menus específicos estritamente relativos ao próprio submódulo
  let navItems: { id: Page; label: string; icon: React.ComponentType<{ className?: string; size?: number }> }[] = [];

  if (activeSubmodule === 'infracoes') {
    navItems = [
      { id: 'DASHBOARD' as Page, label: 'Dashboard', icon: LayoutDashboard },
      { id: 'MULTAS' as Page, label: 'Multas', icon: Siren },
      { id: 'ALERTAS' as Page, label: 'Alertas', icon: BellRing },
    ];
  } else if (activeSubmodule === 'frotas') {
    navItems = [
      { id: 'FROTAS' as Page, label: 'Lista de Frota', icon: Truck },
    ];
  } else if (activeSubmodule === 'motoristas') {
    navItems = [
      { id: 'MOTORISTAS' as Page, label: 'Lista Motoristas', icon: Users },
    ];
  }

  return (
    <aside 
      className={`bg-[#07110C] border-r border-slate-800/40 py-6 hidden md:flex flex-col relative z-20 flex-shrink-0 transition-all duration-300 ease-in-out select-none ${
        isOpen ? 'w-52 pl-4 pr-0' : 'w-16 pl-3 pr-0'
      }`}
    >
      {/* Botão de Toggle Retrátil no padrão exato do Controle de Frota Leve */}
      <button 
        onClick={toggleSidebar}
        className={`absolute top-4 w-6 h-6 bg-[#114D38]/20 hover:bg-[#114D38]/40 border border-emerald-500/25 rounded-full shadow-md flex items-center justify-center text-slate-300 hover:text-emerald-400 z-30 transition-all cursor-pointer ${
          !isOpen ? 'left-1/2 -translate-x-1/2 mt-12' : 'right-3'
        }`}
        title={isOpen ? "Recolher menu" : "Expandir menu"}
      >
        {isOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {/* Header com a Logo Risel - Visual Frota Leve */}
      <div className={`mb-8 flex items-center gap-2.5 transition-all ${!isOpen ? 'pr-3 justify-center' : 'pr-4'}`}>
        <div className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-500/20 shadow-lg shadow-emerald-500/20 shrink-0 bg-white/5 flex items-center justify-center">
          <img 
            src={logoUrl} 
            alt="Logo Risel" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "https://placehold.co/100x100?text=R";
            }}
          />
        </div>
        {isOpen && (
          <div className="animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
            <h1 className="text-sm font-display font-black text-white leading-none tracking-tight">Risel</h1>
            <p className="text-[8px] text-emerald-400 font-black tracking-wider uppercase mt-1">Combustíveis</p>
          </div>
        )}
      </div>

      {/* Navegação dos Itens Relativos ao Submódulo Ativo */}
      <nav className="flex-1 space-y-1 overflow-x-hidden pr-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center px-3 py-2.5 relative transition-all duration-200 font-bold text-xs gap-3 rounded-xl w-full text-left cursor-pointer group ${
                isActive 
                  ? 'bg-orange-500/10 text-orange-500 shadow-sm border-l-4 border-orange-500 font-extrabold' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              } ${!isOpen ? 'justify-center px-2' : ''}`}
              title={!isOpen ? item.label : undefined}
            >
              <Icon 
                className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                  isActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-200'
                }`} 
              />
              {isOpen && (
                <span className="animate-in fade-in duration-300 whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Seção Inferior: Configurações (para Infrações) e Botão de Voltar ao ERP */}
      <div className="mt-auto space-y-1.5 pr-2 pt-4 border-t border-slate-800/40">
        {/* Opção discreta para alternar entre os submódulos da frota sem sair para o ERP */}
        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className={`flex items-center w-full px-3 py-2 text-slate-400 hover:bg-white/5 hover:text-slate-200 rounded-xl transition-all duration-200 font-bold text-xs gap-3 text-left cursor-pointer group ${
              !isOpen ? 'justify-center px-2' : ''
            }`}
            title={!isOpen ? "Portal Frota Pesada" : undefined}
          >
            <LayoutGrid className="w-[18px] h-[18px] shrink-0 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            {isOpen && <span className="whitespace-nowrap">Portal Frota</span>}
          </button>
        )}

        {/* Configurações (exibido no submódulo de Infrações de Trânsito conforme solicitado) */}
        {activeSubmodule === 'infracoes' && (
          <button
            onClick={() => onNavigate('CONFIG')}
            className={`flex items-center w-full px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs gap-3 text-left cursor-pointer group ${
              currentPage === 'CONFIG'
                ? 'bg-orange-500/10 text-orange-500 shadow-sm border-l-4 border-orange-500 font-extrabold'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            } ${!isOpen ? 'justify-center px-2' : ''}`}
            title={!isOpen ? "Configurações" : undefined}
          >
            <Settings 
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                currentPage === 'CONFIG' ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-200'
              }`} 
            />
            {isOpen && <span className="whitespace-nowrap">Configurações</span>}
          </button>
        )}

        {/* Botão de Voltar ao ERP */}
        <button
          onClick={onLogout}
          className={`flex items-center w-full px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs gap-3 text-left cursor-pointer group text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 ${
            !isOpen ? 'justify-center px-2' : ''
          }`}
          title={!isOpen ? "Voltar ao ERP" : undefined}
        >
          <ArrowLeft className="w-[18px] h-[18px] shrink-0 text-slate-400 group-hover:text-rose-400 transition-colors group-hover:-translate-x-0.5" />
          {isOpen && <span className="whitespace-nowrap">Voltar ao ERP</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
