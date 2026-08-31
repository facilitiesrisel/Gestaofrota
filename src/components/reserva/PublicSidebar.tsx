
import React from 'react';
import { DocumentTextIcon, ClipboardListIcon, LogoutIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, MapPinIcon, BookOpenIcon, CarIcon } from './icons';
import { RiselLogo } from './RiselLogo';

interface PublicSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  onOpenHelp?: () => void;
}

const PublicSidebar: React.FC<PublicSidebarProps> = ({ currentView, onNavigate, isSidebarOpen, setIsSidebarOpen, onOpenHelp }) => {
  const navItems = [
    { id: 'request', label: 'Solicitar Reserva', icon: DocumentTextIcon, desc: 'Veículo próprio da frota' },
    { id: 'racRequest', label: 'Solicitar Locação RAC', icon: CarIcon, desc: 'Veículo terceirizado/locadora' },
    { id: 'dailyUse', label: 'Uso Diário', icon: ClipboardListIcon, desc: 'Registre saída/retorno' },
    { id: 'fleetStatus', label: 'Status da Frota', icon: MapPinIcon, desc: 'Consulte disponibilidade' },
  ];

  // Verde Sutil & CRM Look
  const baseItemClass = 'flex items-center px-4 py-4 mb-2 mx-2 rounded-lg cursor-pointer transition-all duration-300 group relative';
  const activeItemClass = 'bg-white border-l-4 border-primary shadow-sm';
  const inactiveItemClass = 'text-emerald-900/70 hover:bg-white/60 hover:text-primary';

  const handleNavigate = (view: string) => {
    onNavigate(view);
    if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
    }
  };

  return (
    <aside className={`
      hidden md:flex inset-y-0 left-0 z-40 relative 
      bg-emerald-50 border-r border-emerald-100
      text-slate-800 transition-all duration-300 transform shadow-none
      ${isSidebarOpen ? 'w-72' : 'w-20'}
      flex-col h-full
    `}>
      <div className={`h-24 flex items-center ${isSidebarOpen ? 'justify-between px-6' : 'justify-center'} border-b border-emerald-100 bg-emerald-50/50`}>
         {isSidebarOpen ? (
            <div className="flex items-center gap-3">
                <RiselLogo className="h-10 w-10 drop-shadow-sm" />
                <div className="flex flex-col">
                    <span className="font-extrabold text-xl text-primary tracking-tight">RISEL</span>
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Frota Leve</span>
                </div>
            </div>
         ) : (
            <RiselLogo className="h-10 w-10 drop-shadow-sm" />
         )}
         
         {/* Toggle Button */}
         <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-white text-emerald-400 hover:text-primary border border-emerald-200 shadow-sm absolute -right-3 top-9 z-50">
            {isSidebarOpen ? <ChevronDoubleLeftIcon className="h-3 w-3"/> : <ChevronDoubleRightIcon className="h-3 w-3"/>}
         </button>
         <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-emerald-600 hover:text-primary">
            <ChevronDoubleLeftIcon className="h-6 w-6"/>
         </button>
      </div>

      {isSidebarOpen && (
        <div className="px-6 pt-8 pb-2">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Acesso Público</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-2">
          {navItems.map(item => (
            <li key={item.id} onClick={() => handleNavigate(item.id)} title={!isSidebarOpen ? item.label : ''}>
              <a className={`${baseItemClass} ${currentView === item.id ? activeItemClass : inactiveItemClass}`}>
                <div className={`p-2 rounded-md ${currentView === item.id ? 'text-primary' : 'text-emerald-400 group-hover:text-primary'} transition-all`}>
                    <item.icon className="h-6 w-6" />
                </div>
                
                <div className={`ml-3 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute'}`}>
                    <span className="block font-bold text-sm text-emerald-900">{item.label}</span>
                    <span className="block text-[10px] text-emerald-600 font-medium">{item.desc}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>

        {/* Manual Link Public & Voltar ao Início */}
        <ul className="space-y-2 mt-4 pt-4 border-t border-emerald-100/50">
            {onOpenHelp && (
                <li onClick={onOpenHelp} title={!isSidebarOpen ? "Manual do Sistema" : ''}>
                    <a className={`${baseItemClass} ${inactiveItemClass}`}>
                        <div className={`p-2 rounded-md text-emerald-400 group-hover:text-primary transition-all`}>
                            <BookOpenIcon className="h-6 w-6" />
                        </div>
                        <div className={`ml-3 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute'}`}>
                            <span className="block font-bold text-sm text-emerald-900">Manual do Sistema</span>
                            <span className="block text-[10px] text-emerald-600 font-medium">Ajuda / PDF</span>
                        </div>
                    </a>
                </li>
            )}
            <li>
                <a href="/" className={`${baseItemClass} ${inactiveItemClass}`} title={!isSidebarOpen ? "Voltar ao Início" : ''}>
                    <div className="p-2 rounded-md text-emerald-400 group-hover:text-primary transition-all">
                        <ChevronDoubleLeftIcon className="h-6 w-6" />
                    </div>
                    <div className={`ml-3 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute'}`}>
                        <span className="block font-bold text-sm text-emerald-900">Página Inicial</span>
                        <span className="block text-[10px] text-emerald-600 font-medium">Voltar aos Módulos</span>
                    </div>
                </a>
            </li>
        </ul>
      </nav>

      <div className="p-4 border-t border-emerald-100 bg-emerald-100/30">
        <div onClick={() => handleNavigate('login')} className="flex items-center px-4 py-3 rounded-lg cursor-pointer text-emerald-600 hover:bg-white hover:text-primary transition-colors group border border-transparent hover:border-primary/10 hover:shadow-sm">
            <LogoutIcon className="h-5 w-5 flex-shrink-0 transition-transform group-hover:translate-x-1" />
            {isSidebarOpen && <span className="ml-3 font-semibold text-sm">Área Administrativa</span>}
        </div>
      </div>
    </aside>
  );
};

export default PublicSidebar;
