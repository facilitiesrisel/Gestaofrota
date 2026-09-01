import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import ReservationForm from './ReservationForm';
import { UserRacRequestForm } from './UserRacRequestForm';
import AdminDashboard from './AdminDashboard';
import Login from './Login';
import PublicSidebar from './PublicSidebar';
import UserDailyUseForm from './UserDailyUseForm';
import FleetStatusView from './FleetStatusView';
import HelpGuideModal from './HelpGuideModal';
import { RiselLogo } from './RiselLogo';
import { MenuIcon, DocumentTextIcon, ClipboardListIcon, MapPinIcon, LogoutIcon, CarIcon } from './icons';
import { ReservationAuthProvider, useAuth } from '../../context/ReservationAuthContext';
import { useAuth as useGlobalAuth } from '../../context/AuthContext';
import { ReservationProvider, useReservations } from '../../context/ReservationContext';

const firestoreRulesForPublicAccess = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    function isAuthenticated() {
      return request.auth != null;
    }
    function isRealAdmin() {
      return request.auth != null && request.auth.token.firebase.sign_in_provider != 'anonymous';
    }
    match /vehicles/{vehicleId} {
      allow read: if true;
      allow update: if isAuthenticated();
      allow create, delete: if isRealAdmin();
    }
    match /reservations/{reservationId} {
      allow read: if true;
      allow create: if isAuthenticated();
      allow update, delete: if isRealAdmin();
    }
    match /dailyUse/{tripId} {
      allow read: if true;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isRealAdmin();
    }
    match /racRentals/{rentalId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if isRealAdmin();
    }
    match /user_settings/{settingId} {
      allow read: if isAuthenticated();
      allow write: if isRealAdmin();
    }
  }
}`;

const PublicLayout: React.FC = () => {
    const { permissionError } = useReservations();
    const location = useLocation();
    const isFrotaRoute = location.pathname.startsWith("/frota");
    
    const [searchParams, setSearchParams] = useSearchParams();
    const rawPublicView = searchParams.get("sub") || "request";
    const publicView = rawPublicView === 'logout_reservas' ? 'login' : rawPublicView;

    const [preSelectedVehicleId, setPreSelectedVehicleId] = useState<string | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const handleNavigate = (view: string) => {
        if (isFrotaRoute) {
            setSearchParams({ tab: 'reservas', sub: view });
        } else {
            setSearchParams({ sub: view });
        }
        if (view !== 'request') {
            setPreSelectedVehicleId(null);
        }
    };

    const handleRequestReservationFromFleet = (vehicleId: string) => {
        setPreSelectedVehicleId(vehicleId);
        if (isFrotaRoute) {
            setSearchParams({ tab: 'reservas', sub: 'request' });
        } else {
            setSearchParams({ sub: 'request' });
        }
    };

    const renderPublicContent = () => {
        switch (publicView) {
            case 'racRequest':
            case 'rac':
            case 'rac_request':
                return (
                    <div className="w-full flex flex-col items-center bg-slate-50 min-h-full">
                        {/* Mobile Header for RAC */}
                        <div className="md:hidden w-full px-4 pt-3 pb-1">
                            <div className="bg-gradient-to-br from-[#114D38] via-[#0d3f2e] to-[#07241a] rounded-2xl p-4 shadow-md border border-emerald-800/40 text-center relative overflow-hidden flex flex-col items-center">
                                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center mb-1.5 border border-amber-400/30">
                                    <CarIcon className="w-5 h-5 text-amber-300" />
                                </div>
                                <h1 className="text-base font-black text-white uppercase tracking-wider font-display">
                                    Locação de Veículo RAC
                                </h1>
                                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                                    Veículos terceirizados (Localiza, Movida, Unidas)
                                </p>
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-amber-500/30 text-[10px] font-bold text-amber-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                    Locação Terceirizada
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:max-w-5xl px-4 py-4 md:py-6">
                            <UserRacRequestForm onSuccess={() => {}} />
                        </div>
                    </div>
                );
            case 'dailyUse':
                return (
                    <div className="w-full flex flex-col items-center bg-slate-50 min-h-full">
                        {/* Mobile Header for Daily Use */}
                        <div className="md:hidden w-full px-4 pt-3 pb-1">
                            <div className="bg-gradient-to-br from-[#114D38] via-[#0d3f2e] to-[#07241a] rounded-2xl p-4 shadow-md border border-emerald-800/40 text-center relative overflow-hidden flex flex-col items-center">
                                <div className="w-8 h-8 rounded-xl bg-white/15 text-emerald-200 flex items-center justify-center mb-1.5 border border-white/20">
                                    <ClipboardListIcon className="w-5 h-5 text-emerald-300" />
                                </div>
                                <h1 className="text-base font-black text-white uppercase tracking-wider font-display">
                                    Diário de Bordo &bull; Uso Diário
                                </h1>
                                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                                    Início e encerramento de viagens da frota
                                </p>
                            </div>
                        </div>

                        <div className="w-full md:max-w-3xl mx-auto bg-white md:rounded-[24px] md:shadow-sm h-full md:h-auto overflow-y-auto md:mt-4 md:mb-8 border border-slate-200">
                            <UserDailyUseForm />
                        </div>
                    </div>
                );
            case 'fleetStatus':
                return (
                    <div className="p-4 md:p-8 h-full">
                        <FleetStatusView onRequestReservation={handleRequestReservationFromFleet} />
                    </div>
                );
            case 'login':
                return <div className="bg-white rounded-[24px] shadow-sm p-8 max-w-md mx-auto mt-8 md:mt-12 border border-slate-200"><Login /></div>;
            case 'request':
            default:
                 return (
                     <div className="w-full flex flex-col items-center bg-slate-50 min-h-full">
                        {/* Mobile Header for Request - Elegante Verde Escuro com Alta Legibilidade */}
                        <div className="md:hidden w-full px-4 pt-3 pb-1">
                            <div className="bg-gradient-to-br from-[#114D38] via-[#0d3f2e] to-[#07241a] rounded-2xl p-4 shadow-md border border-emerald-800/40 text-center relative overflow-hidden flex flex-col items-center">
                                <div className="w-8 h-8 rounded-xl bg-white/15 text-emerald-200 flex items-center justify-center mb-1.5 border border-white/20">
                                    <DocumentTextIcon className="w-5 h-5 text-emerald-300" />
                                </div>
                                <h1 className="text-base font-black text-white uppercase tracking-wider font-display">
                                    Nova Solicitação
                                </h1>
                                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                                    Preencha os dados para agendar seu veículo
                                </p>
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-[10px] font-bold text-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Frota Leve Própria
                                </div>
                            </div>
                        </div>

                        {/* Desktop Header for Request */}
                        <div className="hidden md:flex w-full max-w-5xl mx-auto mb-6 items-center justify-between py-4 px-2">
                            <div>
                                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Solicitação de Veículo Próprio</h1>
                                <p className="text-sm text-slate-500">Agende sua viagem com a frota leve da Risel.</p>
                            </div>
                            <div className="bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm text-xs font-semibold text-slate-600">
                                Frota Leve &bull; Risel Combustíveis
                            </div>
                        </div>
                        
                        <div className="w-full md:max-w-5xl px-4 pb-8">
                             <ReservationForm initialVehicleId={preSelectedVehicleId} />
                        </div>
                    </div>
                );
        }
    };
    
    return (
        <div className="w-full bg-slate-50 flex-1 min-h-0 overflow-y-auto">
            <HelpGuideModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

            {permissionError && (
                 <div className="fixed inset-0 bg-red-900/95 backdrop-blur-sm flex flex-col items-center justify-center text-white p-8 z-[60] text-center font-sans">
                    <div className="max-w-2xl bg-white/10 p-8 rounded-xl shadow-2xl border border-white/20">
                        <h2 className="text-2xl font-bold mb-4">Erro de Configuração</h2>
                        <p>O sistema precisa de permissões atualizadas no banco de dados.</p>
                        <pre className="text-xs bg-black/50 p-4 rounded mt-4 text-left overflow-x-auto">{firestoreRulesForPublicAccess}</pre>
                    </div>
                </div>
            )}

            {/* Área de Conteúdo com scroll independente e espaçamento seguro inferior no mobile */}
            <div className="w-full transition-all duration-300 pb-24 md:pb-6">
                <main className="w-full scroll-smooth">
                    {renderPublicContent()}
                </main>
            </div>

            {/* Menu de Navegação Inferior para Celular (Estilo Aplicativo Mobile) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-1 py-1.5 flex items-center justify-around">
                {[
                    { 
                        id: 'request', 
                        label: 'Reserva', 
                        icon: DocumentTextIcon, 
                        badge: null,
                        isActive: publicView === 'request'
                    },
                    { 
                        id: 'racRequest', 
                        label: 'Locação RAC', 
                        icon: CarIcon, 
                        badge: 'RAC',
                        isActive: publicView === 'racRequest' || publicView === 'rac' || publicView === 'rac_request'
                    },
                    { 
                        id: 'dailyUse', 
                        label: 'Uso Diário', 
                        icon: ClipboardListIcon, 
                        badge: null,
                        isActive: publicView === 'dailyUse'
                    },
                    { 
                        id: 'fleetStatus', 
                        label: 'Status', 
                        icon: MapPinIcon, 
                        badge: null,
                        isActive: publicView === 'fleetStatus'
                    },
                    { 
                        id: 'login', 
                        label: 'Admin', 
                        icon: LogoutIcon, 
                        badge: null,
                        isActive: publicView === 'login'
                    },
                ].map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`flex-1 flex flex-col items-center justify-center relative py-1 px-1 transition-all duration-200 cursor-pointer min-h-[48px] ${
                            item.isActive 
                                ? 'text-[#114D38] font-black' 
                                : 'text-slate-500 hover:text-slate-800 font-semibold'
                        }`}
                    >
                        {item.isActive && (
                            <span className="absolute top-0 w-8 h-1 bg-[#114D38] rounded-b-full shadow-xs" />
                        )}
                        
                        <div className={`relative p-1 rounded-xl transition-all ${item.isActive ? 'bg-emerald-50 scale-105' : ''}`}>
                            <item.icon className={`w-5 h-5 ${item.isActive ? 'text-[#114D38]' : item.id === 'racRequest' ? 'text-amber-500' : 'text-slate-400'}`} />
                            {item.badge && (
                                <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-amber-500 text-white text-[8px] font-black rounded-full leading-none">
                                    {item.badge}
                                </span>
                            )}
                        </div>
                        
                        <span className="text-[10px] tracking-tight truncate w-full text-center leading-none mt-0.5">
                            {item.label}
                        </span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

const ReservaSubmoduleInner: React.FC<{ forcePublic?: boolean }> = ({ forcePublic = false }) => {
    const { user: globalUser } = useGlobalAuth();
    const { user: fbUser, signOut: handleFbLogout, loading } = useAuth();
    const [searchParams] = useSearchParams();
    const subParam = searchParams.get("sub");
    
    const isUserAdmin = Boolean((globalUser && globalUser.email) || (fbUser && !fbUser.isAnonymous));

    useEffect(() => {
        if (!loading) {
            const currentStored = localStorage.getItem("reserva_admin_logado") === "true";
            if (isUserAdmin !== currentStored) {
                localStorage.setItem("reserva_admin_logado", isUserAdmin ? "true" : "false");
                window.dispatchEvent(new Event("risel_submodule_auth_change"));
            }
        }
    }, [isUserAdmin, loading]);
    
    const handleLogout = async () => {
        localStorage.removeItem("reserva_admin_logado");
        window.dispatchEvent(new Event("risel_submodule_auth_change"));
        try {
            await handleFbLogout();
        } catch (e) {}
    };

    if (loading) {
        return (
            <div className="flex flex-1 min-h-0 items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center animate-pulse">
                    <RiselLogo className="w-16 h-16 mb-4" />
                    <p className="text-slate-500 font-medium">Carregando Sistema de Reservas...</p>
                </div>
            </div>
        );
    }

    // Se estiver em modo público forçado (link público para solicitantes)
    if (forcePublic) {
        if (subParam === 'login' || subParam === 'admin') {
            return isUserAdmin ? (
                <AdminDashboard onLogout={handleLogout} />
            ) : (
                <PublicLayout />
            );
        }
        return <PublicLayout />;
    }

    return isUserAdmin ? (
        <AdminDashboard onLogout={handleLogout} />
    ) : (
        <PublicLayout />
    );
};

export const ReservaSubmoduleContainer: React.FC<{ forcePublic?: boolean }> = ({ forcePublic = false }) => {
    return (
        <ReservationAuthProvider>
            <ReservationProvider>
                <div className="relative w-full h-full text-left font-sans text-slate-800 antialiased flex flex-col flex-1 min-h-0 overflow-hidden">
                    <ReservaSubmoduleInner forcePublic={forcePublic} />
                </div>
            </ReservationProvider>
        </ReservationAuthProvider>
    );
};
