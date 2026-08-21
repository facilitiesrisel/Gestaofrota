
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import ReservationsView from './ReservationsView';
import RacRentalsView from './RacRentalsView';
import VehiclesView from './VehiclesView';
import DailyUseView from './DailyUseView';
import FleetStatusView from './FleetStatusView';
import DashboardView from './DashboardView';
import MapView from './MapView';
import HelpGuideModal from './HelpGuideModal';
import SettingsView from './SettingsView';
import { MenuIcon, DashboardIcon, MapPinIcon, DocumentTextIcon, ClipboardListIcon, CarIcon } from './icons';
import { ChartConfig } from './CustomChartBuilderModal';
import { onDashboardSettingsChange, updateDashboardSettings } from '../../services/firebaseService';
import { ReservationStatus } from '../../types_reserva';

interface AdminDashboardProps {
  onLogout: () => void;
}

// Default gallery updated with modern BI visualizations (Treemaps, Composed, Areas, Radars and Donuts)
const DEFAULT_GALLERY: ChartConfig[] = [
    // --- Reservations Charts (6 charts = 3 rows of 2) ---
    {
        id: 100,
        title: 'Total de Reservas por Status',
        dataSource: 'reservations',
        dimension: 'status',
        metric: 'count',
        chartType: 'pie',
        filters: {}
    },
    {
        id: 106,
        title: 'Evolução Mensal de Reservas',
        dataSource: 'reservations',
        dimension: 'month',
        metric: 'count',
        chartType: 'area',
        filters: {}
    },
    {
        id: 102,
        title: 'Distribuição por Setor Solicitante',
        dataSource: 'reservations',
        dimension: 'department',
        metric: 'count',
        chartType: 'pie',
        filters: {}
    },
    {
        id: 105,
        title: 'Destinos Mais Visitados (Cidades)',
        dataSource: 'reservations',
        dimension: 'destinationCity',
        metric: 'count',
        chartType: 'treemap',
        filters: {}
    },
    {
        id: 107,
        title: 'Reservas por Dia da Semana',
        dataSource: 'reservations',
        dimension: 'weekday',
        metric: 'count',
        chartType: 'radar',
        filters: {}
    },
    {
        id: 101,
        title: 'Volume de Reservas por Veículo',
        dataSource: 'reservations',
        dimension: 'vehicle',
        metric: 'count',
        chartType: 'composed',
        filters: {}
    },
    // --- Daily Use Charts (4 charts = 2 rows of 2) ---
    {
        id: 206,
        title: 'Evolução Mensal de Viagens',
        dataSource: 'dailyUse',
        dimension: 'month',
        metric: 'count',
        chartType: 'area',
        filters: {}
    },
    {
        id: 207,
        title: 'Histórico de KM Rodados por Mês',
        dataSource: 'dailyUse',
        dimension: 'month',
        metric: 'sum_km',
        chartType: 'composed',
        filters: {}
    },
    {
        id: 209,
        title: 'Quilometragem por Faixa de Horário',
        dataSource: 'dailyUse',
        dimension: 'timeRange',
        metric: 'sum_km',
        chartType: 'radar',
        filters: {}
    },
    {
        id: 201,
        title: 'Quilometragem Total por Veículo (Uso Diário)',
        dataSource: 'dailyUse',
        dimension: 'vehicle',
        metric: 'sum_km',
        chartType: 'bar',
        filters: {}
    },
    // --- Vehicles Charts (2 charts = 1 row of 2) ---
    {
        id: 301,
        title: 'Distribuição de Veículos por Base Operacional',
        dataSource: 'vehicles',
        dimension: 'base',
        metric: 'count',
        chartType: 'pie',
        filters: {}
    },
    {
        id: 302,
        title: 'Veículos por Modelo',
        dataSource: 'vehicles',
        dimension: 'model',
        metric: 'count',
        chartType: 'treemap',
        filters: {}
    }
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = searchParams.get("sub") || "dashboard";
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [customCharts, setCustomCharts] = useState<ChartConfig[]>([]);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const setCurrentView = (view: string) => {
    if (view === 'logout_reservas') {
      onLogout();
    } else {
      setSearchParams({ tab: 'reservas', sub: view });
    }
  };

  useEffect(() => {
    if (currentView === 'logout_reservas') {
      onLogout();
      setSearchParams({ tab: 'reservas', sub: 'login' });
    }
  }, [currentView, onLogout, setSearchParams]);

  // Load dashboard settings
  useEffect(() => {
    const unsubscribe = onDashboardSettingsChange(
      (settings) => {
        if (settings && settings.dashboardCharts && settings.dashboardCharts.length > 0) {
          setCustomCharts(settings.dashboardCharts);
        } else {
          // Initialize with default gallery if no settings found
          setCustomCharts(DEFAULT_GALLERY);
        }
        setIsSettingsLoaded(true);
      },
      (error) => {
        console.error("Error loading dashboard settings:", error);
        setSettingsError("Failed to load dashboard customization.");
        // Fallback to defaults on error
        setCustomCharts(DEFAULT_GALLERY);
        setIsSettingsLoaded(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleChartsChange = (newCharts: ChartConfig[]) => {
    setCustomCharts(newCharts);
    updateDashboardSettings({ dashboardCharts: newCharts }).catch(err => {
        console.error("Failed to save dashboard charts:", err);
        // Optionally show a toast error here
    });
  };

  const viewTitles: { [key: string]: string } = {
    dashboard: 'Dashboard Analítico',
    reservations: 'Gestão de Reservas',
    dailyUse: 'Uso Diário',
    racRentals: 'Locações RAC',
    vehicles: 'Veículos',
    fleetStatus: 'Status da Frota',
    monitoring: 'Monitoramento (Mapa)',
    settings: 'Configurações do Sistema',
  };

  useEffect(() => {
    if (viewTitles[currentView]) {
        document.title = `Admin | ${viewTitles[currentView]}`;
    }
  }, [currentView]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView customCharts={customCharts} onChartsChange={handleChartsChange} canEditDashboard={true} />;
      case 'monitoring':
        return <MapView />;
      case 'reservations':
        return <ReservationsView />;
      case 'dailyUse':
        return <DailyUseView />;
      case 'racRentals':
        return <RacRentalsView />;
      case 'vehicles':
        return <VehiclesView />;
      case 'fleetStatus':
        return <FleetStatusView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView customCharts={customCharts} onChartsChange={handleChartsChange} canEditDashboard={true} />;
    }
  };

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50">
      <HelpGuideModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} type="admin" />
      
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden transition-all duration-300">
        <main className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
