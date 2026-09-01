import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RacRental } from '../../types_reserva';
import { SP_CITIES, ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import { addRacRental, sendEmail, generateRacEmailHtml } from '../../services/firebaseService';
import { checkDriverCnhStatus, saveDriverCnhRecord } from '../../services/cnhService';
import Modal from './Modal';
import { 
  CarIcon, 
  MapPinIcon, 
  CalendarIcon, 
  DocumentTextIcon, 
  CheckIcon, 
  ExclamationTriangleIcon,
  ClockIcon
} from './icons';

// Categorias de veículos para locação RAC
const VEHICLE_CATEGORIES = [
  { id: 'Hatch Compacto', label: 'Hatch Compacto', desc: 'Ex: Polo, HB20, Argo (Econômico / Urbano)' },
  { id: 'Sedan Médio', label: 'Sedan Médio', desc: 'Ex: Virtus, Onix Plus, Cronos (Porta-malas espaçoso)' },
  { id: 'SUV / Utilitário', label: 'SUV / Utilitário', desc: 'Ex: T-Cross, Tracker, Renegade (Maior conforto)' },
  { id: 'Picape Leve', label: 'Picape Leve', desc: 'Ex: Strada, Saveiro (Uso operacional/carga leve)' },
  { id: 'Picape Média 4x4', label: 'Picape Média 4x4', desc: 'Ex: Hilux, S10, Ranger (Campo / Obras)' },
  { id: 'Minivan / 7 Lugares', label: 'Minivan / 7 Lugares', desc: 'Ex: Spin (Transporte de equipe)' },
  { id: 'Executivo / Especial', label: 'Executivo / Especial', desc: 'Ex: Corolla, Compass (Viagens de diretoria)' },
];

// Cidades com bases Risel para destaque no topo
const BASE_CITIES = ['Paulínia', 'Betim', 'Jales', 'Aguai', 'Campinas', 'São Paulo', 'Belo Horizonte', 'Rio de Janeiro'];

const parseDateTime = (dateTimeStr: string) => {
  if (!dateTimeStr) return new Date();
  const [datePart, timePart] = dateTimeStr.split('T');
  const [y, m, d] = (datePart || '').split('-').map(Number);
  const [hours, mins] = (timePart || '08:00').split(':').map(Number);
  return new Date(y, m - 1, d, hours || 8, mins || 0, 0, 0);
};

interface UserRacRequestFormProps {
  onSuccess?: (rental: RacRental) => void;
}

export const UserRacRequestForm: React.FC<UserRacRequestFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    requesterName: '',
    requesterSector: '',
    requesterRole: '',
    requesterEmail: '',
    requesterPhone: '',
    driverName: '',
    driverRole: '',
    pickupCity: '',
    returnCity: '',
    pickupDateTime: '',
    returnDateTime: '',
    category: 'Hatch Compacto',
    purpose: '',
    observations: '',
  });

  const [isDriverSameAsRequester, setIsDriverSameAsRequester] = useState(true);
  const [cnhFile, setCnhFile] = useState<{
    file: File;
    fileName: string;
    base64: string;
    previewUrl: string;
    isImage: boolean;
  } | null>(null);

  const [cnhStatus, setCnhStatus] = useState<{
    checked: boolean;
    hasCnh: boolean;
    cnhRecord?: any;
  }>({ checked: false, hasCnh: false });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [minPickupDate, setMinPickupDate] = useState('');
  const [minReturnDate, setMinReturnDate] = useState('');
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; content: React.ReactNode }>({
    isOpen: false,
    title: '',
    content: <></>,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializa datas mínimas
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const isoNow = now.toISOString().slice(0, 16);
    setMinPickupDate(isoNow);
    setMinReturnDate(isoNow);

    // Sugestão de data padrão: amanhã às 08:00 até 5 dias depois às 18:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    
    const returnDay = new Date(tomorrow);
    returnDay.setDate(returnDay.getDate() + 3);
    returnDay.setHours(18, 0, 0, 0);

    setFormData(prev => ({
      ...prev,
      pickupDateTime: tomorrow.toISOString().slice(0, 16),
      returnDateTime: returnDay.toISOString().slice(0, 16)
    }));
  }, []);

  // Monitora se o condutor ou solicitante já tem CNH cadastrada
  useEffect(() => {
    const targetEmail = formData.requesterEmail?.trim();
    const targetName = (isDriverSameAsRequester ? formData.requesterName : formData.driverName)?.trim();

    if (targetEmail || targetName) {
      const status = checkDriverCnhStatus(targetEmail, targetName);
      setCnhStatus({
        checked: true,
        hasCnh: status.hasCnh,
        cnhRecord: status.cnhRecord
      });
    } else {
      setCnhStatus({ checked: false, hasCnh: false });
    }
  }, [formData.requesterEmail, formData.requesterName, formData.driverName, isDriverSameAsRequester]);

  // Se o condutor for o próprio solicitante, espelha nome e cargo
  useEffect(() => {
    if (isDriverSameAsRequester) {
      setFormData(prev => ({
        ...prev,
        driverName: prev.requesterName,
        driverRole: prev.requesterRole
      }));
    }
  }, [isDriverSameAsRequester, formData.requesterName, formData.requesterRole]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'pickupDateTime') {
      setMinReturnDate(value);
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Manipulador de upload de arquivo CNH
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processCnhFile(file);
    }
  };

  const processCnhFile = (file: File) => {
    // Validar tamanho máximo (15MB)
    if (file.size > 15 * 1024 * 1024) {
      alert('O arquivo selecionado é muito grande. O tamanho máximo permitido é 15MB.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    
    reader.onload = () => {
      const base64 = reader.result as string;
      setCnhFile({
        file,
        fileName: file.name,
        base64,
        previewUrl: isImage ? base64 : '',
        isImage
      });
    };

    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCnhFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveCnh = () => {
    setCnhFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cálculo da duração estimada em dias e horas
  const rentalDurationText = useMemo(() => {
    if (!formData.pickupDateTime || !formData.returnDateTime) return '';
    const start = parseDateTime(formData.pickupDateTime).getTime();
    const end = parseDateTime(formData.returnDateTime).getTime();
    const diffMs = end - start;

    if (diffMs <= 0) return 'Data de devolução deve ser posterior à de retirada';

    const hoursTotal = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hoursTotal / 24);
    const remainingHours = hoursTotal % 24;

    if (days === 0) return `Duração estimada: ${remainingHours} horas`;
    if (remainingHours === 0) return `Duração estimada: ${days} dia(s) (${days} diárias)`;
    return `Duração estimada: ${days} dia(s) e ${remainingHours}h (${days + (remainingHours > 2 ? 1 : 0)} diárias)`;
  }, [formData.pickupDateTime, formData.returnDateTime]);

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação obrigatória da CNH para primeira solicitação
    const hasCnhAlready = cnhStatus.hasCnh;
    const isAttachingNow = !!cnhFile;

    if (!hasCnhAlready && !isAttachingNow) {
      setModalState({
        isOpen: true,
        title: 'Cópia da CNH Obrigatória',
        content: (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 shrink-0" />
              <p>
                Como esta é a <strong>primeira solicitação</strong> para o condutor informado, é obrigatório anexar a cópia da CNH (PDF ou Foto) para abertura da reserva na locadora.
              </p>
            </div>
            <button
              onClick={() => {
                setModalState({ isOpen: false, title: '', content: <></> });
                fileInputRef.current?.scrollIntoView({ behavior: 'smooth' });
                fileInputRef.current?.click();
              }}
              className="w-full py-2.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
            >
              Anexar Cópia da CNH
            </button>
          </div>
        )
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const pickupDateObj = parseDateTime(formData.pickupDateTime);
      const returnDateObj = parseDateTime(formData.returnDateTime);

      if (returnDateObj <= pickupDateObj) {
        throw new Error('A data de devolução deve ser posterior à data de retirada do veículo.');
      }

      // Gera código de protocolo único
      const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const protocolNumber = `RAC-${nowStr}-${randomCode}`;

      const finalSector = formData.requesterSector.trim() || 'GERAL';

      const finalDriverName = isDriverSameAsRequester ? formData.requesterName : formData.driverName;
      const finalDriverRole = isDriverSameAsRequester ? formData.requesterRole : formData.driverRole;

      // Monta objeto da locação RAC
      const newRentalData: Omit<RacRental, 'id'> = {
        rentalCompany: 'A Definir (Cotação RAC)',
        plate: 'A DEFINIR',
        requesterName: formData.requesterName.toUpperCase().trim(),
        requesterSector: finalSector,
        requesterRole: formData.requesterRole.toUpperCase().trim(),
        requesterEmail: formData.requesterEmail.toLowerCase().trim(),
        requesterPhone: formData.requesterPhone.trim(),
        value: 0,
        reservationNumber: protocolNumber,
        driverName: finalDriverName.toUpperCase().trim(),
        driverRole: finalDriverRole.toUpperCase().trim(),
        status: 'Solicitada',
        base: formData.pickupCity || 'Matriz',
        createdByUser: formData.requesterEmail || 'Solicitante Público RAC',
        reservationDate: new Date(),
        pickupDate: pickupDateObj,
        pickupStore: formData.pickupCity + ' (A definir loja)',
        returnDate: returnDateObj,
        returnStore: formData.returnCity + ' (A definir loja)',
        pickupCity: formData.pickupCity.trim(),
        returnCity: formData.returnCity.trim(),
        category: 'Conforme Observações',
        purpose: formData.purpose.trim(),
        observations: formData.observations.trim(),
        hasCnhCopy: hasCnhAlready || isAttachingNow,
        cnhFileName: cnhFile?.fileName || cnhStatus.cnhRecord?.fileName || '',
        cnhBase64: cnhFile?.base64 || cnhStatus.cnhRecord?.cnhData || '',
        cnhUploadDate: new Date(),
        protocolNumber: protocolNumber
      };

      // 1. Salva a nova locação RAC no banco/localStorage
      const createdRef = await addRacRental(newRentalData);
      const fullRental: RacRental = {
        ...newRentalData,
        id: createdRef?.id || `local_${Date.now()}`
      };

      // 2. Se anexou CNH nova, salva no cofre de CNHs para solicitações futuras
      if (cnhFile) {
        saveDriverCnhRecord({
          driverName: finalDriverName,
          email: formData.requesterEmail,
          phone: formData.requesterPhone,
          fileName: cnhFile.fileName,
          fileType: cnhFile.file.type,
          fileSize: cnhFile.file.size,
          cnhData: cnhFile.base64,
          uploadDate: new Date().toISOString(),
          lastRacProtocol: protocolNumber
        });
      }

      // 3. Prepara anexos do e-mail (anexa CNH se enviada agora ou existente no cadastro)
      const emailAttachments: Array<{ filename: string; content?: string; contentType?: string }> = [];
      
      if (cnhFile && cnhFile.base64) {
        emailAttachments.push({
          filename: cnhFile.fileName || `CNH_${finalDriverName.replace(/\s+/g, '_')}.pdf`,
          content: cnhFile.base64,
          contentType: cnhFile.file.type || 'application/pdf'
        });
      } else if (cnhStatus.hasCnh && cnhStatus.cnhRecord?.cnhData) {
        emailAttachments.push({
          filename: cnhStatus.cnhRecord.fileName || `CNH_${finalDriverName.replace(/\s+/g, '_')}.pdf`,
          content: cnhStatus.cnhRecord.cnhData,
          contentType: cnhStatus.cnhRecord.fileType || 'application/pdf'
        });
      }

      // 4. Envia notificação por e-mail para os administradores com cópia para o solicitante
      const emailSubject = `[Solicitação RAC] ${protocolNumber} - ${formData.requesterName} (${formData.pickupCity} ➔ ${formData.returnCity})`;
      const emailHtml = generateRacEmailHtml(fullRental, !!cnhFile, hasCnhAlready);

      const emailRecipients = [...ADMIN_EMAIL_RECIPIENTS];
      if (formData.requesterEmail && !emailRecipients.includes(formData.requesterEmail)) {
        // Envia para admins e coloca o solicitante como cópia
      }

      await sendEmail(
        emailRecipients,
        emailSubject,
        emailHtml,
        {
          fromName: 'Gestão de Reservas Risel',
          cc: formData.requesterEmail ? [formData.requesterEmail] : undefined,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined
        }
      );

      // 5. Exibe Modal de Sucesso
      setModalState({
        isOpen: true,
        title: 'Solicitação de RAC Registrada com Sucesso!',
        content: (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckIcon className="w-6 h-6" />
            </div>
            
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Protocolo: {protocolNumber}
              </span>
              <h3 className="text-base font-extrabold text-slate-800 mt-2">
                Solicitação enviada para a Gestão de Frota
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                Sua solicitação de locação de veículo terceirizado foi recebida e já está registrada na fila de <strong>Locações RAC</strong>. Os gestores responsáveis foram notificados por e-mail com todos os detalhes e cópia da CNH.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-xs space-y-1.5 font-sans">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Solicitante:</span>
                <span className="font-extrabold text-slate-800">{formData.requesterName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Retirada:</span>
                <span className="font-extrabold text-slate-800">{formData.pickupCity} ({new Date(pickupDateObj).toLocaleDateString('pt-BR')} às {new Date(pickupDateObj).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Devolução:</span>
                <span className="font-extrabold text-slate-800">{formData.returnCity} ({new Date(returnDateObj).toLocaleDateString('pt-BR')} às {new Date(returnDateObj).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Status CNH:</span>
                <span className="font-bold text-emerald-700">
                  {cnhFile ? '📎 Anexada nesta solicitação' : '✅ Já cadastrada no sistema'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setModalState({ isOpen: false, title: '', content: <></> });
                if (onSuccess) onSuccess(fullRental);
                // Reset form
                setFormData({
                  requesterName: '',
                  requesterSector: '',
                  requesterRole: '',
                  requesterEmail: '',
                  requesterPhone: '',
                  driverName: '',
                  driverRole: '',
                  pickupCity: '',
                  returnCity: '',
                  pickupDateTime: '',
                  returnDateTime: '',
                  category: 'Hatch Compacto',
                  purpose: '',
                  observations: '',
                });
                setCnhFile(null);
              }}
              className="w-full py-3 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-sm"
            >
              Concluir & Fazer Nova Solicitação
            </button>
          </div>
        )
      });

    } catch (err: any) {
      console.error('Erro ao submeter solicitação de RAC:', err);
      setModalState({
        isOpen: true,
        title: 'Erro no Envio da Solicitação',
        content: (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600 shrink-0" />
              <p>{err.message || 'Ocorreu um erro ao processar sua solicitação. Tente novamente.'}</p>
            </div>
            <button
              onClick={() => setModalState({ isOpen: false, title: '', content: <></> })}
              className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
            >
              Fechar e Corrigir
            </button>
          </div>
        )
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white md:rounded-[24px] shadow-sm border border-slate-200 overflow-hidden text-left font-sans">
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, title: '', content: <></> })}
        title={modalState.title}
      >
        {modalState.content}
      </Modal>

      {/* Header Institucional do Formulário */}
      <div className="bg-gradient-to-r from-[#114D38] via-[#0d3b2b] to-[#114D38] p-5 sm:p-6 text-white border-b border-emerald-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Solicitar Locação de Veículo (RAC)
            </h2>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
        
        {/* SEÇÃO 1: DADOS DO SOLICITANTE */}
        <div>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
              1
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Identificação do Solicitante
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nome Completo do Solicitante <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="requesterName"
                value={formData.requesterName}
                onChange={handleChange}
                placeholder="Ex: João da Silva"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Setor / Departamento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="requesterSector"
                value={formData.requesterSector}
                onChange={handleChange}
                placeholder="Ex: Comercial, Manutenção, Diretoria..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Cargo / Função <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="requesterRole"
                value={formData.requesterRole}
                onChange={handleChange}
                placeholder="Ex: Engenheiro de Campo"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                E-mail Corporativo <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                name="requesterEmail"
                value={formData.requesterEmail}
                onChange={handleChange}
                placeholder="seu.nome@risel.com.br"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all lowercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Telefone / WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                name="requesterPhone"
                value={formData.requesterPhone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: DADOS DO CONDUTOR */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
                2
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                Condutor do Veículo
              </h3>
            </div>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={isDriverSameAsRequester}
                onChange={(e) => setIsDriverSameAsRequester(e.target.checked)}
                className="w-4 h-4 text-[#114D38] rounded focus:ring-[#114D38]"
              />
              <span className="text-xs font-bold text-slate-700 select-none">
                Condutor é o próprio solicitante
              </span>
            </label>
          </div>

          {!isDriverSameAsRequester && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Condutor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  name="driverName"
                  value={formData.driverName}
                  onChange={handleChange}
                  placeholder="Nome do motorista que retirará o carro"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cargo / Função do Condutor
                </label>
                <input
                  type="text"
                  name="driverRole"
                  value={formData.driverRole}
                  onChange={handleChange}
                  placeholder="Ex: Motorista Operacional"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase"
                />
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 3: CIDADES DE RETIRADA E DEVOLUÇÃO (OBRIGATÓRIO) */}
        <div>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
              3
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Cidades de Retirada e Devolução (Itinerário RAC)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <MapPinIcon className="w-4 h-4 text-emerald-600" />
                Cidade onde deseja RETIRAR o veículo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                list="cidades-retirada-list"
                name="pickupCity"
                value={formData.pickupCity}
                onChange={handleChange}
                placeholder="Ex: Paulínia, Campinas, São Paulo, Betim..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all"
              />
              <datalist id="cidades-retirada-list">
                {BASE_CITIES.map(c => <option key={`base_p_${c}`} value={c} />)}
                {SP_CITIES.map(c => <option key={`sp_p_${c}`} value={c} />)}
              </datalist>
              <p className="text-[10px] text-slate-500 mt-1">
                Informe a cidade ou aeroporto onde a locadora deve disponibilizar o carro.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <MapPinIcon className="w-4 h-4 text-orange-600" />
                Cidade onde pretende DEVOLVER o veículo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                list="cidades-devolucao-list"
                name="returnCity"
                value={formData.returnCity}
                onChange={handleChange}
                placeholder="Ex: Paulínia, Campinas, Betim, Rio de Janeiro..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all"
              />
              <datalist id="cidades-devolucao-list">
                {BASE_CITIES.map(c => <option key={`base_d_${c}`} value={c} />)}
                {SP_CITIES.map(c => <option key={`sp_d_${c}`} value={c} />)}
              </datalist>
              <p className="text-[10px] text-slate-500 mt-1">
                Pode ser a mesma cidade de retirada ou outra localidade (sujeito a taxa de retorno da locadora).
              </p>
            </div>
          </div>
        </div>

        {/* SEÇÃO 4: PERÍODO DA LOCAÇÃO */}
        <div>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
              4
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Período da Locação
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-emerald-600" />
                Data e Hora de Retirada <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                min={minPickupDate}
                name="pickupDateTime"
                value={formData.pickupDateTime}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ClockIcon className="w-4 h-4 text-orange-600" />
                Data e Hora de Devolução <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                min={minReturnDate}
                name="returnDateTime"
                value={formData.returnDateTime}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all"
              />
            </div>
          </div>

          {rentalDurationText && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900 font-bold">
              <span>⏱️ {rentalDurationText}</span>
              <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">
                Cálculo em tempo real
              </span>
            </div>
          )}
        </div>

        {/* SEÇÃO 5: FINALIDADE & OBSERVAÇÕES */}
        <div>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
              5
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Finalidade e Observações da Locação
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Finalidade / Motivo da Viagem <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="Descreva a necessidade da viagem, cliente a ser atendido ou serviço operacional..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Observações Complementares (Categoria Desejada, Locadora, Detalhes)
              </label>
              <textarea
                rows={3}
                name="observations"
                value={formData.observations}
                onChange={handleChange}
                placeholder="Descreva a categoria desejada (ex: Sedan, Hatch, SUV, Picape), preferência de locadora, necessidade de cadeirinha, bagageiro extra ou outras necessidades..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 6: ANEXO DA CNH (DETECÇÃO INTELIGENTE DE 1ª VEZ VS JÁ CADASTRADA) */}
        <div>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
              6
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Cópia da CNH do Condutor
            </h3>
          </div>

          {/* Detector Inteligente de CNH */}
          {cnhStatus.checked && cnhStatus.hasCnh ? (
            <div className="mb-4 bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-start gap-3.5 text-emerald-900">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                    CNH Já Cadastrada no Sistema
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-extrabold">
                    Validação Automática
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Identificamos que o condutor <strong>{formData.driverName || formData.requesterName}</strong> já possui cópia da CNH arquivada com segurança em nosso banco de dados. <strong>O envio de um novo anexo não é necessário</strong> para esta solicitação.
                </p>
                <p className="text-[11px] text-emerald-700 mt-1 italic">
                  Caso deseje substituir por uma nova via da CNH (ex: CNH renovada), utilize o campo de anexo abaixo (opcional).
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3.5 text-amber-950">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ExclamationTriangleIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                    Primeira Solicitação deste Condutor: CNH Obrigatória
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold">
                    Documentação Obrigatória
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                  Para que a equipe possa emitir a reserva junto à locadora contratada, é <strong>obrigatório anexar a cópia legível da CNH</strong> (PDF ou foto frente/verso).
                </p>
              </div>
            </div>
          )}

          {/* Área de Upload / Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              cnhFile
                ? 'border-emerald-500 bg-emerald-50/40'
                : !cnhStatus.hasCnh
                ? 'border-amber-400 bg-amber-50/20 hover:bg-amber-50/40'
                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={handleFileSelect}
              className="hidden"
              id="cnh-file-input"
            />

            {cnhFile ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
                <div className="flex items-center gap-3 text-left">
                  {cnhFile.isImage ? (
                    <img
                      src={cnhFile.previewUrl}
                      alt="Preview CNH"
                      className="w-16 h-12 object-cover rounded-lg border border-slate-200 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">
                      PDF
                    </div>
                  )}
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 truncate max-w-xs">
                      {cnhFile.fileName}
                    </h5>
                    <p className="text-[10px] text-emerald-700 font-semibold">
                      Arquivo pronto para envio e anexo automático no e-mail
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Trocar Arquivo
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCnh}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <DocumentTextIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-extrabold text-slate-700">
                  Arraste e solte a cópia da CNH aqui ou clique para selecionar
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Formatos aceitos: PDF, PNG, JPG ou JPEG (máx. 15MB)
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-4 py-2 bg-white hover:bg-slate-50 text-[#114D38] border border-emerald-700 font-extrabold text-xs rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Selecionar Arquivo da CNH
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BOTÃO DE SUBMISSÃO */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
              isSubmitting
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-[#114D38] hover:bg-[#0d3b2b] shadow-emerald-900/10'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Registrando Solicitação...
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                Enviar Solicitação de RAC
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
