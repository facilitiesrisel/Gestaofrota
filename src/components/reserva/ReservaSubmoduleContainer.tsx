import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReservationForm from './ReservationForm';
import AdminDashboard from './AdminDashboard';
import Login from './Login';
import PublicSidebar from './PublicSidebar';
import UserDailyUseForm from './UserDailyUseForm';
import FleetStatusView from './FleetStatusView';
import HelpGuideModal from './HelpGuideModal';
import { RiselLogo } from './RiselLogo';
import { MenuIcon, DocumentTextIcon, ClipboardListIcon, MapPinIcon, LogoutIcon } from './icons';
import { ReservationAuthProvider, useAuth } from '../../context/ReservationAuthContext';
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
      allow create, update, delete: if isRealAdmin();
    }
    match /user_settings/{settingId} {
      allow read: if isAuthenticated();
      allow write: if isRealAdmin();
    }
  }
}`;

const PublicLayout: React.FC = () => {
    const { permissionError } = useReservations();
    
    const [searchParams, setSearchParams] = useSearchParams();
    const rawPublicView = searchParams.get("sub") || "request";
    const publicView = rawPublicView === 'logout_reservas' ? 'login' : rawPublicView;

    const [preSelectedVehicleId, setPreSelectedVehicleId] = useState<string | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const handleNavigate = (view: string) => {
        setSearchParams({ tab: 'reservas', sub: view });
        if (view !== 'request') {
            setPreSelectedVehicleId(null);
        }
    };

    const handleRequestReservationFromFleet = (vehicleId: string) => {
        setPreSelectedVehicleId(vehicleId);
        setSearchParams({ tab: 'reservas', sub: 'request' });
    };

    const renderPublicContent = () => {
        switch (publicView) {
            case 'dailyUse':
                return (
                    <div className="w-full md:max-w-3xl mx-auto bg-white md:rounded-[24px] md:shadow-sm h-full md:h-auto overflow-y-auto md:mt-4 md:mb-8 border border-slate-200">
                         <UserDailyUseForm />
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
                        {/* Mobile Header for Request */}
                        <div className="md:hidden flex flex-col items-center py-6 px-4 w-full bg-white mb-4 border-b border-slate-200 shadow-sm">
                            <h1 className="text-xl font-extrabold text-primary uppercase tracking-wide">Nova Solicitação</h1>
                            <p className="text-xs text-slate-500 mt-1">Preencha os dados para agendar</p>
                        </div>

                        {/* Desktop Header for Request */}
                        <div className="hidden md:flex w-full max-w-5xl mx-auto mb-6 items-center justify-between py-4 px-2">
                            <div>
                                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Solicitação de Veículo</h1>
                                <p className="text-sm text-slate-500">Agende sua viagem com antecedência.</p>
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

            <div className="w-full transition-all duration-300">
                <main className="w-full scroll-smooth">
                    {renderPublicContent()}
                </main>
            </div>
        </div>
    );
};

const ReservaSubmoduleInner: React.FC = () => {
    const { user, signOut: handleLogout, loading } = useAuth();
    
    useEffect(() => {
        if (!loading) {
            const isAdmin = !!(user && !user.isAnonymous);
            const currentStored = localStorage.getItem("reserva_admin_logado") === "true";
            if (isAdmin !== currentStored) {
                localStorage.setItem("reserva_admin_logado", isAdmin ? "true" : "false");
                window.dispatchEvent(new Event("risel_submodule_auth_change"));
            }
        }
    }, [user, loading]);
    
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

    return user && !user.isAnonymous ? (
        <AdminDashboard onLogout={handleLogout} />
    ) : (
        <PublicLayout />
    );
};

export const ReservaSubmoduleContainer: React.FC = () => {
    return (
        <ReservationAuthProvider>
            <ReservationProvider>
                <div className="relative w-full h-full text-left font-sans text-slate-800 antialiased flex flex-col flex-1 min-h-0 overflow-hidden">
                    <ReservaSubmoduleInner />
                </div>
            </ReservationProvider>
        </ReservationAuthProvider>
    );
};
