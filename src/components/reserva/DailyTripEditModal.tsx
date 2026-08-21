


import React, { useState, useEffect } from 'react';
import { DailyTrip } from '../../types_reserva';
import { useReservations } from '../../context/ReservationContext';
import Modal from './Modal';
import { SP_CITIES } from '../../constants_reserva';

interface DailyTripEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: DailyTrip;
  onSave: (data: Partial<DailyTrip>) => void;
}

const DailyTripEditModal: React.FC<DailyTripEditModalProps> = ({ isOpen, onClose, trip, onSave }) => {
  const { vehicles, reservations, dailyTrips } = useReservations();
  const [formData, setFormData] = useState<Partial<DailyTrip>>({});

  useEffect(() => {
    if (trip) {
      // Formata as datas para os inputs de datetime-local
      const formatDateTimeLocal = (date: Date | undefined) => {
        if (!date) return '';
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
      };
      
      setFormData({
        ...trip,
        departureDateTime: formatDateTimeLocal(trip.departureDateTime) as any,
        actualReturnDateTime: formatDateTimeLocal(trip.actualReturnDateTime) as any,
      });
    }
  }, [trip]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const upperCaseFields = ['driverName', 'destination', 'destinationCity', 'purpose'];

    if (upperCaseFields.includes(name)) {
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Explicitly pick only the fields that can be edited from the form
    const { 
        driverName, vehicleId, departureDateTime, actualReturnDateTime, 
        destinationCity, finalKm, destination, purpose 
    } = formData;

    const dataToSave: { [key: string]: any } = {
        driverName,
        vehicleId,
        destinationCity,
        destination,
        purpose,
        departureDateTime: departureDateTime ? new Date(departureDateTime as any) : undefined,
        actualReturnDateTime: actualReturnDateTime ? new Date(actualReturnDateTime as any) : undefined,
        finalKm: (finalKm || finalKm === 0) ? Number(finalKm) : undefined,
    };

    // Remove any keys with undefined values before saving to Firestore
    Object.keys(dataToSave).forEach(key => dataToSave[key] === undefined && delete dataToSave[key]);

    onSave(dataToSave as Partial<DailyTrip>);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Viagem de Uso Diário">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Motorista</label>
                <input type="text" name="driverName" value={formData.driverName || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
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
                <label className="block text-sm font-medium text-gray-700">Saída</label>
                <input type="datetime-local" name="departureDateTime" value={formData.departureDateTime as any} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Retorno</label>
                <input type="datetime-local" name="actualReturnDateTime" value={formData.actualReturnDateTime as any} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Cidade de Destino</label>
                <input type="text" list="cities" name="destinationCity" value={formData.destinationCity || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
                <datalist id="cities">{SP_CITIES.map(city => <option key={city} value={city} />)}</datalist>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">KM Final</label>
                <input type="number" name="finalKm" value={formData.finalKm || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
             <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Local de Destino</label>
                <input type="text" name="destination" value={formData.destination || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
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

export default DailyTripEditModal;
