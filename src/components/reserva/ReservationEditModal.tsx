
import React, { useState, useEffect } from 'react';
import { Reservation, Vehicle, ReservationStatus } from '../../types_reserva';
import { useReservations } from '../../context/ReservationContext';
import Modal from './Modal';
import { SP_CITIES } from '../../constants_reserva';
import { normalizeCidade } from '../../utils/baseOperacional';
import { normalizeNomeSetor, SETORES_OFICIAIS } from '../../utils/setorOperacional';

interface ReservationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation;
  onSave: (data: Partial<Reservation>) => void;
}

const ReservationEditModal: React.FC<ReservationEditModalProps> = ({ isOpen, onClose, reservation, onSave }) => {
  const { vehicles, reservations, dailyTrips } = useReservations();
  const [formData, setFormData] = useState<Partial<Reservation>>({});

  useEffect(() => {
    if (reservation) {
      // Format dates for datetime-local and date inputs
      const departure = new Date(reservation.departureDateTime);
      departure.setMinutes(departure.getMinutes() - departure.getTimezoneOffset());
      
      const returnD = new Date(reservation.returnDate);
      returnD.setMinutes(returnD.getMinutes() - returnD.getTimezoneOffset());
      
      setFormData({
        ...reservation,
        departureDateTime: departure.toISOString().slice(0, 16) as any,
        returnDate: returnD.toISOString().slice(0, 16) as any,
      });
    }
  }, [reservation]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const upperCaseFields = ['requesterName', 'department', 'role', 'destination', 'destinationCity', 'purpose'];

    if (upperCaseFields.includes(name)) {
      setFormData({ ...formData, [name]: value.toUpperCase() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação estrita se o status for Concluída
    if (formData.status === ReservationStatus.Completed) {
      const finalKmNum = Number(formData.finalKm);
      if (!formData.finalKm || isNaN(finalKmNum) || finalKmNum <= 0) {
        alert("Para alterar o status da reserva para Concluída, é obrigatório informar o KM Final do veículo.");
        return;
      }

      const currentVeh = vehicles.find(v => v.id === formData.vehicleId);
      const minAllowed = currentVeh ? (currentVeh.lastKm || currentVeh.initialKm || 0) : 0;
      if (minAllowed > 0 && finalKmNum < minAllowed) {
        alert(`O KM final (${finalKmNum} km) não pode ser menor que o hodômetro atual do veículo (${minAllowed} km).`);
        return;
      }
    }

    // Helper to safely parse date and time string to Local Date
    const parseDateTime = (dateTimeStr: string) => {
        if (!dateTimeStr) return undefined;
        const [datePart, timePart] = dateTimeStr.split('T');
        const [y, m, d] = datePart.split('-').map(Number);
        const [hours, mins] = (timePart || "12:00").split(':').map(Number);
        return new Date(y, m - 1, d, hours, mins, 0, 0);
    };

    const dataToSave: { [key: string]: any } = {
        ...formData,
        department: formData.department ? normalizeNomeSetor(formData.department) : formData.department,
        destinationCity: formData.destinationCity ? normalizeCidade(formData.destinationCity) : formData.destinationCity,
        departureDateTime: formData.departureDateTime ? new Date(formData.departureDateTime as any) : undefined,
        // Support saving full Return Date & Time
        returnDate: formData.returnDate ? parseDateTime(String(formData.returnDate)) : undefined,
        distanceKm: formData.distanceKm ? Number(formData.distanceKm) : undefined,
    };

    // Remove any keys with undefined values before saving to Firestore.
    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined) {
            delete dataToSave[key];
        }
    });
    
    // Also remove the ID to ensure we are only sending update data
    delete dataToSave.id;

    onSave(dataToSave as Partial<Reservation>);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Reserva">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Solicitante</label>
                <input type="text" name="requesterName" value={formData.requesterName || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">E-mail</label>
                <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Setor</label>
                <input type="text" name="department" list="modal-setores-list" value={formData.department || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
                <datalist id="modal-setores-list">
                    {SETORES_OFICIAIS.map(s => (
                        <option key={s} value={s} />
                    ))}
                </datalist>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Função</label>
                <input type="text" name="role" value={formData.role || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Saída</label>
                <input type="datetime-local" name="departureDateTime" value={formData.departureDateTime as any} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Retorno</label>
                <input type="datetime-local" name="returnDate" value={formData.returnDate as any} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Local de Destino</label>
                <input type="text" name="destination" value={formData.destination || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Cidade de Destino</label>
                <input type="text" list="cities" name="destinationCity" value={formData.destinationCity || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
                <datalist id="cities">{SP_CITIES.map(city => <option key={city} value={city} />)}</datalist>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Veículo</label>
                 <select name="vehicleId" value={formData.vehicleId} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    {vehicles.filter(v => {
                      return v.isActive !== false || v.id === formData.vehicleId;
                    }).map(v => <option key={v.id} value={v.id}>{v.model} - {v.plate}</option>)}
                </select>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                 <select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    {Object.values(ReservationStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {formData.status === ReservationStatus.Completed && (() => {
              const currentVeh = vehicles.find(v => v.id === formData.vehicleId);
              const currentKm = currentVeh ? (currentVeh.lastKm || currentVeh.initialKm || 0) : 0;
              return (
                <div className="md:col-span-2 bg-amber-50/70 p-4 rounded-xl border border-amber-300 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <span>🏁</span>
                    <span>Dados de Conclusão e Devolução do Veículo (Obrigatórios)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Hodômetro / KM Final <span className="text-red-600">* (Obrigatório)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="finalKm"
                          required
                          min={currentKm > 0 ? currentKm : 1}
                          value={formData.finalKm || ''}
                          onChange={handleChange}
                          placeholder={`Mínimo: ${currentKm} km`}
                          className="w-full text-sm border border-amber-300 bg-white p-2.5 pr-12 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">KM</span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-1">
                        KM atual do veículo: <strong>{currentKm.toLocaleString('pt-BR')} km</strong>. Atualizará o cadastro do veículo.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Data e Hora Efetiva de Devolução <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="actualReturnDateTime"
                        required
                        value={formData.actualReturnDateTime ? new Date(formData.actualReturnDateTime).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
                        onChange={(e) => setFormData({ ...formData, actualReturnDateTime: new Date(e.target.value) as any })}
                        className="w-full text-sm border border-amber-300 bg-white p-2.5 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

             <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Motivo da Viagem</label>
                <input type="text" name="purpose" value={formData.purpose || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
            </div>
            <div className="md:col-span-2 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  📝 Observações da Gestão de Frota / Administrador (Serão enviadas por e-mail ao solicitante)
                </label>
                <textarea 
                  name="adminNotes" 
                  rows={3}
                  value={formData.adminNotes || ''} 
                  onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })} 
                  placeholder="Ex: Chave disponível na portaria. Veículo revisado e liberado para a rota informada."
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
            </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300">Cancelar</button>
          <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-green-800">Salvar Alterações</button>
        </div>
      </form>
    </Modal>
  );
};

export default ReservationEditModal;
