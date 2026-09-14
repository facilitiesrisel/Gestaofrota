
import React, { useState, useEffect } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { ReservationStatus, Vehicle, Reservation, FuelLevel } from '../../types_reserva';
import { SP_CITIES, LEADERSHIP_ROLES, ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import { fetchDistanceWithGemini } from '../../services/geminiService';
import { sendEmail, generateEmailHtml } from '../../services/firebaseService';
import { 
  filterVehiclesForSaoPauloRodizio, 
  isDestinationSaoPaulo, 
  checkVehicleRodizio, 
  getRestrictedDigitsForTrip, 
  getPlateFinalDigit 
} from '../../services/rodizioService';
import { useAuth } from '../../context/ReservationAuthContext';
import { useAuth as useGlobalAuth } from '../../context/AuthContext';
import Modal from './Modal';
import { CarIcon, MapPinIcon, CalendarIcon, DocumentTextIcon, CheckIcon, ExclamationTriangleIcon } from './icons';
import { normalizeCidade } from '../../utils/baseOperacional';
import { normalizeNomeSetor, SETORES_OFICIAIS } from '../../utils/setorOperacional';

// User Icon (Not in standard set, creating local)
const UserIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
    </svg>
);

// Building Icon
const BuildingIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" clipRule="evenodd" />
    </svg>
);

const parseDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return new Date();
    // Format is assumed to be YYYY-MM-DDTHH:MM
    const [datePart, timePart] = dateTimeStr.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hours, mins] = (timePart || "12:00").split(':').map(Number);
    return new Date(y, m - 1, d, hours, mins, 0, 0);
};

interface ReservationFormProps {
    initialVehicleId?: string | null;
    onSuccess?: () => void;
}

const ReservationForm: React.FC<ReservationFormProps> = ({ initialVehicleId, onSuccess }) => {
  const { vehicles, reservations, dailyTrips, addReservation, getVehicleById } = useReservations();
  const { user } = useAuth();
  const { user: globalUser } = useGlobalAuth();
  const isAdmin = Boolean((user && !user.isAnonymous) || (globalUser && globalUser.email));

  const [formData, setFormData] = useState({
    requesterName: globalUser?.name ? globalUser.name.toUpperCase() : '',
    department: (globalUser as any)?.department ? normalizeNomeSetor((globalUser as any).department) : '',
    role: globalUser?.role === 'admin' ? 'DIRETORIA / GESTÃO' : (globalUser?.role ? globalUser.role.toUpperCase() : ''),
    email: globalUser?.email || '',
    departureDateTime: '',
    returnDate: '',
    destination: '',
    destinationCity: '',
    purpose: '',
    driverName: '', // Added separate driverName field
    driverRole: '', // Added separate driverRole field for hierarchy check
  });

  // Atualiza automaticamente os dados se o usuário logar enquanto o formulário estiver aberto
  useEffect(() => {
    if (globalUser && globalUser.email) {
      setFormData(prev => ({
        ...prev,
        requesterName: prev.requesterName || (globalUser.name ? globalUser.name.toUpperCase() : 'DENY GONÇALVES'),
        email: prev.email || globalUser.email || 'deny.goncalves@risel.com.br',
        department: prev.department || ((globalUser as any)?.department ? normalizeNomeSetor((globalUser as any).department) : 'OPERAÇÕES'),
        role: prev.role || (globalUser.role === 'admin' ? 'DIRETORIA / GESTÃO' : 'COLABORADOR'),
      }));
    }
  }, [globalUser]);

  const [isDriverSameAsRequester, setIsDriverSameAsRequester] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; content: React.ReactNode }>({ isOpen: false, title: '', content: <></> });

  // Calculate minimum datetime (now) to prevent past bookings
  const [minDateTime, setMinDateTime] = useState('');
  const [minReturnDate, setMinReturnDate] = useState('');

  useEffect(() => {
      if (isAdmin) {
          setMinDateTime('');
          setMinReturnDate('');
          return;
      }
      const updateMinTime = () => {
          const now = new Date();
          // Adjust to local timezone string ISO format
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          const isoString = now.toISOString().slice(0, 16);
          setMinDateTime(isoString);
          
          // Default min return date is today with time
          setMinReturnDate(isoString);
      };
      updateMinTime();
      // Update every minute to keep "now" accurate
      const interval = setInterval(updateMinTime, 60000);
      return () => clearInterval(interval);
  }, [isAdmin]);

  const preSelectedVehicle = initialVehicleId ? getVehicleById(initialVehicleId) : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const upperCaseFields = ['requesterName', 'department', 'role', 'destination', 'destinationCity', 'purpose', 'driverName', 'driverRole'];

    if (name === 'departureDateTime') {
        // Update minReturnDate based on selected departure
        if (value) {
            setMinReturnDate(value);
        }
    }

    if (upperCaseFields.includes(name)) {
      setFormData({ ...formData, [name]: value.toUpperCase() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Use exact date and time requested to improve vehicle availability
    const reqStartDate = parseDateTime(formData.departureDateTime);
    const reqEndDate = parseDateTime(formData.returnDate);
    
    // Check for conflicts: Overlap Logic based on exact dates and times
    const reservedVehicleIds = reservations
      .filter(r => {
        const isActive = r.status === ReservationStatus.Approved || r.status === ReservationStatus.Pending || r.status === ReservationStatus.InUse;
        if (!isActive) return false;

        const resStart = new Date(r.departureDateTime);
        const resEnd = new Date(r.returnDate);

        // Check if ranges overlap (exclusive bounds check to allow back-to-back rentals)
        return reqStartDate < resEnd && reqEndDate > resStart;
      })
      .map(r => r.vehicleId);

    // Vehicles currently in Daily Use (on the road)
    const activeDailyTripVehicleIds = new Set(
      dailyTrips
        .filter(trip => trip.status === ReservationStatus.InUse)
        .map(trip => trip.vehicleId)
    );

    const availableVehicles = vehicles.filter(v => {
      const isCurrentlyInDailyUse = activeDailyTripVehicleIds.has(v.id);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reqStartDay = new Date(reqStartDate);
      reqStartDay.setHours(0, 0, 0, 0);
      
      // Se o veículo está em uso diário ativo hoje e a reserva solicitada se inicia HOJE, ele está indisponível
      const isReservationStartingToday = reqStartDay.getTime() === today.getTime();
      const isUnavailableDueToDailyUse = isCurrentlyInDailyUse && isReservationStartingToday;

      return v.isActive !== false && !reservedVehicleIds.includes(v.id) && !isUnavailableDueToDailyUse;
    });

    if (availableVehicles.length === 0) {
      setModalState({
        isOpen: true,
        title: 'Indisponível',
        content: (
          <div>
            <p>Não existem veículos disponíveis para o período selecionado.</p>
            <p className="text-sm text-gray-500 mt-2">Dica: Tente alterar as datas de saída ou retorno.</p>
            <button
              onClick={() => {
                setModalState({ ...modalState, isOpen: false });
                setFormData({ ...formData, departureDateTime: '' });
              }}
              className="mt-4 w-full bg-primary text-white font-bold py-2 px-4 rounded hover:bg-green-800"
            >
              Tentar outra data
            </button>
          </div>
        ),
      });
      setIsSubmitting(false);
      return;
    }

    // --- VERIFICAÇÃO INTELIGENTE DE RODÍZIO MUNICIPAL EM SÃO PAULO CAPITAL ---
    const isSPTrip = isDestinationSaoPaulo(formData.destinationCity, formData.destination);
    const rodizioFilter = filterVehiclesForSaoPauloRodizio(
      availableVehicles,
      reqStartDate,
      reqEndDate,
      formData.destinationCity,
      formData.destination
    );

    // Se o destino for São Paulo, a lista de veículos elegíveis exclui os com final de placa restrito no período
    const eligibleVehicles = isSPTrip && rodizioFilter.allowedVehicles.length > 0
      ? rodizioFilter.allowedVehicles
      : availableVehicles;

    // --- LOGIC FOR HB20 CONFLICT / DOWNGRADE CHECK ---
    // Determine effective role: If driver is different, use driver's role for hierarchy logic
    const effectiveRole = isDriverSameAsRequester ? formData.role : formData.driverRole;
    
    const isLeadership = LEADERSHIP_ROLES.some(r => effectiveRole.toLowerCase().includes(r));
    const anyHb20Exists = vehicles.some(v => v.model.toLowerCase().includes('hb20'));
    const availableHb20 = eligibleVehicles.some(v => v.model.toLowerCase().includes('hb20'));

    // Se for Gestão, existir HB20 na frota, MAS nenhum disponível agora (ou nenhum liberado de rodízio), e houver outros carros (Downgrade possível):
    if (!initialVehicleId && isLeadership && anyHb20Exists && !availableHb20 && eligibleVehicles.length > 0) {
        setModalState({
            isOpen: true,
            title: 'Veículo Preferencial Indisponível',
            content: (
                <div>
                    <div className="flex items-center gap-3 mb-4 text-amber-600 bg-amber-50 p-4 rounded-lg border border-amber-100 shadow-sm">
                        <div className="bg-amber-100 p-2 rounded-full">
                            <ExclamationTriangleIcon className="h-6 w-6 shrink-0" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-800">Modelo HB20 Indisponível</p>
                            <p className="text-xs text-amber-700">
                                {isSPTrip 
                                  ? 'Nenhum modelo HB20 liberado de rodízio em SP para as datas selecionadas.'
                                  : 'Conflito de agenda nas datas selecionadas.'}
                            </p>
                        </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                        No momento, todos os veículos do modelo HB20 {isSPTrip ? 'estão reservados ou restritos pelo rodízio municipal' : 'estão reservados'} para o período de <strong>{new Date(formData.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong> a <strong>{parseDateTime(formData.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>.
                    </p>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                        <p className="text-gray-900 font-bold text-sm mb-2">Opção de Downgrade:</p>
                        <p className="text-xs text-gray-600">
                            Você pode prosseguir com a reserva utilizando um veículo básico disponível {isSPTrip && '(garantindo placa liberada de rodízio em SP)'}.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => { setModalState({ ...modalState, isOpen: false }); setIsSubmitting(false); }} 
                            className="bg-gray-100 text-gray-600 font-bold py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={async () => { 
                                setModalState({ ...modalState, isOpen: false }); 
                                // Force select non-HB20 from eligible list
                                const fallbackVehicle = selectVehicleByRole(eligibleVehicles, 'force_basic'); 
                                await proceedWithReservation(fallbackVehicle); 
                            }} 
                            className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-green-800 transition-colors text-sm shadow-md"
                        >
                            Aceitar Downgrade
                        </button>
                    </div>
                </div>
            )
        });
        return; // Stop execution to wait for modal choice
    }

    let vehicleToReserve: Vehicle | null = null;

    if (initialVehicleId) {
        const specificVehicle = availableVehicles.find(v => v.id === initialVehicleId);
        if (specificVehicle) {
            // Se o destino for São Paulo e o veículo pré-selecionado estiver com restrição de rodízio:
            if (isSPTrip && rodizioFilter.restrictedVehicles.some(rv => rv.id === specificVehicle.id)) {
                const finalDigit = getPlateFinalDigit(specificVehicle.plate);
                const { restrictedDays } = checkVehicleRodizio(specificVehicle.plate, reqStartDate, reqEndDate);
                setModalState({
                    isOpen: true,
                    title: 'Alerta Inteligente de Rodízio em SP',
                    content: (
                        <div className="space-y-4 text-left">
                            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900">
                                <div className="bg-amber-100 p-2 rounded-full shrink-0 text-amber-700 mt-0.5">
                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-amber-950">Veículo com Restrição de Rodízio</h4>
                                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                                        O veículo selecionado <strong>{specificVehicle.model} ({specificVehicle.plate})</strong> possui final de placa <strong>{finalDigit}</strong>, que está em rodízio no Centro Expandido de São Paulo na(s) <strong>{restrictedDays.join(', ')}</strong>.
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-600">
                                Para sua segurança e evitar multas de trânsito da CET, o sistema pode selecionar automaticamente outro veículo com final de placa liberado para circulação.
                            </p>
                            <div className="flex justify-end gap-2 pt-2">
                                <button 
                                    onClick={() => { setModalState({ ...modalState, isOpen: false }); setIsSubmitting(false); }} 
                                    className="bg-slate-200 text-slate-700 font-bold py-2 px-3.5 rounded-lg text-xs hover:bg-slate-300 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={async () => {
                                        setModalState({ ...modalState, isOpen: false });
                                        const liberatedVehicle = selectVehicleByRole(rodizioFilter.allowedVehicles, effectiveRole);
                                        await proceedWithReservation(liberatedVehicle);
                                    }} 
                                    className="bg-primary text-white font-bold py-2 px-3.5 rounded-lg text-xs hover:bg-green-800 transition-colors shadow"
                                >
                                    Selecionar Veículo Liberado
                                </button>
                            </div>
                        </div>
                    )
                });
                return;
            }
            vehicleToReserve = specificVehicle;
        } else {
             setModalState({
                isOpen: true,
                title: 'Veículo Indisponível',
                content: (
                    <div>
                        <p>O veículo <strong>{preSelectedVehicle?.model} ({preSelectedVehicle?.plate})</strong> que você selecionou não está disponível para a data escolhida.</p>
                        <p className="mt-2">Deseja deixar o sistema selecionar outro veículo disponível automaticamente?</p>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setModalState({ ...modalState, isOpen: false }); setIsSubmitting(false); }} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-400">
                                Cancelar
                            </button>
                            <button onClick={async () => { 
                                setModalState({ ...modalState, isOpen: false }); 
                                const fallbackVehicle = selectVehicleByRole(eligibleVehicles, effectiveRole);
                                await proceedWithReservation(fallbackVehicle); 
                            }} className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-green-800">
                                Sim, selecionar outro
                            </button>
                        </div>
                    </div>
                ),
            });
            return;
        }
    } else {
        vehicleToReserve = selectVehicleByRole(eligibleVehicles, effectiveRole);
    }

    if (vehicleToReserve) {
        await proceedWithReservation(vehicleToReserve);
    } else {
        setIsSubmitting(false);
    }
  };

  // Helper para converter nível de combustível em pontuação para ordenação
  const getFuelScore = (level: FuelLevel | undefined): number => {
      switch (level) {
          case FuelLevel.Full: return 4;
          case FuelLevel.ThreeQuarters: return 3;
          case FuelLevel.Half: return 2;
          case FuelLevel.Quarter: return 1;
          default: return 0; // Empty or undefined (sem dados)
      }
  };

  // Helper para obter o último nível de combustível conhecido de um veículo
  const getVehicleCurrentFuel = (vehicleId: string): number => {
      const vehicleTrips = dailyTrips.filter(t => 
          t.vehicleId === vehicleId && 
          t.status === ReservationStatus.Completed && 
          t.finalFuelLevel
      );
      
      // Ordenar por data de retorno (mais recente primeiro)
      vehicleTrips.sort((a, b) => {
          const dateA = a.actualReturnDateTime ? new Date(a.actualReturnDateTime).getTime() : 0;
          const dateB = b.actualReturnDateTime ? new Date(b.actualReturnDateTime).getTime() : 0;
          return dateB - dateA;
      });

      const lastLevel = vehicleTrips.length > 0 ? vehicleTrips[0].finalFuelLevel : undefined;
      return getFuelScore(lastLevel);
  };

  const selectVehicleByRole = (availableList: Vehicle[], role: string): Vehicle => {
        const isLeadership = LEADERSHIP_ROLES.some(r => role.toLowerCase().includes(r));
        let candidates: Vehicle[] = [];
        
        if (isLeadership) {
            const hb20Vehicles = availableList.filter(v => v.model.toLowerCase().includes('hb20'));
            // Se houver HB20 disponível, usa apenas eles. Se não, usa todos os disponíveis (downgrade implícito no fallback)
            candidates = hb20Vehicles.length > 0 ? hb20Vehicles : availableList;
        } else {
             // Para cargos básicos ou downgrade forçado: Evita HB20
             const nonHb20Available = availableList.filter(v => !v.model.toLowerCase().includes('hb20'));
             // Se houver não-HB20, usa eles. Se só sobrou HB20 (raro devido à lógica anterior), usa disponíveis.
             candidates = nonHb20Available.length > 0 ? nonHb20Available : availableList;
        }

        // --- LÓGICA DE PRIORIDADE DE COMBUSTÍVEL ---
        // Ordena os candidatos: Maior combustível primeiro
        candidates.sort((a, b) => {
            const fuelA = getVehicleCurrentFuel(a.id);
            const fuelB = getVehicleCurrentFuel(b.id);
            return fuelB - fuelA; // Descending
        });

        // Retorna o veículo com mais combustível (índice 0)
        return candidates[0];
  };
  
  const proceedWithReservation = async (vehicleToReserve: Vehicle) => {
    const city = normalizeCidade(formData.destinationCity);
    const { distance } = await fetchDistanceWithGemini('Paulínia/SP', city);

    // Determina o nome do condutor
    const finalDriverName = isDriverSameAsRequester ? formData.requesterName : formData.driverName;

    // Parse proposed return date and time using local timezone utility
    const returnDateFixed = parseDateTime(formData.returnDate);

    // Checagem de rodízio para São Paulo Capital
    const isSP = isDestinationSaoPaulo(city, formData.destination);
    const plateFinal = getPlateFinalDigit(vehicleToReserve.plate);
    const rodizioInfo = checkVehicleRodizio(vehicleToReserve.plate, formData.departureDateTime, formData.returnDate);

    const reservationData: Omit<Reservation, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'requestTimestamp'> = {
      requesterName: formData.requesterName,
      department: normalizeNomeSetor(formData.department),
      role: formData.role,
      email: formData.email,
      departureDateTime: new Date(formData.departureDateTime),
      returnDate: returnDateFixed,
      destination: formData.destination,
      destinationCity: city,
      vehicleId: vehicleToReserve.id,
      purpose: formData.purpose,
      driverName: finalDriverName, // Send driver name
    };

    if (distance !== null) {
      reservationData.distanceKm = distance;
    }

    await addReservation(reservationData);
    
    // Preparar lista de detalhes para o e-mail
    const emailDetails = [
        { label: "Solicitante", value: formData.requesterName },
        { label: "Condutor", value: finalDriverName },
        { label: "Departamento", value: normalizeNomeSetor(formData.department) },
        { label: "Veículo Sugerido", value: `${vehicleToReserve.model} - ${vehicleToReserve.plate}` },
        { label: "Data de Saída", value: new Date(formData.departureDateTime).toLocaleString('pt-BR') },
        { label: "Retorno Previsto", value: returnDateFixed.toLocaleString('pt-BR') },
        { label: "Destino", value: `${city} - ${formData.destination}` },
        { label: "Distância Estimada", value: distance ? `${distance.toLocaleString('pt-BR')} km` : 'N/A' },
        { label: "Motivo", value: formData.purpose }
    ];

    if (isSP) {
        emailDetails.push({
            label: "Rodízio SP Capital",
            value: rodizioInfo.isRestricted 
                ? `Atenção: Restrição na(s) ${rodizioInfo.restrictedDays.join(', ')}` 
                : `Liberado (Final ${plateFinal})`
        });
    }

    // Enviar e-mail para a administração e com cópia para o solicitante
    const emailHtml = generateEmailHtml(
        "Detalhes da Solicitação",
        emailDetails,
        '#005C30',
        window.location.origin
    );

    const recipients = [...ADMIN_EMAIL_RECIPIENTS];
    if (formData.email && formData.email.trim() && !recipients.includes(formData.email.trim())) {
      recipients.push(formData.email.trim());
    }

    try {
      await sendEmail(
        recipients, 
        `Nova Solicitação de Reserva de Veículo - ${formData.requesterName}`, 
        emailHtml,
        {
          fromName: "Gestão de Reservas Risel",
          source: "reservas"
        }
      );
    } catch (emailErr) {
      console.warn("Aviso: reserva gravada no sistema, porém o despacho de e-mail oscilou:", emailErr);
    }

    setModalState({
        isOpen: true,
        title: 'Solicitação Enviada com Sucesso!',
        content: (
          <div className="space-y-4 text-left">
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#114D38] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <CheckIcon className="h-5 w-5"/>
                </div>
                <div>
                    <h4 className="font-extrabold text-sm uppercase tracking-wide text-emerald-950">
                        Reserva registrada com sucesso!
                    </h4>
                    <p className="text-xs text-emerald-800 mt-1">
                        Sua solicitação de veículo próprio foi cadastrada no sistema.
                    </p>
                    <p className="text-xs text-emerald-900 font-bold mt-1.5 bg-emerald-100/70 p-2 rounded-lg border border-emerald-200">
                        A análise e confirmação serão enviadas para: <span className="underline">{formData.email}</span>
                    </p>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-left space-y-2.5 text-xs border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase">Veículo Sugerido:</span>
                    <span className="font-extrabold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {vehicleToReserve.model} • {vehicleToReserve.plate}
                    </span>
                </div>
                {isSP && (
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500 font-bold uppercase">Rodízio SP Capital:</span>
                        <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] border ${
                            rodizioInfo.isRestricted 
                                ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                            {rodizioInfo.isRestricted 
                                ? `Atenção: Restrito na(s) ${rodizioInfo.restrictedDays.join(', ')}` 
                                : `✅ Liberado (Final ${plateFinal})`}
                        </span>
                    </div>
                )}
                {distance && (
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500 font-bold uppercase">Distância Estimada (Ida/Volta):</span>
                        <span className="font-extrabold text-emerald-700">{distance.toLocaleString('pt-BR')} km</span>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase">Destino:</span>
                    <span className="font-semibold text-slate-700">{city} - {formData.destination}</span>
                </div>
            </div>

            <button
                onClick={() => {
                    setModalState({ ...modalState, isOpen: false });
                    setFormData({
                        requesterName: '', department: '', role: '', email: '',
                        departureDateTime: '', returnDate: '', destination: '',
                        destinationCity: '', purpose: '', driverName: '', driverRole: ''
                    });
                    setIsDriverSameAsRequester(true);
                    onSuccess?.();
                }}
                className="w-full py-3.5 bg-gradient-to-r from-[#114D38] to-[#0d3b2b] hover:from-[#0d3b2b] hover:to-[#092b1f] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
            >
              Concluir e Fechar
            </button>
          </div>
        ),
      });
    setIsSubmitting(false);
  }

  return (
    <div className="w-full bg-white md:rounded-[24px] shadow-sm border border-slate-200 overflow-hidden text-left font-sans">
      <Modal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
      >
        {modalState.content}
      </Modal>

      {/* Header Institucional Risel */}
      <div className="bg-gradient-to-r from-[#114D38] via-[#0d3b2b] to-[#114D38] p-5 sm:p-6 text-white border-b border-emerald-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-bold text-emerald-200 uppercase tracking-wider mb-2">
              Frota Leve Risel
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Solicitação de Veículo Próprio
            </h2>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-8 bg-slate-50/50 space-y-6">
        {preSelectedVehicle && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 shadow-sm">
                <div className="p-2.5 bg-[#114D38] text-white rounded-xl shadow-sm">
                    <CarIcon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Veículo Pré-Selecionado</p>
                    <p className="text-base font-black text-emerald-950">{preSelectedVehicle.model} <span className="text-sm font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 ml-1">{preSelectedVehicle.plate}</span></p>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          
          {/* SECTION 1: IDENTIFICAÇÃO */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
                      01
                  </div>
                  <div>
                      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                          Identificação do Solicitante e Condutor
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">Dados corporativos de quem está requisitando o veículo</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                      <label htmlFor="requesterName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Nome Completo (Solicitante) *
                      </label>
                      <input 
                          type="text" 
                          name="requesterName" 
                          placeholder="Digite seu nome completo" 
                          value={formData.requesterName} 
                          onChange={handleChange} 
                          required 
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase" 
                      />
                  </div>
                  <div>
                      <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          E-mail Corporativo *
                      </label>
                      <input 
                          type="email" 
                          name="email" 
                          placeholder="seu.email@risel.com.br" 
                          value={formData.email} 
                          onChange={handleChange} 
                          required 
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all" 
                      />
                  </div>
                  <div>
                      <label htmlFor="department" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Setor / Departamento *
                      </label>
                      <input 
                          type="text" 
                          name="department" 
                          list="setores-oficiais-list"
                          placeholder="Ex: Comercial, Logística, Manutenção" 
                          value={formData.department} 
                          onChange={handleChange} 
                          required 
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all" 
                      />
                      <datalist id="setores-oficiais-list">
                          {SETORES_OFICIAIS.map(s => (
                              <option key={s} value={s} />
                          ))}
                      </datalist>
                  </div>
                  <div>
                      <label htmlFor="role" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Cargo / Função (Solicitante) *
                      </label>
                      <input 
                          type="text" 
                          name="role" 
                          placeholder="Ex: Analista, Coordenador, Gerente" 
                          value={formData.role} 
                          onChange={handleChange} 
                          required 
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase" 
                      />
                  </div>

                  {/* --- LÓGICA DO CONDUTOR --- */}
                  <div className="md:col-span-2 bg-slate-50/80 p-4 sm:p-5 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                          O Condutor é o mesmo da Reserva?
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                              type="button"
                              onClick={() => setIsDriverSameAsRequester(true)}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all text-left ${
                                  isDriverSameAsRequester
                                      ? 'bg-emerald-50/80 border-[#114D38] text-[#114D38] shadow-sm ring-1 ring-[#114D38]'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isDriverSameAsRequester ? 'border-[#114D38]' : 'border-slate-300'}`}>
                                  {isDriverSameAsRequester && <span className="w-2 h-2 rounded-full bg-[#114D38]" />}
                              </span>
                              Sim, sou o condutor do veículo
                          </button>
                          <button
                              type="button"
                              onClick={() => setIsDriverSameAsRequester(false)}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all text-left ${
                                  !isDriverSameAsRequester
                                      ? 'bg-emerald-50/80 border-[#114D38] text-[#114D38] shadow-sm ring-1 ring-[#114D38]'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!isDriverSameAsRequester ? 'border-[#114D38]' : 'border-slate-300'}`}>
                                  {!isDriverSameAsRequester && <span className="w-2 h-2 rounded-full bg-[#114D38]" />}
                              </span>
                              Não, o condutor será outro colaborador
                          </button>
                      </div>

                      {!isDriverSameAsRequester && (
                          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                  <label htmlFor="driverName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                      Nome do Condutor *
                                  </label>
                                  <input 
                                      type="text" 
                                      name="driverName" 
                                      placeholder="Nome completo do motorista" 
                                      value={formData.driverName} 
                                      onChange={handleChange} 
                                      required={!isDriverSameAsRequester}
                                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] transition-all uppercase" 
                                  />
                              </div>
                              <div>
                                  <label htmlFor="driverRole" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                      Cargo / Função do Condutor *
                                  </label>
                                  <input 
                                      type="text" 
                                      name="driverRole" 
                                      placeholder="Ex: Supervisor, Operador" 
                                      value={formData.driverRole} 
                                      onChange={handleChange} 
                                      required={!isDriverSameAsRequester}
                                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] transition-all uppercase" 
                                  />
                                  <p className="text-[11px] text-slate-500 mt-1">Utilizado para determinar a categoria de veículo adequada.</p>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* SECTION 2: DADOS DA VIAGEM */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
                      02
                  </div>
                  <div>
                      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                          Roteiro & Período da Viagem
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">Horários de saída e retorno previstos e local de destino</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                      <label htmlFor="departureDateTime" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Data e Hora de Saída *
                      </label>
                      <div className="relative">
                          <input 
                              type="datetime-local" 
                              name="departureDateTime" 
                              value={formData.departureDateTime} 
                              onChange={handleChange} 
                              required 
                              min={minDateTime} 
                              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all" 
                          />
                      </div>
                  </div>
                  <div>
                      <label htmlFor="returnDate" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Data e Horário de Retorno Previsto *
                      </label>
                      <div className="relative">
                          <input 
                              type="datetime-local" 
                              name="returnDate" 
                              value={formData.returnDate} 
                              onChange={handleChange} 
                              required 
                              min={minReturnDate} 
                              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all" 
                          />
                      </div>
                  </div>
                  <div>
                      <label htmlFor="destinationCity" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Cidade de Destino *
                      </label>
                      <div className="relative">
                          <input
                              type="text"
                              id="destinationCity"
                              name="destinationCity"
                              value={formData.destinationCity}
                              onChange={handleChange}
                              list="cities"
                              required
                              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase"
                              placeholder="Digite ou selecione a cidade"
                          />
                      </div>
                      <datalist id="cities">
                          {SP_CITIES.map(city => <option key={city} value={city} />)}
                      </datalist>
                  </div>
                  <div>
                      <label htmlFor="destination" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Local Específico de Destino *
                      </label>
                      <input 
                          type="text" 
                          name="destination" 
                          value={formData.destination} 
                          onChange={handleChange} 
                          required 
                          placeholder="Ex: Usina, Escritório Cliente, Posto..." 
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase" 
                      />
                  </div>

                  {/* Alerta Inteligente de Rodízio em São Paulo Capital */}
                  {isDestinationSaoPaulo(formData.destinationCity, formData.destination) && (
                      <div className="md:col-span-2 p-3.5 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3 text-xs text-sky-900 shadow-sm animate-fadeIn">
                          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5 text-base font-bold shadow-xs">
                              🛡️
                          </div>
                          <div className="space-y-1 text-left">
                              <div className="flex items-center gap-2">
                                  <p className="font-extrabold text-sky-950 uppercase tracking-wider text-[11px]">
                                      Alerta Inteligente: Rodízio SP Capital
                                  </p>
                                  <span className="bg-sky-200/80 text-sky-900 text-[10px] font-black px-1.5 py-0.5 rounded">
                                      Ativo
                                  </span>
                              </div>
                              <p className="text-sky-800 leading-relaxed text-xs">
                                  Destino em <strong>São Paulo Capital</strong> detectado. O sistema selecionará automaticamente um veículo da frota com <strong>final de placa liberado</strong> nos dias da viagem, garantindo conformidade com o rodízio municipal da CET.
                              </p>
                              {formData.departureDateTime && (
                                  <p className="text-[11px] text-sky-900 font-semibold bg-sky-100/70 p-2 rounded-lg border border-sky-200/60 mt-1">
                                      {(() => {
                                          const { digits, dayNames } = getRestrictedDigitsForTrip(formData.departureDateTime, formData.returnDate);
                                          if (dayNames.length > 0) {
                                              return `Dias úteis da viagem: ${dayNames.join(', ')} — Placas restritas com final ${digits.join(', ')} serão excluídas automaticamente da escolha.`;
                                          }
                                          return 'Viagem em final de semana — Circulação livre sem restrição de rodízio.';
                                      })()}
                                  </p>
                              )}
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* SECTION 3: MOTIVO */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
                      03
                  </div>
                  <div>
                      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                          Motivo & Justificativa da Viagem
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">Finalidade operacional da utilização do veículo</p>
                  </div>
              </div>

              <div>
                  <textarea 
                      name="purpose" 
                      rows={3}
                      value={formData.purpose} 
                      onChange={handleChange as any} 
                      required 
                      placeholder="Descreva detalhadamente a finalidade e objetivo da viagem..."
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase resize-none" 
                  />
                  <p className="text-[11px] text-slate-400 mt-1 text-right">Campos marcados com * são obrigatórios</p>
              </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full py-4 bg-gradient-to-r from-[#114D38] to-[#0d3b2b] hover:from-[#0d3b2b] hover:to-[#092b1f] text-white font-extrabold rounded-xl text-sm uppercase tracking-wider shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                  <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Processando Solicitação...</span>
                  </>
              ) : (
                  <span>Enviar Solicitação de Veículo</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationForm;
