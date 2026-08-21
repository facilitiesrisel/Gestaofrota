
import React, { useState, useEffect } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { ReservationStatus, Vehicle, Reservation, FuelLevel } from '../../types_reserva';
import { SP_CITIES, LEADERSHIP_ROLES, ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import { fetchDistanceWithGemini } from '../../services/geminiService';
import { sendEmail, generateEmailHtml } from '../../services/firebaseService';
import { useAuth } from '../../context/ReservationAuthContext';
import Modal from './Modal';
import { CarIcon, MapPinIcon, CalendarIcon, DocumentTextIcon, CheckIcon, ExclamationTriangleIcon } from './icons';

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
  const isAdmin = user && !user.isAnonymous;

  const [formData, setFormData] = useState({
    requesterName: '',
    department: '',
    role: '',
    email: '',
    departureDateTime: '',
    returnDate: '',
    destination: '',
    destinationCity: '',
    purpose: '',
    driverName: '', // Added separate driverName field
    driverRole: '', // Added separate driverRole field for hierarchy check
  });

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

    // --- LOGIC FOR HB20 CONFLICT / DOWNGRADE CHECK ---
    // Determine effective role: If driver is different, use driver's role for hierarchy logic
    const effectiveRole = isDriverSameAsRequester ? formData.role : formData.driverRole;
    
    const isLeadership = LEADERSHIP_ROLES.some(r => effectiveRole.toLowerCase().includes(r));
    const anyHb20Exists = vehicles.some(v => v.model.toLowerCase().includes('hb20'));
    const availableHb20 = availableVehicles.some(v => v.model.toLowerCase().includes('hb20'));

    // Se for Gestão, existir HB20 na frota, MAS nenhum disponível agora, e houver outros carros (Downgrade possível):
    if (!initialVehicleId && isLeadership && anyHb20Exists && !availableHb20 && availableVehicles.length > 0) {
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
                            <p className="text-xs text-amber-700">Conflito de agenda nas datas selecionadas.</p>
                        </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                        No momento, todos os veículos do modelo HB20 estão reservados para o período de <strong>{new Date(formData.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong> a <strong>{parseDateTime(formData.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>.
                    </p>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                        <p className="text-gray-900 font-bold text-sm mb-2">Opção de Downgrade:</p>
                        <p className="text-xs text-gray-600">
                            Você pode prosseguir com a reserva utilizando um veículo básico disponível (Gol/Saveiro).
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
                                // Force select non-HB20 (pass invalid role to skip HB20 preference logic)
                                const fallbackVehicle = selectVehicleByRole(availableVehicles, 'force_basic'); 
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
                                const fallbackVehicle = selectVehicleByRole(availableVehicles, effectiveRole);
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
        vehicleToReserve = selectVehicleByRole(availableVehicles, effectiveRole);
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
    const city = formData.destinationCity;
    const { distance, error: distanceError } = await fetchDistanceWithGemini('Paulínia/SP', city);

    // Determina o nome do condutor
    const finalDriverName = isDriverSameAsRequester ? formData.requesterName : formData.driverName;

    // Parse proposed return date and time using local timezone utility
    const returnDateFixed = parseDateTime(formData.returnDate);

    const reservationData: Omit<Reservation, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'requestTimestamp'> = {
      requesterName: formData.requesterName,
      department: formData.department,
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
    
    // Enviar e-mail para o administrador
    const emailHtml = generateEmailHtml(
        "Detalhes da Solicitação",
        [
            { label: "Solicitante", value: formData.requesterName },
            { label: "Condutor", value: finalDriverName }, // Inclui condutor no email
            { label: "Departamento", value: formData.department },
            { label: "Veículo Sugerido", value: `${vehicleToReserve.model} - ${vehicleToReserve.plate}` },
            { label: "Data de Saída", value: new Date(formData.departureDateTime).toLocaleString('pt-BR') },
            { label: "Retorno Previsto", value: returnDateFixed.toLocaleString('pt-BR') },
            { label: "Destino", value: `${city} - ${formData.destination}` },
            { label: "Distância Estimada", value: distance ? `${distance.toLocaleString('pt-BR')} km` : 'N/A' },
            { label: "Motivo", value: formData.purpose }
        ],
        '#ff9b00', // Laranja
        window.location.origin // Action Link para o sistema
    );

    await sendEmail(ADMIN_EMAIL_RECIPIENTS, `Nova Solicitação de Reserva realizada por: ${formData.requesterName}`, emailHtml);

    if (distanceError) {
        console.warn("Distance calculation API failed but reservation succeeded:", distanceError);
    }
    
    setModalState({
        isOpen: true,
        title: 'Solicitação Enviada!',
        content: (
          <div>
            <div className="p-4 mb-4 bg-green-100 text-green-800 rounded-lg">
                <h4 className="font-bold flex items-center gap-2"><CheckIcon className="h-6 w-6"/> Reserva enviada com sucesso!</h4>
                <p className="text-sm mt-2">
                    Sua solicitação foi registrada. 
                </p>
                <p className="text-sm mt-2 font-bold">
                    A resposta da análise (aprovação ou recusa) será enviada para o e-mail <strong>{formData.email}</strong>.
                </p>
            </div>
            
            {distanceError && (
                <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-400 text-yellow-800 text-sm rounded-md" role="alert">
                    <p className="font-bold">Aviso sobre o cálculo de distância</p>
                    <p className="mt-1">{distanceError}</p>
                </div>
            )}

            <div className="bg-gray-50 p-3 rounded-md text-left space-y-2 text-sm border border-gray-200">
                <p><strong>Veículo pré-reservado:</strong> {vehicleToReserve.model} ({vehicleToReserve.plate})</p>
                {distance && <p><strong>Distância estimada (ida e volta):</strong> {distance.toLocaleString('pt-BR')} km</p>}
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
                className="mt-6 w-full bg-primary text-white font-bold py-2 px-4 rounded hover:bg-green-800"
            >
              Fechar
            </button>
          </div>
        ),
      });
    setIsSubmitting(false);
  }

  return (
    <div className="h-full max-w-4xl mx-auto pb-10">
      <Modal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
      >
        {modalState.content}
      </Modal>

      {preSelectedVehicle && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3 text-blue-800 animate-pulse">
              <CarIcon className="h-6 w-6" />
              <div>
                  <p className="font-bold">Veículo Selecionado: {preSelectedVehicle.model}</p>
                  <p className="text-sm">Placa: {preSelectedVehicle.plate}</p>
              </div>
          </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SECTION 1: IDENTIFICAÇÃO */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-3">
                <div className="p-2 bg-white rounded-full shadow-sm text-slate-500">
                    <UserIcon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-700 text-lg">Identificação</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                    <label htmlFor="requesterName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo (Solicitante)</label>
                    <input type="text" name="requesterName" placeholder="Digite seu nome" value={formData.requesterName} onChange={handleChange} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all uppercase" />
                </div>
                <div className="relative">
                    <label htmlFor="email" className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Corporativo</label>
                    <input type="email" name="email" placeholder="seu.email@risel.com.br" value={formData.email} onChange={handleChange} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
                </div>
                <div className="relative">
                    <label htmlFor="department" className="block text-xs font-bold text-slate-500 uppercase mb-1">Setor / Departamento</label>
                    <input type="text" name="department" placeholder="Ex: Comercial, Logística" value={formData.department} onChange={handleChange} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all uppercase" />
                </div>
                <div className="relative">
                    <label htmlFor="role" className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo / Função (Solicitante)</label>
                    <input type="text" name="role" placeholder="Ex: Analista, Gerente" value={formData.role} onChange={handleChange} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all uppercase" />
                </div>

                {/* --- LÓGICA DO CONDUTOR --- */}
                <div className="relative md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3">O Condutor é o mesmo da Reserva?</label>
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="radio" 
                                checked={isDriverSameAsRequester} 
                                onChange={() => setIsDriverSameAsRequester(true)} 
                                className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
                            />
                            <span className="text-sm font-medium text-slate-700 group-hover:text-primary transition-colors">Sim</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="radio" 
                                checked={!isDriverSameAsRequester} 
                                onChange={() => setIsDriverSameAsRequester(false)} 
                                className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
                            />
                            <span className="text-sm font-medium text-slate-700 group-hover:text-primary transition-colors">Não</span>
                        </label>
                    </div>

                    {!isDriverSameAsRequester && (
                        <div className="mt-4 animate-fadeIn grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="driverName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Condutor</label>
                                <input 
                                    type="text" 
                                    name="driverName" 
                                    placeholder="Nome completo do motorista" 
                                    value={formData.driverName} 
                                    onChange={handleChange} 
                                    required={!isDriverSameAsRequester}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all uppercase" 
                                />
                            </div>
                            <div>
                                <label htmlFor="driverRole" className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo / Função do Condutor</label>
                                <input 
                                    type="text" 
                                    name="driverRole" 
                                    placeholder="Ex: Supervisor, Coordenador" 
                                    value={formData.driverRole} 
                                    onChange={handleChange} 
                                    required={!isDriverSameAsRequester}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all uppercase" 
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Utilizado para determinar a categoria do veículo (Executivo/Básico).</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* SECTION 2: DADOS DA VIAGEM */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-3">
                <div className="p-2 bg-white rounded-full shadow-sm text-green-600">
                    <MapPinIcon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-700 text-lg">Dados da Viagem</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="departureDateTime" className="block text-xs font-bold text-slate-500 uppercase mb-1">Data e Hora de Saída</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                        <input 
                            type="datetime-local" 
                            name="departureDateTime" 
                            value={formData.departureDateTime} 
                            onChange={handleChange} 
                            required 
                            min={minDateTime} 
                            className="w-full pl-10 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="returnDate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Data e Horário de Retorno Previsto</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                        <input 
                            type="datetime-local" 
                            name="returnDate" 
                            value={formData.returnDate} 
                            onChange={handleChange} 
                            required 
                            min={minReturnDate} 
                            className="w-full pl-10 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="destinationCity" className="block text-xs font-bold text-slate-500 uppercase mb-1">Cidade de Destino</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <BuildingIcon className="h-5 w-5" />
                        </div>
                        <input
                            type="text"
                            id="destinationCity"
                            name="destinationCity"
                            value={formData.destinationCity}
                            onChange={handleChange}
                            list="cities"
                            required
                            className="w-full pl-10 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all uppercase"
                            placeholder="Selecione a cidade"
                        />
                    </div>
                    <datalist id="cities">
                        {SP_CITIES.map(city => <option key={city} value={city} />)}
                    </datalist>
                </div>
                <div>
                    <label htmlFor="destination" className="block text-xs font-bold text-slate-500 uppercase mb-1">Local Específico</label>
                    <input type="text" name="destination" value={formData.destination} onChange={handleChange} required placeholder="Ex: Escritório Cliente, Usina..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all uppercase" />
                </div>
            </div>
        </div>

        {/* SECTION 3: MOTIVO */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-3">
                <div className="p-2 bg-white rounded-full shadow-sm text-orange-500">
                    <DocumentTextIcon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-700 text-lg">Motivo da Solicitação</h3>
            </div>
            <div className="p-6">
                <textarea 
                    name="purpose" 
                    rows={3}
                    value={formData.purpose} 
                    onChange={handleChange as any} 
                    required 
                    placeholder="Descreva brevemente a finalidade da viagem..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all uppercase resize-none" 
                />
                <p className="text-xs text-gray-400 mt-2 text-right">Campos obrigatórios *</p>
            </div>
        </div>

        <div className="pt-4">
          <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center gap-2 py-4 px-6 border border-transparent rounded-xl shadow-lg text-lg font-bold text-white bg-gradient-to-r from-primary to-primary-dark hover:from-green-700 hover:to-green-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed transition-all transform active:scale-[0.99]">
            {isSubmitting ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando...
                </>
            ) : 'ENVIAR SOLICITAÇÃO'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReservationForm;
