
import React, { useState, useEffect, useMemo } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { ReservationStatus, Vehicle, Reservation, FuelLevel } from '../../types_reserva';
import { SP_CITIES, LEADERSHIP_ROLES, ADMIN_EMAIL_RECIPIENTS, getReservasEmailRecipients } from '../../constants_reserva';
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
import { 
  parseLocalDateTime, 
  formatToDateTimeLocalInput, 
  formatDateTimeBR, 
  getDefaultReservationDates, 
  validateReservationDates 
} from '../../utils/reservaDateUtils';

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

interface ReservationFormProps {
    initialVehicleId?: string | null;
    onSuccess?: () => void;
    isModal?: boolean;
}

const ReservationForm: React.FC<ReservationFormProps> = ({ initialVehicleId, onSuccess, isModal }) => {
  const { vehicles, reservations, dailyTrips, addReservation, getVehicleById } = useReservations();
  const { user: globalUser } = useGlobalAuth();
  const isAdmin = Boolean(
    globalUser && (
      globalUser.role === 'admin' ||
      globalUser.permissions?.admin === true ||
      globalUser.email?.toLowerCase() === 'deny.goncalves@risel.com.br'
    )
  );

  // Inicializa datas com valores padrão coerentes (horário comercial futuro sem erro)
  const [formData, setFormData] = useState(() => {
    const defaultDates = getDefaultReservationDates();
    return {
      requesterName: globalUser?.name ? globalUser.name.toUpperCase() : '',
      department: (globalUser as any)?.department ? normalizeNomeSetor((globalUser as any).department) : '',
      role: globalUser?.role === 'admin' ? 'DIRETORIA / GESTÃO' : (globalUser?.role ? globalUser.role.toUpperCase() : ''),
      email: globalUser?.email || '',
      departureDateTime: defaultDates.departureDateTime,
      returnDate: defaultDates.returnDate,
      destination: '',
      destinationCity: '',
      purpose: '',
      driverName: '', // Added separate driverName field
      driverRole: '', // Added separate driverRole field for hierarchy check
    };
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
          const nowIso = formatToDateTimeLocalInput(new Date());
          setMinDateTime(nowIso);
          
          // Default min return date is now
          setMinReturnDate(nowIso);
      };
      updateMinTime();
      // Update every minute to keep "now" accurate
      const interval = setInterval(updateMinTime, 60000);
      return () => clearInterval(interval);
  }, [isAdmin]);

  const preSelectedVehicle = initialVehicleId ? getVehicleById(initialVehicleId) : null;

  // Barra de integridade e completude dos dados (Garante visualização integral no celular para não gerar dados incompletos)
  const formProgress = useMemo(() => {
    const checks = [
      { id: 'requesterName', label: 'Solicitante', filled: Boolean(formData.requesterName.trim()) },
      { id: 'email', label: 'E-mail Corporativo', filled: Boolean(formData.email.trim() && formData.email.includes('@')) },
      { id: 'department', label: 'Setor', filled: Boolean(formData.department.trim()) },
      { id: 'role', label: 'Cargo', filled: Boolean(formData.role.trim()) },
      { id: 'driverName', label: 'Condutor', filled: isDriverSameAsRequester ? true : Boolean(formData.driverName.trim() && formData.driverRole.trim()) },
      { id: 'departureDateTime', label: 'Data/Hora Saída', filled: Boolean(formData.departureDateTime) },
      { id: 'returnDate', label: 'Data/Hora Retorno', filled: Boolean(formData.returnDate) },
      { id: 'destinationCity', label: 'Destino', filled: Boolean(formData.destinationCity.trim() && formData.destination.trim()) },
      { id: 'purpose', label: 'Motivo/Justificativa', filled: Boolean(formData.purpose.trim() && formData.purpose.trim().length >= 5) },
    ];
    const total = checks.length;
    const completed = checks.filter(c => c.filled).length;
    const percent = Math.round((completed / total) * 100);
    const isReady = completed === total;
    return { checks, total, completed, percent, isReady };
  }, [formData, isDriverSameAsRequester]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const upperCaseFields = ['requesterName', 'department', 'role', 'destination', 'destinationCity', 'purpose', 'driverName', 'driverRole'];

    if (name === 'departureDateTime') {
        // Update minReturnDate based on selected departure
        if (value) {
            setMinReturnDate(value);
            // Prevenção ativa de erro: se a data de retorno atual for menor ou igual à nova saída, ajusta retorno
            try {
              const depD = parseLocalDateTime(value);
              const retD = formData.returnDate ? parseLocalDateTime(formData.returnDate) : null;
              if (!retD || retD.getTime() <= depD.getTime()) {
                const autoReturn = new Date(depD);
                if (depD.getHours() < 16) {
                  autoReturn.setHours(18, 0, 0, 0);
                } else {
                  autoReturn.setHours(depD.getHours() + 3, 0, 0, 0);
                }
                setFormData(prev => ({
                  ...prev,
                  departureDateTime: value,
                  returnDate: formatToDateTimeLocalInput(autoReturn)
                }));
                return;
              }
            } catch (e) {}
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

    // Validação estrita de todos os campos obrigatórios com mapeamento de IDs para auto-scroll no celular
    const missingFieldsMap: Array<{ id: string; label: string }> = [];
    if (!formData.requesterName.trim()) missingFieldsMap.push({ id: 'requesterName', label: 'Nome Completo do Solicitante' });
    if (!formData.email.trim() || !formData.email.includes('@')) missingFieldsMap.push({ id: 'email', label: 'E-mail Corporativo válido' });
    if (!formData.department.trim()) missingFieldsMap.push({ id: 'department', label: 'Setor / Departamento' });
    if (!formData.role.trim()) missingFieldsMap.push({ id: 'role', label: 'Cargo / Função do Solicitante' });
    if (!isDriverSameAsRequester) {
      if (!formData.driverName.trim()) missingFieldsMap.push({ id: 'driverName', label: 'Nome Completo do Condutor' });
      if (!formData.driverRole.trim()) missingFieldsMap.push({ id: 'driverRole', label: 'Cargo / Função do Condutor' });
    }
    if (!formData.departureDateTime) missingFieldsMap.push({ id: 'departureDateTime', label: 'Data e Hora de Saída' });
    if (!formData.returnDate) missingFieldsMap.push({ id: 'returnDate', label: 'Data e Horário de Retorno Previsto' });
    if (!formData.destinationCity.trim()) missingFieldsMap.push({ id: 'destinationCity', label: 'Cidade de Destino' });
    if (!formData.destination.trim()) missingFieldsMap.push({ id: 'destination', label: 'Local Específico de Destino' });
    if (!formData.purpose.trim() || formData.purpose.trim().length < 5) missingFieldsMap.push({ id: 'purpose', label: 'Motivo & Justificativa da Viagem (mínimo 5 caracteres)' });

    const scrollToField = (fieldId: string) => {
      setModalState(prev => ({ ...prev, isOpen: false }));
      setIsSubmitting(false);
      setTimeout(() => {
        const el = document.getElementById(fieldId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
          el.classList.add('ring-4', 'ring-rose-500/40', 'border-rose-500');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-rose-500/40', 'border-rose-500');
          }, 3500);
        }
      }, 150);
    };

    if (missingFieldsMap.length > 0) {
      setModalState({
        isOpen: true,
        title: 'Informações Incompletas no Formulário',
        content: (
          <div className="space-y-4 text-left">
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-start gap-3">
              <div className="bg-amber-100 p-2 rounded-full shrink-0 text-amber-700 mt-0.5">
                <ExclamationTriangleIcon className="h-5 w-5" />
              </div>
              <div className="w-full">
                <h4 className="font-extrabold text-sm text-amber-950 uppercase tracking-wide">
                  Identificamos campos pendentes:
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  No celular, todos os dados são necessários para que a solicitação não seja gerada com dados incompletos.
                </p>
                <div className="mt-3 space-y-1.5">
                  {missingFieldsMap.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => scrollToField(item.id)}
                      className="w-full flex items-center justify-between text-left p-2 rounded-xl bg-white/80 hover:bg-white border border-amber-200 text-xs font-bold text-amber-900 cursor-pointer transition-all active:scale-95"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        {item.label}
                      </span>
                      <span className="text-[10px] text-emerald-800 font-extrabold uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Preencher ➔
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => scrollToField(missingFieldsMap[0].id)}
                className="bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold py-2.5 px-5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer uppercase tracking-wider"
              >
                Ir para o primeiro campo pendente
              </button>
            </div>
          </div>
        )
      });
      setIsSubmitting(false);
      return;
    }

    // Validação estrita e amigável das datas e horários antes de qualquer verificação
    const dateValidation = validateReservationDates(formData.departureDateTime, formData.returnDate, { allowPast: isAdmin });
    if (!dateValidation.isValid || !dateValidation.departureDate || !dateValidation.returnDate) {
      setModalState({
        isOpen: true,
        title: 'Verifique a Data e Horário',
        content: (
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900">
              <div className="bg-amber-100 p-2 rounded-full shrink-0 text-amber-700 mt-0.5">
                <ExclamationTriangleIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-950">Inconsistência de Data / Horário</h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {dateValidation.errorMessage || 'Por favor, revise as datas de saída e de retorno informado.'}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Certifique-se de que a data de saída não esteja no passado e que o horário de retorno previsto seja posterior ao horário de saída.
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalState(prev => ({ ...prev, isOpen: false }));
                  setIsSubmitting(false);
                }}
                className="bg-[#114D38] text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer"
              >
                Entendido, vou ajustar
              </button>
            </div>
          </div>
        )
      });
      setIsSubmitting(false);
      return;
    }

    // Datas validadas e devidamente tratadas no horário local fidedigno
    const reqStartDate = dateValidation.departureDate;
    const reqEndDate = dateValidation.returnDate;
    
    // Check for conflicts: Overlap Logic based on exact dates and times
    const reservedVehicleIds = reservations
      .filter(r => {
        const isActive = r.status === ReservationStatus.Approved || r.status === ReservationStatus.Pending || r.status === ReservationStatus.InUse;
        if (!isActive) return false;

        const resStart = parseLocalDateTime(r.departureDateTime);
        const resEnd = parseLocalDateTime(r.returnDate);

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
                        No momento, todos os veículos do modelo HB20 {isSPTrip ? 'estão reservados ou restritos pelo rodízio municipal' : 'estão reservados'} para o período de <strong>{formatDateTimeBR(reqStartDate)}</strong> a <strong>{formatDateTimeBR(reqEndDate)}</strong>.
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

    // Conversão de datas e horários com integridade absoluta (sem desvios de timezone)
    const departureDateFixed = parseLocalDateTime(formData.departureDateTime);
    const returnDateFixed = parseLocalDateTime(formData.returnDate);

    // Checagem de rodízio para São Paulo Capital
    const isSP = isDestinationSaoPaulo(city, formData.destination);
    const plateFinal = getPlateFinalDigit(vehicleToReserve.plate);
    const rodizioInfo = checkVehicleRodizio(vehicleToReserve.plate, departureDateFixed, returnDateFixed);

    const reservationData: Omit<Reservation, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'requestTimestamp'> = {
      requesterName: formData.requesterName,
      department: normalizeNomeSetor(formData.department),
      role: formData.role,
      email: formData.email,
      departureDateTime: departureDateFixed,
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
    
    // Preparar lista de detalhes para o e-mail com formatação garantida
    const emailDetails = [
        { label: "Solicitante", value: formData.requesterName },
        { label: "Condutor", value: finalDriverName },
        { label: "Departamento", value: normalizeNomeSetor(formData.department) },
        { label: "Categoria Pretendida", value: vehicleToReserve.model ? `${vehicleToReserve.model} (${vehicleToReserve.type || 'Passeio / Operações'})` : 'Hatch Compacto' },
        { label: "Veículo Sugerido", value: `${vehicleToReserve.model} - ${vehicleToReserve.plate}` },
        { label: "Data de Saída", value: formatDateTimeBR(departureDateFixed) },
        { label: "Retorno Previsto", value: formatDateTimeBR(returnDateFixed) },
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

    // Enviar e-mail de notificação de nova solicitação EXCLUSIVAMENTE para a administração
    // REGRA DE NEGÓCIO: O e-mail de solicitação NUNCA pode chegar ao solicitante.
    // O solicitante só receberá o e-mail quando a administração responder (aprovar ou recusar) a reserva.
    const emailHtml = generateEmailHtml(
        "Detalhes da Solicitação",
        emailDetails,
        '#005C30',
        window.location.origin,
        `Uma nova solicitação de reserva de veículo foi registrada por ${formData.requesterName} e aguarda análise da Gestão de Frota.`
    );

    // REGRA DE NEGÓCIO ESTRITA:
    // No primeiro e-mail enviado na solicitação, os usuários NÃO devem estar em cópia nem como destinatários.
    // O primeiro e-mail serve exclusivamente para a administração ver que há novas solicitações de reservas pendentes.
    // Somente após a aprovação ou recusa, o e-mail deve ser enviado para o usuário, com cópia para deny e lorena.
    const baseAdmins = getReservasEmailRecipients();
    const adminRecipients = Array.from(new Set([
      'deny.goncalves@risel.com.br',
      'lorena.padilha@risel.com.br',
      ...baseAdmins
    ]));

    try {
      await sendEmail(
        adminRecipients, 
        `Nova Solicitação de Reserva de Veículo - ${formData.requesterName}`, 
        emailHtml,
        {
          fromName: "Risel Combustíveis",
          source: "reservas"
        }
      );
    } catch (emailErr) {
      console.warn("Aviso: reserva gravada no sistema, porém o despacho de e-mail oscilou:", emailErr);
    }

    const protocolNumber = `RES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const handleCopySuccessSummary = () => {
      const summaryText = [
        `🚗 *COMPROVANTE DE SOLICITAÇÃO DE RESERVA DE VEÍCULO - RISEL*`,
        `📋 *Protocolo:* ${protocolNumber}`,
        `👤 *Solicitante:* ${formData.requesterName} (${formData.department || 'Geral'})`,
        `💼 *Cargo:* ${formData.role}`,
        `📧 *E-mail:* ${formData.email}`,
        `🧑‍✈️ *Condutor:* ${isDriverSameAsRequester ? `${formData.requesterName} (Próprio Solicitante)` : `${formData.driverName} (${formData.driverRole})`}`,
        `📍 *Destino:* ${city} - ${formData.destination}`,
        `📅 *Saída:* ${formatDateTimeBR(formData.departureDateTime)}`,
        `🏁 *Retorno:* ${formatDateTimeBR(formData.returnDate)}`,
        `🚙 *Veículo:* ${vehicleToReserve.model} • Placa ${vehicleToReserve.plate}`,
        distance ? `📏 *Distância Estimada:* ${distance.toLocaleString('pt-BR')} km (ida e volta)` : null,
        `📝 *Motivo:* ${formData.purpose}`,
        `⏱️ *Status:* Aguardando Homologação da Frota`
      ].filter(Boolean).join('\n');

      navigator.clipboard?.writeText(summaryText);
      alert('Comprovante copiado com sucesso! Você pode colá-lo no WhatsApp ou e-mail.');
    };

    setModalState({
        isOpen: true,
        title: 'Solicitação Enviada com Sucesso!',
        content: (
          <div className="space-y-4 text-left max-h-[80vh] overflow-y-auto pr-1">
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start gap-3 shadow-xs">
                <div className="w-9 h-9 rounded-full bg-[#114D38] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm font-black">
                    <CheckIcon className="h-5 w-5"/>
                </div>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-sm uppercase tracking-wide text-emerald-950">
                          Reserva Registrada com Sucesso!
                      </h4>
                      <span className="text-[10px] font-mono font-bold bg-white text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                        {protocolNumber}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                        Todos os dados da sua solicitação foram validados e registrados sem qualquer omissão.
                    </p>
                    <p className="text-xs text-emerald-900 font-bold mt-1.5 bg-emerald-100/70 p-2 rounded-xl border border-emerald-200">
                        Confirmação e notificações enviadas para: <span className="underline">{formData.email}</span>
                    </p>
                </div>
            </div>

            {/* Comprovante Oficial Completo */}
            <div className="bg-slate-50 p-4 rounded-2xl text-left space-y-2.5 text-xs border border-slate-200 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[11px]">Veículo Alocado:</span>
                    <span className="font-black text-slate-800 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                        {vehicleToReserve.model} • <span className="font-mono text-emerald-800">{vehicleToReserve.plate}</span>
                    </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[11px]">Condutor:</span>
                    <span className="font-extrabold text-slate-800">
                        {isDriverSameAsRequester ? `${formData.requesterName} (Próprio Solicitante)` : `${formData.driverName} (${formData.driverRole})`}
                    </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[11px]">Período da Viagem:</span>
                    <div className="text-right">
                        <div className="font-mono font-bold text-slate-800">
                          Saída: {formatDateTimeBR(formData.departureDateTime)}
                        </div>
                        <div className="font-mono font-bold text-slate-600 mt-0.5">
                          Retorno: {formatDateTimeBR(formData.returnDate)}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[11px]">Destino Completo:</span>
                    <span className="font-bold text-slate-800 text-right max-w-[240px] truncate">
                      {city} — {formData.destination}
                    </span>
                </div>

                {isSP && (
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500 font-bold uppercase text-[11px]">Rodízio SP Capital:</span>
                        <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] border ${
                            rodizioInfo.isRestricted 
                                ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                            {rodizioInfo.isRestricted 
                                ? `Atenção: Restrito na(s) ${rodizioInfo.restrictedDays.join(', ')}` 
                                : `✅ Placa Liberada (Final ${plateFinal})`}
                        </span>
                    </div>
                )}

                {distance && (
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500 font-bold uppercase text-[11px]">Distância Estimada:</span>
                        <span className="font-extrabold text-emerald-800 font-mono">{distance.toLocaleString('pt-BR')} km (ida e volta)</span>
                    </div>
                )}

                <div className="pt-1">
                    <span className="text-slate-500 font-bold uppercase text-[11px] block mb-1">Finalidade:</span>
                    <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 text-xs italic">
                      "{formData.purpose}"
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                  type="button"
                  onClick={handleCopySuccessSummary}
                  className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <span>📋 Copiar Comprovante (WhatsApp)</span>
              </button>

              <button
                  type="button"
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
                  className="w-full py-3 bg-gradient-to-r from-[#114D38] to-[#0d3b2b] hover:from-[#0d3b2b] hover:to-[#092b1f] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>Concluir e Fechar</span>
              </button>
            </div>
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
                          id="requesterName"
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
                          id="email"
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
                          id="department"
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
                          id="role"
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
                                      id="driverName"
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
                                      id="driverRole"
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
                              id="departureDateTime"
                              name="departureDateTime" 
                              value={formData.departureDateTime} 
                              onChange={handleChange} 
                              required 
                              min={minDateTime} 
                              className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all shadow-2xs" 
                          />
                      </div>
                      {formData.departureDateTime && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <span>📅 Saída Confirmada:</span>
                              <span className="font-mono">{formatDateTimeBR(formData.departureDateTime)}</span>
                          </div>
                      )}
                  </div>
                  <div>
                      <label htmlFor="returnDate" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Data e Horário de Retorno Previsto *
                      </label>
                      <div className="relative">
                          <input 
                              type="datetime-local" 
                              id="returnDate"
                              name="returnDate" 
                              value={formData.returnDate} 
                              onChange={handleChange} 
                              required 
                              min={minReturnDate} 
                              className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all shadow-2xs" 
                          />
                      </div>
                      {formData.returnDate && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <span>🏁 Retorno Previsto:</span>
                              <span className="font-mono">{formatDateTimeBR(formData.returnDate)}</span>
                          </div>
                      )}
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
                          id="destination"
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
                  <label htmlFor="purpose" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Finalidade e Justificativa da Utilização *
                  </label>
                  <textarea 
                      id="purpose"
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

          {/* PAINEL DE CONFERÊNCIA PRÉVIA E AUDITORIA VISUAL (MOBILE FIRST: VISIBILIDADE INTEGRAL) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
                          ✓
                      </div>
                      <div>
                          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                              Conferência dos Dados da Reserva
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium">
                              Todas as informações abaixo foram consolidadas para evitar dados incompletos
                          </p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                          formProgress.isReady 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                      }`}>
                          {formProgress.completed} de {formProgress.total} itens preenchidos ({formProgress.percent}%)
                      </span>
                  </div>
              </div>

              {/* Barra de Progresso Visual */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                      className={`h-full transition-all duration-300 ${formProgress.isReady ? 'bg-[#00CA71]' : 'bg-[#F47920]'}`}
                      style={{ width: `${formProgress.percent}%` }}
                  />
              </div>

              {/* Grade de Resumo Mobile de Todos os Dados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Solicitante:</span>
                      <span className="font-extrabold text-slate-800 truncate block mt-0.5">
                          {formData.requesterName || <span className="text-amber-600 font-bold">⚠️ Não informado</span>}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate">
                          {formData.department ? `${formData.department}` : ''} {formData.role ? `• ${formData.role}` : ''}
                      </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Condutor:</span>
                      <span className="font-extrabold text-slate-800 truncate block mt-0.5">
                          {isDriverSameAsRequester 
                              ? (formData.requesterName ? `${formData.requesterName} (Próprio Solicitante)` : <span className="text-amber-600">⚠️ Solicitante</span>)
                              : (formData.driverName ? `${formData.driverName} (${formData.driverRole || 'Sem cargo'})` : <span className="text-amber-600 font-bold">⚠️ Condutor pendente</span>)}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate">
                          {formData.email || 'E-mail corporativo'}
                      </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Destino da Viagem:</span>
                      <span className="font-extrabold text-slate-800 truncate block mt-0.5">
                          {formData.destinationCity ? `${formData.destinationCity}` : <span className="text-amber-600 font-bold">⚠️ Cidade pendente</span>}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate">
                          {formData.destination ? formData.destination : 'Local específico pendente'}
                      </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 sm:col-span-2 lg:col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Período Selecionado:</span>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mt-0.5 font-mono">
                          <span className="text-slate-700 font-bold text-[11px]">
                              Saída: <span className="text-emerald-800">{formData.departureDateTime ? formatDateTimeBR(formData.departureDateTime) : '⚠️ Definir saída'}</span>
                          </span>
                          <span className="text-slate-700 font-bold text-[11px]">
                              Retorno: <span className="text-emerald-800">{formData.returnDate ? formatDateTimeBR(formData.returnDate) : '⚠️ Definir retorno'}</span>
                          </span>
                      </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Veículo Alocado:</span>
                      <span className="font-extrabold text-[#114D38] truncate block mt-0.5">
                          {preSelectedVehicle ? `${preSelectedVehicle.model} (${preSelectedVehicle.plate})` : 'Frota Leve / Alocação Automática'}
                      </span>
                  </div>
              </div>

              {!formProgress.isReady && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                      <span className="text-base">⚠️</span>
                      <span className="font-semibold">
                          Existem campos obrigatórios em branco acima. Complete-os para que sua reserva seja enviada sem omissões.
                      </span>
                  </div>
              )}
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
