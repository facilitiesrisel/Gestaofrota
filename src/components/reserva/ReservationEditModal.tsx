
import React, { useState, useEffect } from 'react';
import { Reservation, Vehicle, ReservationStatus } from '../../types_reserva';
import { useReservations } from '../../context/ReservationContext';
import Modal from './Modal';
import { SP_CITIES } from '../../constants_reserva';

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
                <input type="text" name="department" value={formData.department || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
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
             <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Motivo da Viagem</label>
                <input type="text" name="purpose" value={formData.purpose || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
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
