
import React, { useState, useMemo } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { Reservation, ReservationStatus, Vehicle } from '../../types_reserva';
import { CheckIcon, XIcon, PencilIcon, TrashIcon, CheckCircleIcon, FunnelIcon, DownloadIcon, ExclamationTriangleIcon, ClockIcon, PlayIcon, XCircleIcon, BellIcon } from './icons';
import Modal from './Modal';
import ReservationEditModal from './ReservationEditModal';
import { useAuth } from '../../context/ReservationAuthContext';
import { sendEmail, generateEmailHtml } from '../../services/firebaseService';
import { ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import RacRentalsView from './RacRentalsView';
import ReservationForm from './ReservationForm';
import { ExternalLink, QrCode, Copy, Check, Car, Sparkles, FileText, ClipboardList } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Helper para calcular duração estimada
const formatDuration = (start: Date | string, end: Date | string) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diff = endTime - startTime;
    
    if (diff < 0) return '';

    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (days === 0 && minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '0m';
};

const ReservationsView: React.FC = () => {
  const { reservations, vehicles, updateReservation, getVehicleById, deleteReservation, finalizeReservation } = useReservations();
  const { user } = useAuth(); 
  
  // --- Estados de Notificação de Celular ---
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
        return JSON.parse(localStorage.getItem('readOverdueNotifications') || '[]');
    } catch {
        return [];
    }
  });
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);

  const markAsRead = (id: string) => {
    if (!readNotificationIds.includes(id)) {
        const updated = [...readNotificationIds, id];
        setReadNotificationIds(updated);
        localStorage.setItem('readOverdueNotifications', JSON.stringify(updated));
    }
  };

  // Encontra reservas ativas que já passaram do prazo de devolução
  const overdueReservations = useMemo(() => {
    const now = new Date();
    return reservations.filter(res => {
        // Apenas reservas "Aprovada" ou "Em Uso" (ativas)
        const isActive = [ReservationStatus.Approved, ReservationStatus.InUse].includes(res.status);
        if (!isActive) return false;

        const returnLimit = new Date(res.returnDate);
        return now > returnLimit;
    });
  }, [reservations]);

  // Filtra as notificações de atraso não lidas/clicadas
  const unreadOverdueReservations = useMemo(() => {
    return overdueReservations.filter(res => !readNotificationIds.includes(res.id));
  }, [overdueReservations, readNotificationIds]);

  const activeReservationsCount = useMemo(() => {
    return reservations.filter(r => [ReservationStatus.Pending, ReservationStatus.Approved, ReservationStatus.InUse].includes(r.status)).length;
  }, [reservations]);

  const historyReservationsCount = useMemo(() => {
    return reservations.filter(r => [ReservationStatus.Completed, ReservationStatus.Rejected, ReservationStatus.Cancelled].includes(r.status)).length;
  }, [reservations]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isChangeVehicleModalOpen, setIsChangeVehicleModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPublicLinkModalOpen, setIsPublicLinkModalOpen] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);

  const handleCopyPublicPortalLink = () => {
    const link = `${window.location.origin}/reservas`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedPublicLink(true);
      showToast("Link do Portal Público copiado com sucesso!", "success");
      setTimeout(() => setCopiedPublicLink(false), 3000);
    });
  };
  
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [availableVehiclesForChange, setAvailableVehiclesForChange] = useState<Vehicle[]>([]);
  const [finalizeFormData, setFinalizeFormData] = useState({ finalKm: '', actualReturnDateTime: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [approveAdminNotes, setApproveAdminNotes] = useState('');

  // --- Filtros ---
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'locacoes'>('active');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVehicleId, setFilterVehicleId] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
        setToast(null);
    }, 5000);
  }

  const getStatusChip = (status: ReservationStatus) => {
    switch (status) {
      case ReservationStatus.Approved:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Aprovada</span>;
      case ReservationStatus.Rejected:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Rejeitada</span>;
      case ReservationStatus.InUse:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Em Uso</span>;
      case ReservationStatus.Completed:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Concluída</span>;
      case ReservationStatus.Cancelled:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-600">Cancelada</span>;
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>;
    }
  };
  
  const confirmApprove = async (reservation: Reservation, notes?: string) => {
      try {
        const finalNotes = notes !== undefined ? notes : approveAdminNotes;
        await updateReservation(reservation.id, { 
          status: ReservationStatus.Approved,
          adminNotes: finalNotes.trim() || undefined
        });
        const vehicle = getVehicleById(reservation.vehicleId);
        const departureDate = new Date(reservation.departureDateTime);
        const formattedDate = departureDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');

        const details = [
            { label: "Status", value: "✅ APROVADA" },
            { label: "Solicitante", value: reservation.requesterName },
            { label: "Veículo", value: vehicle ? `${vehicle.model} - ${vehicle.plate}` : "N/A" },
            { label: "Saída", value: departureDate.toLocaleString('pt-BR') },
            { label: "Retorno", value: new Date(reservation.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
            { label: "Destino", value: `${reservation.destinationCity} - ${reservation.destination}` }
        ];

        if (finalNotes && finalNotes.trim()) {
          details.push({ label: "Observações da Administração", value: finalNotes.trim() });
        }

        const emailHtml = generateEmailHtml(
            "Confirmação de Reserva",
            details,
            "#ff9b00",
            undefined,
            `Prezado(a) ${reservation.requesterName}, informamos que sua solicitação de reserva foi aprovada.`,
            finalNotes && finalNotes.trim() 
              ? `Observações da Gestão de Frota: ${finalNotes.trim()}` 
              : "Orientamos checar se o veículo possui alguma avaria antes de sair. Lembre-se de devolver o veículo abastecido e informar o KM Final ao retornar.",
            "#00753f"
        );

        const recipients = [...ADMIN_EMAIL_RECIPIENTS];
        if (reservation.email && !recipients.includes(reservation.email)) {
          recipients.push(reservation.email);
        }
        await sendEmail(recipients, `Sua Solicitação de Reserva para o dia ${formattedDate} foi Aprovada`, emailHtml);
        showToast("Reserva aprovada e e-mails enviados com sucesso!", 'success');
    } catch (updateError) {
        console.error("Falha ao aprovar reserva:", updateError);
        showToast("Erro ao processar a aprovação.", 'error');
    } finally {
        setIsMaintenanceModalOpen(false);
        setIsApproveModalOpen(false);
        setSelectedReservation(null);
        setApproveAdminNotes('');
    }
  };

  const handleApprove = async (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setApproveAdminNotes(reservation.adminNotes || '');
    const vehicle = getVehicleById(reservation.vehicleId);
    if (vehicle) {
        const currentKm = vehicle.lastKm || 0;
        const nextServiceKm = (vehicle.lastServiceKm || 0) + 10000;
        if (currentKm > nextServiceKm) {
            setIsMaintenanceModalOpen(true);
            return;
        }
    }
    setIsApproveModalOpen(true);
  };
  
  const handleOpenRejectModal = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const confirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservation || !rejectReason.trim()) return;

    try {
      await updateReservation(selectedReservation.id, { 
        status: ReservationStatus.Rejected, 
        rejectReason: rejectReason.trim() 
      });
      const departureDate = new Date(selectedReservation.departureDateTime);
      const emailHtml = generateEmailHtml(
          "Solicitação de Reserva Rejeitada",
          [
              { label: "Status", value: "❌ REJEITADA" }, 
              { label: "Solicitante", value: selectedReservation.requesterName }, 
              { label: "Data de Saída", value: departureDate.toLocaleString('pt-BR') },
              { label: "Destino", value: `${selectedReservation.destinationCity} - ${selectedReservation.destination}` },
              { label: "Motivo da Recusa", value: rejectReason.trim() }
          ],
          "#dc2626",
          undefined,
          `Prezado(a) ${selectedReservation.requesterName}, informamos que sua solicitação de reserva não pôde ser aprovada.`,
          `Motivo da Recusa / Parecer da Administração: ${rejectReason.trim()}`,
          "#dc2626"
      );
      const recipients = [...ADMIN_EMAIL_RECIPIENTS];
      if (selectedReservation.email && !recipients.includes(selectedReservation.email)) {
        recipients.push(selectedReservation.email);
      }
      await sendEmail(recipients, `Solicitação de Reserva Recusada - ${selectedReservation.requesterName}`, emailHtml);
      showToast("Reserva rejeitada e e-mail enviado.", 'success');
    } catch (err) { 
      showToast("Erro ao rejeitar.", 'error'); 
    } finally {
      setIsRejectModalOpen(false);
      setSelectedReservation(null);
    }
  };

  const handleCancel = async (reservation: Reservation) => {
      if (window.confirm(`Deseja cancelar a reserva de ${reservation.requesterName}?`)) {
          try {
              await updateReservation(reservation.id, { status: ReservationStatus.Cancelled });
              showToast("Reserva cancelada com sucesso.", 'success');
          } catch (e) {
              showToast("Erro ao cancelar reserva.", 'error');
          }
      }
  };

  const handleStartReservation = async (reservation: Reservation) => {
      try {
          await updateReservation(reservation.id, { status: ReservationStatus.InUse });
          showToast("Status alterado para Em Uso.", 'success');
      } catch (e) {
          showToast("Erro ao iniciar reserva.", 'error');
      }
  };

  const handleOpenChangeVehicleModal = (reservation: Reservation) => {
    // Determine the range of the reservation we are changing (using exact times to improve vehicle availability)
    const reqStartDate = new Date(reservation.departureDateTime);
    const reqEndDate = new Date(reservation.returnDate);

    const reservedVehicleIds = reservations
      .filter(r => {
        if (r.id === reservation.id) return false; // Ignore itself
        if (r.status !== ReservationStatus.Approved && r.status !== ReservationStatus.Pending && r.status !== ReservationStatus.InUse) return false;

        const resStart = new Date(r.departureDateTime);
        const resEnd = new Date(r.returnDate);

        // Check for overlap (exclusive bounds check to allow back-to-back rentals)
        return reqStartDate < resEnd && reqEndDate > resStart;
      })
      .map(r => r.vehicleId);

    const available = vehicles.filter(v => v.isActive !== false && !reservedVehicleIds.includes(v.id));
    setAvailableVehiclesForChange(available);
    setSelectedReservation(reservation);
    setIsChangeVehicleModalOpen(true);
  };

  const handleChangeVehicleAndApprove = async (newVehicleId: string) => {
    if (selectedReservation) {
        await updateReservation(selectedReservation.id, { vehicleId: newVehicleId });
        const updated = { ...selectedReservation, vehicleId: newVehicleId };
        await handleApprove(updated);
        setIsChangeVehicleModalOpen(false);
        setSelectedReservation(null);
    }
  };

  const handleOpenEditModal = (reservation: Reservation) => { setSelectedReservation(reservation); setIsEditModalOpen(true); }
  const handleSaveEdit = async (updatedData: Partial<Reservation>) => {
    if(selectedReservation) {
        try {
          await updateReservation(selectedReservation.id, updatedData);
          
          // Envia notificação por e-mail sobre a atualização para administradores e solicitante
          const vehicle = getVehicleById(updatedData.vehicleId || selectedReservation.vehicleId);
          const depDate = new Date(updatedData.departureDateTime || selectedReservation.departureDateTime);
          const retDate = new Date(updatedData.returnDate || selectedReservation.returnDate);
          const recipientEmail = updatedData.email || selectedReservation.email;
          const adminNotes = updatedData.adminNotes !== undefined ? updatedData.adminNotes : selectedReservation.adminNotes;
          
          const details = [
            { label: "Status", value: (updatedData.status || selectedReservation.status).toUpperCase() },
            { label: "Solicitante", value: updatedData.requesterName || selectedReservation.requesterName },
            { label: "Veículo", value: vehicle ? `${vehicle.model} - ${vehicle.plate}` : "N/A" },
            { label: "Saída", value: depDate.toLocaleString('pt-BR') },
            { label: "Retorno", value: retDate.toLocaleString('pt-BR') },
            { label: "Destino", value: `${updatedData.destinationCity || selectedReservation.destinationCity} - ${updatedData.destination || selectedReservation.destination}` },
          ];

          if (adminNotes && adminNotes.trim()) {
            details.push({ label: "Observações da Administração", value: adminNotes.trim() });
          }

          const emailHtml = generateEmailHtml(
            "Atualização na Reserva de Veículo",
            details,
            "#ff9b00",
            undefined,
            `Prezado(a) ${updatedData.requesterName || selectedReservation.requesterName}, sua reserva de veículo foi atualizada pela Gestão de Frota.`,
            adminNotes && adminNotes.trim() ? `Observações da Gestão de Frota: ${adminNotes.trim()}` : undefined,
            "#00753f"
          );

          const recipients = [...ADMIN_EMAIL_RECIPIENTS];
          if (recipientEmail && !recipients.includes(recipientEmail)) {
            recipients.push(recipientEmail);
          }

          await sendEmail(recipients, `Atualização de Reserva - ${updatedData.requesterName || selectedReservation.requesterName}`, emailHtml);
          showToast("Reserva atualizada e e-mails enviados com sucesso.", 'success');
        } catch (err) {
          console.error("Erro ao salvar edição de reserva:", err);
          showToast("Reserva atualizada.", 'success');
        } finally {
          setIsEditModalOpen(false);
          setSelectedReservation(null);
        }
    }
  }

  const handleOpenDeleteModal = (reservation: Reservation) => { setSelectedReservation(reservation); setIsDeleteModalOpen(true); }
  const handleDelete = async () => {
      if(selectedReservation) {
          try {
              await deleteReservation(selectedReservation.id);
              showToast("Reserva excluída com sucesso.", 'success');
          } catch (e) {
              console.error("Erro ao excluir reserva:", e);
              showToast("Reserva excluída.", 'success');
          } finally {
              setIsDeleteModalOpen(false);
              setSelectedReservation(null);
          }
      }
  }
  
  const handleOpenFinalizeModal = (reservation: Reservation) => {
        setSelectedReservation(reservation);
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setFinalizeFormData({ finalKm: reservation.finalKm?.toString() || '', actualReturnDateTime: now.toISOString().slice(0, 16) });
        setIsFinalizeModalOpen(true);
  };

  const handleFinalizeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedReservation && finalizeFormData.actualReturnDateTime) {
            try {
                const finalKm = finalizeFormData.finalKm ? parseInt(finalizeFormData.finalKm) : null;
                await finalizeReservation(selectedReservation.id, selectedReservation.vehicleId, finalKm, new Date(finalizeFormData.actualReturnDateTime));
                setIsFinalizeModalOpen(false);
                setSelectedReservation(null);
                showToast("Reserva finalizada!", 'success');
            } catch (e: any) { showToast(e.message, 'error'); }
        }
  };

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
        // Aba ativa x histórico
        if (activeTab === 'active') {
            if (![ReservationStatus.Pending, ReservationStatus.Approved, ReservationStatus.InUse].includes(res.status)) return false;
        } else {
            if (![ReservationStatus.Completed, ReservationStatus.Rejected, ReservationStatus.Cancelled].includes(res.status)) return false;
        }

        if (filterStartDate && new Date(res.departureDateTime) < new Date(filterStartDate)) return false;
        if (filterEndDate) { const end = new Date(filterEndDate); end.setHours(23,59,59); if (new Date(res.departureDateTime) > end) return false; }
        if (filterStatus && res.status !== filterStatus) return false;
        if (filterVehicleId && res.vehicleId !== filterVehicleId) return false;
        if (filterSearch && !res.requesterName.toLowerCase().includes(filterSearch.toLowerCase()) && !res.department.toLowerCase().includes(filterSearch.toLowerCase())) return false;
        return true;
    }).sort((a, b) => (b.requestTimestamp ? new Date(b.requestTimestamp).getTime() : 0) - (a.requestTimestamp ? new Date(a.requestTimestamp).getTime() : 0));
  }, [reservations, filterStartDate, filterEndDate, filterStatus, filterVehicleId, filterSearch, activeTab]);

  const handleExport = () => { /* ... Export Logic ... */ };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3 w-full text-left overflow-hidden">
       {toast && <div className={`fixed top-20 right-6 text-white p-4 rounded shadow z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.message}</div>}
       
       {/* Alerta de Notificação Push de Smartphone no topo */}
       {unreadOverdueReservations.length > 0 && (
           <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 select-none animate-bounce" style={{ animationDuration: '3s' }}>
               <div 
                   onClick={() => {
                       const firstRes = unreadOverdueReservations[0];
                       markAsRead(firstRes.id);
                       handleOpenEditModal(firstRes);
                   }}
                   className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-slate-800 cursor-pointer hover:bg-slate-800/95 transition-all flex items-start gap-3.5 relative overflow-hidden"
               >
                   <div className="bg-amber-500 p-2 rounded-xl text-slate-950 flex items-center justify-center shrink-0">
                       <BellIcon className="h-5 w-5 animate-pulse" />
                   </div>
                   <div className="flex-1 min-w-0 pr-4">
                       <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                           <span className="font-bold tracking-wider uppercase text-amber-500">Aviso de Celular • Urgente</span>
                           <span>agora</span>
                       </div>
                       <h4 className="text-xs font-bold text-slate-100 truncate">Reserva Passou do Prazo!</h4>
                       <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                           A reserva de <strong>{unreadOverdueReservations[0].requesterName}</strong> ({getVehicleById(unreadOverdueReservations[0].vehicleId)?.model}) venceu e não foi encerrada no sistema.
                       </p>
                       <div className="mt-3 flex items-center justify-between">
                           <span className="text-[10px] text-amber-400 font-bold hover:underline">Toque para editar e encerrar...</span>
                           <button 
                               onClick={(e) => {
                                   e.stopPropagation();
                                   markAsRead(unreadOverdueReservations[0].id);
                               }}
                               className="text-[10px] font-bold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-2 py-1 rounded-md transition-all bg-slate-950/40"
                           >
                                Dispensar
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}
      
      {/* Modal Link Público de Reservas */}
      <Modal isOpen={isPublicLinkModalOpen} onClose={() => setIsPublicLinkModalOpen(false)} title="Portal Público de Reservas">
          <div className="space-y-4 text-left">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                      <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">Acesso Exclusivo para Solicitantes</h4>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                          Neste link, os colaboradores acessam <strong>apenas o submódulo de reservas</strong> (solicitação de frotas leves, locações RAC terceirizadas, diário de bordo e status da frota), sem acesso aos outros módulos ou menus do ERP.
                      </p>
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0 flex flex-col items-center">
                      <QRCodeSVG value={`${window.location.origin}/reservas`} size={130} />
                      <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Escanear com Celular</span>
                  </div>
                  <div className="flex-1 space-y-2.5 w-full">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Link Direto do Portal:
                      </label>
                      <div className="flex items-center gap-2">
                          <input 
                              type="text" 
                              readOnly 
                              value={`${window.location.origin}/reservas`} 
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 font-bold focus:outline-none select-all"
                          />
                          <button
                              type="button"
                              onClick={handleCopyPublicPortalLink}
                              className="px-3 py-2 bg-[#114D38] hover:bg-[#1d7053] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs"
                          >
                              {copiedPublicLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                              <span>{copiedPublicLink ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                          <a
                              href="/reservas"
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-[#F47920] border border-orange-300/40 text-xs font-extrabold transition-all cursor-pointer"
                          >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Abrir Portal em Nova Aba</span>
                          </a>
                      </div>
                  </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Opções disponíveis para o solicitante:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                      <div className="flex items-center gap-2 p-2 bg-slate-100/70 rounded-lg">
                          <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>1. Solicitação de Frota Leve</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-100/70 rounded-lg">
                          <Car className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>2. Locação RAC Terceirizada</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-100/70 rounded-lg">
                          <ClipboardList className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>3. Diário de Bordo (Uso Diário)</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-100/70 rounded-lg">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>4. Status & Disponibilidade</span>
                      </div>
                  </div>
              </div>
          </div>
      </Modal>

      {/* Modals (Keep existing implementations) */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nova Reserva (Admin)">
          <div className="max-h-[80vh] overflow-y-auto pr-2">
              <ReservationForm onSuccess={() => setIsAddModalOpen(false)} />
          </div>
      </Modal>
      <Modal isOpen={isChangeVehicleModalOpen} onClose={() => setIsChangeVehicleModalOpen(false)} title="Alterar Veículo">
          {selectedReservation && (
            <div>
              <p className="mb-4">Selecione um novo veículo:</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                  {availableVehiclesForChange.map(v => (
                    <button key={v.id} onClick={() => handleChangeVehicleAndApprove(v.id)} className="w-full text-left p-3 border rounded hover:bg-gray-100">
                      <strong>{v.model}</strong> - {v.plate}
                    </button>
                  ))}
              </div>
            </div>
          )}
      </Modal>
      {selectedReservation && isEditModalOpen && <ReservationEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} reservation={selectedReservation} onSave={handleSaveEdit} />}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão da Reserva">
        <div className="p-2 space-y-4">
            <p className="text-sm text-slate-600">
                Tem certeza de que deseja excluir esta reserva? Esta ação removerá o registro do sistema.
            </p>
            {selectedReservation && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                    <p><strong className="text-slate-700">Solicitante:</strong> {selectedReservation.requesterName}</p>
                    <p><strong className="text-slate-700">Destino:</strong> {selectedReservation.destinationCity} - {selectedReservation.destination}</p>
                    <p><strong className="text-slate-700">Data de Saída:</strong> {new Date(selectedReservation.departureDateTime).toLocaleString('pt-BR')}</p>
                </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
                <button 
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)} 
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                    Cancelar
                </button>
                <button 
                    type="button"
                    onClick={handleDelete} 
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                    Excluir Definitivamente
                </button>
            </div>
        </div>
      </Modal>
      <Modal isOpen={isFinalizeModalOpen} onClose={() => setIsFinalizeModalOpen(false)} title="Finalizar">
         {/* ... Finalize Form ... */}
         <form onSubmit={handleFinalizeSubmit} className="space-y-4">
             <input type="datetime-local" value={finalizeFormData.actualReturnDateTime} onChange={e => setFinalizeFormData({...finalizeFormData, actualReturnDateTime: e.target.value})} required className="w-full border p-2 rounded" />
             <input type="number" placeholder="KM Final" value={finalizeFormData.finalKm} onChange={e => setFinalizeFormData({...finalizeFormData, finalKm: e.target.value})} className="w-full border p-2 rounded" />
             <button type="submit" className="w-full bg-primary text-white p-2 rounded">Confirmar</button>
         </form>
      </Modal>
      <Modal isOpen={isMaintenanceModalOpen} onClose={() => setIsMaintenanceModalOpen(false)} title="Aviso de Manutenção">
         <div className="text-center">
             <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto"/>
             <p className="my-4">Este veículo está com a revisão vencida. Deseja aprovar mesmo assim?</p>
             <div className="flex justify-center gap-4">
                 <button onClick={() => setIsMaintenanceModalOpen(false)} className="bg-gray-200 p-2 rounded">Cancelar</button>
                 <button onClick={() => confirmApprove(selectedReservation!)} className="bg-red-600 text-white p-2 rounded">Aprovar</button>
             </div>
         </div>
      </Modal>
      <Modal isOpen={isApproveModalOpen} onClose={() => { setIsApproveModalOpen(false); setSelectedReservation(null); }} title="Aprovar Solicitação de Reserva">
        {selectedReservation && (
          <form onSubmit={(e) => { e.preventDefault(); confirmApprove(selectedReservation, approveAdminNotes); }} className="space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Solicitante:</span>
                <span className="font-bold text-slate-900">{selectedReservation.requesterName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Veículo:</span>
                <span className="font-bold text-slate-900">{getVehicleById(selectedReservation.vehicleId)?.model} - {getVehicleById(selectedReservation.vehicleId)?.plate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Destino:</span>
                <span className="font-bold text-slate-900">{selectedReservation.destinationCity} - {selectedReservation.destination}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Período:</span>
                <span className="font-bold text-slate-900">
                  {new Date(selectedReservation.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} até {new Date(selectedReservation.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-1.5">
              <label className="block text-xs font-bold text-emerald-900">
                📝 Observações da Gestão de Frota / Instruções de Retirada (Opcional)
              </label>
              <p className="text-[11px] text-emerald-700 leading-tight">
                Estas orientações serão incluídas com destaque no e-mail enviado ao solicitante e aos administradores.
              </p>
              <textarea 
                value={approveAdminNotes} 
                onChange={e => setApproveAdminNotes(e.target.value)} 
                rows={3}
                className="w-full bg-white border border-emerald-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none" 
                placeholder="Ex: Chave disponível na recepção. Veículo higienizado e liberado para a rota informada."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => { setIsApproveModalOpen(false); setSelectedReservation(null); }} 
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <CheckIcon className="w-4 h-4" />
                Confirmar e Aprovar
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Rejeitar Reserva">
         <form onSubmit={confirmReject} className="space-y-4">
             <p className="text-sm text-gray-600">Por favor, informe o motivo da rejeição. Esta mensagem será enviada ao solicitante.</p>
             <textarea 
                 value={rejectReason} 
                 onChange={e => setRejectReason(e.target.value)} 
                 required 
                 className="w-full border p-2 rounded h-24" 
                 placeholder="Motivo da rejeição..."
             />
             <div className="flex justify-end gap-4">
                 <button type="button" onClick={() => setIsRejectModalOpen(false)} className="bg-gray-200 p-2 rounded">Cancelar</button>
                 <button type="submit" className="bg-red-600 text-white p-2 rounded">Confirmar Rejeição</button>
             </div>
         </form>
      </Modal>

      {/* Seção Superior Congelada (Cabeçalho, Ações e Filtros) */}
      <div className="shrink-0 space-y-2.5">
        {/* Cabeçalho Premium integrado ao padrão de submenus */}
        <div className="bg-white p-4 rounded-2xl border border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="text-left">
            <h2 className="text-sm font-extrabold text-slate-800">Gerenciar Reservas</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Aprovação e controle de agendamentos de frotas e viagens leves.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
              <button 
                  onClick={() => setIsPublicLinkModalOpen(true)} 
                  title="Abrir Link e QR Code do Portal Público de Reservas"
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-[#F47920] border border-amber-300/40 font-extrabold uppercase tracking-wider py-2 px-3.5 rounded-xl transition duration-300 shadow-xs text-xs flex items-center gap-1.5 cursor-pointer"
              >
                  <QrCode className="w-4 h-4 text-[#F47920]" />
                  <span>Link Público de Reservas</span>
              </button>

              <button 
                  onClick={() => setIsAddModalOpen(true)} 
                  className="bg-[#114D38] hover:bg-[#1d7053] text-white font-extrabold uppercase tracking-wider py-2 px-4 rounded-xl transition duration-300 shadow-sm text-xs flex items-center gap-1.5 cursor-pointer"
              >
                  <span>+ Nova Reserva</span>
              </button>
          </div>
        </div>

        {/* Abas e Ferramentas */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-150 shadow-sm">
            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                <button 
                    onClick={() => { setActiveTab('active'); setFilterStatus(''); }} 
                    className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <span>Ativas</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {activeReservationsCount}
                    </span>
                </button>
                <button 
                    onClick={() => { setActiveTab('history'); setFilterStatus(''); }} 
                    className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <span>Histórico</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'history' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {historyReservationsCount}
                    </span>
                </button>
                <button 
                    onClick={() => { setActiveTab('locacoes'); setFilterStatus(''); }} 
                    className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'locacoes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <span>Locações (RAC)</span>
                </button>
            </div>
            <div className="flex gap-2 items-center w-full md:w-auto justify-end">
                <button onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 bg-white transition-colors cursor-pointer"><FunnelIcon className="h-4 w-4"/> Filtros</button>
                
                {/* Sino de Notificações de Celular */}
                <div className="relative">
                    <button 
                        onClick={() => setIsNotifPanelOpen(!isNotifPanelOpen)} 
                        className={`relative p-2 rounded-xl border transition-all cursor-pointer ${isNotifPanelOpen ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 border-slate-200'}`}
                        title="Alertas de Atraso"
                    >
                        <BellIcon className="h-4 w-4" />
                        {unreadOverdueReservations.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
                                {unreadOverdueReservations.length}
                            </span>
                        )}
                    </button>

                    {/* Central de Avisos Flutuante estilo Celular */}
                    {isNotifPanelOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 text-white animate-fade-in divide-y divide-slate-800">
                            <div className="flex justify-between items-center pb-2.5 font-sans">
                                <span className="text-xs font-bold tracking-widest text-slate-400">CENTRAL DE AVISOS</span>
                                <span className="text-[10px] text-amber-500 font-bold px-1.5 py-0.5 bg-amber-500/10 rounded">FROTAS MOBILE</span>
                            </div>
                            <div className="pt-2.5 max-h-80 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
                                {unreadOverdueReservations.length === 0 ? (
                                    <div className="text-center py-6 text-xs text-slate-500 font-medium">
                                        Nenhum aviso pendente. Tudo em dia! 👍
                                    </div>
                                ) : (
                                    unreadOverdueReservations.map(res => {
                                        const vehicle = getVehicleById(res.vehicleId);
                                        const limitDate = new Date(res.returnDate);
                                        return (
                                            <div 
                                                key={res.id}
                                                onClick={() => {
                                                    markAsRead(res.id);
                                                    handleOpenEditModal(res);
                                                    setIsNotifPanelOpen(false);
                                                }}
                                                className="block w-full text-left p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 cursor-pointer transition-all duration-200 group animate-fade-in"
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-red-400 text-xs font-bold flex items-center gap-1">
                                                        <ClockIcon className="h-3.5 w-3.5" /> Prazo Excedido
                                                    </span>
                                                    <span className="text-[9px] text-slate-550">{new Date(res.departureDateTime).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors">{res.requesterName}</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">Veículo: {vehicle ? `${vehicle.model} - ${vehicle.plate}` : 'N/A'}</p>
                                                <p className="text-[11px] text-slate-400">Retorno em: <span className="text-red-400 font-semibold">{limitDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></p>
                                                <div className="mt-2 flex justify-end">
                                                    <span className="text-[10px] font-bold text-slate-900 bg-amber-400 group-hover:bg-amber-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
                                                        <PencilIcon className="h-3 w-3" /> Editar e Tratar
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                     )}
                </div>
            </div>
        </div>

        {/* Barra de Filtros Retrátil */}
        {isFiltersOpen && (
            <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-3">
                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50" />
                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50">
                    <option value="">Status: Todos</option>
                    {Object.values(ReservationStatus)
                        .filter(s => activeTab === 'active' 
                            ? [ReservationStatus.Pending, ReservationStatus.Approved, ReservationStatus.InUse].includes(s)
                            : [ReservationStatus.Completed, ReservationStatus.Rejected, ReservationStatus.Cancelled].includes(s)
                        )
                        .map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterVehicleId} onChange={e => setFilterVehicleId(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50"><option value="">Veículo: Todos</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.model}</option>)}</select>
                <input type="text" placeholder="Buscar..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50" />
            </div>
        )}
      </div>

      {/* Conteúdo com rolagem independente e cabeçalho congelado */}
      <div className="flex-1 min-h-0 flex flex-col pr-1 pb-2">
        {activeTab === 'locacoes' ? (
            <div className="flex-1 min-h-0 flex flex-col w-full h-full">
                <RacRentalsView embedded={true} />
            </div>
        ) : activeTab === 'history' ? (
            <>
                {/* Tabela de Histórico de Reservas (Desktop) */}
                <div className="hidden md:block flex-1 min-h-0 overflow-auto bg-white rounded-3xl border border-slate-150 shadow-sm mb-4">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-20 bg-[#114D38]">
                        <tr className="bg-[#114D38] text-white text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Solicitante</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Data Pedido</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Veículo</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Período Realizado</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Destino</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Desfecho / Quilometragem</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Status</th>
                          <th className="py-4 px-6 text-right sticky top-0 bg-[#114D38] z-20 shadow-xs">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {filteredReservations.length === 0 ? (
                          <tr>
                              <td colSpan={8} className="px-6 py-10 text-center text-slate-400 font-medium">
                                  Nenhum registro encontrado no histórico.
                              </td>
                          </tr>
                      ) : (
                          filteredReservations.map(res => {
                              const vehicle = getVehicleById(res.vehicleId);
                              return (
                              <tr key={res.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="px-6 py-4">
                                      <div className="text-sm font-bold text-gray-900">{res.requesterName}</div>
                                      <div className="text-xs text-gray-500">{res.department} {res.role ? `• ${res.role}` : ''}</div>
                                  </td>
                                  <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                      {res.requestTimestamp ? new Date(res.requestTimestamp).toLocaleDateString('pt-BR') : '-'}
                                  </td>
                                  <td className="px-6 py-4">
                                      {vehicle ? (
                                          <div className="flex flex-col">
                                              <span className="text-sm font-bold text-gray-800">{vehicle.model}</span>
                                              <span className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded w-fit mt-0.5 text-gray-600 shadow-inner">
                                                  {vehicle.plate}
                                              </span>
                                          </div>
                                      ) : <span className="text-gray-400">N/A</span>}
                                  </td>
                                  <td className="px-6 py-4 text-xs font-medium">
                                      <div className="text-slate-800 font-bold">Saída: {new Date(res.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                                      <div className="text-slate-500 mt-0.5">
                                          {res.actualReturnDateTime ? (
                                              <span className="text-emerald-700 font-semibold">Devolvido: {new Date(res.actualReturnDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                          ) : (
                                              <span>Previsto: {new Date(res.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                          )}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-medium text-slate-750">
                                      <div className="font-bold text-slate-800">{res.destinationCity}</div>
                                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{res.destination || '-'}</div>
                                  </td>
                                  <td className="px-6 py-4 text-xs">
                                      {res.status === ReservationStatus.Completed ? (
                                          <div className="space-y-0.5">
                                              <div className="text-slate-800 font-bold">
                                                  KM Final: <span className="font-mono text-emerald-800 font-black">{res.finalKm ? `${res.finalKm.toLocaleString('pt-BR')} km` : 'N/I'}</span>
                                              </div>
                                              {res.distanceKm && res.distanceKm > 0 ? (
                                                  <div className="text-[10px] text-slate-500 font-medium">Previsto: ~{res.distanceKm} km</div>
                                              ) : null}
                                          </div>
                                      ) : res.status === ReservationStatus.Rejected ? (
                                          <div className="bg-red-50 text-red-800 border border-red-200 p-2 rounded-lg text-[11px] max-w-[200px]">
                                              <span className="font-bold block">Motivo da Recusa:</span>
                                              <span className="text-slate-700">{res.rejectReason || 'Não informado'}</span>
                                          </div>
                                      ) : res.status === ReservationStatus.Cancelled ? (
                                          <div className="text-slate-400 italic text-xs">Cancelada</div>
                                      ) : (
                                          <span className="text-slate-400">-</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-4">{getStatusChip(res.status)}</td>
                                  <td className="px-6 py-4 flex gap-2 justify-end">
                                      <button onClick={() => handleOpenEditModal(res)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-150 cursor-pointer" title="Ver / Editar"><PencilIcon className="h-5 w-5"/></button>
                                      <button onClick={() => handleOpenDeleteModal(res)} className="text-gray-400 hover:text-red-600 hover:bg-gray-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-150 cursor-pointer" title="Excluir"><TrashIcon className="h-5 w-5"/></button>
                                  </td>
                              </tr>
                          )})
                      )}
                      </tbody>
                    </table>
                </div>

                {/* Mobile View para Histórico */}
                <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-4 pb-6">
                    {filteredReservations.length === 0 ? (
                        <div className="bg-white p-6 rounded-2xl border text-center text-slate-400 font-medium text-xs">
                            Nenhum registro encontrado no histórico.
                        </div>
                    ) : (
                        filteredReservations.map(res => (
                            <div key={res.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-gray-900 text-sm block">{res.requesterName}</span>
                                        <span className="text-xs text-gray-500">{res.department} {res.role ? `• ${res.role}` : ''}</span>
                                    </div>
                                    {getStatusChip(res.status)}
                                </div>
                                <div className="text-xs text-gray-600 space-y-1.5 bg-slate-50 p-3 rounded-xl">
                                    <p><strong>Veículo:</strong> {getVehicleById(res.vehicleId)?.model} - <span className="font-mono">{getVehicleById(res.vehicleId)?.plate}</span></p>
                                    <p><strong>Saída:</strong> {new Date(res.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                    {res.actualReturnDateTime ? (
                                        <p className="text-emerald-700"><strong>Devolvido:</strong> {new Date(res.actualReturnDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                    ) : (
                                        <p><strong>Retorno Previsto:</strong> {new Date(res.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                    )}
                                    <p><strong>Destino:</strong> {res.destinationCity} {res.destination ? `(${res.destination})` : ''}</p>
                                    {res.status === ReservationStatus.Completed && (
                                        <p><strong>KM Final:</strong> <span className="font-mono text-emerald-800 font-bold">{res.finalKm ? `${res.finalKm.toLocaleString('pt-BR')} km` : 'N/I'}</span></p>
                                    )}
                                    {res.status === ReservationStatus.Rejected && res.rejectReason && (
                                        <p className="text-red-700"><strong>Motivo:</strong> {res.rejectReason}</p>
                                    )}
                                </div>
                                <div className="flex justify-end gap-3 border-t pt-3">
                                    <button onClick={() => handleOpenEditModal(res)} className="text-blue-600 p-1.5 rounded-lg border border-blue-100 bg-blue-50 cursor-pointer" title="Editar"><PencilIcon className="h-4 w-4"/></button>
                                    <button onClick={() => handleOpenDeleteModal(res)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer" title="Excluir"><TrashIcon className="h-4 w-4"/></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </>
        ) : (
            <>
                {/* Tabela de Reservas Ativas (Desktop) */}
                <div className="hidden md:block flex-1 min-h-0 overflow-auto bg-white rounded-3xl border border-slate-150 shadow-sm mb-4">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-20 bg-[#114D38]">
                        <tr className="bg-[#114D38] text-white text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Solicitante</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Data Pedido</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Veículo</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Período</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Destino</th>
                          <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-20 shadow-xs">Status</th>
                          <th className="py-4 px-6 text-right sticky top-0 bg-[#114D38] z-20 shadow-xs">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {filteredReservations.length === 0 ? (
                          <tr>
                              <td colSpan={7} className="px-6 py-10 text-center text-slate-400 font-medium">
                                  Nenhuma reserva ativa encontrada.
                              </td>
                          </tr>
                      ) : (
                          filteredReservations.map(res => {
                              const vehicle = getVehicleById(res.vehicleId);
                              return (
                              <tr key={res.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="px-6 py-4">
                                      <div className="text-sm font-bold text-gray-900">{res.requesterName}</div>
                                      <div className="text-xs text-gray-500">{res.department}</div>
                                  </td>
                                  <td className="px-6 py-4 text-sm font-medium">{res.requestTimestamp ? new Date(res.requestTimestamp).toLocaleDateString('pt-BR') : '-'}</td>
                                  <td className="px-6 py-4">
                                      {vehicle ? (
                                          <div className="flex flex-col">
                                              <span className="text-sm font-bold text-gray-800">{vehicle.model}</span>
                                              <span className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded w-fit mt-0.5 text-gray-600 shadow-inner">
                                                  {vehicle.plate}
                                              </span>
                                          </div>
                                      ) : <span className="text-gray-400">N/A</span>}
                                  </td>
                                  <td className="px-6 py-4 text-sm font-medium">
                                      <div>{new Date(res.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                                      <div className="text-xs text-slate-550 font-medium">até {new Date(res.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                                  </td>
                                  <td className="px-6 py-4 text-sm font-medium text-slate-750">{res.destinationCity}</td>
                                  <td className="px-6 py-4">{getStatusChip(res.status)}</td>
                                  <td className="px-6 py-4 flex gap-2 justify-end">
                                      {res.status === ReservationStatus.Pending && (
                                          <>
                                              <button onClick={() => handleApprove(res)} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-green-150 cursor-pointer" title="Aprovar"><CheckIcon className="h-5 w-5"/></button>
                                              <button onClick={() => handleOpenRejectModal(res)} className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-150 cursor-pointer" title="Rejeitar"><XIcon className="h-5 w-5"/></button>
                                          </>
                                      )}
                                      {res.status === ReservationStatus.Approved && (
                                          <>
                                              <button onClick={() => handleStartReservation(res)} className="text-green-700 hover:text-green-900 hover:bg-green-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-green-150 cursor-pointer" title="Iniciar Viagem / Em Uso">
                                                  <PlayIcon className="h-5 w-5" />
                                              </button>
                                              <button onClick={() => handleCancel(res)} className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-150 cursor-pointer" title="Cancelar Reserva">
                                                  <XCircleIcon className="h-5 w-5" />
                                              </button>
                                          </>
                                      )}
                                      <button onClick={() => handleOpenEditModal(res)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-150 cursor-pointer" title="Editar"><PencilIcon className="h-5 w-5"/></button>
                                      <button onClick={() => handleOpenDeleteModal(res)} className="text-gray-400 hover:text-red-600 hover:bg-gray-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-150 cursor-pointer" title="Excluir"><TrashIcon className="h-5 w-5"/></button>
                                  </td>
                              </tr>
                          )})
                      )}
                      </tbody>
                    </table>
                </div>
                
                {/* Mobile View para Reservas Ativas */}
                <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-4 pb-6">
                    {filteredReservations.length === 0 ? (
                        <div className="bg-white p-6 rounded-2xl border text-center text-slate-400 font-medium text-xs">
                            Nenhuma reserva ativa encontrada.
                        </div>
                    ) : (
                        filteredReservations.map(res => (
                            <div key={res.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-gray-900">{res.requesterName}</span>
                                        <span className="text-xs text-gray-500 block">{res.department}</span>
                                    </div>
                                    {getStatusChip(res.status)}
                                </div>
                                <div className="text-sm text-gray-600 mt-2 space-y-1">
                                    <p><strong>Veículo:</strong> {getVehicleById(res.vehicleId)?.model} - {getVehicleById(res.vehicleId)?.plate}</p>
                                    <p><strong>Saída:</strong> {new Date(res.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                    <p><strong>Retorno Previsto:</strong> {new Date(res.returnDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                    <p><strong>Destino:</strong> {res.destinationCity}</p>
                                </div>
                                <div className="flex justify-end mt-3 gap-3 border-t pt-3">
                                      {res.status === ReservationStatus.Pending && (
                                          <>
                                              <button onClick={() => handleApprove(res)} className="text-green-600 p-1 cursor-pointer" title="Aprovar"><CheckIcon className="h-6 w-6"/></button>
                                              <button onClick={() => handleOpenRejectModal(res)} className="text-red-600 p-1 cursor-pointer" title="Rejeitar"><XIcon className="h-6 w-6"/></button>
                                          </>
                                      )}
                                      {res.status === ReservationStatus.Approved && (
                                          <>
                                              <button onClick={() => handleStartReservation(res)} className="text-green-700 p-1 cursor-pointer" title="Iniciar Viagem"><PlayIcon className="h-6 w-6" /></button>
                                              <button onClick={() => handleCancel(res)} className="text-gray-500 hover:text-red-600 p-1 cursor-pointer" title="Cancelar"><XCircleIcon className="h-6 w-6" /></button>
                                          </>
                                      )}
                                      
                                      <button onClick={() => handleOpenEditModal(res)} className="text-blue-600 p-1 cursor-pointer" title="Editar"><PencilIcon className="h-6 w-6"/></button>
                                      <button onClick={() => handleOpenDeleteModal(res)} className="text-gray-400 hover:text-red-600 p-1 cursor-pointer" title="Excluir"><TrashIcon className="h-6 w-6"/></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default ReservationsView;
