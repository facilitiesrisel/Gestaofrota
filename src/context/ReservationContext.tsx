import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { Reservation, ReservationStatus, Vehicle, DailyTrip, FuelLevel } from '../types_reserva';
import * as firebaseApi from '../services/firebaseService';
import { useReservationAuth } from './ReservationAuthContext';
import { ADMIN_EMAIL_RECIPIENTS } from '../constants_reserva';
import { getSubmoduleRecipientsSync } from '../services/emailRecipientsService';
import { sendEmail, generateEmailHtml } from '../services/firebaseService';
import { fetchFleetPositions } from '../services/geoFrotasService';
import { VEICULOS_REAIS } from '../data/veiculos_reais';
import { checkAndTriggerPerimeterExitAlerts, PerimeterVehicleEvent } from '../services/perimeterAlertService';

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
  runPerimeterCheck: () => Promise<PerimeterVehicleEvent[]>;
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
              try {
                localStorage.setItem('risel_reserva_vehicles', JSON.stringify(data));
              } catch (e) {}
            } else {
              setVehicles(getInitialFleetVehicles());
            }
            try {
              window.dispatchEvent(new Event('risel_reserva_data_updated'));
            } catch (e) {}
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
            try {
              localStorage.setItem('risel_reservations', JSON.stringify(data));
              window.dispatchEvent(new Event('risel_reservations_updated'));
              window.dispatchEvent(new Event('risel_reserva_data_updated'));
            } catch (e) {}
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
            try {
              localStorage.setItem('risel_daily_trips', JSON.stringify(data));
              localStorage.setItem('risel_frota_daily_trips', JSON.stringify(data));
              window.dispatchEvent(new Event('risel_daily_trip_updated'));
              window.dispatchEvent(new Event('risel_reserva_data_updated'));
            } catch (e) {}
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
    setReservations(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    await firebaseApi.updateReservation(id, data);

    // Se o status foi alterado para Concluída e possui KM Final, atualiza direto no cadastro do veículo
    if (data.status === ReservationStatus.Completed && data.finalKm !== undefined && data.finalKm !== null && Number(data.finalKm) > 0) {
      const finalKmNum = Number(data.finalKm);
      const targetVehicleId = data.vehicleId || reservations.find(r => r.id === id)?.vehicleId;
      if (targetVehicleId) {
        setVehicles(prev => prev.map(v => v.id === targetVehicleId ? { ...v, lastKm: finalKmNum } : v));
        try {
          await firebaseApi.updateVehicle(targetVehicleId, { lastKm: finalKmNum });
          checkAndSendMaintenanceAlert(targetVehicleId, finalKmNum);
        } catch (vehErr) {
          console.warn("Aviso ao atualizar KM do veículo na conclusão de reserva:", vehErr);
        }
      }
    }
  }, [reservations]);

  // AUTO-START RESERVATIONS Logic (com margem de tolerância operacional)
  useEffect(() => {
    // Apenas administradores logados devem processar essa automação para evitar conflitos ou erros de permissão
    if (!user || user.isAnonymous || reservations.length === 0) return;

    const checkAutoStartReservations = async () => {
        const now = new Date();
        
        // Filtra reservas que estão Aprovadas E cujo horário de saída já passou há pelo menos 10 minutos
        const reservationsToStart = reservations.filter(r => 
            r.status === ReservationStatus.Approved && 
            (new Date(r.departureDateTime).getTime() + (10 * 60 * 1000)) <= now.getTime()
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
    // Não executa imediatamente no mount para evitar concorrência com o carregamento de dados
    const initialTimer = setTimeout(checkAutoStartReservations, 5000);

    return () => {
        clearInterval(interval);
        clearTimeout(initialTimer);
    };
  }, [reservations, user, updateReservation]);

  // MONITORAMENTO DE PERÍMETRO DA SEDE (PAULÍNIA/SP):
  // Detecta quando um veículo sai do perímetro da sede sem reserva ou agendamento de uso diário ativo
  // e dispara e-mail informativo automático a todos os usuários com acesso ao sistema.
  const runPerimeterCheck = useCallback(async (): Promise<PerimeterVehicleEvent[]> => {
    try {
      const positions = await fetchFleetPositions();
      if (!positions || positions.length === 0) return [];
      const events = await checkAndTriggerPerimeterExitAlerts(positions, vehicles, reservations, dailyTrips);
      return events;
    } catch (e) {
      console.warn("Erro ao executar checagem de perímetro da sede:", e);
      return [];
    }
  }, [vehicles, reservations, dailyTrips]);

  useEffect(() => {
    // Apenas monitora se houver veículos e não for usuário anônimo
    if (authLoading || isLoading) return;

    const executePerimeterAudit = async () => {
      try {
        await runPerimeterCheck();
      } catch (err) {
        console.warn("Auditoria periódica de perímetro falhou:", err);
      }
    };

    // Primeira checagem após 15 segundos da inicialização do contexto
    const timer = setTimeout(executePerimeterAudit, 15000);
    // Intervalo contínuo de checagem a cada 90 segundos
    const interval = setInterval(executePerimeterAudit, 90000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [runPerimeterCheck, authLoading, isLoading]);

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
         
         const recipients = Array.from(new Set([
           'deny.goncalves@risel.com.br',
           'lorena.padilha@risel.com.br',
           ...getSubmoduleRecipientsSync('manutencao'),
           ...ADMIN_EMAIL_RECIPIENTS
         ]));
         
         sendEmail(recipients, subject, emailHtml, {
           fromName: "Controle de Frotas",
           source: "frota"
         }).catch(err => console.error("Failed to send maintenance alert", err));
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

    if (finalKm === null || finalKm === undefined || Number(finalKm) <= 0) {
      throw new Error("É obrigatório informar o KM Final do veículo para concluir a reserva.");
    }

    const finalKmNum = Number(finalKm);

    try {
      const updateData: any = {
        status: ReservationStatus.Completed,
        actualReturnDateTime,
        finalKm: finalKmNum,
      };

      // Atualiza o cadastro do veículo imediatamente na UI e no backend
      setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, lastKm: finalKmNum } : v));
      await firebaseApi.updateVehicle(vehicleId, { lastKm: finalKmNum });
      checkAndSendMaintenanceAlert(vehicleId, finalKmNum);

      // Atualiza a reserva na UI e no backend
      setReservations(prev => prev.map(r => r.id === id ? { ...r, ...updateData } : r));
      await firebaseApi.updateReservation(id, updateData);
      
    } catch (error) {
      console.error("Error finalizing reservation:", error);
      throw error instanceof Error ? error : new Error("Ocorreu um erro ao finalizar a reserva.");
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
        runPerimeterCheck,
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
