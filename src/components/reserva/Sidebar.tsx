
import React from 'react';
import { CalendarIcon, CarIcon, LogoutIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ClipboardListIcon, DashboardIcon, MapPinIcon, DocumentTextIcon, BookOpenIcon, CogIcon } from './icons';
import { RiselLogo } from './RiselLogo';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  onOpenHelp?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onLogout, isSidebarOpen, setIsSidebarOpen, onOpenHelp }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard Analítico', icon: DashboardIcon },
    { id: 'reservations', label: 'Gestão de Reservas', icon: DocumentTextIcon },
    { id: 'dailyUse', label: 'Diário de Bordo', icon: ClipboardListIcon },
    { id: 'vehicles', label: 'Frota de Veículos', icon: CarIcon },
    { id: 'fleetStatus', label: 'Status da Frota', icon: CarIcon },
    { id: 'racRentals', label: 'Locações RAC', icon: ClipboardListIcon },
  ];

  // Estilo "Verde Sutil" e CRM
  const baseItemClass = 'flex items-center px-4 py-3 mb-1 mx-2 rounded-lg cursor-pointer transition-all duration-300 group relative overflow-hidden font-medium';
  const activeItemClass = 'bg-white shadow-sm text-primary border-l-4 border-primary';
  const inactiveItemClass = 'text-emerald-900/70 hover:bg-white/60 hover:text-primary';

  const handleNavigate = (view: string) => {
    onNavigate(view);
    if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
    }
  };

  return (
    <aside className={`
      hidden md:flex relative inset-y-0 left-0 z-40 
      bg-emerald-50 border-r border-emerald-100
      transition-all duration-300 transform 
      ${isSidebarOpen ? 'w-72' : 'w-20'}
      flex-col h-full shadow-none
    `}>
      {/* Header Logo */}
      <div className={`h-20 flex items-center ${isSidebarOpen ? 'justify-between px-6' : 'justify-center'} border-b border-emerald-100 bg-emerald-50/50`}>
         {isSidebarOpen ? (
            <div className="flex items-center gap-3 animate-fadeIn">
                <div className="bg-white p-1 rounded-full shadow-sm border border-emerald-100">
                    <RiselLogo className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-tight tracking-wide text-primary">RISEL</h1>
                    <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-medium">Gestão de Frota</p>
                </div>
            </div>
         ) : (
            <div className="bg-white p-1.5 rounded-full shadow-sm border border-emerald-100 transform hover:scale-110 transition-transform">
                <RiselLogo className="h-8 w-8" />
            </div>
         )}
         
         {/* Desktop Toggle */}
         <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-white text-emerald-400 hover:text-primary border border-emerald-200 shadow-sm absolute -right-3 top-7 z-50 transition-colors">
            {isSidebarOpen ? <ChevronDoubleLeftIcon className="h-3 w-3"/> : <ChevronDoubleRightIcon className="h-3 w-3"/>}
         </button>
         
         {/* Mobile Close */}
         <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-emerald-600 hover:text-primary">
            <ChevronDoubleLeftIcon className="h-6 w-6"/>
         </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-1">
        {isSidebarOpen && <p className="px-6 text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Navegação Principal</p>}
        
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.id} onClick={() => handleNavigate(item.id)} title={!isSidebarOpen ? item.label : ''}>
              <a className={`${baseItemClass} ${currentView === item.id ? activeItemClass : inactiveItemClass}`}>
                <item.icon className={`h-5 w-5 flex-shrink-0 transition-colors ${currentView === item.id ? 'text-primary' : 'text-emerald-400 group-hover:text-primary'}`} />
                
                <span className={`ml-3 text-sm whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute'}`}>
                    {item.label}
                </span>
              </a>
            </li>
          ))}
        </ul>

        {/* Manual Link */}
        {onOpenHelp && (
            <ul className="space-y-1 mt-6 pt-6 border-t border-emerald-100/50">
                {isSidebarOpen && <p className="px-6 text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Ajuda</p>}
                <li onClick={onOpenHelp} title={!isSidebarOpen ? "Manual do Sistema" : ''}>
                    <a className={`${baseItemClass} ${inactiveItemClass}`}>
                        <BookOpenIcon className="h-5 w-5 flex-shrink-0 transition-colors text-emerald-400 group-hover:text-primary" />
                        <span className={`ml-3 text-sm whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute'}`}>
                            Manual do Sistema
                        </span>
                    </a>
                </li>
            </ul>
        )}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-emerald-100 bg-emerald-100/30">
        <div onClick={onLogout} title="Sair do Sistema" className="flex items-center px-4 py-3 rounded-lg cursor-pointer text-emerald-600 hover:bg-red-50 hover:text-red-600 transition-colors group border border-transparent hover:border-red-100">
            <LogoutIcon className="h-5 w-5 flex-shrink-0 transition-transform group-hover:-translate-x-1" />
            {isSidebarOpen && <span className="ml-3 font-medium text-sm">Sair</span>}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
