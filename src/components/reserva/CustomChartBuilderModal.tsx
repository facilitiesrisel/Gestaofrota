
import React, { useState, useMemo, useEffect } from 'react';
import { useReservations } from '../../context/ReservationContext';
import Modal from './Modal';
import { ReservationStatus, DailyTrip } from '../../types_reserva';

export interface ChartConfig {
    id: number;
    title: string;
    dataSource: 'reservations' | 'dailyUse' | 'vehicles';
    dimension: 'vehicle' | 'department' | 'status' | 'month' | 'year' | 'day' | 'weekday' | 'destinationCity' | 'driverName' | 'requesterName' | 'purpose' | 'role' | 'serviceStatus' | 'washStatus' | 'model' | 'base' | 'timeRange' | 'leadTime' | 'durationRange';
    metric: 'count' | 'sum_km' | 'avg_km' | 'sum_duration_days' | 'avg_duration_days' | 'avg_km_per_trip';
    chartType: 'bar' | 'pie' | 'line' | 'area' | 'radar' | 'scatter' | 'funnel' | 'radialBar' | 'treemap' | 'composed';
    filters: {
        vehicleIds?: string[];
        departments?: string[];
        statuses?: ReservationStatus[];
    }
}

interface CustomChartBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ChartConfig) => void;
  initialConfig?: ChartConfig | null;
  defaultDataSource?: 'reservations' | 'dailyUse' | 'vehicles';
}

// SVG Icons for Looker-Style Selection
const ChartIcons = {
    bar: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    ),
    line: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
    ),
    pie: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
    ),
    area: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19V9l5-4 5 4 4-2v12H5z" fill="currentColor" fillOpacity={0.2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19V9l5-4 5 4 4-2v12H5z" /></svg>
    ),
    radar: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
    ),
    scatter: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><circle cx="5" cy="19" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="15" cy="15" r="2" /><circle cx="19" cy="7" r="2" /><circle cx="8" cy="6" r="2" /></svg>
    ),
    funnel: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18l-2 4H5L3 4zm4 8h10l-2 4H9l-2-4zm2 8h6" /></svg>
    ),
    radialBar: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    treemap: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M3 11h18M11 3v18M11 11h6M17 11v10" strokeWidth={2} /></svg>
    ),
    composed: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /><rect x="3" y="12" width="4" height="8" rx="1" /><rect x="9" y="8" width="4" height="12" rx="1" /></svg>
    )
};

const ChartTypeOption: React.FC<{ type: string, label: string, selected: boolean, onClick: () => void }> = ({ type, label, selected, onClick }) => (
    <div 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${selected ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
        title={label}
    >
        <div className="mb-2">
            {ChartIcons[type as keyof typeof ChartIcons]}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-center">{label}</span>
    </div>
);

const CustomChartBuilderModal: React.FC<CustomChartBuilderModalProps> = ({ isOpen, onClose, onSave, initialConfig, defaultDataSource = 'reservations' }) => {
  const { vehicles, reservations, dailyTrips } = useReservations();

  const [title, setTitle] = useState('Nova Análise');
  const [dataSource, setDataSource] = useState<ChartConfig['dataSource']>('reservations');
  const [dimension, setDimension] = useState<ChartConfig['dimension']>('vehicle');
  const [metric, setMetric] = useState<ChartConfig['metric']>('count');
  const [chartType, setChartType] = useState<ChartConfig['chartType']>('bar');
  const [filterVehicleIds, setFilterVehicleIds] = useState<string[]>([]);
  const [filterDepartments, setFilterDepartments] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<ReservationStatus[]>([]);

  const availableDepartments = useMemo(() => {
    const dataSet = dataSource === 'reservations' ? reservations : dailyTrips;
    const departments = new Set(dataSet.map(r => r.department));
    return Array.from(departments).sort();
  }, [reservations, dailyTrips, dataSource]);

  const dimensionOptions = {
    reservations: [
      { value: 'vehicle', label: 'Veículo (Placa)' },
      { value: 'department', label: 'Setor' },
      { value: 'requesterName', label: 'Solicitante' },
      { value: 'status', label: 'Status da Reserva' },
      { value: 'role', label: 'Função' },
      { value: 'weekday', label: 'Dia da Semana' },
      { value: 'day', label: 'Dia (Evolução Diária)' },
      { value: 'month', label: 'Mês (Evolução Mensal)' },
      { value: 'year', label: 'Ano' },
      { value: 'destinationCity', label: 'Cidade de Destino' },
      { value: 'purpose', label: 'Finalidade / Motivo' },
      { value: 'leadTime', label: 'Antecedência (Lead Time)' },
      { value: 'durationRange', label: 'Faixa de Duração (Dias)' },
      { value: 'timeRange', label: 'Faixa de Horário de Saída' },
    ],
    dailyUse: [
      { value: 'vehicle', label: 'Veículo (Placa)' },
      { value: 'department', label: 'Setor' },
      { value: 'driverName', label: 'Motorista' },
      { value: 'weekday', label: 'Dia da Semana' },
      { value: 'day', label: 'Dia (Evolução Diária)' },
      { value: 'month', label: 'Mês (Evolução Mensal)' },
      { value: 'year', label: 'Ano' },
      { value: 'destinationCity', label: 'Cidade de Destino' },
      { value: 'purpose', label: 'Finalidade' },
      { value: 'timeRange', label: 'Faixa de Horário' },
    ],
    vehicles: [
      { value: 'model', label: 'Modelo do Veículo' },
      { value: 'year', label: 'Ano de Fabricação' },
      { value: 'serviceStatus', label: 'Status da Revisão' },
      { value: 'washStatus', label: 'Status da Lavagem' },
      { value: 'vehicle', label: 'Placa Individual' },
      { value: 'base', label: 'Base Operacional' },
    ]
  };

  const metricOptions = {
    reservations: [
      { value: 'count', label: 'Contagem de Reservas' },
      { value: 'sum_km', label: 'Soma de Distância (KM)' },
      { value: 'avg_km', label: 'Média de Distância (KM)' },
      { value: 'sum_duration_days', label: 'Soma de Duração (Dias)' },
      { value: 'avg_duration_days', label: 'Média de Duração (Dias)' },
    ],
    dailyUse: [
      { value: 'count', label: 'Contagem de Viagens' },
      { value: 'sum_km', label: 'Soma de KM Rodado' },
      { value: 'avg_km_per_trip', label: 'Média de KM por Viagem' },
      { value: 'sum_duration_days', label: 'Soma de Duração (Dias)' },
      { value: 'avg_duration_days', label: 'Média de Duração (Dias)' },
    ],
    vehicles: [
       { value: 'count', label: 'Contagem de Veículos' },
       { value: 'sum_km', label: 'Soma do Odômetro (Frota)' },
       { value: 'avg_km', label: 'Média do Odômetro' },
    ]
  };

  const resetState = (source: ChartConfig['dataSource'] = 'reservations') => {
    setTitle('Nova Análise');
    setDataSource(source);
    setDimension(dimensionOptions[source][0].value as ChartConfig['dimension']);
    setMetric(metricOptions[source][0].value as ChartConfig['metric']);
    setChartType('bar');
    setFilterVehicleIds([]);
    setFilterDepartments([]);
    setFilterStatuses([]);
  };

  useEffect(() => {
    if (isOpen) {
        if (initialConfig) {
            setTitle(initialConfig.title);
            setDataSource(initialConfig.dataSource || 'reservations');
            setDimension(initialConfig.dimension);
            setMetric(initialConfig.metric);
            setChartType(initialConfig.chartType);
            setFilterVehicleIds(initialConfig.filters.vehicleIds || []);
            setFilterDepartments(initialConfig.filters.departments || []);
            setFilterStatuses(initialConfig.filters.statuses || []);
        } else {
            const source = defaultDataSource === 'vehicles' ? 'vehicles' : defaultDataSource === 'dailyUse' ? 'dailyUse' : 'reservations';
            resetState(source);
        }
    }
  }, [isOpen, initialConfig, defaultDataSource]);

  const handleDataSourceRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === 'reservations' || value === 'dailyUse' || value === 'vehicles') {
        const newDataSource = value as ChartConfig['dataSource'];
        setDataSource(newDataSource);
        setDimension(dimensionOptions[newDataSource][0].value as ChartConfig['dimension']);
        setMetric(metricOptions[newDataSource][0].value as ChartConfig['metric']);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
        id: initialConfig ? initialConfig.id : Date.now(),
        title,
        dataSource,
        dimension,
        metric,
        chartType,
        filters: {
            vehicleIds: filterVehicleIds,
            departments: filterDepartments,
            statuses: filterStatuses,
        }
    });
  };

  const handleMultiSelectChange = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
    setter(selectedOptions);
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialConfig ? 'Editar Análise' : 'Criar Análise Avançada'}>
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
        
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Fonte de Dados</label>
            <div className="flex flex-wrap gap-3">
                {[
                    { val: 'reservations', label: 'Reservas' },
                    { val: 'dailyUse', label: 'Uso Diário' },
                    { val: 'vehicles', label: 'Frota' }
                ].map(opt => (
                    <label key={opt.val} className={`flex items-center px-3 py-2 rounded-md cursor-pointer transition-all border ${dataSource === opt.val ? 'bg-white border-primary text-primary shadow-sm' : 'border-transparent hover:bg-white hover:border-slate-300'}`}>
                        <input type="radio" value={opt.val} checked={dataSource === opt.val} onChange={handleDataSourceRadioChange} className="sr-only" />
                        <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                ))}
            </div>
        </div>

        <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Título do Gráfico</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm" placeholder="Ex: Uso por Departamento" />
        </div>
        
        <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Visualização</label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {[
                    {type: 'bar', label: 'Barras'},
                    {type: 'line', label: 'Linha'},
                    {type: 'pie', label: 'Pizza'},
                    {type: 'area', label: 'Área'},
                    {type: 'scatter', label: 'Dispersão'},
                    {type: 'funnel', label: 'Funil'},
                    {type: 'radar', label: 'Radar'},
                    {type: 'radialBar', label: 'Radial'},
                    {type: 'treemap', label: 'Treemap'},
                    {type: 'composed', label: 'Mista'}
                ].map(item => (
                    <ChartTypeOption 
                        key={item.type}
                        type={item.type}
                        label={item.label}
                        selected={chartType === item.type}
                        onClick={() => setChartType(item.type as any)}
                    />
                ))}
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Dimensão (Eixo X)</label>
                <select value={dimension} onChange={e => setDimension(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-white">
                    {dimensionOptions[dataSource].map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Métrica (Valor)</label>
                <select value={metric} onChange={e => setMetric(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-white">
                    {metricOptions[dataSource].map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
        </div>

        <fieldset className="border border-slate-200 p-4 rounded-lg bg-slate-50/50">
            <legend className="text-xs font-bold text-slate-500 uppercase tracking-wide px-2">Filtros (Opcional)</legend>
            <div className="space-y-4 pt-2">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Veículo(s)</label>
                    <select multiple value={filterVehicleIds} onChange={handleMultiSelectChange(setFilterVehicleIds)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm h-24 focus:ring-primary">
                       {vehicles.map(v => <option key={v.id} value={v.id}>{v.model} - {v.plate}</option>)}
                    </select>
                </div>
                
                {dataSource !== 'vehicles' && (
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Setor(es)</label>
                        <select multiple value={filterDepartments} onChange={handleMultiSelectChange(setFilterDepartments)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm h-24 focus:ring-primary">
                        {availableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                )}

                {dataSource === 'reservations' && (
                  <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                      <select multiple value={filterStatuses} onChange={handleMultiSelectChange(setFilterStatuses as any)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm h-24 focus:ring-primary">
                        {Object.values(ReservationStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 italic flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Segure Ctrl (ou Cmd) para selecionar múltiplos itens.
                </p>
            </div>
        </fieldset>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
          <button type="submit" className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">{initialConfig ? 'Atualizar Análise' : 'Criar Gráfico'}</button>
        </div>
      </form>
    </Modal>
  );
};

export default CustomChartBuilderModal;
