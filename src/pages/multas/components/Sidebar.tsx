
import React from 'react';
import { BarChart3, Siren, Truck, Users, Settings, LogOut, ChevronLeft, ChevronRight, BellRing } from 'lucide-react';
import { Page } from '../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isOpen, toggleSidebar, onLogout }) => {
  const menuItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: BarChart3 },
    { id: 'MULTAS', label: 'Multas', icon: Siren },
    { id: 'ALERTAS', label: 'Alertas', icon: BellRing },
    { id: 'FROTAS', label: 'Frotas', icon: Truck },
    { id: 'MOTORISTAS', label: 'Motoristas', icon: Users },
  ];

  // URL da Logomarca atualizada
  const logoUrl = "https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg"; 

  return (
    <div className={`relative h-screen bg-gradient-to-b from-[#022c22] via-[#044a3a] to-[#00d664] transition-all duration-300 flex flex-col ${isOpen ? 'w-64' : 'w-20'} z-50 border-r border-white/10 shadow-2xl`}>
      
      {/* Botão de Toggle Flutuante na Borda - Garante funcionalidade retrátil */}
      <button 
        onClick={toggleSidebar} 
        className="absolute -right-3 top-10 bg-white text-risel-green border border-gray-200 p-1.5 rounded-full shadow-lg z-50 hover:bg-gray-50 transition-all hover:scale-110 focus:outline-none flex items-center justify-center"
        title={isOpen ? "Recolher menu" : "Expandir menu"}
      >
        {isOpen ? <ChevronLeft size={14} className="stroke-[3]" /> : <ChevronRight size={14} className="stroke-[3]" />}
      </button>

      <div className="p-6 flex items-center justify-between">
        {isOpen ? (
            <div className="flex flex-col animate-in fade-in duration-300 w-full">
                 <div className="flex items-center gap-3">
                    <div className="bg-white p-1 rounded-lg shadow-lg flex items-center justify-center overflow-hidden h-10 w-10 shrink-0">
                        <img 
                            src={logoUrl} 
                            alt="Risel Logo" 
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                // Fallback caso a imagem quebre
                                e.currentTarget.src = "https://placehold.co/100x100?text=R"; 
                                e.currentTarget.onerror = null;
                            }}
                        />
                    </div>
                    <div className="overflow-hidden">
                        <h1 className="text-xl font-black tracking-wide text-white uppercase leading-none drop-shadow-md whitespace-nowrap">
                            Risel
                        </h1>
                    </div>
                 </div>
            </div>
        ) : (
             <div className="w-full flex justify-center animate-in fade-in duration-300">
                <div className="bg-white p-1 rounded-lg shadow-lg flex items-center justify-center overflow-hidden h-10 w-10">
                    <img 
                        src={logoUrl} 
                        alt="Risel Logo" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            e.currentTarget.src = "https://placehold.co/100x100?text=R"; 
                            e.currentTarget.onerror = null;
                        }}
                    />
                </div>
             </div>
        )}
      </div>

      <nav className="flex-1 mt-4">
        <ul className="space-y-3 px-3">
          {menuItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id as Page)}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-300 group relative overflow-hidden border
                  ${isActive 
                    ? 'bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)] border-white/30 backdrop-blur-sm' 
                    : 'border-transparent text-white/60 hover:bg-white/10 hover:text-white hover:border-white/10'}
                  ${!isOpen ? 'justify-center' : ''}
                `}
                title={!isOpen ? item.label : ''}
              >
                <item.icon size={20} className={`${isActive ? 'text-risel-green drop-shadow-md' : 'text-white/60 group-hover:text-white'} transition-all duration-300 shrink-0`} />
                {isOpen && <span className={`ml-3 whitespace-nowrap text-sm font-bold tracking-wide ${isActive ? 'text-white' : ''} animate-in fade-in slide-in-from-left-2 duration-200`}>{item.label}</span>}
                
                {/* Active Indicator Strip */}
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-risel-green rounded-r shadow-[0_0_8px_#00d664]"></div>}
              </button>
            </li>
          )})}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <button 
            onClick={() => onNavigate('CONFIG')}
            className={`w-full flex items-center p-3 transition-all rounded-xl border ${currentPage === 'CONFIG' ? 'bg-orange-500/20 text-risel-orange border-orange-500/30 font-bold' : 'border-transparent text-white/60 hover:bg-white/10 hover:text-white'} ${!isOpen ? 'justify-center' : ''}`}
            title={!isOpen ? 'Configurações' : ''}
        >
            <Settings size={20} className={`${currentPage === 'CONFIG' ? 'text-risel-orange' : 'text-white/60 group-hover:text-white'} shrink-0`} />
            {isOpen && <span className="ml-3 text-xs uppercase font-bold tracking-wider animate-in fade-in slide-in-from-left-2 duration-200">Configurações</span>}
        </button>

        <button 
            onClick={onLogout}
            className={`w-full flex items-center p-3 transition-all rounded-xl border border-transparent text-red-200 hover:bg-red-500/20 hover:text-white group ${!isOpen ? 'justify-center' : ''}`}
            title={!isOpen ? 'Sair' : ''}
        >
            <LogOut size={20} className="group-hover:scale-110 transition-transform shrink-0" />
            {isOpen && <span className="ml-3 text-xs uppercase font-bold tracking-wider animate-in fade-in slide-in-from-left-2 duration-200">Sair</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
