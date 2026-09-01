import React, { useState, useEffect, useMemo } from 'react';
import { RacRental } from '../../types_reserva';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  AreaChart,
  Area,
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  subscribeToRacRentals, 
  addRacRental, 
  updateRacRental, 
  deleteRacRental,
  isRacRentalUsingFallback,
  getLocalRacRentalsCount,
  syncLocalRacRentalsWithFirebase,
  INITIAL_RAC_RENTALS,
  sendEmail,
  generateRacEmailHtml
} from '../../services/firebaseService';
import { ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import { useAuth } from '../../context/ReservationAuthContext';
import { 
  PlusIcon, 
  FunnelIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XIcon, 
  CalendarIcon, 
  ClockIcon, 
  CheckCircleIcon,
  XCircleIcon,
  CarIcon,
  MapPinIcon,
  CreditCardIcon,
  ClipboardListIcon
} from './icons';
import Modal from './Modal';
import { firebaseConfig } from '../../firebaseConfig';

// Componente de Placa Mercosul Realista e de Alto Padrão
const MercosulPlateBadge: React.FC<{ plate?: string }> = ({ plate }) => {
    const cleanPlate = (plate || '').toUpperCase().trim();
    const hasValidPlate = cleanPlate.length >= 6;
    
    if (!hasValidPlate) {
        return (
            <div className="inline-flex items-center justify-center border border-dashed border-slate-300 bg-slate-100/80 rounded-lg px-2.5 py-1 text-center select-none" style={{ minWidth: '92px' }}>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    {cleanPlate || 'SEM PLACA'}
                </span>
            </div>
        );
    }
    
    return (
        <div className="inline-flex flex-col items-center justify-center border border-slate-300 rounded-lg overflow-hidden shadow-xs bg-white select-none hover:border-slate-400 transition-all" style={{ width: '92px', minWidth: '92px' }}>
            {/* Faixa Azul Mercosul */}
            <div className="w-full py-0.5 px-1.5 flex items-center justify-between bg-[#003399]">
                <div className="flex items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-300 opacity-90"></div>
                    <div className="w-1 h-1 rounded-full bg-yellow-200 opacity-70"></div>
                </div>
                <span className="text-[7.5px] font-black text-white tracking-widest leading-none font-sans uppercase">
                    BRASIL
                </span>
                <div className="w-2.5 h-1.5 bg-emerald-500 rounded-[1px] relative flex items-center justify-center overflow-hidden">
                    <div className="w-1.5 h-1 bg-yellow-400 rotate-45 transform"></div>
                    <div className="w-0.5 h-0.5 rounded-full bg-blue-700 absolute"></div>
                </div>
            </div>

            {/* Corpo da Placa com Código e Fonte Monospace */}
            <div className="w-full bg-white py-0.5 px-1 text-center flex items-center justify-center">
                <span className="text-[12px] font-mono font-black tracking-wider leading-tight text-slate-900">
                    {cleanPlate}
                </span>
            </div>
        </div>
    );
};

// Helper to calculate usage time dynamically
const calculateUsageTime = (start: Date | string, end: Date | string) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diff = endTime - startTime;
    
    if (isNaN(diff) || diff < 0) return '0h';

    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '0m';
};

// Formata valor monetário no padrão BRL (R$ 0,00)
const formatCurrencyBRL = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Converte entrada de texto monetário para float com centavos
const parseCurrencyInput = (val: string): number => {
    if (!val) return 0;
    const cleanStr = String(val).trim();
    if (cleanStr.includes(',')) {
        const withoutThousands = cleanStr.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(withoutThousands);
        return isNaN(num) ? 0 : num;
    }
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
};

// Formats a date to ISO string for datetime-local input fields (YYYY-MM-DDTHH:MM)
const formatToLocalISO = (date: Date): string => {
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
};

interface RacRentalsViewProps {
    embedded?: boolean;
}

const RacRentalsView: React.FC<RacRentalsViewProps> = ({ embedded = false }) => {
    const { user } = useAuth();
    const [rentals, setRentals] = useState<RacRental[]>(INITIAL_RAC_RENTALS);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [usingFallback, setUsingFallback] = useState(false);
    const [localRentalsCount, setLocalRentalsCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Filter states
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isStatsDashboardOpen, setIsStatsDashboardOpen] = useState(false);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterSearch, setFilterSearch] = useState('');

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedRental, setSelectedRental] = useState<RacRental | null>(null);
    const [viewingCnh, setViewingCnh] = useState<{ isOpen: boolean; name: string; url: string; fileName: string } | null>(null);

    // Approve / Reject states
    const [approveFormData, setApproveFormData] = useState({
        rentalCompany: 'Localiza',
        reservationNumber: '',
        plate: '',
        value: '',
        pickupStore: '',
        returnStore: '',
        adminNotes: ''
    });
    const [rejectReason, setRejectReason] = useState('');
    const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
    const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

    // Form inputs
    const [formData, setFormData] = useState({
        rentalCompany: 'Localiza',
        plate: '',
        requesterName: '',
        requesterSector: '',
        requesterRole: '',
        requesterEmail: '',
        requesterPhone: '',
        driverName: '',
        driverRole: '',
        value: '',
        reservationNumber: '',
        status: 'Aguardando retirada' as 'Solicitada' | 'Em Uso' | 'Finalizada' | 'Aguardando retirada' | 'Recusada',
        base: '',
        createdByUser: '',
        category: '',
        purpose: '',
        observations: '',
        adminNotes: '',
        pickupCity: '',
        returnCity: '',
        reservationDate: formatToLocalISO(new Date()),
        pickupDate: formatToLocalISO(new Date()),
        pickupStore: '',
        returnDate: formatToLocalISO(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        returnStore: '',
    });

    // Subscribe to Firebase real-time data
    useEffect(() => {
        const unsubscribe = subscribeToRacRentals(
            (data) => {
                if (data && data.length > 0) {
                    setRentals(data);
                } else {
                    setRentals(INITIAL_RAC_RENTALS);
                }
                setIsLoading(false);
                setUsingFallback(isRacRentalUsingFallback());
                setLocalRentalsCount(getLocalRacRentalsCount());
            },
            (error) => {
                console.error("Error syncing RAC rentals:", error);
                setRentals(INITIAL_RAC_RENTALS);
                if (isRacRentalUsingFallback()) {
                    setUsingFallback(true);
                } else {
                    showToast("Erro ao sincronizar dados com o servidor.", "error");
                }
                setLocalRentalsCount(getLocalRacRentalsCount());
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSyncLocallySavedRentals = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            const countBefore = localRentalsCount;
            await syncLocalRacRentalsWithFirebase();
            if (countBefore > 0) {
                showToast("Todas as locações salvadas localmente foram sincronizadas com sucesso com o Firebase!", "success");
            } else {
                showToast("Conexão com o Firebase restabelecida com sucesso! Sincronização em nuvem ativa.", "success");
            }
            setLocalRentalsCount(0);
            setUsingFallback(false);
        } catch (error: any) {
            console.error("Falha ao sincronizar com o Firebase:", error);
            const errMsg = error instanceof Error ? error.message : "Erro desconhecido. Verifique sua conexão.";
            showToast(`Erro ao sincronizar com o Firebase. ${errMsg}`, "error");
        } finally {
            setIsSyncing(false);
        }
    };

    // Gather all unique bases from existing rentals, plus defaults
    const uniqueBases = useMemo(() => {
        const basesSet = new Set<string>(['Matriz', 'Filial SP', 'Filial RJ', 'Filial BH', 'Filial Sul']);
        rentals.forEach(r => {
            if (r.base && r.base.trim()) {
                basesSet.add(r.base.trim());
            }
        });
        return Array.from(basesSet).sort((a, b) => a.localeCompare(b));
    }, [rentals]);

    // Filter & search logic
    const filteredRentals = useMemo(() => {
        return rentals.filter(rental => {
            // Date Filter on pickupDate
            if (filterStartDate && new Date(rental.pickupDate) < new Date(filterStartDate)) return false;
            
            if (filterEndDate) {
                const end = new Date(filterEndDate);
                end.setHours(23, 59, 59, 999);
                if (new Date(rental.pickupDate) > end) return false;
            }

            // Rental Company Filter
            if (filterCompany) {
                if (filterCompany === 'Outras') {
                    const known = ['localiza', 'movida', 'unidas', 'super mais'];
                    const comp = (rental.rentalCompany || '').toLowerCase();
                    if (known.some(k => comp.includes(k))) return false;
                } else {
                    const comp = (rental.rentalCompany || '').toLowerCase();
                    if (!comp.includes(filterCompany.toLowerCase())) return false;
                }
            }

            // Status Filter
            if (filterStatus !== 'all' && rental.status !== filterStatus) return false;

            // Global text search (Plate, Solicitante, Driver, Reserva #, Base, Protocol, Cidades)
            if (filterSearch.trim()) {
                const s = filterSearch.toLowerCase().trim();
                const plateMatch = (rental.plate || '').toLowerCase().includes(s);
                const reqMatch = (rental.requesterName || '').toLowerCase().includes(s);
                const rmMatch = (rental.reservationNumber || '').toLowerCase().includes(s);
                const condMatch = (rental.driverName || '').toLowerCase().includes(s);
                const baseMatch = (rental.base || '').toLowerCase().includes(s);
                const compMatch = (rental.rentalCompany || '').toLowerCase().includes(s);
                const protMatch = (rental.protocol || '').toLowerCase().includes(s);
                const cityMatch = (rental.pickupCity || '').toLowerCase().includes(s) || (rental.returnCity || '').toLowerCase().includes(s);
                if (!plateMatch && !reqMatch && !rmMatch && !condMatch && !baseMatch && !compMatch && !protMatch && !cityMatch) return false;
            }

            return true;
        }).sort((a, b) => {
            // Sort by pickupDate descending (newest first)
            const dateA = new Date(a.pickupDate).getTime();
            const dateB = new Date(b.pickupDate).getTime();
            return dateB - dateA;
        });
    }, [rentals, filterStartDate, filterEndDate, filterCompany, filterStatus, filterSearch]);

    // Statistics panel counters
    const stats = useMemo(() => {
        const total = rentals.length;
        const requested = rentals.filter(r => r.status === 'Solicitada').length;
        const inUse = rentals.filter(r => r.status === 'Em Uso').length;
        const completed = rentals.filter(r => r.status === 'Finalizada').length;
        const awaiting = rentals.filter(r => r.status === 'Aguardando retirada').length;
        return { total, requested, inUse, completed, awaiting };
    }, [rentals]);

    // Analytical computations for Indicators & Charts
    const indicators = useMemo(() => {
        const totalVal = rentals.reduce((sum, r) => sum + (r.value || 0), 0);
        const avgVal = rentals.length > 0 ? (totalVal / rentals.length) : 0;
        
        const totalDays = rentals.reduce((sum, r) => {
            const start = new Date(r.pickupDate).getTime();
            const end = new Date(r.returnDate).getTime();
            const diff = end - start;
            const days = diff / (1000 * 60 * 60 * 24);
            return sum + (days > 0 ? days : 0);
        }, 0);
        const avgDays = rentals.length > 0 ? (totalDays / rentals.length) : 0;
        const activeCount = rentals.filter(r => r.status === 'Em Uso').length;

        // Análise de comparação com mês anterior
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
        const prevYear = curMonth === 0 ? curYear - 1 : curYear;

        const curMonthRentals = rentals.filter(r => {
            const d = new Date(r.pickupDate);
            return d.getMonth() === curMonth && d.getFullYear() === curYear;
        });
        const prevMonthRentals = rentals.filter(r => {
            const d = new Date(r.pickupDate);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });

        const curMonthInvestment = curMonthRentals.reduce((sum, r) => sum + (r.value || 0), 0);
        const prevMonthInvestment = prevMonthRentals.reduce((sum, r) => sum + (r.value || 0), 0);
        
        let investmentDiffPercent: number | null = null;
        if (prevMonthInvestment > 0) {
            investmentDiffPercent = Math.round(((curMonthInvestment - prevMonthInvestment) / prevMonthInvestment) * 100);
        }

        let rentalsDiffPercent: number | null = null;
        if (prevMonthRentals.length > 0) {
            rentalsDiffPercent = Math.round(((curMonthRentals.length - prevMonthRentals.length) / prevMonthRentals.length) * 100);
        }

        return {
            totalInvestment: totalVal,
            averageInvestment: avgVal,
            averageDays: avgDays,
            activeRentalsCount: activeCount,
            curMonthInvestment,
            prevMonthInvestment,
            investmentDiffPercent,
            rentalsDiffPercent
        };
    }, [rentals]);

    // Chart 1 & 2: Quantidade e Valor de Locações por Mês
    const monthlyVolumeData = useMemo(() => {
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const dataMap = meses.map(m => ({ name: m, "Locações": 0, "Valor (R$)": 0 }));
        
        let hasRealData = false;
        rentals.forEach(r => {
            const d = new Date(r.pickupDate);
            const mIdx = d.getMonth();
            if (mIdx >= 0 && mIdx < 12) {
                dataMap[mIdx]["Locações"] += 1;
                dataMap[mIdx]["Valor (R$)"] += (r.value || 0);
                hasRealData = true;
            }
        });

        if (!hasRealData) {
            const currentMonth = new Date().getMonth();
            return meses.slice(0, currentMonth + 1).map(m => ({ name: m, "Locações": 0, "Valor (R$)": 0 }));
        }

        const currentMonth = new Date().getMonth();
        return dataMap.filter((item, idx) => idx <= currentMonth || item["Locações"] > 0);
    }, [rentals]);

    // Chart 3: Total de Locações por Setor
    const sectorDistributionData = useMemo(() => {
        const sectorMap: { [key: string]: number } = {};
        let hasSectors = false;
        
        rentals.forEach(r => {
            if (r.requesterSector) {
                const sector = r.requesterSector.trim();
                if (sector) {
                    sectorMap[sector] = (sectorMap[sector] || 0) + 1;
                    hasSectors = true;
                }
            }
        });

        if (!hasSectors) {
            return [];
        }

        const data = Object.keys(sectorMap).map(key => ({
            name: key,
            "Locações": sectorMap[key]
        }));

        return data.sort((a, b) => b["Locações"] - a["Locações"]).slice(0, 6);
    }, [rentals]);

    // Chart 4: Total de Reservas por Status
    const statusDistributionData = useMemo(() => {
        const statusMap = { 'Aguardando retirada': 0, 'Em Uso': 0, 'Finalizada': 0 };
        let hasData = false;
        
        rentals.forEach(r => {
            if (r.status === 'Aguardando retirada') statusMap['Aguardando retirada'] += 1;
            else if (r.status === 'Em Uso') statusMap['Em Uso'] += 1;
            else if (r.status === 'Finalizada') statusMap['Finalizada'] += 1;
            hasData = true;
        });

        if (!hasData) {
            return [
                { name: 'Aguardando retirada', value: 0 },
                { name: 'Em Uso', value: 0 },
                { name: 'Finalizada', value: 0 }
            ];
        }

        return [
            { name: 'Aguardando retirada', value: statusMap['Aguardando retirada'] },
            { name: 'Em Uso', value: statusMap['Em Uso'] },
            { name: 'Finalizada', value: statusMap['Finalizada'] }
        ];
    }, [rentals]);

    // Open clean form for creating new rental
    const handleOpenCreateModal = () => {
        setSelectedRental(null);
        setFormData({
            rentalCompany: 'Localiza',
            plate: '',
            requesterName: '',
            requesterSector: '',
            requesterRole: '',
            requesterEmail: '',
            requesterPhone: '',
            driverName: '',
            driverRole: '',
            value: '',
            reservationNumber: '',
            status: 'Aguardando retirada',
            base: '',
            createdByUser: user?.email || 'Admin',
            category: '',
            purpose: '',
            observations: '',
            adminNotes: '',
            pickupCity: '',
            returnCity: '',
            reservationDate: formatToLocalISO(new Date()),
            pickupDate: formatToLocalISO(new Date()),
            pickupStore: '',
            returnDate: formatToLocalISO(new Date(Date.now() + 24 * 60 * 60 * 1000)),
            returnStore: '',
        });
        setIsFormModalOpen(true);
    };

    // Open form with existing prefilled data for editing
    const handleOpenEditModal = (rental: RacRental) => {
        setSelectedRental(rental);
        setFormData({
            rentalCompany: rental.rentalCompany || 'Localiza',
            plate: rental.plate || '',
            requesterName: rental.requesterName || '',
            requesterSector: rental.requesterSector || '',
            requesterRole: rental.requesterRole || '',
            requesterEmail: rental.requesterEmail || '',
            requesterPhone: rental.requesterPhone || '',
            driverName: rental.driverName || '',
            driverRole: rental.driverRole || '',
            value: rental.value !== undefined && rental.value !== null ? String(rental.value) : '',
            reservationNumber: rental.reservationNumber || '',
            status: (rental.status || 'Aguardando retirada') as any,
            base: rental.base || '',
            createdByUser: rental.createdByUser || user?.email || 'Admin',
            category: rental.category || '',
            purpose: rental.purpose || '',
            observations: rental.observations || '',
            adminNotes: rental.adminNotes || '',
            pickupCity: rental.pickupCity || '',
            returnCity: rental.returnCity || '',
            reservationDate: formatToLocalISO(new Date(rental.reservationDate || new Date())),
            pickupDate: formatToLocalISO(new Date(rental.pickupDate || new Date())),
            pickupStore: rental.pickupStore || '',
            returnDate: formatToLocalISO(new Date(rental.returnDate || Date.now() + 86400000)),
            returnStore: rental.returnStore || '',
        });
        setIsFormModalOpen(true);
    };

    // Open modal to confirm deleting rental
    const handleOpenDeleteModal = (rental: RacRental) => {
        setSelectedRental(rental);
        setIsDeleteModalOpen(true);
    };

    // Open Approval Modal
    const handleOpenApproveModal = (rental: RacRental) => {
        setSelectedRental(rental);
        setApproveFormData({
            rentalCompany: rental.rentalCompany && rental.rentalCompany !== 'A Definir (Cotação RAC)' ? rental.rentalCompany : 'Localiza',
            reservationNumber: rental.reservationNumber && !rental.reservationNumber.startsWith('RAC-') ? rental.reservationNumber : '',
            plate: rental.plate && rental.plate !== 'A DEFINIR' ? rental.plate : '',
            value: rental.value !== undefined && rental.value !== null ? String(rental.value) : '',
            pickupStore: rental.pickupStore || (rental.pickupCity ? `${rental.pickupCity} (Loja Principal)` : ''),
            returnStore: rental.returnStore || (rental.returnCity ? `${rental.returnCity} (Loja Principal)` : ''),
            adminNotes: rental.adminNotes || ''
        });
        setIsApproveModalOpen(true);
    };

    // Confirm Approval and Send Email
    const handleConfirmApprove = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRental) return;
        setIsSubmittingApproval(true);
        try {
            const updatedData: Partial<RacRental> = {
                status: 'Aguardando retirada',
                rentalCompany: approveFormData.rentalCompany || 'Localiza',
                reservationNumber: approveFormData.reservationNumber.trim() || selectedRental.reservationNumber,
                plate: approveFormData.plate.toUpperCase().trim() || selectedRental.plate,
                value: parseCurrencyInput(approveFormData.value),
                pickupStore: approveFormData.pickupStore.trim(),
                returnStore: approveFormData.returnStore.trim(),
                adminNotes: approveFormData.adminNotes.trim()
            };

            await updateRacRental(selectedRental.id, updatedData);

            const fullUpdated: RacRental = {
                ...selectedRental,
                ...updatedData
            };

            // Dispara e-mail de Aprovação com observações do administrador
            try {
                const emailHtml = generateRacEmailHtml(fullUpdated, {
                    actionType: 'approved',
                    adminNotes: approveFormData.adminNotes.trim()
                });

                const recipients = [...ADMIN_EMAIL_RECIPIENTS];
                if (fullUpdated.requesterEmail && !recipients.includes(fullUpdated.requesterEmail)) {
                    recipients.push(fullUpdated.requesterEmail);
                }

                await sendEmail(
                    recipients,
                    `[Solicitação RAC APROVADA] ${fullUpdated.protocolNumber || fullUpdated.reservationNumber} - ${fullUpdated.requesterName}`,
                    emailHtml
                );
            } catch (mailErr) {
                console.warn("Aviso ao enviar e-mail de aprovação RAC:", mailErr);
            }

            showToast("Solicitação RAC aprovada e e-mails enviados com sucesso!", "success");
            setIsApproveModalOpen(false);
            setSelectedRental(null);
        } catch (err) {
            console.error("Erro ao aprovar solicitação RAC:", err);
            showToast("Erro ao processar aprovação da locação.", "error");
        } finally {
            setIsSubmittingApproval(false);
        }
    };

    // Open Rejection Modal
    const handleOpenRejectModal = (rental: RacRental) => {
        setSelectedRental(rental);
        setRejectReason('');
        setIsRejectModalOpen(true);
    };

    // Confirm Rejection and Send Email
    const handleConfirmReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRental) return;
        if (!rejectReason.trim()) {
            showToast("Por favor, informe a justificativa da recusa.", "error");
            return;
        }
        setIsSubmittingRejection(true);
        try {
            const updatedData: Partial<RacRental> = {
                status: 'Recusada',
                rejectReason: rejectReason.trim(),
                adminNotes: rejectReason.trim()
            };

            await updateRacRental(selectedRental.id, updatedData);

            const fullUpdated: RacRental = {
                ...selectedRental,
                ...updatedData
            };

            // Dispara e-mail de Recusa com justificativa e observações
            try {
                const emailHtml = generateRacEmailHtml(fullUpdated, {
                    actionType: 'rejected',
                    rejectReason: rejectReason.trim(),
                    adminNotes: rejectReason.trim()
                });

                const recipients = [...ADMIN_EMAIL_RECIPIENTS];
                if (fullUpdated.requesterEmail && !recipients.includes(fullUpdated.requesterEmail)) {
                    recipients.push(fullUpdated.requesterEmail);
                }

                await sendEmail(
                    recipients,
                    `[Solicitação RAC RECUSADA] ${fullUpdated.protocolNumber || fullUpdated.reservationNumber} - ${fullUpdated.requesterName}`,
                    emailHtml
                );
            } catch (mailErr) {
                console.warn("Aviso ao enviar e-mail de recusa RAC:", mailErr);
            }

            showToast("Solicitação RAC recusada e e-mail enviado ao solicitante.", "success");
            setIsRejectModalOpen(false);
            setSelectedRental(null);
        } catch (err) {
            console.error("Erro ao recusar solicitação RAC:", err);
            showToast("Erro ao processar recusa da locação.", "error");
        } finally {
            setIsSubmittingRejection(false);
        }
    };

    // Submit handler for both Create and Update
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.requesterName || !formData.requesterName.trim()) {
            showToast("O nome do solicitante é obrigatório.", "error");
            return;
        }

        try {
            const dataToSave: Partial<RacRental> = {
                rentalCompany: formData.rentalCompany || 'Localiza',
                plate: (formData.plate || '').toUpperCase().trim(),
                requesterName: (formData.requesterName || '').trim(),
                requesterSector: (formData.requesterSector || '').trim(),
                requesterRole: (formData.requesterRole || '').trim(),
                requesterEmail: (formData.requesterEmail || '').trim(),
                requesterPhone: (formData.requesterPhone || '').trim(),
                driverName: (formData.driverName || '').trim(),
                driverRole: (formData.driverRole || '').trim(),
                value: parseCurrencyInput(formData.value),
                reservationNumber: (formData.reservationNumber || '').trim(),
                status: formData.status,
                base: (formData.base || '').trim(),
                createdByUser: (formData.createdByUser || '').trim() || user?.email || 'Admin',
                category: (formData.category || '').trim(),
                purpose: (formData.purpose || '').trim(),
                observations: (formData.observations || '').trim(),
                adminNotes: (formData.adminNotes || '').trim(),
                pickupCity: (formData.pickupCity || '').trim(),
                returnCity: (formData.returnCity || '').trim(),
                reservationDate: formData.reservationDate ? new Date(formData.reservationDate) : new Date(),
                pickupDate: formData.pickupDate ? new Date(formData.pickupDate) : new Date(),
                pickupStore: (formData.pickupStore || '').trim(),
                returnDate: formData.returnDate ? new Date(formData.returnDate) : new Date(),
                returnStore: (formData.returnStore || '').trim(),
            };

            if (selectedRental) {
                await updateRacRental(selectedRental.id, dataToSave);

                // Envia e-mail de atualização com observações se for edição
                try {
                    const fullUpdated: RacRental = {
                        ...selectedRental,
                        ...dataToSave
                    };
                    const emailHtml = generateRacEmailHtml(fullUpdated, {
                        actionType: 'updated',
                        adminNotes: (formData.adminNotes || '').trim()
                    });
                    const recipients = [...ADMIN_EMAIL_RECIPIENTS];
                    if (fullUpdated.requesterEmail && !recipients.includes(fullUpdated.requesterEmail)) {
                        recipients.push(fullUpdated.requesterEmail);
                    }
                    await sendEmail(
                        recipients,
                        `[Atualização de Locação RAC] ${fullUpdated.protocolNumber || fullUpdated.reservationNumber} - ${fullUpdated.requesterName}`,
                        emailHtml
                    );
                } catch (mErr) {
                    console.warn("Aviso ao enviar e-mail de atualização RAC:", mErr);
                }

                showToast("Locação RAC atualizada e notificação enviada!");
            } else {
                await addRacRental(dataToSave as any);
                showToast("Nova locação RAC cadastrada!");
            }
            setIsFormModalOpen(false);
            setSelectedRental(null);
        } catch (err) {
            console.error("Error saving RAC rental:", err);
            showToast("Ocorreu um erro ao salvar as informações da locação.", "error");
        }
    };

    // Quick toggle status
    const handleToggleStatus = async (rental: RacRental) => {
        let nextStatus: 'Solicitada' | 'Aguardando retirada' | 'Em Uso' | 'Finalizada' = 'Em Uso';
        let msg = '';
        if (rental.status === 'Solicitada') {
            handleOpenApproveModal(rental);
            return;
        } else if (rental.status === 'Aguardando retirada') {
            nextStatus = 'Em Uso';
            msg = "Locação alterada para Em Uso!";
        } else if (rental.status === 'Em Uso') {
            nextStatus = 'Finalizada';
            msg = "Locação finalizada com sucesso!";
        } else {
            nextStatus = 'Em Uso';
            msg = "Locação reaberta e alterada para Em Uso!";
        }
        
        try {
            await updateRacRental(rental.id, { status: nextStatus });
            showToast(msg);
        } catch (err) {
            console.error("Error toggling status:", err);
            showToast("Erro ao alterar status da locação.", "error");
        }
    };

    // Delete confirmation handler
    const handleDeleteConfirm = async () => {
        if (!selectedRental) return;
        try {
            await deleteRacRental(selectedRental.id);
            showToast("Locação RAC excluída com sucesso.");
            setIsDeleteModalOpen(false);
            setSelectedRental(null);
        } catch (err) {
            console.error("Error deleting RAC rental:", err);
            showToast("Falha ao excluir locação.", "error");
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col p-4 md:p-6 space-y-4 bg-slate-50/60">
            {toast && (
                <div className={`fixed top-24 right-6 text-white p-4 rounded-2xl shadow-xl z-50 flex items-center gap-2 transform transition-transform animate-fadeIn ${toast.type === 'success' ? 'bg-[#114D38] border border-emerald-500' : 'bg-rose-600 border border-rose-500'}`}>
                    {toast.type === 'success' ? <CheckCircleIcon className="h-5 w-5" /> : <XCircleIcon className="h-5 w-5" />}
                    <span className="font-bold text-xs">{toast.message}</span>
                </div>
            )}

            {usingFallback && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl text-xs flex flex-col gap-3 shadow-xs animate-fadeIn shrink-0">
                    <div className="flex items-start gap-3">
                        <span className="text-lg">⚠️</span>
                        <div className="space-y-1">
                            <p className="font-black text-xs text-amber-900">Configuração de Sincronização em Nuvem (RAC)</p>
                            <p className="text-slate-600 font-medium">
                                Suas locações estão sendo salvas com segurança no navegador. Para sincronizar em múltiplos dispositivos, certifique-se de que a regra de segurança <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">match /racRentals/{'{rentalId}'}</code> esteja ativa no Firestore.
                            </p>
                        </div>
                        <button
                            onClick={handleSyncLocallySavedRentals}
                            disabled={isSyncing}
                            className="ml-auto bg-[#114D38] hover:bg-emerald-800 disabled:opacity-50 text-white font-black text-xs py-1.5 px-3 rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                            {isSyncing ? 'Sincronizando...' : 'Testar Sincronização'}
                        </button>
                    </div>
                </div>
            )}

            {/* 1. Header Fixo com Botões e Cards de Indicadores BI */}
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6 py-2 space-y-2.5 border-b border-slate-200/80 shadow-2xs">
                {/* Header Bar */}
                <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 flex-wrap">
                    {!isStatsDashboardOpen ? (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
                                <span className="text-sm">🏢</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black text-slate-900 tracking-tight">Locações RAC</h1>
                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200/80">
                                    {rentals.length} {rentals.length === 1 ? 'contrato' : 'contratos'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-[#114D38]">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                </svg>
                            </div>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Painel Analítico RAC</span>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-2 flex-wrap ml-auto">
                        <button 
                            onClick={() => setIsStatsDashboardOpen(!isStatsDashboardOpen)} 
                            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-xl transition-all cursor-pointer ${
                                isStatsDashboardOpen 
                                    ? 'bg-[#114D38] text-white border-[#114D38] shadow-xs' 
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                               <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                            </svg>
                            <span>{isStatsDashboardOpen ? 'Ocultar BI' : 'Indicadores BI'}</span>
                        </button>

                        <button 
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)} 
                            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-xl transition-all cursor-pointer ${
                                isFiltersOpen 
                                    ? 'bg-slate-100 text-slate-800 border-slate-300 shadow-inner' 
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
                            }`}
                        >
                            <FunnelIcon className="h-3.5 w-3.5 text-slate-500" />
                            <span>Filtros</span>
                        </button>

                        <button 
                            onClick={handleOpenCreateModal} 
                            className="bg-slate-900 hover:bg-[#114D38] text-white font-bold py-1.5 px-3.5 rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 flex items-center gap-1.5 text-xs shrink-0 cursor-pointer"
                        >
                            <PlusIcon className="h-3.5 w-3.5 text-white"/>
                            <span>Nova Locação</span>
                        </button>
                    </div>
                </div>

                {/* 4 Cards Financeiros / Operacionais Fixo no Topo */}
                {isStatsDashboardOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fadeIn">
                        {/* Card 1: Total Investido (RAC) */}
                        <div className="bg-gradient-to-br from-emerald-900 via-[#114D38] to-teal-950 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="flex items-center justify-between relative z-10">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200/90">Total Investido (RAC)</span>
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-emerald-200">
                                    <span className="text-xs">💰</span>
                                </div>
                            </div>
                            <div className="mt-1.5 relative z-10">
                                <h4 className="text-xl font-black text-white font-sans tracking-tight">
                                    {formatCurrencyBRL(indicators.totalInvestment)}
                                </h4>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-200/80 font-medium">
                                    <span>Gasto total acumulado</span>
                                    {indicators.investmentDiffPercent !== null && (
                                        <span className={`font-bold px-1.5 py-0.2 rounded-md ${indicators.investmentDiffPercent <= 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'}`}>
                                            {indicators.investmentDiffPercent > 0 ? `+${indicators.investmentDiffPercent}% vs mês ant.` : `${indicators.investmentDiffPercent}% vs mês ant.`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
                        </div>

                        {/* Card 2: Custo Médio por Contrato */}
                        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="flex items-center justify-between relative z-10">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Custo Médio / Contrato</span>
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-slate-300">
                                    <span className="text-xs">📊</span>
                                </div>
                            </div>
                            <div className="mt-1.5 relative z-10">
                                <h4 className="text-xl font-black text-white font-sans tracking-tight">
                                    {formatCurrencyBRL(indicators.averageInvestment)}
                                </h4>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-300/80 font-medium">
                                    <span>Média por locação</span>
                                    <span className="font-bold text-slate-300">{rentals.length} contratos</span>
                                </div>
                            </div>
                            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
                        </div>

                        {/* Card 3: Média de Utilização */}
                        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="flex items-center justify-between relative z-10">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-200">Média de Utilização</span>
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-indigo-200">
                                    <ClockIcon className="w-3 h-3" />
                                </div>
                            </div>
                            <div className="mt-1.5 relative z-10">
                                <h4 className="text-xl font-black text-white font-sans tracking-tight">
                                    {indicators.averageDays.toFixed(1)} <span className="text-xs font-semibold text-indigo-200">dias</span>
                                </h4>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-indigo-200/80 font-medium">
                                    <span>Duração média</span>
                                    <span className="font-bold text-indigo-300">Tempo de uso</span>
                                </div>
                            </div>
                            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
                        </div>

                        {/* Card 4: Locações Ativas */}
                        <div className="bg-gradient-to-br from-blue-950 via-sky-950 to-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="flex items-center justify-between relative z-10">
                                <span className="text-[10px] font-black uppercase tracking-wider text-sky-200">Locações Ativas</span>
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-sky-200">
                                    <CarIcon className="w-3 h-3" />
                                </div>
                            </div>
                            <div className="mt-1.5 relative z-10">
                                <h4 className="text-xl font-black text-sky-300 font-sans tracking-tight">
                                    {indicators.activeRentalsCount} <span className="text-xs font-semibold text-sky-200">em uso</span>
                                </h4>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-sky-200/80 font-medium">
                                    <span>Em circulação externa</span>
                                    {indicators.rentalsDiffPercent !== null && (
                                        <span className={`font-bold px-1.5 py-0.2 rounded-md ${indicators.rentalsDiffPercent >= 0 ? 'bg-sky-400/20 text-sky-200' : 'bg-slate-400/20 text-slate-200'}`}>
                                            {indicators.rentalsDiffPercent > 0 ? `+${indicators.rentalsDiffPercent}% vs mês ant.` : `${indicators.rentalsDiffPercent}% vs mês ant.`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-sky-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Painel de Gráficos Analíticos (Expandível) */}
            {isStatsDashboardOpen && (
                <div className="bg-white border border-slate-200 p-5 rounded-3xl space-y-4 shadow-xs animate-fadeIn">
                    {/* Gráficos Recharts em Pares (2 por Linha) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Gráfico 1: Quantidade de Locações por Mês */}
                        <div className="bg-slate-50/60 p-4.5 rounded-2xl border border-slate-200 flex flex-col">
                            <div className="mb-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Quantidade de Locações por Mês</h4>
                                <p className="text-[10px] text-slate-400">Volume de novos contratos de aluguel por mês de retirada.</p>
                            </div>
                            <div className="h-56 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyVolumeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                                            labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                        />
                                        <Bar dataKey="Locações" fill="#114D38" radius={[6, 6, 0, 0]} barSize={28} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Gráfico 2: Valor Total de Locações por Mês */}
                        <div className="bg-slate-50/60 p-4.5 rounded-2xl border border-slate-200 flex flex-col">
                            <div className="mb-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Valor Total de Locações por Mês</h4>
                                <p className="text-[10px] text-slate-400">Evolução financeira dos gastos com aluguel externo de veículos.</p>
                            </div>
                            <div className="h-56 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={monthlyVolumeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorValorRac" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#d97706" stopOpacity={0.25}/>
                                                <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            formatter={(value: any) => [formatCurrencyBRL(Number(value)), 'Gasto Total']}
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                                            labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                        />
                                        <Area type="monotone" dataKey="Valor (R$)" stroke="#d97706" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValorRac)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Gráfico 3: Total de Locações por Setor */}
                        <div className="bg-slate-50/60 p-4.5 rounded-2xl border border-slate-200 flex flex-col">
                            <div className="mb-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Locações por Setor Solicitante</h4>
                                <p className="text-[10px] text-slate-400">Distribuição volumétrica entre os centros de custo da empresa.</p>
                            </div>
                            <div className="h-56 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={sectorDistributionData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                        <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} tickLine={false} width={110} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                                        />
                                        <Bar dataKey="Locações" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Gráfico 4: Distribuição por Status (Donut) */}
                        <div className="bg-slate-50/60 p-4.5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                            <div className="mb-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Proporção por Status</h4>
                                <p className="text-[10px] text-slate-400">Status atual dos contratos de aluguel RAC.</p>
                            </div>
                            <div className="h-44 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusDistributionData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            <Cell key="cell-0" fill="#f59e0b" />
                                            <Cell key="cell-1" fill="#3b82f6" />
                                            <Cell key="cell-2" fill="#10b981" />
                                        </Pie>
                                        <Tooltip 
                                            formatter={(value: any) => [`${value} contratos`, 'Quantidade']}
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '11px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total</span>
                                    <span className="text-xl font-black text-slate-900 leading-none mt-0.5">
                                        {statusDistributionData.reduce((sum, s) => sum + s.value, 0)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-center gap-3 mt-1 pb-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                                    Aguardando ({statusDistributionData.find(s => s.name === 'Aguardando retirada')?.value || 0})
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                                    Em Uso ({statusDistributionData.find(s => s.name === 'Em Uso')?.value || 0})
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                                    Finalizada ({statusDistributionData.find(s => s.name === 'Finalizada')?.value || 0})
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Barra de Filtros e Busca Rápida */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    
                    {/* Barra de Pesquisa */}
                    <div className="relative w-full md:w-80">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Buscar por placa, solicitante, condutor ou reserva..." 
                            value={filterSearch} 
                            onChange={e => setFilterSearch(e.target.value)} 
                            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                        />
                        {filterSearch && (
                            <button 
                                onClick={() => setFilterSearch('')} 
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                                <XIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Pílulas de Filtro de Status */}
                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                        
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-inner shrink-0">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    filterStatus === 'all'
                                        ? 'bg-white text-slate-900 shadow-xs font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>Todos</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">{rentals.length}</span>
                            </button>

                            {stats.requested > 0 && (
                                <button
                                    onClick={() => setFilterStatus('Solicitada')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer animate-pulse ${
                                        filterStatus === 'Solicitada'
                                            ? 'bg-amber-500 text-white shadow-xs font-black'
                                            : 'text-amber-700 hover:text-amber-900 bg-amber-50'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                    <span>Solicitadas</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-black">{stats.requested}</span>
                                </button>
                            )}

                            <button
                                onClick={() => setFilterStatus('Em Uso')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    filterStatus === 'Em Uso'
                                        ? 'bg-white text-blue-700 shadow-xs font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span>Em Uso</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 font-black">{stats.inUse}</span>
                            </button>

                            <button
                                onClick={() => setFilterStatus('Aguardando retirada')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    filterStatus === 'Aguardando retirada'
                                        ? 'bg-white text-amber-700 shadow-xs font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span>Aguardando</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 font-black">{stats.awaiting}</span>
                            </button>

                            <button
                                onClick={() => setFilterStatus('Finalizada')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    filterStatus === 'Finalizada'
                                        ? 'bg-white text-emerald-800 shadow-xs font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span>Finalizadas</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 font-black">{stats.completed}</span>
                            </button>
                        </div>

                        {/* Filtro por Locadora */}
                        <select 
                            value={filterCompany} 
                            onChange={e => setFilterCompany(e.target.value)} 
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-emerald-600 cursor-pointer shrink-0"
                        >
                            <option value="">Locadora: Todas</option>
                            <option value="Localiza">Localiza</option>
                            <option value="Movida">Movida</option>
                            <option value="Unidas">Unidas</option>
                            <option value="Outras">Outras</option>
                        </select>

                    </div>
                </div>

                {/* Banner de Solicitações Pendentes dos Usuários */}
                {stats.requested > 0 && filterStatus !== 'Solicitada' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🔔</span>
                            <span>
                                <strong>{stats.requested} {stats.requested === 1 ? 'solicitação' : 'solicitações'} de locação RAC</strong> feita via portal público aguardando cotação e preenchimento de dados da locadora.
                            </span>
                        </div>
                        <button
                            onClick={() => setFilterStatus('Solicitada')}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
                        >
                            Ver Solicitações
                        </button>
                    </div>
                )}

                {/* Filtros Avançados Expansíveis */}
                {isFiltersOpen && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-col md:flex-row items-center gap-3 text-xs">
                        <span className="font-bold text-slate-600 shrink-0">Intervalo de Retirada:</span>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input 
                                type="date" 
                                value={filterStartDate} 
                                onChange={e => setFilterStartDate(e.target.value)} 
                                className="border border-slate-200 bg-white px-2.5 py-1 text-xs rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-600" 
                            />
                            <span className="text-slate-400 font-bold">até</span>
                            <input 
                                type="date" 
                                value={filterEndDate} 
                                onChange={e => setFilterEndDate(e.target.value)} 
                                className="border border-slate-200 bg-white px-2.5 py-1 text-xs rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-600" 
                            />
                            {(filterStartDate || filterEndDate || filterCompany) && (
                                <button
                                    onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterCompany(''); }}
                                    className="text-xs text-rose-600 font-bold hover:underline cursor-pointer ml-2"
                                >
                                    Limpar datas
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Tabela de Locações Desktop (Alto Padrão Visual) */}
            <div className="hidden md:block overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#114D38] text-white text-[10px] font-black uppercase tracking-wider border-b border-[#0d3b2c]">
                                <th scope="col" className="py-4 px-5 text-left">Locadora / Placa</th>
                                <th scope="col" className="py-4 px-5 text-left">Solicitante & Contato</th>
                                <th scope="col" className="py-4 px-5 text-left">Itinerário (Cidades)</th>
                                <th scope="col" className="py-4 px-5 text-left">Valor (R$)</th>
                                <th scope="col" className="py-4 px-5 text-left">Condutor & CNH</th>
                                <th scope="col" className="py-4 px-5 text-left">Período de Locação</th>
                                <th scope="col" className="py-4 px-5 text-left">Status</th>
                                <th scope="col" className="py-4 px-5 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-xs font-bold">Carregando locações RAC...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRentals.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <CarIcon className="w-8 h-8 opacity-30 text-slate-400" />
                                            <span className="font-bold text-sm">Nenhuma locação RAC encontrada.</span>
                                            <button 
                                                onClick={() => { setFilterSearch(''); setFilterStatus('all'); setFilterCompany(''); setFilterStartDate(''); setFilterEndDate(''); }}
                                                className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                                            >
                                                Limpar todos os filtros
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRentals.map(r => {
                                    let compBadgeClass = "bg-purple-50 text-purple-800 border-purple-200";
                                    if (r.rentalCompany === 'Localiza') {
                                        compBadgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200";
                                    } else if (r.rentalCompany === 'Movida') {
                                        compBadgeClass = "bg-orange-50 text-orange-850 border-orange-200";
                                    } else if (r.rentalCompany === 'Unidas') {
                                        compBadgeClass = "bg-blue-50 text-blue-800 border-blue-200";
                                    }

                                    const hasCnhAttached = !!(r.cnhBase64 || r.hasCnhCopy);

                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                                            
                                            {/* Locadora & Placa Mercosul */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <MercosulPlateBadge plate={r.plate} />
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border w-fit ${compBadgeClass}`}>
                                                            {r.rentalCompany || 'A Definir'}
                                                        </span>
                                                        {r.reservationNumber && (
                                                            <span className="text-[10px] font-mono font-bold text-slate-400">
                                                                #{r.reservationNumber}
                                                            </span>
                                                        )}
                                                        {r.protocol && (
                                                            <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/60">
                                                                Prot: {r.protocol}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Solicitante & Contato */}
                                            <td className="px-5 py-4">
                                                <div className="text-sm font-black text-slate-900">{r.requesterName}</div>
                                                <div className="text-[11px] text-slate-500 font-medium">
                                                    {r.requesterSector || 'Geral'} {r.requesterRole ? `• ${r.requesterRole}` : ''}
                                                </div>
                                                {r.requesterPhone && (
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        📞 {r.requesterPhone}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Itinerário (Cidades de Retirada e Devolução) */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1 text-[11px]">
                                                    <div className="flex items-center gap-1.5 text-slate-800">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        <span className="font-bold">{r.pickupCity || r.pickupStore || 'Retirada a definir'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-500">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                                        <span className="font-medium">{r.returnCity || r.returnStore || 'Devolução a definir'}</span>
                                                    </div>
                                                    {r.category && (
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                            Cat: {r.category}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Valor Total */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="text-sm font-black text-slate-900 font-sans">
                                                    {r.value ? formatCurrencyBRL(r.value) : <span className="text-slate-400 text-xs font-normal">A cotar</span>}
                                                </div>
                                                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                                                    {r.status === 'Solicitada' ? 'Aguardando Cotação' : 'Custo Contratado'}
                                                </span>
                                            </td>

                                            {/* Condutor & CNH */}
                                            <td className="px-5 py-4">
                                                <div className="text-xs font-bold text-slate-800">
                                                    {r.driverName || 'Não informado'}
                                                </div>
                                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                    {hasCnhAttached ? (
                                                        <button
                                                            onClick={() => {
                                                                if (r.cnhBase64) {
                                                                    setViewingCnh({
                                                                        isOpen: true,
                                                                        name: r.driverName || r.requesterName,
                                                                        url: r.cnhBase64,
                                                                        fileName: r.cnhFileName || 'cnh_anexo.jpg'
                                                                    });
                                                                } else {
                                                                    showToast("CNH já cadastrada no histórico do condutor.", "success");
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                                            title="Visualizar CNH"
                                                        >
                                                            📎 CNH Anexada
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400">
                                                            {r.cnhAlreadyOnRecord ? '✅ CNH em Arquivo' : 'Sem anexo'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Período de Locação (Retirada / Devolução) */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1 text-[11px]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">RET</span>
                                                        <span className="font-bold text-slate-700">
                                                            {new Date(r.pickupDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1 py-0.2 rounded">DEV</span>
                                                        <span className="font-bold text-slate-700">
                                                            {new Date(r.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {r.status === 'Solicitada' ? (
                                                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-black rounded-xl bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                                        Solicitada
                                                    </span>
                                                ) : r.status === 'Recusada' ? (
                                                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-black rounded-xl bg-rose-100 text-rose-800 border border-rose-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                                        Recusada
                                                    </span>
                                                ) : r.status === 'Aguardando retirada' ? (
                                                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-black rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                        Aguardando
                                                    </span>
                                                ) : r.status === 'Em Uso' ? (
                                                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-black rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                        Em Uso
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-black rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Finalizada
                                                    </span>
                                                )}
                                            </td>

                                            {/* Ações */}
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    {r.status === 'Solicitada' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleOpenApproveModal(r)}
                                                                className="px-2.5 py-1.5 text-xs font-black text-white bg-[#114D38] hover:bg-[#0d3b2c] rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                                                                title="Aprovar Solicitação RAC e Notificar Solicitante"
                                                            >
                                                                <CheckIcon className="h-3.5 w-3.5" />
                                                                Aprovar
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenRejectModal(r)}
                                                                className="px-2 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                                                                title="Recusar Solicitação RAC com Justificativa"
                                                            >
                                                                <XCircleIcon className="h-3.5 w-3.5" />
                                                                Recusar
                                                            </button>
                                                        </>
                                                    ) : r.status === 'Recusada' ? (
                                                        <button
                                                            onClick={() => handleOpenApproveModal(r)}
                                                            className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                                                            title="Reabrir e Aprovar Locação RAC"
                                                        >
                                                            <CheckIcon className="h-3.5 w-3.5" />
                                                            Reavaliar
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleToggleStatus(r)}
                                                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                                                r.status === 'Aguardando retirada' 
                                                                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200' 
                                                                    : r.status === 'Em Uso' 
                                                                        ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' 
                                                                        : 'text-slate-500 bg-slate-100 hover:bg-slate-200 border-slate-200'
                                                            }`}
                                                            title={
                                                                r.status === 'Aguardando retirada' 
                                                                    ? "Iniciar utilização (Mudar para Em Uso)" 
                                                                    : r.status === 'Em Uso' 
                                                                        ? "Finalizar locação (Encerrar)" 
                                                                        : "Reabrir locação"
                                                            }
                                                        >
                                                            <CheckIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleOpenEditModal(r)}
                                                        className="p-2 text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all cursor-pointer" 
                                                        title="Editar Cadastro da Locação"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleOpenDeleteModal(r)}
                                                        className="p-2 text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer" 
                                                        title="Excluir Permanentemente"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 6. Layout Mobile em Cards */}
            <div className="md:hidden space-y-3.5 overflow-y-auto flex-grow">
                {filteredRentals.length === 0 ? (
                    <div className="bg-white p-6 rounded-2xl text-center text-slate-400 font-bold text-sm">
                        Nenhuma locação encontrada.
                    </div>
                ) : (
                    filteredRentals.map(r => (
                        <div key={r.id} className="p-4.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-3.5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <MercosulPlateBadge plate={r.plate} />
                                    <div>
                                        <p className="text-sm font-black text-slate-900">
                                            {r.requesterName}
                                        </p>
                                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                                            {r.rentalCompany || 'Locadora a definir'} • {r.requesterSector || 'Geral'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleOpenEditModal(r)} className="p-1.5 text-blue-600 border border-blue-200 rounded-lg" title="Editar">
                                        <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleOpenDeleteModal(r)} className="p-1.5 text-rose-600 border border-rose-200 rounded-lg" title="Excluir">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Itinerário</span>
                                    <span className="font-bold text-slate-700">
                                        {r.pickupCity || 'A definir'} ➔ {r.returnCity || 'A definir'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Status</span>
                                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                                        r.status === 'Solicitada' ? 'text-amber-800 bg-amber-100 border border-amber-300' :
                                        r.status === 'Recusada' ? 'text-rose-800 bg-rose-100 border border-rose-200' :
                                        r.status === 'Em Uso' ? 'text-blue-700 bg-blue-50 border border-blue-200' : 
                                        r.status === 'Aguardando retirada' ? 'text-amber-700 bg-amber-50 border border-amber-200' : 
                                        'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                    }`}>
                                        {r.status}
                                    </span>
                                </div>
                            </div>

                            {/* Ações Mobile Rápidas */}
                            {r.status === 'Solicitada' && (
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                    <button
                                        onClick={() => handleOpenApproveModal(r)}
                                        className="w-full py-2 bg-[#114D38] hover:bg-[#0d3b2c] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                        <CheckIcon className="h-3.5 w-3.5" />
                                        Aprovar
                                    </button>
                                    <button
                                        onClick={() => handleOpenRejectModal(r)}
                                        className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                        <XCircleIcon className="h-3.5 w-3.5" />
                                        Recusar
                                    </button>
                                </div>
                            )}

                            {r.status === 'Recusada' && (
                                <div className="pt-1 border-t border-slate-100">
                                    <button
                                        onClick={() => handleOpenApproveModal(r)}
                                        className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                        <CheckIcon className="h-3.5 w-3.5" />
                                        Reavaliar & Aprovar
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* 7. Modal de Cadastro / Edição com Design Refinado */}
            <Modal 
                isOpen={isFormModalOpen} 
                onClose={() => setIsFormModalOpen(false)} 
                title={
                    <div className="flex items-center gap-2 text-[#114D38]">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                            <CarIcon className="w-4 h-4" />
                        </div>
                        <span className="font-black text-base">
                            {selectedRental ? "Editar / Completar Locação RAC" : "Cadastrar Nova Locação RAC"}
                        </span>
                    </div>
                }
            >
                <form onSubmit={handleFormSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                    
                    {/* Seção 1: Locadora & Placa */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                        <span className="text-xs font-black uppercase tracking-wider text-[#114D38] block">
                            1. Locadora & Veículo
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Locadora</label>
                                <select 
                                    value={formData.rentalCompany} 
                                    onChange={e => setFormData({ ...formData, rentalCompany: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                >
                                    <option value="Localiza">Localiza</option>
                                    <option value="Movida">Movida</option>
                                    <option value="Unidas">Unidas</option>
                                    <option value="Outras">Outras (Terceirizados)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Placa do Veículo (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={formData.plate} 
                                    onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                                    placeholder="EX: BRA2E19"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono font-black tracking-wider text-slate-900 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none uppercase placeholder:normal-case placeholder:text-slate-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Seção 2: Solicitante & Condutor */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                        <span className="text-xs font-black uppercase tracking-wider text-[#114D38] block">
                            2. Solicitante & Condutor
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Solicitante</label>
                                <input 
                                    type="text" 
                                    value={formData.requesterName} 
                                    onChange={e => setFormData({ ...formData, requesterName: e.target.value })}
                                    required
                                    placeholder="Ex: João da Silva"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Setor Solicitante</label>
                                <input 
                                    type="text" 
                                    value={formData.requesterSector} 
                                    onChange={e => setFormData({ ...formData, requesterSector: e.target.value })}
                                    placeholder="Ex: Operações, Logística, Diretoria"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                                <input 
                                    type="text" 
                                    value={formData.requesterPhone} 
                                    onChange={e => setFormData({ ...formData, requesterPhone: e.target.value })}
                                    placeholder="(00) 00000-0000"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Condutor Autorizado</label>
                                <input 
                                    type="text" 
                                    value={formData.driverName} 
                                    onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                                    placeholder="Nome do Condutor"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Seção 3: Itinerário & Categoria */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                        <span className="text-xs font-black uppercase tracking-wider text-[#114D38] block">
                            3. Itinerário & Cidades de Retirada / Devolução
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Cidade onde deseja Retirar</label>
                                <input 
                                    type="text" 
                                    value={formData.pickupCity} 
                                    onChange={e => setFormData({ ...formData, pickupCity: e.target.value })}
                                    placeholder="Ex: Uberlândia, MG"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Cidade onde pretende Devolver</label>
                                <input 
                                    type="text" 
                                    value={formData.returnCity} 
                                    onChange={e => setFormData({ ...formData, returnCity: e.target.value })}
                                    placeholder="Ex: Araguari, MG"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Categoria Pretendida</label>
                                <input 
                                    type="text" 
                                    value={formData.category} 
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="Ex: Hatch Compacto, Sedan, SUV, Pick-up"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Finalidade / Motivo</label>
                                <input 
                                    type="text" 
                                    value={formData.purpose} 
                                    onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                    placeholder="Ex: Visita a clientes / Operação"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Seção 4: Valores & Status */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                        <span className="text-xs font-black uppercase tracking-wider text-[#114D38] block">
                            4. Valores & Status
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Valor da Locação (R$)</label>
                                <input 
                                    type="text" 
                                    value={formData.value} 
                                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                                    placeholder="Ex: 1.250,00"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nº Reserva Locadora</label>
                                <input 
                                    type="text" 
                                    value={formData.reservationNumber} 
                                    onChange={e => setFormData({ ...formData, reservationNumber: e.target.value })}
                                    placeholder="Ex: MV-15748a"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                <select 
                                    value={formData.status} 
                                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                >
                                    <option value="Solicitada">Solicitada (Aguardando Cotação)</option>
                                    <option value="Aguardando retirada">Aguardando retirada</option>
                                    <option value="Em Uso">Em Uso</option>
                                    <option value="Finalizada">Finalizada</option>
                                    <option value="Recusada">Recusada</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Seção 5: Retirada & Devolução */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                        <span className="text-xs font-black uppercase tracking-wider text-[#114D38] block">
                            5. Retirada & Devolução
                        </span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Data/Hora de Retirada</label>
                                <input 
                                    type="datetime-local" 
                                    value={formData.pickupDate} 
                                    onChange={e => setFormData({ ...formData, pickupDate: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Loja de Retirada</label>
                                <input 
                                    type="text" 
                                    value={formData.pickupStore} 
                                    onChange={e => setFormData({ ...formData, pickupStore: e.target.value })}
                                    placeholder="Ex: Localiza Aeroporto"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Data/Hora de Devolução</label>
                                <input 
                                    type="datetime-local" 
                                    value={formData.returnDate} 
                                    onChange={e => setFormData({ ...formData, returnDate: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Loja de Devolução</label>
                                <input 
                                    type="text" 
                                    value={formData.returnStore} 
                                    onChange={e => setFormData({ ...formData, returnStore: e.target.value })}
                                    placeholder="Ex: Localiza Centro"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Seção 6: Observações da Gestão de Frota */}
                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/60 space-y-3">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-900 block flex items-center gap-1.5">
                            <span>💬</span> 6. Observações da Gestão de Frota / Instruções ao Solicitante
                        </span>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Observações / Orientações (Enviadas por e-mail)</label>
                            <textarea 
                                value={formData.adminNotes || ''} 
                                onChange={e => setFormData({ ...formData, adminNotes: e.target.value })}
                                placeholder="Ex: Reserva confirmada na Localiza Aeroporto. Apresentar CNH física original e cartão corporativo ao retirar."
                                rows={3}
                                className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={() => setIsFormModalOpen(false)} 
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2.5 bg-[#114D38] hover:bg-[#0d3b2c] text-white rounded-2xl text-xs font-black shadow-sm transition-all cursor-pointer"
                        >
                            Salvar Locação
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Aprovação de Solicitação RAC */}
            <Modal
                isOpen={isApproveModalOpen}
                onClose={() => {
                    setIsApproveModalOpen(false);
                    setSelectedRental(null);
                }}
                title={
                    <div className="flex items-center gap-2 text-[#114D38]">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                        <span className="font-black text-base">Aprovar Solicitação de Locação RAC</span>
                    </div>
                }
            >
                <form onSubmit={handleConfirmApprove} className="space-y-4">
                    <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/60 space-y-1 text-xs">
                        <p className="font-extrabold text-[#114D38]">
                            Protocolo: <span className="font-mono text-[#F47920]">{selectedRental?.protocolNumber || selectedRental?.protocol || selectedRental?.reservationNumber}</span>
                        </p>
                        <p className="text-slate-700 font-semibold">
                            Solicitante: <span className="font-bold">{selectedRental?.requesterName}</span> ({selectedRental?.requesterEmail || 'Sem e-mail cadastrado'})
                        </p>
                        <p className="text-slate-600 font-medium">
                            Itinerário: <span className="font-bold">{selectedRental?.pickupCity || 'Origem'}</span> ➔ <span className="font-bold">{selectedRental?.returnCity || 'Destino'}</span>
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Locadora Selecionada *</label>
                                <select
                                    value={approveFormData.rentalCompany}
                                    onChange={e => setApproveFormData({ ...approveFormData, rentalCompany: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 outline-none"
                                    required
                                >
                                    <option value="Localiza">Localiza</option>
                                    <option value="Movida">Movida</option>
                                    <option value="Unidas">Unidas</option>
                                    <option value="Foco">Foco</option>
                                    <option value="Kovi">Kovi</option>
                                    <option value="Outra Locadora">Outra Locadora</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nº Reserva / Voucher Locadora *</label>
                                <input
                                    type="text"
                                    value={approveFormData.reservationNumber}
                                    onChange={e => setApproveFormData({ ...approveFormData, reservationNumber: e.target.value })}
                                    placeholder="Ex: LOC-998877 ou MV-12345"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Valor Aprovado (R$)</label>
                                <input
                                    type="text"
                                    value={approveFormData.value}
                                    onChange={e => setApproveFormData({ ...approveFormData, value: e.target.value })}
                                    placeholder="Ex: 850,00"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Placa (se já atribuída)</label>
                                <input
                                    type="text"
                                    value={approveFormData.plate}
                                    onChange={e => setApproveFormData({ ...approveFormData, plate: e.target.value.toUpperCase() })}
                                    placeholder="Ex: BRA2E19"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Loja de Retirada</label>
                                <input
                                    type="text"
                                    value={approveFormData.pickupStore}
                                    onChange={e => setApproveFormData({ ...approveFormData, pickupStore: e.target.value })}
                                    placeholder="Ex: Localiza Aeroporto VCP"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Loja de Devolução</label>
                                <input
                                    type="text"
                                    value={approveFormData.returnStore}
                                    onChange={e => setApproveFormData({ ...approveFormData, returnStore: e.target.value })}
                                    placeholder="Ex: Localiza Aeroporto VCP"
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Observações do Administrador / Orientações ao Solicitante
                            </label>
                            <textarea
                                value={approveFormData.adminNotes}
                                onChange={e => setApproveFormData({ ...approveFormData, adminNotes: e.target.value })}
                                placeholder="Instruções de retirada, código de confirmação, regras de abastecimento ou orientações específicas que irão no e-mail..."
                                rows={3}
                                className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-800 focus:border-emerald-600 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => {
                                setIsApproveModalOpen(false);
                                setSelectedRental(null);
                            }}
                            disabled={isSubmittingApproval}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmittingApproval}
                            className="px-5 py-2 bg-[#114D38] hover:bg-[#0d3b2c] text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            {isSubmittingApproval ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Aprovando e Notificando...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
                                    <span>Confirmar Aprovação & Notificar</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Recusa de Solicitação RAC */}
            <Modal
                isOpen={isRejectModalOpen}
                onClose={() => {
                    setIsRejectModalOpen(false);
                    setSelectedRental(null);
                }}
                title={
                    <div className="flex items-center gap-2 text-rose-700">
                        <XCircleIcon className="h-5 w-5" />
                        <span className="font-black text-base">Recusar Solicitação de Locação RAC</span>
                    </div>
                }
            >
                <form onSubmit={handleConfirmReject} className="space-y-4">
                    <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200/60 space-y-1 text-xs">
                        <p className="font-extrabold text-rose-900">
                            Protocolo: <span className="font-mono text-rose-700">{selectedRental?.protocolNumber || selectedRental?.protocol || selectedRental?.reservationNumber}</span>
                        </p>
                        <p className="text-slate-700 font-semibold">
                            Solicitante: <span className="font-bold">{selectedRental?.requesterName}</span> ({selectedRental?.requesterEmail || 'Sem e-mail cadastrado'})
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Justificativa / Motivo da Recusa * (Será enviada por e-mail ao solicitante)
                        </label>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Informe o motivo da não aprovação (ex: indisponibilidade orçamentária, substituição por veículo da frota própria, etc.)..."
                            rows={4}
                            className="w-full px-3.5 py-2.5 bg-white border border-rose-300 rounded-xl text-xs font-semibold text-slate-800 focus:border-rose-600 outline-none"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRejectModalOpen(false);
                                setSelectedRental(null);
                            }}
                            disabled={isSubmittingRejection}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmittingRejection}
                            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            {isSubmittingRejection ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Enviando Recusa...</span>
                                </>
                            ) : (
                                <>
                                    <XCircleIcon className="h-4 w-4" />
                                    <span>Confirmar Recusa & Notificar</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Visualização da CNH */}
            {viewingCnh && (
                <Modal
                    isOpen={viewingCnh.isOpen}
                    onClose={() => setViewingCnh(null)}
                    title={
                        <div className="flex items-center gap-2 text-emerald-800">
                            <span className="text-base">📄</span>
                            <span className="font-bold text-sm">CNH de {viewingCnh.name}</span>
                        </div>
                    }
                >
                    <div className="space-y-4 flex flex-col items-center">
                        {viewingCnh.url.startsWith('data:image/') ? (
                            <img 
                                src={viewingCnh.url} 
                                alt={`CNH ${viewingCnh.name}`} 
                                className="max-h-[60vh] rounded-xl border border-slate-200 shadow-sm object-contain"
                            />
                        ) : (
                            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 w-full">
                                <p className="text-sm font-bold text-slate-700 mb-2">Documento Anexado</p>
                                <p className="text-xs text-slate-500">{viewingCnh.fileName}</p>
                            </div>
                        )}
                        <div className="flex items-center justify-between w-full pt-2">
                            <a
                                href={viewingCnh.url}
                                download={viewingCnh.fileName}
                                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
                            >
                                ⬇️ Baixar CNH
                            </a>
                            <button
                                onClick={() => setViewingCnh(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* 8. Modal de Confirmação de Exclusão */}
            <Modal 
                isOpen={isDeleteModalOpen} 
                onClose={() => setIsDeleteModalOpen(false)} 
                title={
                    <div className="flex items-center gap-2 text-rose-600">
                        <TrashIcon className="w-5 h-5" />
                        <span className="font-black text-base">Excluir Locação RAC</span>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-slate-600 text-xs leading-relaxed">
                        Tem certeza que deseja excluir permanentemente o registro de locação de <strong>{selectedRental?.requesterName}</strong> ({selectedRental?.rentalCompany})?
                    </p>
                    <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200">
                        Aviso: Esta ação removerá o registro do banco de dados e não poderá ser desfeita.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            onClick={() => setIsDeleteModalOpen(false)} 
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleDeleteConfirm} 
                            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                        >
                            Excluir Registro
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default RacRentalsView;
