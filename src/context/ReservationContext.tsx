import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { Reservation, ReservationStatus, Vehicle, DailyTrip, FuelLevel } from '../types_reserva';
import * as firebaseApi from '../services/firebaseService';
import { useReservationAuth } from './ReservationAuthContext';
import { ADMIN_EMAIL_RECIPIENTS } from '../constants_reserva';
import { sendEmail, generateEmailHtml } from '../services/firebaseService';
import { fetchFleetPositions } from '../services/geoFrotasService';
import { VEICULOS_REAIS } from '../data/veiculos_reais';

// Converte os 75 veículos reais cadastrados no sistema para o formato do módulo de reservas
const getInitialFleetVehicles = (): Vehicle[] => {
  try {
    const stored = localStorage.getItem('risel_frota_veiculos_v2');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((v: any) => ({
          id: v.id || `v-${(v.placa || v.plate || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          model: v.modelo || v.model || 'Veículo',
          plate: (v.placa || v.plate || '').toUpperCase().trim(),
          year: Number(v.ano || v.year) || 2024,
          initialKm: Number(v.odometro || v.initialKm) || 0,
          lastKm: Number(v.odometro || v.lastKm) || 0,
          isActive: v.status !== "Inativo" && v.isActive !== false,
          type: (v.funcao && v.funcao.toLowerCase().includes('gest')) || v.type === 'Gestão' ? 'Gestão' : 'Operações',
          isManual: Boolean(v.isManual)
        }));
      }
    }
  } catch (e) {
    console.warn("Erro ao carregar veículos de localStorage no ReservationContext:", e);
  }

  return VEICULOS_REAIS.map(v => ({
    id: v.id || `v-${v.placa.toLowerCase()}`,
    model: v.modelo,
    plate: v.placa,
    year: 2024,
    initialKm: 0,
    lastKm: v.odometro || 0,
    isActive: v.status !== "Inativo",
    type: (v.funcao && v.funcao.toLowerCase().includes('gest') ? 'Gestão' : 'Operações') as 'Operações' | 'Gestão',
    isManual: false
  }));
};

interface ReservationContextType {
  vehicles: Vehicle[];
  reservations: Reservation[];
  dailyTrips: DailyTrip[];
  isLoading: boolean;
  permissionError: boolean;
  addReservation: (reservation: Omit<Reservation, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'requestTimestamp'>) => Promise<void>;
  updateReservation: (id: string, data: Partial<Omit<Reservation, 'id'>>) => Promise<void>;
  deleteReservation: (id: string) => Promise<void>;
  finalizeReservation: (id: string, vehicleId: string, finalKm: number | null, actualReturnDateTime: Date) => Promise<void>;
  addDailyTrip: (tripData: Omit<DailyTrip, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'finalFuelLevel'>) => Promise<string>;
  endTrip: (tripId: string, returnDateTime: Date, finalKm: number, finalFuelLevel: FuelLevel) => Promise<void>;
  updateDailyTrip: (id: string, data: Partial<Omit<DailyTrip, 'id'>>) => Promise<void>;
  deleteDailyTrip: (id: string) => Promise<void>;
  getVehicleById: (id: string) => Vehicle | undefined;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<void>;
  updateVehicle: (vehicle: Vehicle) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  syncVehiclesFromGeoFrotas: () => Promise<number>;
}

const ReservationContext = createContext<ReservationContextType | undefined>(undefined);

export const ReservationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(getInitialFleetVehicles);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dailyTrips, setDailyTrips] = useState<DailyTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const { user, loading: authLoading } = useReservationAuth();

  useEffect(() => {
    // If auth is still loading, wait.
    if (authLoading) return;

    setIsLoading(true);
    setPermissionError(false);

    let vehiclesLoaded = false;
    let reservationsLoaded = false;
    let dailyLoaded = false;

    const checkLoadingComplete = () => {
        if (vehiclesLoaded && reservationsLoaded && dailyLoaded) {
            setIsLoading(false);
        }
    };

    // Subscribe to real-time updates
    const unsubVehicles = firebaseApi.subscribeToVehicles(
        (data) => {
            if (data && data.length > 0) {
              setVehicles(data);
            } else {
              setVehicles(getInitialFleetVehicles());
            }
            vehiclesLoaded = true;
            checkLoadingComplete();
        },
        (error) => {
            console.error("Vehicles sync error:", error);
            setVehicles(getInitialFleetVehicles());
            vehiclesLoaded = true;
            checkLoadingComplete();
        }
    );

    const unsubReservations = firebaseApi.subscribeToReservations(
        (data) => {
            setReservations(data);
            reservationsLoaded = true;
            checkLoadingComplete();
        },
        (error) => {
            console.error("Reservations sync error:", error);
            if (error.code === 'permission-denied' && (!user || user.isAnonymous)) {
                setPermissionError(true);
            }
            reservationsLoaded = true;
            checkLoadingComplete();
        }
    );

    const unsubDaily = firebaseApi.subscribeToDailyUseTrips(
        (data) => {
            setDailyTrips(data);
            dailyLoaded = true;
            checkLoadingComplete();
        },
        (error) => {
            console.error("Daily trips sync error:", error);
            dailyLoaded = true;
            checkLoadingComplete();
        }
    );

    return () => {
        unsubVehicles();
        unsubReservations();
        unsubDaily();
    };
  }, [user, authLoading]);

  const updateReservation = useCallback(async (id: string, data: Partial<Omit<Reservation, 'id'>>) => {
    await firebaseApi.updateReservation(id, data);
  }, []);

  // AUTO-START RESERVATIONS Logic
  useEffect(() => {
    // Apenas administradores logados devem processar essa automação para evitar conflitos ou erros de permissão
    if (!user || user.isAnonymous || reservations.length === 0) return;

    const checkAutoStartReservations = async () => {
        const now = new Date();
        
        // Filtra reservas que estão Aprovadas E cujo horário de saída já passou
        const reservationsToStart = reservations.filter(r => 
            r.status === ReservationStatus.Approved && 
            new Date(r.departureDateTime) <= now
        );

        if (reservationsToStart.length > 0) {
            console.log(`Auto-starting ${reservationsToStart.length} reservations...`);
            
            // Atualiza cada uma para 'InUse'
            for (const res of reservationsToStart) {
                try {
                   await updateReservation(res.id, { status: ReservationStatus.InUse });
                } catch (err) {
                    console.error(`Failed to auto-start reservation ${res.id}`, err);
                }
            }
        }
    };

    // Verifica a cada 60 segundos
    const interval = setInterval(checkAutoStartReservations, 60000);
    checkAutoStartReservations(); // Verifica também ao carregar

    return () => clearInterval(interval);
  }, [reservations, user, updateReservation]);

  const getVehicleById = useCallback((id: string) => {
    if (!id) return undefined;
    const cleanId = id.toString().trim().toUpperCase();
    return vehicles.find(v => v.id === id || v.plate.trim().toUpperCase() === cleanId);
  }, [vehicles]);
  
  // Helper: Check maintenance and send email if needed
  const checkAndSendMaintenanceAlert = async (vehicleId: string, currentKm: number) => {
     const vehicle = vehicles.find(v => v.id === vehicleId);
     if (!vehicle) return;

     // 1. Check KM Logic (10,000 km interval)
     const lastServiceKm = vehicle.lastServiceKm || 0;
     const nextServiceKm = lastServiceKm + 10000;
     const remainingKm = nextServiceKm - currentKm;

     // 2. Check Date Logic (1 Year interval)
     let remainingDays = null;
     let nextServiceDate = null;
     if (vehicle.lastServiceDate) {
         const lastDate = new Date(vehicle.lastServiceDate);
         nextServiceDate = new Date(lastDate);
         nextServiceDate.setFullYear(lastDate.getFullYear() + 1);
         
         const now = new Date();
         const diffTime = nextServiceDate.getTime() - now.getTime();
         remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
     }

     const alerts: string[] = [];
     let isCritical = false;

     // Evaluate KM
     if (remainingKm < 0) {
         alerts.push(`🔴 KM VENCIDO: Excedeu ${Math.abs(remainingKm).toLocaleString('pt-BR')} km do limite.`);
         isCritical = true;
     } else if (remainingKm <= 500) {
         alerts.push(`🟡 KM CRÍTICO: Restam apenas ${remainingKm.toLocaleString('pt-BR')} km.`);
         isCritical = true;
     } else if (remainingKm <= 1000) {
         alerts.push(`🟢 KM PRÓXIMO: Restam ${remainingKm.toLocaleString('pt-BR')} km.`);
     }

     // Evaluate Date
     if (remainingDays !== null) {
         if (remainingDays < 0) {
             alerts.push(`🔴 DATA VENCIDA: Atrasado há ${Math.abs(remainingDays)} dias.`);
             isCritical = true;
         } else if (remainingDays <= 15) {
             alerts.push(`🟡 DATA CRÍTICA: Restam ${remainingDays} dias.`);
             isCritical = true;
         } else if (remainingDays <= 30) {
             alerts.push(`🟢 DATA PRÓXIMA: Restam ${remainingDays} dias.`);
         }
     }

     if (alerts.length > 0) {
         const statusLabel = isCritical ? "MANUTENÇÃO CRÍTICA/VENCIDA" : "ALERTA DE MANUTENÇÃO";
         const statusColor = isCritical ? "#dc2626" : "#eab308"; // Red or Yellow
         const subject = `${isCritical ? '🚨' : '⚠️'} Alerta de Manutenção: ${vehicle.model} (${vehicle.plate})`;

         const emailHtml = generateEmailHtml(
             statusLabel,
             [
                 { label: "Veículo", value: `${vehicle.model} - ${vehicle.plate}` },
                 { label: "Alertas Identificados", value: alerts.join('<br/>') },
                 { label: "KM Atual", value: `${currentKm.toLocaleString('pt-BR')} km` },
                 { label: "Última Revisão (KM)", value: `${lastServiceKm.toLocaleString('pt-BR')} km` },
                 { label: "Próxima Revisão (KM)", value: `${nextServiceKm.toLocaleString('pt-BR')} km` },
                 { label: "Última Revisão (Data)", value: vehicle.lastServiceDate ? new Date(vehicle.lastServiceDate).toLocaleDateString('pt-BR') : 'N/A' },
                 { label: "Próxima Revisão (Data)", value: nextServiceDate ? nextServiceDate.toLocaleDateString('pt-BR') : 'N/A' }
             ],
             statusColor,
             undefined,
             "O veículo atingiu os parâmetros de alerta para manutenção preventiva."
         );
         
         sendEmail(ADMIN_EMAIL_RECIPIENTS, subject, emailHtml).catch(err => console.error("Failed to send maintenance alert", err));
     }
  };

  const addReservation = useCallback(async (reservationData: Omit<Reservation, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'requestTimestamp'>) => {
    await firebaseApi.addReservation(reservationData);
  }, []);
  
  const deleteReservation = useCallback(async (id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    try {
      await firebaseApi.deleteReservation(id);
    } catch (err) {
      console.warn("deleteReservation error:", err);
    }
  }, []);
  
  const finalizeReservation = useCallback(async (id: string, vehicleId: string, finalKm: number | null, actualReturnDateTime: Date) => {
    const reservation = reservations.find(r => r.id === id);
    if (!reservation) {
        console.error("Reservation not found for finalization:", id);
        throw new Error("Reserva não encontrada para finalizar.");
    }

    try {
      const updateData: any = {
        status: ReservationStatus.Completed,
        actualReturnDateTime,
      };

      // Only update KM if provided
      if (finalKm !== null && finalKm > 0) {
          updateData.finalKm = finalKm;
          await firebaseApi.updateVehicle(vehicleId, { lastKm: finalKm });
          checkAndSendMaintenanceAlert(vehicleId, finalKm);
      }

      await firebaseApi.updateReservation(id, updateData);
      
    } catch (error) {
      console.error("Error finalizing reservation:", error);
      throw new Error("Ocorreu um erro ao finalizar a reserva.");
    }
  }, [reservations, vehicles]);

  const addDailyTrip = useCallback(async (tripData: Omit<DailyTrip, 'id' | 'status' | 'actualReturnDateTime' | 'finalKm' | 'finalFuelLevel'>) => {
    try {
        const newTripId = await firebaseApi.addDailyUseTrip(tripData);
        return newTripId;
    } catch (error: any) {
        console.error("Error adding daily trip:", error);
        if (error.code === 'permission-denied' || error.message?.toString().toLowerCase().includes('permission') || error.message?.toString().includes('insufficient permissions')) {
            setPermissionError(true);
            throw new Error("Permissão negada. Verifique as regras de segurança do Firestore.");
        }
        throw error;
    }
  }, []);
  
  const endTrip = useCallback(async (tripId: string, returnDateTime: Date, finalKm: number, finalFuelLevel: FuelLevel) => {
      const trip = dailyTrips.find(t => t.id === tripId);
      if (!trip) {
          console.error("Trip not found for ending:", tripId);
          throw new Error("Viagem não encontrada. Não foi possível finalizar.");
      }
      
      // STEP 1: End the Trip (Update DailyUse Collection)
      try {
        await firebaseApi.endDailyUseTrip(tripId, { actualReturnDateTime: returnDateTime, finalKm, finalFuelLevel });
      } catch (error: any) {
        console.error("Error ending trip (dailyUse update):", error);
        if (error.code === 'permission-denied' || error.message?.toString().toLowerCase().includes('permission') || error.message?.toString().includes('insufficient permissions')) {
            setPermissionError(true);
            throw new Error("Permissão negada ao finalizar viagem. Verifique as regras de segurança do Firestore.");
        }
        throw new Error("Falha ao finalizar a viagem. Verifique sua conexão e tente novamente.");
      }

      // STEP 2: Update Vehicle Odometer (Update Vehicles Collection)
      try {
        await firebaseApi.updateVehicle(trip.vehicleId, { lastKm: finalKm });
        checkAndSendMaintenanceAlert(trip.vehicleId, finalKm);
      } catch (error: any) {
        console.warn("Warning: Failed to update vehicle mileage after ending trip (likely permission issue):", error);
      }
  }, [dailyTrips, vehicles]);

  const updateDailyTrip = useCallback(async (id: string, data: Partial<Omit<DailyTrip, 'id'>>) => {
    try {
        await firebaseApi.updateDailyUseTrip(id, data);
    } catch (error: any) {
        console.error("Error updating daily trip:", error);
        if (error.code === 'permission-denied' || error.message?.toString().toLowerCase().includes('permission')) {
            setPermissionError(true);
        }
        throw new Error("Falha ao atualizar a viagem de uso diario.");
    }
  }, [dailyTrips, vehicles]);

  const deleteDailyTrip = useCallback(async (id: string) => {
    setDailyTrips(prev => prev.filter(t => t.id !== id));
    try {
      await firebaseApi.deleteDailyUseTrip(id);
    } catch (err) {
      console.warn("deleteDailyTrip error:", err);
    }
  }, []);

  const addVehicle = useCallback(async (vehicleData: Omit<Vehicle, 'id'>) => {
    const dataWithManual = {
      ...vehicleData,
      isManual: vehicleData.isManual !== false
    };
    await firebaseApi.addVehicle(dataWithManual);
  }, []);

  const updateVehicle = useCallback(async (updatedVehicle: Vehicle) => {
    // Only extract valid vehicle fields to avoid saving extended UI properties to Firestore
    const vehicleData: any = {
        model: updatedVehicle.model,
        plate: updatedVehicle.plate,
        year: updatedVehicle.year,
        initialKm: updatedVehicle.initialKm,
        lastKm: updatedVehicle.lastKm,
        lastServiceDate: updatedVehicle.lastServiceDate,
        lastServiceKm: updatedVehicle.lastServiceKm,
        lastWashDate: updatedVehicle.lastWashDate,
        isActive: updatedVehicle.isActive,
        type: updatedVehicle.type,
        isManual: updatedVehicle.isManual !== false
    };
    
    // Clean up undefined properties manually if any
    Object.keys(vehicleData).forEach(key => vehicleData[key] === undefined && delete vehicleData[key]);

    await firebaseApi.updateVehicle(updatedVehicle.id, vehicleData);
    if (vehicleData.lastKm) {
        checkAndSendMaintenanceAlert(updatedVehicle.id, vehicleData.lastKm);
    }
  }, [vehicles]);

  const deleteVehicle = useCallback(async (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
    try {
      await firebaseApi.deleteVehicle(id);
    } catch (err) {
      console.warn("deleteVehicle error:", err);
    }
  }, []);

  const clearAllData = useCallback(async () => {
      setIsLoading(true);
      try {
          const reservationPromises = reservations.map(r => firebaseApi.deleteReservation(r.id));
          const dailyTripPromises = dailyTrips.map(t => firebaseApi.deleteDailyUseTrip(t.id));
          
          await Promise.all([...reservationPromises, ...dailyTripPromises]);
      } catch (e) {
          console.error("Failed to clear data:", e);
          throw e;
      } finally {
          setIsLoading(false);
      }
  }, [reservations, dailyTrips]);

  const syncVehiclesFromGeoFrotas = useCallback(async (): Promise<number> => {
    // A importação automática de veículos foi desativada.
    // A única maneira de inserir e inativar veículos na Gestão de Reservas é de forma manual no Menu Frota de Veículos.
    return 0;
  }, []);

  return (
    <ReservationContext.Provider value={{ 
        vehicles, 
        reservations, 
        dailyTrips, 
        isLoading, 
        permissionError,
        addReservation,
        updateReservation,
        deleteReservation,
        finalizeReservation,
        addDailyTrip,
        endTrip,
        updateDailyTrip,
        deleteDailyTrip,
        getVehicleById,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        clearAllData,
        syncVehiclesFromGeoFrotas,
    }}>
      {children}
    </ReservationContext.Provider>
  );
};

export const useReservations = () => {
  const context = useContext(ReservationContext);
  if (context === undefined) {
    throw new Error('useReservations deve ser usado dentro de um ReservationProvider');
  }
  return context;
};
