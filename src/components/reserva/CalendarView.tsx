
import React, { useState } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { Reservation, ReservationStatus } from '../../types_reserva';
import ReservationEditModal from './ReservationEditModal';

const CalendarView: React.FC = () => {
  const { reservations, getVehicleById, updateReservation } = useReservations();
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Tooltip state
  const [hoveredInfo, setHoveredInfo] = useState<{ res: Reservation; x: number; y: number } | null>(null);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startOfMonth.getDay());
  const endDate = new Date(endOfMonth);
  endDate.setDate(endDate.getDate() + (6 - endOfMonth.getDay()));

  const days = [];
  let day = new Date(startDate);

  while (day <= endDate) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const approvedReservations = reservations.filter(
    (r) => r.status === ReservationStatus.Approved || r.status === ReservationStatus.InUse
  );

  const reservationsByDate: { [key: string]: any[] } = {};
  approvedReservations.forEach((res) => {
    const dateKey = new Date(res.departureDateTime).toDateString();
    if (!reservationsByDate[dateKey]) {
      reservationsByDate[dateKey] = [];
    }
    reservationsByDate[dateKey].push(res);
  });
  
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const handleOpenEditModal = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsEditModalOpen(true);
    setHoveredInfo(null); // Close tooltip on click
  };

  const handleSaveEdit = async (updatedData: Partial<Reservation>) => {
    if (selectedReservation) {
      await updateReservation(selectedReservation.id, updatedData);
      setIsEditModalOpen(false);
      setSelectedReservation(null);
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const monthNames = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div className="bg-white p-6 rounded-lg shadow-md relative">
      {selectedReservation && (
        <ReservationEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          reservation={selectedReservation}
          onSave={handleSaveEdit}
        />
      )}
      
      {/* Tooltip Floating Card */}
      {hoveredInfo && (
        <div 
            className="fixed z-50 bg-white p-4 rounded-lg shadow-xl border border-gray-200 text-sm w-80 pointer-events-none transition-opacity duration-200"
            style={{ 
                top: Math.min(hoveredInfo.y + 10, window.innerHeight - 200), // Prevent bottom overflow
                left: Math.min(hoveredInfo.x + 10, window.innerWidth - 330) // Prevent right overflow
            }}
        >
            <div className="flex items-center justify-between mb-3 border-b pb-2">
                <span className="font-bold text-primary text-base">{getVehicleById(hoveredInfo.res.vehicleId)?.model}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-mono">{getVehicleById(hoveredInfo.res.vehicleId)?.plate}</span>
            </div>
            <div className="space-y-2 text-gray-700">
                <p><span className="font-semibold text-gray-900">Solicitante:</span> {hoveredInfo.res.requesterName}</p>
                <p><span className="font-semibold text-gray-900">Setor:</span> {hoveredInfo.res.department}</p>
                <p><span className="font-semibold text-gray-900">Destino:</span> {hoveredInfo.res.destinationCity} - {hoveredInfo.res.destination}</p>
                 <p><span className="font-semibold text-gray-900">Horário:</span> {new Date(hoveredInfo.res.departureDateTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} - {new Date(hoveredInfo.res.returnDate).toLocaleDateString('pt-BR', {day: '2-digit', month:'2-digit'})}</p>
                {hoveredInfo.res.purpose && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs italic text-gray-600 border border-gray-100">
                        "{hoveredInfo.res.purpose}"
                    </div>
                )}
            </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <button onClick={handlePrevMonth} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-green-800">&lt;</button>
        <h2 className="text-xl font-bold text-gray-800">
          {monthNames[currentDate.getMonth()]} de {currentDate.getFullYear()}
        </h2>
        <button onClick={handleNextMonth} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-green-800">&gt;</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(wd => <div key={wd} className="text-center font-semibold text-gray-600 py-2 text-sm md:text-base">{wd}</div>)}
        {days.map((d, index) => {
          const dateKey = d.toDateString();
          const dayReservations = (reservationsByDate[dateKey] || []).sort((a,b) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime());
          const isCurrentMonth = d.getMonth() === currentDate.getMonth();
          const isToday = d.toDateString() === new Date().toDateString();

          return (
            <div
              key={index}
              className={`border rounded-md p-1 md:p-2 min-h-[100px] md:min-h-[140px] flex flex-col ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'} ${isToday ? 'border-2 border-accent' : 'border-gray-200'}`}
            >
              <span className={`font-semibold text-xs md:text-sm mb-1 ${isCurrentMonth ? 'text-gray-800' : 'text-gray-400'}`}>{d.getDate()}</span>
              
              <div className="flex-1 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                {dayReservations.map(res => {
                    const vehicle = getVehicleById(res.vehicleId);
                    const time = new Date(res.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const firstName = res.requesterName.split(' ')[0];
                    
                    return (
                      <div 
                        key={res.id} 
                        className="bg-primary text-white p-1 rounded cursor-pointer hover:bg-green-700 transition-colors shadow-sm text-left group" 
                        onClick={() => handleOpenEditModal(res)}
                        onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredInfo({
                                res,
                                x: rect.right, 
                                y: rect.top
                            });
                        }}
                        onMouseLeave={() => setHoveredInfo(null)}
                      >
                        <div className="flex flex-col">
                             <span className="font-bold truncate text-[10px] md:text-xs leading-tight">{time} {firstName}</span>
                             <span className="truncate text-[9px] md:text-[10px] opacity-90 leading-tight">{vehicle?.model}</span>
                        </div>
                      </div>
                    )
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;
