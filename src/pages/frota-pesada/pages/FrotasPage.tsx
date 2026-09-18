import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchAllData, saveVeiculo, deleteVeiculo, cleanString, formatInputText } from '../services/storage';
import { Veiculo, Multa } from '../types';
import { 
  Plus, Search, Car, RefreshCw, Edit, Trash2, ArrowUpDown, X, Truck, Hash, 
  Settings, FileText, DollarSign, Filter, ChevronDown, ChevronUp, Calendar, 
  Map as MapIcon, BarChart3, UploadCloud, Info, CheckCircle, PieChart as PieIcon, TrendingUp, Loader2,
  SlidersHorizontal, GripVertical, Check, RotateCcw, CheckSquare, Square, ArrowLeft, ArrowRight, Eye
} from 'lucide-react';
import Loading from '../components/Loading';
import { MercosulPlateBadge } from '../../../components/MercosulPlateBadge';
import { useAuth } from '../../../context/AuthContext';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, AreaChart, Area, PieChart, Pie } from 'recharts';

export interface FrotaColumnConfig {
  id: string;
  label: string;
  category: 'Identificação' | 'Localização & Operação' | 'Custos & Licenciamento';
  minWidth?: string;
  align?: 'left' | 'center' | 'right';
  sortKey: keyof Veiculo;
  defaultVisible?: boolean;
}

export const ALL_FROTA_COLUMNS: FrotaColumnConfig[] = [
  // Categoria: Identificação
  { id: 'status', label: 'Status', category: 'Identificação', minWidth: 'min-w-[95px]', align: 'center', sortKey: 'status', defaultVisible: true },
  { id: 'frota', label: 'Frota', category: 'Identificação', minWidth: 'min-w-[90px]', align: 'center', sortKey: 'id', defaultVisible: true },
  { id: 'placa', label: 'Placa', category: 'Identificação', minWidth: 'min-w-[110px]', align: 'center', sortKey: 'placa', defaultVisible: true },
  { id: 'modelo', label: 'Modelo', category: 'Identificação', minWidth: 'min-w-[140px]', align: 'left', sortKey: 'modelo', defaultVisible: true },
  { id: 'marca', label: 'Marca', category: 'Identificação', minWidth: 'min-w-[110px]', align: 'left', sortKey: 'marca', defaultVisible: false },
  { id: 'ano', label: 'Ano', category: 'Identificação', minWidth: 'min-w-[80px]', align: 'center', sortKey: 'ano', defaultVisible: false },
  { id: 'tipo', label: 'Tipo', category: 'Identificação', minWidth: 'min-w-[110px]', align: 'center', sortKey: 'tipo', defaultVisible: false },
  { id: 'capacidade', label: 'Capacidade', category: 'Identificação', minWidth: 'min-w-[100px]', align: 'right', sortKey: 'capacidade', defaultVisible: false },

  // Categoria: Localização & Operação
  { id: 'filial', label: 'Filial', category: 'Localização & Operação', minWidth: 'min-w-[120px]', align: 'left', sortKey: 'filial', defaultVisible: true },
  { id: 'regiao', label: 'Região', category: 'Localização & Operação', minWidth: 'min-w-[120px]', align: 'left', sortKey: 'regiao', defaultVisible: false },
  { id: 'base', label: 'Base', category: 'Localização & Operação', minWidth: 'min-w-[100px]', align: 'left', sortKey: 'base', defaultVisible: true },
  { id: 'locadora', label: 'Locadora', category: 'Localização & Operação', minWidth: 'min-w-[110px]', align: 'left', sortKey: 'locadora', defaultVisible: true },
  { id: 'proprietario', label: 'Proprietário', category: 'Localização & Operação', minWidth: 'min-w-[120px]', align: 'left', sortKey: 'proprietario', defaultVisible: false },
  { id: 'gestorResp', label: 'Gestor Resp.', category: 'Localização & Operação', minWidth: 'min-w-[140px]', align: 'left', sortKey: 'gestorResp', defaultVisible: true },
  { id: 'condutor', label: 'Condutor', category: 'Localização & Operação', minWidth: 'min-w-[150px]', align: 'left', sortKey: 'condutor', defaultVisible: false },
  { id: 'funcao', label: 'Função', category: 'Localização & Operação', minWidth: 'min-w-[110px]', align: 'left', sortKey: 'funcao', defaultVisible: false },
  { id: 'contatoMotorista', label: 'Contato', category: 'Localização & Operação', minWidth: 'min-w-[120px]', align: 'left', sortKey: 'contatoMotorista', defaultVisible: false },
  { id: 'vencContrato', label: 'Venc. Contrato', category: 'Localização & Operação', minWidth: 'min-w-[110px]', align: 'center', sortKey: 'vencContrato', defaultVisible: false },

  // Categoria: Custos & Licenciamento
  { id: 'validadeLicenciamento', label: 'Licenciamento', category: 'Custos & Licenciamento', minWidth: 'min-w-[110px]', align: 'center', sortKey: 'validadeLicenciamento', defaultVisible: false },
  { id: 'custoLicenciamento2026', label: 'Custo Licenc.', category: 'Custos & Licenciamento', minWidth: 'min-w-[120px]', align: 'right', sortKey: 'custoLicenciamento2026', defaultVisible: false },
  { id: 'custoIpva2026', label: 'Custo IPVA', category: 'Custos & Licenciamento', minWidth: 'min-w-[110px]', align: 'right', sortKey: 'custoIpva2026', defaultVisible: false },
  { id: 'custoMultas2026', label: 'Custo Multas', category: 'Custos & Licenciamento', minWidth: 'min-w-[130px]', align: 'right', sortKey: 'custoMultas2026', defaultVisible: true },
  { id: 'custoTotal2026', label: 'Custo Total / Placa', category: 'Custos & Licenciamento', minWidth: 'min-w-[140px]', align: 'right', sortKey: 'custoTotal2026', defaultVisible: false },
];

export const DEFAULT_FROTA_COLUMNS = ALL_FROTA_COLUMNS
  .filter(c => c.defaultVisible)
  .map(c => c.id);

const FROTA_COLUMNS_STORAGE_KEY = 'risel_frota_visible_columns_v2';
const getUserFrotaColumnsStorageKey = (email?: string) => {
  const cleanEmail = (email || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  return cleanEmail ? `risel_frota_columns_${cleanEmail}` : FROTA_COLUMNS_STORAGE_KEY;
};

const FrotasPage: React.FC = () => {
  const { user } = useAuth();
  const userStorageKey = useMemo(() => getUserFrotaColumnsStorageKey(user?.email), [user?.email]);

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [allMultas, setAllMultas] = useState<Multa[]>([]); 
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVeiculo, setCurrentVeiculo] = useState<Partial<Veiculo>>({ status: 'ATIVO' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Veiculo; direction: 'asc' | 'desc' } | null>(null);

  // --- COLUMN MANAGEMENT STATES ---
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(userStorageKey) || localStorage.getItem(FROTA_COLUMNS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validIds = new Set(ALL_FROTA_COLUMNS.map(c => c.id));
          const filtered = parsed.filter(id => validIds.has(id));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {
      console.error("Erro ao ler colunas salvas de frota:", e);
    }
    return DEFAULT_FROTA_COLUMNS;
  });

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [columnModalTab, setColumnModalTab] = useState<'visibility' | 'order'>('visibility');
  const [columnSearch, setColumnSearch] = useState('');
  const [selectedColumnCategory, setSelectedColumnCategory] = useState<string>('TODAS');
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const saveUserColumnSelection = (cols: string[]) => {
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(cols));
      localStorage.setItem(FROTA_COLUMNS_STORAGE_KEY, JSON.stringify(cols));
    } catch (e) {
      console.error("Erro ao salvar colunas de frota:", e);
    }
  };

  const visibleColumnsDefs = useMemo(() => {
    const colMap = new Map(ALL_FROTA_COLUMNS.map(c => [c.id, c]));
    return visibleColumns
      .map(id => colMap.get(id))
      .filter((col): col is FrotaColumnConfig => Boolean(col));
  }, [visibleColumns]);

  const moveColumn = (colId: string, direction: 'left' | 'right') => {
    setVisibleColumns(prev => {
      const index = prev.indexOf(colId);
      if (index === -1) return prev;
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const [item] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, item);
      saveUserColumnSelection(updated);
      return updated;
    });
  };

  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColumnId(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  };

  const handleDragOver = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== targetColId) {
      setDragOverColumnId(targetColId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const sourceColId = draggedColumnId || e.dataTransfer.getData('text/plain');
    setDraggedColumnId(null);
    setDragOverColumnId(null);

    if (!sourceColId || sourceColId === targetColId) return;

    setVisibleColumns(prev => {
      const fromIndex = prev.indexOf(sourceColId);
      const toIndex = prev.indexOf(targetColId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      saveUserColumnSelection(updated);
      return updated;
    });
  };

  // --- NEW INTEGRATIONS STATES ---
  const [showFleetMap, setShowFleetMap] = useState(false);
  const [showImportZone, setShowImportZone] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, current: 0, status: '' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importMethod, setImportMethod] = useState<'excel' | 'sheets'>('sheets');
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1mwfKdJ_N-eSjTzz7OZL7FVy8bDY-dGr-qj-ujRQHyZ8/edit');
  const [sheetGid, setSheetGid] = useState('413419483');

  // --- FILTER STATES ---
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
      year: '', // Default empty = ALL YEARS (Geral)
      month: '',
      base: ''
  });

  const loadData = async (force: boolean = false) => {
      setLoading(true);
      const data = await fetchAllData(force);
      setVeiculos(data.veiculos);
      setAllMultas(data.multas);
      setLoading(false);
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // --- OPTIONS FOR FILTERS ---
  const availableYears = useMemo(() => {
      const years = new Set<string>();
      const currentYear = new Date().getFullYear();
      years.add(currentYear.toString());
      years.add((currentYear + 1).toString());
      
      allMultas.forEach(m => {
          if (m.dataHoraInfracao) {
              const dt = m.dataHoraInfracao;
              if (dt) {
                  let y = '';
                  if (dt.includes('T')) y = dt.split('T')[0].split('-')[0];
                  else if (dt.includes('-')) y = dt.split('-')[0];
                  else if (dt.includes('/')) {
                      const parts = dt.split(' ')[0].split('/');
                      if (parts.length === 3) y = parts[2];
                  }
                  if (y && y.length === 4) years.add(y);
              }
          }
      });
      return Array.from(years).sort().reverse();
  }, [allMultas]);

  const availableBases = useMemo(() => {
      const bases = new Set(veiculos.map(v => v.filial).filter(Boolean));
      return Array.from(bases).sort();
  }, [veiculos]);

  const months = [
      { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' }, { value: '3', label: 'Março' },
      { value: '4', label: 'Abril' }, { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
      { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Setembro' },
      { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
  ];

  // --- CALCULATION & FILTERING ---
  const processedVeiculos = useMemo(() => {
      // 1. Filtragem Inicial (Busca Texto)
      let result = veiculos.filter(v => {
        const searchRaw = searchTerm.toLowerCase();
        const searchClean = searchRaw.replace(/[^a-z0-9]/g, ''); 
        if (!searchRaw) return true;
        return (
            (v.id && String(v.id).toLowerCase().includes(searchRaw)) ||
            (v.placa && cleanString(v.placa).toLowerCase().includes(searchClean)) ||
            (v.filial && String(v.filial).toLowerCase().includes(searchRaw)) ||
            (v.modelo && String(v.modelo).toLowerCase().includes(searchRaw)) ||
            (v.status && v.status.toLowerCase().includes(searchRaw)) ||
            (v.proprietario && v.proprietario.toLowerCase().includes(searchRaw)) ||
            (v.marca && v.marca.toLowerCase().includes(searchRaw))
        );
      });

      // 2. Filtragem por Base
      if (filters.base) {
          result = result.filter(v => v.filial === filters.base);
      }

      // 3. Recálculo Dinâmico de Multas
      return result.map(v => {
          const cleanPlaca = cleanString(v.placa);
          const cleanId = cleanString(v.id);
          
          const veiculoMultas = allMultas.filter(m => {
              const mPlaca = cleanString(m.placa);
              const mFrota = cleanString(m.frota);
              return (cleanPlaca && mPlaca === cleanPlaca) ||
                     (cleanId && mFrota && mFrota === cleanId);
          });

          const filteredMultas = veiculoMultas.filter(m => {
              const dt = m.dataHoraInfracao;
              if (!dt) return false;
              
              let date: Date;
              if (dt.includes('T')) {
                  date = new Date(dt);
              } else if (dt.includes('/')) {
                  const [day, month, year] = dt.split(' ')[0].split('/');
                  date = new Date(Number(year), Number(month) - 1, Number(day));
              } else if (dt.includes('-')) {
                    date = new Date(dt);
              } else {
                  return false;
              }

              if (isNaN(date.getTime())) return false;

              if (filters.year && date.getFullYear().toString() !== filters.year) return false;
              if (filters.month && (date.getMonth() + 1).toString() !== filters.month) return false;

              return true;
          });

          const totalMultas = filteredMultas.reduce((acc, m) => acc + (m.valorComDesconto || m.valor || 0), 0);
          
          return {
              ...v,
              custoMultas2026: totalMultas, 
              custoTotal2026: (v.custoLicenciamento2026 || 0) + (v.custoIpva2026 || 0) + totalMultas
          };
      });

  }, [veiculos, allMultas, searchTerm, filters]);

  const sortedVeiculos = useMemo(() => {
    if (!sortConfig) return processedVeiculos;
    return [...processedVeiculos].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      const aNum = parseFloat(String(aValue));
      const bNum = parseFloat(String(bValue));
      if (!isNaN(aNum) && !isNaN(bNum)) return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processedVeiculos, sortConfig]);

  // --- DYNAMIC DATA ANALYSIS FOR bento-dashboards ---
  const dashboardData = useMemo(() => {
    const totalVehicles = sortedVeiculos.length;
    const activeVehicles = sortedVeiculos.filter(v => !v.status || v.status.toUpperCase() !== 'INATIVO').length;
    const inactiveVehicles = sortedVeiculos.filter(v => v.status && v.status.toUpperCase() === 'INATIVO').length;
    const maintenanceVehicles = sortedVeiculos.filter(v => v.status && v.status.toUpperCase() === 'MANUTENCAO').length;

    // Total expenses sums
    const totalLicensing = sortedVeiculos.reduce((acc, v) => acc + (v.custoLicenciamento2026 || 0), 0);
    const totalIpva = sortedVeiculos.reduce((acc, v) => acc + (v.custoIpva2026 || 0), 0);
    const totalFines = sortedVeiculos.reduce((acc, v) => acc + (v.custoMultas2026 || 0), 0);
    const totalCombinedExpenses = totalLicensing + totalIpva + totalFines;

    // Grouping by Base (Filial)
    const baseCounts: Record<string, number> = {};
    sortedVeiculos.forEach(v => {
      const b = v.filial ? String(v.filial).toUpperCase().trim() : 'INDETERMINADO';
      baseCounts[b] = (baseCounts[b] || 0) + 1;
    });
    const byBase = Object.keys(baseCounts).map(k => ({
      name: k,
      value: baseCounts[k]
    })).sort((a, b) => b.value - a.value);

    // Grouping by Brand (Marca)
    const brandCounts: Record<string, number> = {};
    sortedVeiculos.forEach(v => {
      const m = v.marca ? String(v.marca).toUpperCase().trim() : 'OUTROS';
      brandCounts[m] = (brandCounts[m] || 0) + 1;
    });
    const byBrand = Object.keys(brandCounts).map(k => ({
      name: k,
      value: brandCounts[k]
    })).sort((a, b) => b.value - a.value).slice(0, 8);

    // Grouping by Model (Modelo)
    const modelCounts: Record<string, number> = {};
    sortedVeiculos.forEach(v => {
      const mod = v.modelo ? String(v.modelo).toUpperCase().trim() : 'OUTROS';
      modelCounts[mod] = (modelCounts[mod] || 0) + 1;
    });
    const byModel = Object.keys(modelCounts).map(k => ({
      name: k,
      value: modelCounts[k]
    })).sort((a, b) => b.value - a.value).slice(0, 8);

    // Grouping by Manufacturing Year (Ano)
    const yearCounts: Record<string, number> = {};
    sortedVeiculos.forEach(v => {
      const yr = v.ano ? String(v.ano).trim() : 'S/D';
      yearCounts[yr] = (yearCounts[yr] || 0) + 1;
    });
    const byYear = Object.keys(yearCounts).map(k => ({
      name: k,
      value: yearCounts[k]
    })).sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return {
      totalVehicles,
      activeVehicles,
      inactiveVehicles,
      maintenanceVehicles,
      totalCombinedExpenses,
      byBase,
      byBrand,
      byModel,
      byYear
    };
  }, [sortedVeiculos]);

  // --- LOCAL EXCEL FILE SPREADSHEET IMPORTER ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    setImportProgress({ total: 0, current: 0, status: 'Lendo e analisando arquivo local...' });
    setImporting(true);

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Dynamic Case Insensitive tab check
        const sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().replace(/\s+/g, '') === 'frotacompleta'
        ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          alert(`ERRO: Aba 'Frota Completa' não foi localizada no arquivo XLSX.`);
          setImporting(false);
          return;
        }

        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);
        if (rawRows.length === 0) {
          alert("ERRO: Nenhum registro de frotas foi localizado nesta planilha.");
          setImporting(false);
          return;
        }

        const mappedVeiculos: Veiculo[] = [];

        for (let row of rawRows) {
          const normRow: any = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.toUpperCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, '')
              .replace(/[\s\W_]+/g, '');
            normRow[cleanKey] = row[key];
          });

          const idValue = normRow.FROTA || normRow.ID || normRow.PREFIXO || normRow.CODIGO || normRow.NFROTA || normRow.VEICULO;
          const placaValue = normRow.PLACA || normRow.PLACAS;
          
          if (!idValue || !placaValue) continue;

          const brand = normRow.MARCA || normRow.FABRICANTE || normRow.MARCABREVE;
          const model = normRow.MODELO || normRow.VEICULO;
          const year = normRow.ANO || normRow.ANOFABRICACAO || normRow.ANOMODELO;
          const filialValue = normRow.FILIAL || normRow.BASE || normRow.UNIDADE;
          const region = normRow.REGIAO || normRow.UF;
          const typeValue = normRow.TIPO || normRow.CATEGORIA || normRow.TIPOVEICULO;
          const capacity = normRow.CAPACIDADE || normRow.CARROCERIA;
          const owner = normRow.PROPRIETARIO || normRow.EMPRESA || normRow.LOCADORA;
          const statusValue = normRow.STATUS || normRow.SITUACAO || 'ATIVO';

          const licValue = normRow.CUSTOLICENCIAMENTO2026 || normRow.LICENCIAMENTO2026 || normRow.CUSTOLICENCIAMENTO;
          const ipvaValue = normRow.CUSTOIPVA2026 || normRow.IPVA2026 || normRow.CUSTOIPVA;
          
          const parseCost = (val: any) => {
            if (val === undefined || val === null) return 0;
            if (typeof val === 'number') return val;
            const cleaned = String(val).replace('R$', '').replace(/\s+/g, '').replace('.', '').replace(',', '.');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
          };

          let licExpDate = '';
          const rawLicDate = normRow.LICENCIAMENTO || normRow.VALIDADELICENCIAMENTO || normRow.VENCIMENTOLICENCIAMENTO;
          if (rawLicDate) {
            if (typeof rawLicDate === 'number') {
              const dateObj = XLSX.SSF.parse_date_code(rawLicDate);
              licExpDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
            } else {
              licExpDate = String(rawLicDate).trim();
            }
          }

          mappedVeiculos.push({
            id: String(idValue).trim(),
            status: String(statusValue).trim().toUpperCase(),
            placa: cleanString(String(placaValue).trim()),
            marca: brand ? String(brand).trim().toUpperCase() : '',
            modelo: model ? String(model).trim().toUpperCase() : '',
            ano: year ? String(year).trim() : '',
            filial: filialValue ? String(filialValue).trim().toUpperCase() : 'OUTROS',
            regiao: region ? String(region).trim().toUpperCase() : '',
            tipo: typeValue ? String(typeValue).trim().toUpperCase() : '',
            capacidade: capacity ? String(capacity).trim() : '',
            proprietario: owner ? String(owner).trim().toUpperCase() : '',
            validadeLicenciamento: licExpDate,
            custoLicenciamento2026: parseCost(licValue),
            custoIpva2026: parseCost(ipvaValue),
            custoMultas2026: 0,
            custoTotal2026: 0
          });
        }

        if (mappedVeiculos.length === 0) {
          alert("Não foi possível carregar as propriedades da tabela. Verifique se os campos de FROTA e PLACA estão declarados adequadamente.");
          setImporting(false);
          return;
        }

        setImportProgress({
          total: mappedVeiculos.length,
          current: 0,
          status: `Transmitindo ${mappedVeiculos.length} frotas importadas ao painel online do Google Sheets...`
        });

        // Parallel Batch Upload Pipelines
        const batchSize = 10;
        let successCount = 0;

        for (let i = 0; i < mappedVeiculos.length; i += batchSize) {
          const batch = mappedVeiculos.slice(i, i + batchSize);
          await Promise.all(batch.map(async (v) => {
             try {
                await saveVeiculo(v);
                successCount++;
             } catch (err) {
                console.error(`Falha no upload da frota ${v.id}:`, err);
             }
          }));

          setImportProgress(prev => ({
            ...prev,
            current: Math.min(i + batchSize, mappedVeiculos.length),
            status: `Sincronizando frotas com a planilha online: ${Math.min(i + batchSize, mappedVeiculos.length)} de ${mappedVeiculos.length}...`
          }));
        }

        alert(`Sucesso! ${successCount} de ${mappedVeiculos.length} frotas foram sincronizadas e salvas online.`);
        await loadData(true);
        setImporting(false);
        setShowImportZone(false);

      } catch (err: any) {
         console.error(err);
         alert(`Erro no processamento do Excel: ${err.message || err}`);
         setImporting(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentField = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++; 
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(currentField);
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            row.push(currentField);
            if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
                lines.push(row);
            }
            row = [];
            currentField = '';
            if (char === '\r' && nextChar === '\n') {
                i++; 
            }
        } else {
            currentField += char;
        }
    }
    if (row.length > 0 || currentField !== '') {
        row.push(currentField);
        lines.push(row);
    }
    return lines;
  };

  const processGoogleSheetsImport = async () => {
    if (!sheetUrl) {
       alert("Por favor, informe a URL da planilha no Google Docs.");
       return;
    }
    
    setImportProgress({ total: 0, current: 0, status: 'Conectando e baixando dados da planilha do Google Docs...' });
    setImporting(true);
    
    try {
      let spreadsheetId = sheetUrl.trim();
      if (sheetUrl.includes('/d/')) {
         const parts = sheetUrl.split('/d/');
         if (parts.length > 1) {
            spreadsheetId = parts[1].split('/')[0];
         }
      }
      
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetGid || '0'}`;
      
      const response = await fetch(csvUrl);
      if (!response.ok) {
         if (response.status === 401 || response.status === 403 || response.status === 404) {
            throw new Error(`Acesso Negado (status ${response.status}). A nova planilha precisa estar compartilhada como "Qualquer pessoa com o link pode ler" ou "Publicada na Web" no menu do Google Docs.`);
         }
         throw new Error(`Falha ao conectar com o Google Planilhas. Status: ${response.status} ${response.statusText}`);
      }
      
      const csvText = await response.text();
      if (!csvText || csvText.trim().startsWith('<!DOCTYPE html>')) {
         throw new Error('A resposta do Google Docs foi uma página de login privada. Certifique-se de que o compartilhamento da planilha esteja configurado como Livre para Qualquer Pessoa com o Link ler.');
      }
      
      const lines = parseCSV(csvText);
      if (lines.length <= 1) {
         throw new Error('Nenhum dado encontrado ou planilha vazia.');
      }
      
      // Mapear headers
      const headers = lines[0].map(h => h.trim().toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '')
        .replace(/[\s\W_]+/g, ''));
        
      const mappedVeiculos: Veiculo[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const rowData = lines[i];
        if (rowData.length === 0 || (rowData.length === 1 && rowData[0] === '')) continue;
        
        const normRow: any = {};
        headers.forEach((header, colIdx) => {
           if (header) {
              normRow[header] = rowData[colIdx] !== undefined ? rowData[colIdx] : '';
           }
        });
        
        const placaValue = normRow.PLACA || normRow.PLACAS || normRow.VEICULO || normRow.MARCA;
        const idValue = normRow.FROTA || normRow.ID || normRow.PREFIXO || normRow.CODIGO || normRow.NFROTA || placaValue;
        
        if (!placaValue || String(placaValue).trim() === '') continue;
        
        const brand = normRow.LOCADORA || normRow.MARCA || normRow.FABRICANTE || normRow.MARCABREVE;
        const model = normRow.MODELO || normRow.VEICULO;
        const year = normRow.ANO || normRow.ANOFABRICACAO || normRow.ANOMODELO;
        const filialValue = normRow.FILIAL || normRow.BASE || normRow.UNIDADE || normRow.LOCALIDADE;
        const region = normRow.REGIAO || normRow.UF || filialValue;
        const typeValue = normRow.TIPO || normRow.CATEGORIA || normRow.TIPOVEICULO || normRow.FUNCAO || normRow.FUNÇÃO;
        const capacity = normRow.CAPACIDADE || normRow.CARROCERIA;
        const owner = normRow.PROPRIETARIO || normRow.EMPRESA || normRow.LOCADORA || brand;
        const statusValue = normRow.STATUS || normRow.SITUACAO || 'Ativo';

        // Novas colunas específicas da frotas nova
        const vencContrato = normRow.VENCCONTRATO || normRow.VENCIMENTOCONTRATO || normRow.CONTRATO || normRow.VENC || normRow.LICENCIAMENTO;
        const condutor = normRow.CONDUTOR || normRow.MOTORISTA || normRow.OPERADOR;
        const funcao = normRow.FUNCAO || normRow.FUNÇÃO || normRow.CARGO;
        const contatoMotorista = normRow.CONTATOMOTORISTA || normRow.CONTATO || normRow.TELEFONE;
        const gestorResp = normRow.GESTORRESP || normRow.GESTOR || normRow.RESPONSAVEL || normRow.GESTORRESPONSAVEL;
        const email = normRow.EMAIL || normRow.CORREIO || normRow.CONTATOEMAIL || normRow.DIRETOR;
        const locadora = normRow.LOCADORA || normRow.PARCEIRO || brand;
        const base = normRow.BASE || normRow.LOCALIDADE || filialValue;

        const parseDiasVenc = (val: any) => {
            if (val === undefined || val === null || val === '') return undefined;
            const n = parseInt(String(val).trim());
            return isNaN(n) ? undefined : n;
        };

        const diasVencVal = parseDiasVenc(normRow.DIASPVENC || normRow.DIASVENC || normRow.DIASPARAVENCIMENTO);

        const licValue = normRow.CUSTOLICENCIAMENTO2026 || normRow.LICENCIAMENTO2026 || normRow.CUSTOLICENCIAMENTO;
        const ipvaValue = normRow.CUSTOIPVA2026 || normRow.IPVA2026 || normRow.CUSTOIPVA;
        
        const parseCost = (val: any) => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return val;
            const cleaned = String(val).replace('R$', '').replace(/\s+/g, '').replace('.', '').replace(',', '.');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        };
        
        mappedVeiculos.push({
          id: cleanString(String(placaValue).trim()),
          status: String(statusValue).trim(),
          placa: cleanString(String(placaValue).trim()),
          marca: brand ? String(brand).trim().toUpperCase() : '',
          modelo: model ? String(model).trim().toUpperCase() : '',
          ano: year ? String(year).trim() : '',
          filial: filialValue ? String(filialValue).trim().toUpperCase() : 'OUTROS',
          regiao: region ? String(region).trim().toUpperCase() : 'OUTROS',
          tipo: typeValue ? String(typeValue).trim().toUpperCase() : '',
          capacidade: capacity ? String(capacity).trim() : '',
          proprietario: owner ? String(owner).trim().toUpperCase() : '',
          validadeLicenciamento: normRow.LICENCIAMENTO || vencContrato || '',
          
          // Novos campos da planilha "Frota Completa"
          vencContrato: vencContrato ? String(vencContrato).trim() : undefined,
          condutor: condutor ? String(condutor).trim() : undefined,
          funcao: funcao ? String(funcao).trim() : undefined,
          contatoMotorista: contatoMotorista ? String(contatoMotorista).trim() : undefined,
          gestorResp: gestorResp ? String(gestorResp).trim() : undefined,
          email: email ? String(email).trim() : undefined,
          locadora: locadora ? String(locadora).trim() : undefined,
          base: base ? String(base).trim() : undefined,
          diasVenc: diasVencVal,

          custoLicenciamento2026: parseCost(licValue),
          custoIpva2026: parseCost(ipvaValue),
          custoMultas2026: 0,
          custoTotal2026: 0
        });
      }
      
      if (mappedVeiculos.length === 0) {
        throw new Error('Não foi possível identificar nenhuma frota no formato esperado de colunas (FROTA e PLACA).');
      }
      
      setImportProgress({
        total: mappedVeiculos.length,
        current: 0,
        status: `Transmitindo ${mappedVeiculos.length} frotas importadas ao painel online do Google Sheets...`
      });

      const batchSize = 10;
      let successCount = 0;

      for (let i = 0; i < mappedVeiculos.length; i += batchSize) {
        const batch = mappedVeiculos.slice(i, i + batchSize);
        await Promise.all(batch.map(async (v) => {
           try {
              await saveVeiculo(v);
              successCount++;
           } catch (err) {
              console.error(`Falha no upload da frota ${v.id}:`, err);
           }
        }));

        setImportProgress(prev => ({
          ...prev,
          current: Math.min(i + batchSize, mappedVeiculos.length),
          status: `Sincronizando frotas com a planilha online: ${Math.min(i + batchSize, mappedVeiculos.length)} de ${mappedVeiculos.length}...`
        }));
      }

      alert(`Sucesso! ${successCount} de ${mappedVeiculos.length} frotas foram sincronizadas e salvas online.`);
      await loadData(true);
      setImporting(false);
      setShowImportZone(false);
      
    } catch (err: any) {
       console.error(err);
       alert(`Erro no processamento do Google Sheets: ${err.message || err}`);
       setImporting(false);
    }
  };


  const handleSave = async () => {
    if (currentVeiculo.placa && currentVeiculo.filial) {
      setLoading(true);
      const cleanPlacaKey = cleanString(currentVeiculo.placa);
      const payload = {
          ...currentVeiculo,
          id: cleanPlacaKey,
          placa: cleanPlacaKey,
          status: currentVeiculo.status || 'Ativo'
      };
      await saveVeiculo(payload as Veiculo, editingId || undefined);
      await loadData(true);
      setIsModalOpen(false);
      setCurrentVeiculo({ status: 'Ativo' });
      setEditingId(null);
    } else {
        alert("Campos Obrigatórios: Placa e Filial.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este veículo de forma definitiva?')) {
      setLoading(true);
      await deleteVeiculo(id);
      await loadData(true);
    }
  };

  const handleSort = (key: keyof Veiculo) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const formatCurrency = (val?: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-';
      if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
  };

  // --- CELL RENDERER FOR DYNAMIC COLUMNS ---
  const renderCell = (colId: string, veiculo: Veiculo) => {
    const statusUpper = String(veiculo.status || 'Ativo').toUpperCase();
    const isVencido = statusUpper === 'VENCIDO' || (veiculo.diasVenc !== undefined && veiculo.diasVenc < 0);
    const isAtivo = statusUpper === 'ATIVO' || statusUpper === 'CONTRATADO' || statusUpper === 'VIGENTE';

    switch (colId) {
      case 'status':
        return (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase border whitespace-nowrap ${
            isVencido ? 'bg-red-50 text-red-700 border-red-200' :
            isAtivo ? 'bg-green-50 text-green-700 border-green-200' :
            'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {veiculo.status || 'Ativo'}
          </span>
        );
      case 'frota':
        return veiculo.id ? (
          <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[9px] whitespace-nowrap">
            FROTA {veiculo.id}
          </span>
        ) : <span className="text-gray-400 text-[9px]">-</span>;
      case 'placa':
        return (
          <div className="flex justify-center">
            <MercosulPlateBadge plate={veiculo.placa} size="sm" isInactive={!isAtivo} />
          </div>
        );
      case 'modelo':
        return <span className="font-bold text-gray-700 text-[9.5px] whitespace-nowrap">{veiculo.modelo || '-'}</span>;
      case 'marca':
        return <span className="font-semibold text-gray-600 text-[9px] uppercase whitespace-nowrap">{veiculo.marca || '-'}</span>;
      case 'ano':
        return <span className="font-mono text-gray-600 text-[9px] whitespace-nowrap">{veiculo.ano || '-'}</span>;
      case 'tipo':
        return veiculo.tipo ? (
          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            {veiculo.tipo}
          </span>
        ) : <span className="text-gray-400 text-[9px]">-</span>;
      case 'capacidade':
        return <span className="font-mono text-gray-600 text-[9px] whitespace-nowrap">{veiculo.capacidade ? `${veiculo.capacidade} kg` : '-'}</span>;
      case 'filial':
        return <span className="font-medium text-gray-600 text-[9px] truncate max-w-[150px] block" title={veiculo.filial}>{veiculo.filial || '-'}</span>;
      case 'regiao':
        return <span className="font-medium text-gray-600 text-[9px] whitespace-nowrap">{veiculo.regiao || '-'}</span>;
      case 'base':
        return <span className="font-semibold text-gray-600 uppercase text-[9px] whitespace-nowrap">{veiculo.base || '-'}</span>;
      case 'locadora':
        return <span className="text-gray-600 text-[9px] whitespace-nowrap">{veiculo.locadora || '-'}</span>;
      case 'proprietario':
        return <span className="text-gray-600 text-[9px] whitespace-nowrap">{veiculo.proprietario || '-'}</span>;
      case 'gestorResp':
        return <span className="text-gray-600 text-[9px] truncate max-w-[140px] block" title={veiculo.gestorResp}>{veiculo.gestorResp || '-'}</span>;
      case 'condutor':
        return <span className="text-gray-700 font-medium text-[9.5px] truncate max-w-[160px] block" title={veiculo.condutor}>{veiculo.condutor || '-'}</span>;
      case 'funcao':
        return <span className="text-gray-600 text-[9px] whitespace-nowrap">{veiculo.funcao || '-'}</span>;
      case 'contatoMotorista':
        return <span className="font-mono text-gray-600 text-[9px] whitespace-nowrap">{veiculo.contatoMotorista || '-'}</span>;
      case 'vencContrato':
        return <span className="font-mono text-gray-600 text-[9px] whitespace-nowrap">{formatDate(veiculo.vencContrato)}</span>;
      case 'validadeLicenciamento':
        return <span className="font-mono text-gray-600 text-[9px] whitespace-nowrap">{formatDate(veiculo.validadeLicenciamento)}</span>;
      case 'custoLicenciamento2026':
        return <span className="font-medium text-gray-700 whitespace-nowrap text-right block text-[10px]">{formatCurrency(veiculo.custoLicenciamento2026)}</span>;
      case 'custoIpva2026':
        return <span className="font-medium text-gray-700 whitespace-nowrap text-right block text-[10px]">{formatCurrency(veiculo.custoIpva2026)}</span>;
      case 'custoMultas2026':
        return <span className="font-bold text-red-600 bg-red-50/30 px-1 py-0.5 rounded whitespace-nowrap text-right block text-[10px]">{formatCurrency(veiculo.custoMultas2026)}</span>;
      case 'custoTotal2026':
        return <span className="font-black text-emerald-700 whitespace-nowrap text-right block text-[10px]">{formatCurrency(veiculo.custoTotal2026)}</span>;
      default:
        return <span className="text-[9px]">-</span>;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 relative flex flex-col h-full overflow-hidden">
      {loading && <Loading />}
      
      {/* HEADER COMPACTO DA GESTÃO DE FROTA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0 bg-white/80 px-3 py-2 rounded-xl border border-slate-200/70 shadow-2xs backdrop-blur-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-800 to-teal-700 tracking-tight uppercase leading-none">
            Gestão de Frota
          </h2>
          <p className="text-slate-500 text-[10px] sm:text-[10.5px] font-semibold mt-0.5 leading-none">
            Controle de veículos e custos ({filters.year || 'Geral'})
          </p>
        </div>
        
        <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end flex-wrap gap-y-1">
            
            {/* MAPA DA FROTA TRIGGER */}
            <button 
                onClick={() => { setShowFleetMap(!showFleetMap); if (showImportZone) setShowImportZone(false); }}
                className={`px-2.5 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 font-bold text-[11px] border ${showFleetMap ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
                <MapIcon size={13} className="mr-1.5"/> {showFleetMap ? 'Ver Lista' : 'Mapa da Frota'}
            </button>

            {/* SPREADSHEET IMPORTER TRIGGER */}
            {!showFleetMap && (
                <button 
                    onClick={() => setShowImportZone(!showImportZone)}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 font-bold text-[11px] border ${showImportZone ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                >
                    <UploadCloud size={13} className="mr-1.5"/> Importar Planilha
                </button>
            )}

            {/* FILTROS */}
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-2.5 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 font-bold text-[11px] border ${showFilters ? 'bg-risel-orange text-white border-risel-orange' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
                <Filter size={13} className="mr-1.5"/> Filtros {showFilters ? <ChevronUp size={13} className="ml-1"/> : <ChevronDown size={13} className="ml-1"/>}
            </button>

            {/* BOTÃO DISCRETO DE COLUNAS */}
            <button 
                onClick={() => setIsColumnModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 font-bold text-[11px] border ${
                    isColumnModalOpen 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Escolher e ordenar colunas da tabela de frotas"
            >
                <SlidersHorizontal size={12} className="mr-1.5 text-emerald-600" />
                <span>Colunas</span>
                <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black">
                    {visibleColumnsDefs.length}
                </span>
            </button>

            <button onClick={() => loadData(true)} className="bg-white hover:bg-gray-50 text-risel-green border border-risel-green/30 px-2 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 font-bold text-[11px]" title="Recarregar dados">
                <RefreshCw size={13} />
            </button>
            
            <button onClick={() => { setCurrentVeiculo({ status: 'ATIVO' }); setEditingId(null); setIsModalOpen(true); }} className="bg-risel-green hover:bg-risel-dark text-white px-3 py-1.5 rounded-lg flex items-center shadow-sm transition-all active:scale-95 font-bold text-[11px] uppercase">
                <Plus size={13} className="mr-1" /> Novo Veículo
            </button>
        </div>
      </div>

      {/* DUAL IMPORT HUB (GOOGLE SHEETS ONLINE & EXCEL LOCAL) */}
      {showImportZone && (
          <div className="bg-gradient-to-br from-white to-emerald-50/20 p-6 rounded-2xl shadow-lg border border-emerald-200 transition-all duration-300 animate-in slide-in-from-top-4 duration-300 shrink-0">
              <div className="flex justify-between items-start mb-5">
                  <div>
                      <h4 className="text-md font-black text-emerald-900 flex items-center gap-1.5 uppercase"><UploadCloud size={20} className="text-emerald-700"/> Importador Inteligente - Frota Completa</h4>
                      <p className="text-xs text-slate-500 font-medium">Substitua os dados de frotas atuais importando diretamente da sua planilha do Google Docs ou de um arquivo local.</p>
                  </div>
                  <button onClick={() => setShowImportZone(false)} className="text-gray-400 hover:text-red-500 transition-colors p-1"><X size={16}/></button>
              </div>

              {/* TABS SELECTOR */}
              <div className="flex border-b border-gray-200 mb-5">
                  <button 
                      onClick={() => setImportMethod('sheets')}
                      className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${importMethod === 'sheets' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                      disabled={importing}
                  >
                      1. Google Sheets Sincronizado
                  </button>
                  <button 
                      onClick={() => setImportMethod('excel')}
                      className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${importMethod === 'excel' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                      disabled={importing}
                  >
                      2. Arquivo Excel Local (.xlsx)
                  </button>
              </div>

              {!importing ? (
                  <div className="space-y-4">
                      {importMethod === 'sheets' ? (
                          <div className="bg-white p-5 rounded-xl border border-gray-150 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="md:col-span-2">
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Link ou ID da Planilha do Google Docs</label>
                                      <input 
                                          type="text" 
                                          value={sheetUrl} 
                                          onChange={e => setSheetUrl(e.target.value)}
                                          placeholder="https://docs.google.com/spreadsheets/d/..."
                                          className="w-full border rounded-lg p-2 text-xs font-bold text-slate-700 bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GID (Código da Aba de Veículos / Frotas)</label>
                                      <input 
                                          type="text" 
                                          value={sheetGid} 
                                          onChange={e => setSheetGid(e.target.value)}
                                          placeholder="413419483"
                                          className="w-full border rounded-lg p-2 text-xs font-black text-slate-700 bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                                      />
                                  </div>
                              </div>

                              <div className="bg-amber-50/50 p-3.5 rounded-lg border border-amber-200/50 flex gap-3">
                                  <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                  <div className="text-xs text-amber-800 leading-relaxed">
                                      <p className="font-bold mb-1">Instruções de Compartilhamento:</p>
                                      <ol className="list-decimal list-inside space-y-0.5">
                                          <li>Abra a sua planilha no <strong>Google Docs</strong>.</li>
                                          <li>Clique no botão azul <strong>Compartilhar</strong> no canto superior direito.</li>
                                          <li>Modifique em <i>Acesso Geral</i> para <strong>"Qualquer pessoa com o link"</strong> na função de <strong>Leitor</strong>.</li>
                                          <li>Pronto! Clique no botão abaixo para puxar, mapear e salvar todos os veículos automaticamente no banco.</li>
                                      </ol>
                                  </div>
                              </div>

                              <div className="flex justify-end">
                                  <button 
                                      onClick={processGoogleSheetsImport}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase px-6 py-3 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                                  >
                                      <RefreshCw size={14} className="animate-spin-slow"/> Importar e Sincronizar Google Sheets
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div 
                              className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl bg-white/50 cursor-pointer transition-colors relative" 
                              onClick={() => fileInputRef.current?.click()}
                          >
                              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                              <UploadCloud size={44} className="text-slate-400 mb-2" />
                              <p className="text-sm font-bold text-slate-600 mb-1">Selecione o arquivo da Planilha (.XLSX)</p>
                              <p className="text-xs text-slate-400">Ex: CONTROLE_FROTA_LEVE_2026.xlsx (O arquivo Excel deve conter uma aba chamada "Frota Completa")</p>
                          </div>
                      )}
                  </div>
              ) : (
                  <div className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm space-y-4 animate-pulse">
                      <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600">
                          <span className="flex items-center gap-1.5"><Loader2 size={16} className="animate-spin text-emerald-600"/> {importProgress.status}</span>
                          {importProgress.total > 0 && (
                              <span>{importProgress.current} de {importProgress.total} frotas ({Math.round(importProgress.current / importProgress.total * 100)}%)</span>
                          )}
                      </div>
                      {importProgress.total > 0 && (
                          <div className="w-full bg-slate-100 rounded-full h-3 max-w-full overflow-hidden">
                              <div className="bg-emerald-600 h-3 rounded-full transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total * 100)}%` }}></div>
                          </div>
                      )}
                      <p className="text-[10px] uppercase font-bold text-red-500">* Atenção: Não feche a aba ou reinicie a página até terminar a sincronização online.</p>
                  </div>
              )}
          </div>
      )}

      {/* FILTER BAR */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${showFilters ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Calendar size={12}/> Ano de Referência</label>
                  <select value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-risel-green outline-none bg-gray-50">
                      <option value="">Todos os Anos (Geral)</option>
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mês (Opcional)</label>
                  <select value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})} className="w-full border rounded-lg p-2 text-sm text-gray-700 focus:ring-2 focus:ring-risel-green outline-none bg-gray-50">
                      <option value="">Todos os Meses</option>
                      {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base / Filial</label>
                  <select value={filters.base} onChange={e => setFilters({...filters, base: e.target.value})} className="w-full border rounded-lg p-2 text-sm text-gray-700 focus:ring-2 focus:ring-risel-green outline-none bg-gray-50">
                      <option value="">Todas as Bases</option>
                      {availableBases.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
              </div>
              <div className="flex items-center pb-1">
                  <span className="text-xs text-gray-400 font-medium">* O cálculo de multas será atualizado automaticamente.</span>
              </div>
          </div>
      </div>

      {showFleetMap ? (
          /* BENTO GRID DASHBOARD FOR MAPA DA FROTA */
          <div className="space-y-6 animate-in fade-in duration-300 flex-1 overflow-auto custom-scrollbar pr-1 pb-10">
              
              {/* Top KPIs overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                  <div className="bg-[#022c22] text-white p-5 rounded-2xl shadow-sm border border-emerald-950 flex justify-between items-center relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 scale-150"><Truck size={96} /></div>
                      <div>
                          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Total de Veículos</p>
                          <h4 className="text-3xl font-black">{dashboardData.totalVehicles}</h4>
                          <span className="text-[9px] text-emerald-300 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded uppercase mt-2 inline-block">Frota Cadastrada</span>
                      </div>
                      <div className="bg-emerald-900 p-3 rounded-xl"><Car size={24} className="text-emerald-400"/></div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 flex justify-between items-center relative overflow-hidden">
                      <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Modelos Ativos</p>
                          <h4 className="text-3xl font-black text-emerald-600">{dashboardData.activeVehicles}</h4>
                          <span className="text-[9px] text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded uppercase mt-2 inline-block">Disponíveis</span>
                      </div>
                      <div className="bg-green-50 p-3 rounded-xl"><CheckCircle size={24} className="text-emerald-600"/></div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 flex justify-between items-center relative overflow-hidden">
                      <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Modelos Inativos</p>
                          <h4 className="text-3xl font-black text-rose-600">{dashboardData.inactiveVehicles}</h4>
                          <span className="text-[9px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded uppercase mt-2 inline-block">Indisponíveis</span>
                      </div>
                      <div className="bg-rose-50 p-3 rounded-xl"><X size={24} className="text-rose-600"/></div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 flex justify-between items-center relative overflow-hidden">
                      <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Custo Combinado</p>
                          <h4 className="text-2xl font-black text-slate-800">{formatCurrency(dashboardData.totalCombinedExpenses)}</h4>
                          <span className="text-[9px] text-[#ff9b00] font-bold bg-amber-50 px-1.5 py-0.5 rounded uppercase mt-2 inline-block">Licenc. + IPVA + Multas</span>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-xl"><DollarSign size={24} className="text-[#ff9b00]"/></div>
                  </div>
              </div>

              {/* Charts Bento Grid visualizers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
                  
                  {/* Base Distribution */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 flex flex-col h-[320px]">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><MapIcon size={16} className="text-indigo-600"/> Total de Frotas por Base / Filial</h3>
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">QUANTIDADE</span>
                      </div>
                      <div className="flex-1 w-full min-h-0">
                          {dashboardData.byBase.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={dashboardData.byBase} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                      <YAxis tick={{ fontSize: 10 }} />
                                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                                      <Bar dataKey="value" fill="#00753f" radius={[4, 4, 0, 0]}>
                                          {dashboardData.byBase.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#00753f' : '#ff9b00'} />
                                          ))}
                                      </Bar>
                                  </BarChart>
                              </ResponsiveContainer>
                          ) : (
                               <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400">Nenhum dado cadastrado</div>
                          )}
                      </div>
                  </div>

                  {/* Manufacturers pie donut */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 flex flex-col h-[320px]">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><PieIcon size={16} className="text-teal-600"/> Total de Frotas por Marca</h3>
                          <span className="text-[9px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full font-bold">TOP FABRICANTES</span>
                      </div>
                      <div className="flex-1 w-full min-h-0">
                          {dashboardData.byBrand.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                      <Pie data={dashboardData.byBrand} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} fill="#8884d8" paddingAngle={2} label={{ fontSize: 9, fontWeight: 'black' }}>
                                          {dashboardData.byBrand.map((entry, index) => {
                                              const colors = ['#00753f', '#ff9b00', '#0ea5e9', '#ef4444', '#a855f7', '#14b8a6', '#db2777', '#64748b'];
                                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                          })}
                                      </Pie>
                                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                                  </PieChart>
                              </ResponsiveContainer>
                          ) : (
                               <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400">Nenhum dado cadastrado</div>
                          )}
                      </div>
                  </div>

                  {/* Top popular Models horizontal bar */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 flex flex-col h-[320px]">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><Settings size={16} className="text-amber-600"/> Total de Frotas por Modelo (Top 8)</h3>
                          <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">INDICE</span>
                      </div>
                      <div className="flex-1 w-full min-h-0">
                          {dashboardData.byModel.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={dashboardData.byModel} layout="vertical" margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                                      <XAxis type="number" tick={{ fontSize: 10 }} />
                                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 'bold' }} width={85} />
                                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                                      <Bar dataKey="value" fill="#ff9b00" radius={[0, 4, 4, 0]}>
                                          {dashboardData.byModel.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#ff9b00' : '#0ea5e9'} />
                                          ))}
                                      </Bar>
                                  </BarChart>
                              </ResponsiveContainer>
                          ) : (
                               <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400">Nenhum dado cadastrado</div>
                          )}
                      </div>
                  </div>

                  {/* Years distribution Area */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 flex flex-col h-[320px]">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><Calendar size={16} className="text-emerald-700"/> Total de Frotas por Ano</h3>
                          <span className="text-[9px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full">HISTORICO DE FABRICACAO</span>
                      </div>
                      <div className="flex-1 w-full min-h-0">
                          {dashboardData.byYear.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={dashboardData.byYear} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                      <YAxis tick={{ fontSize: 10 }} />
                                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                                      <Area type="monotone" dataKey="value" stroke="#00753f" fillOpacity={0.11} fill="#00753f" strokeWidth={2.5} />
                                  </AreaChart>
                              </ResponsiveContainer>
                          ) : (
                               <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400">Nenhum dado cadastrado</div>
                          )}
                      </div>
                  </div>

              </div>
          </div>
      ) : (
          /* TRADITIONAL HIGH PRECISION GRID TABLE */
          <>
              <div className="bg-white px-3 py-1.5 rounded-xl shadow-2xs border border-gray-200/80 flex items-center justify-between gap-2.5 transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 shrink-0">
                <div className="flex items-center flex-1">
                  <Search className="text-gray-400 mr-2 shrink-0" size={14}/>
                  <input 
                    type="text" 
                    placeholder="BUSCAR VEÍCULOS, PLACAS OU FILIAIS..." 
                    className="flex-1 outline-none text-slate-700 bg-transparent text-[11px] font-semibold uppercase placeholder:normal-case" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-red-500 transition-colors p-0.5" title="Limpar busca">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold border-l border-slate-200 pl-2.5 shrink-0">
                  <span>Exibindo: <strong className="text-slate-800">{sortedVeiculos.length}</strong> veículos</span>
                  <span className="text-slate-300">•</span>
                  <button 
                    onClick={() => setIsColumnModalOpen(true)}
                    className="text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 font-bold text-[10px]"
                  >
                    <SlidersHorizontal size={11} /> {visibleColumnsDefs.length} colunas
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden flex flex-col flex-1 h-full min-h-0">
                    <div className="overflow-auto flex-1 custom-scrollbar w-full relative">
                        <table className="min-w-max border-collapse uppercase text-[10px]">
                            <thead className="sticky top-0 z-10 shadow-xs">
                                <tr className="bg-gradient-to-r from-[#022c22] to-risel-green">
                                    <th className="px-2 py-2 w-14 text-center text-[9px] font-bold text-white/90 uppercase tracking-wider border-r border-white/10 sticky left-0 z-20 bg-[#022c22] select-none">
                                        Ações
                                    </th>
                                    {visibleColumnsDefs.map((col, colIdx) => (
                                        <th 
                                            key={col.id} 
                                            draggable={true}
                                            onDragStart={(e) => handleDragStart(e, col.id)}
                                            onDragOver={(e) => handleDragOver(e, col.id)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, col.id)}
                                            className={`px-2.5 py-2 text-left text-[9px] font-bold text-white/90 uppercase tracking-wider cursor-move hover:bg-white/10 transition-all group border-r border-white/10 select-none ${col.minWidth || 'min-w-[100px]'} ${
                                                dragOverColumnId === col.id ? 'bg-emerald-500/50 ring-2 ring-white border-l-2 border-white' : ''
                                            } ${draggedColumnId === col.id ? 'opacity-40' : ''}`} 
                                            onClick={() => handleSort(col.sortKey)} 
                                            title={`Arraste para reposicionar. Clique para ordenar por ${col.label}`}
                                        >
                                            <div className="flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <GripVertical size={11} className="opacity-40 group-hover:opacity-100 shrink-0 cursor-grab" />
                                                    <span className="truncate">{col.label}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {/* Botões rápidos para reordenar */}
                                                    <div className="hidden group-hover:flex items-center opacity-80">
                                                        {colIdx > 0 && (
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); moveColumn(col.id, 'left'); }}
                                                                className="hover:text-white text-white/70 p-0.5"
                                                                title="Mover coluna para a esquerda"
                                                            >
                                                                <ArrowLeft size={10} />
                                                            </button>
                                                        )}
                                                        {colIdx < visibleColumnsDefs.length - 1 && (
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); moveColumn(col.id, 'right'); }}
                                                                className="hover:text-white text-white/70 p-0.5"
                                                                title="Mover coluna para a direita"
                                                            >
                                                                <ArrowRight size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className={`flex flex-col opacity-50 group-hover:opacity-100 ${sortConfig?.key === col.sortKey ? 'opacity-100 text-white' : ''}`}>
                                                        <ArrowUpDown size={11} />
                                                    </div>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100 text-[9.5px]">
                                {sortedVeiculos.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleColumnsDefs.length + 1} className="px-6 py-12 text-center text-slate-400 font-medium normal-case">
                                            Nenhum veículo encontrado com os filtros e busca atuais.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedVeiculos.map((veiculo, idx) => {
                                        const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                                        
                                        return (
                                            <tr key={(veiculo.placa || veiculo.id || 'v') + idx} className={`${rowClass} hover:bg-emerald-50/40 transition-colors group`}>
                                                <td className="px-1.5 py-1.5 text-center border-r border-gray-100 sticky left-0 bg-white group-hover:bg-emerald-50/40 z-10 shadow-2xs">
                                                    <div className="flex justify-center space-x-1">
                                                        <button onClick={() => { setCurrentVeiculo(veiculo); setEditingId(veiculo.placa || veiculo.id); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600 transition-colors p-0.5" title="Editar"><Edit size={13}/></button>
                                                        <button onClick={() => handleDelete(veiculo.placa || veiculo.id)} className="text-gray-400 hover:text-red-600 transition-colors p-0.5" title="Excluir"><Trash2 size={13}/></button>
                                                    </div>
                                                </td>
                                                {visibleColumnsDefs.map((col) => (
                                                    <td 
                                                        key={col.id} 
                                                        className={`px-2.5 py-1.5 border-r border-gray-100 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                                    >
                                                        {renderCell(col.id, veiculo)}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
              </div>
          </>
      )}

      {/* EDIT/ADD MODAL DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar uppercase">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2 flex items-center"><Truck className="mr-2 text-risel-green"/> {currentVeiculo.id ? 'EDITAR VEÍCULO' : 'NOVO VEÍCULO'}</h3>
            <div className="space-y-6">
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                   <h4 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center"><Hash size={12} className="mr-1"/> Identificação & Status</h4>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status</label><select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.status || 'Ativo'} onChange={e => setCurrentVeiculo({...currentVeiculo, status: e.target.value})}><option value="Ativo">Ativo</option><option value="Vencido">Vencido</option><option value="Contratado">Contratado</option><option value="Vigente">Vigente</option><option value="Inativo">Inativo</option></select></div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Placa *</label>
                            {Boolean(currentVeiculo.placa) && (
                              <MercosulPlateBadge plate={currentVeiculo.placa} size="sm" />
                            )}
                          </div>
                          <input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm font-bold uppercase bg-white" placeholder="ABC1234" value={currentVeiculo.placa || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, placa: cleanString(e.target.value)})}/>
                        </div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Modelo</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" placeholder="EX: SCANIA R450" value={currentVeiculo.modelo || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, modelo: formatInputText(e.target.value)})}/></div>
                   </div>
               </div>
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                   <h4 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center"><Settings size={12} className="mr-1"/> Detalhes Operacionais</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Filial *</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.filial || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, filial: formatInputText(e.target.value)})}/></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Base</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" placeholder="EX: MATRIZ" value={currentVeiculo.base || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, base: formatInputText(e.target.value)})}/></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Locadora</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" placeholder="EX: LOCALIZA" value={currentVeiculo.locadora || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, locadora: formatInputText(e.target.value)})}/></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Gestor Resp.</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" placeholder="EX: JOSÉ COSTA" value={currentVeiculo.gestorResp || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, gestorResp: formatInputText(e.target.value)})}/></div>
                   </div>
               </div>
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center"><DollarSign size={12} className="mr-1"/> Custos & Multas (Cálculo Automático por Placa)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Licenciamento (R$)</label><input type="number" step="0.01" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white font-bold" value={currentVeiculo.custoLicenciamento2026 || 0} onChange={e => setCurrentVeiculo({...currentVeiculo, custoLicenciamento2026: Number(e.target.value)})}/></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">IPVA (R$)</label><input type="number" step="0.01" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white font-bold" value={currentVeiculo.custoIpva2026 || 0} onChange={e => setCurrentVeiculo({...currentVeiculo, custoIpva2026: Number(e.target.value)})}/></div>
                            <div><label className="block text-[10px] font-bold text-red-500 mb-1 uppercase">Multas ({filters.year || 'Geral'})</label><input type="text" disabled className="w-full border rounded-lg p-2.5 bg-red-50 text-red-600 font-bold text-sm outline-none cursor-not-allowed" value={formatCurrency(currentVeiculo.custoMultas2026)}/></div>
                            <div><label className="block text-[10px] font-bold text-emerald-600 mb-1 uppercase">Total (Calc)</label><input type="text" disabled className="w-full border rounded-lg p-2.5 bg-emerald-50 text-emerald-700 font-black text-sm outline-none cursor-not-allowed" value={formatCurrency((currentVeiculo.custoLicenciamento2026 || 0) + (currentVeiculo.custoIpva2026 || 0) + (currentVeiculo.custoMultas2026 || 0))}/></div>
                    </div>
               </div>
            </div>
            <div className="mt-8 flex justify-end space-x-3 pt-4 border-t border-gray-100">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-medium text-sm uppercase">Cancelar</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-risel-green text-white rounded-xl shadow-lg hover:bg-risel-dark font-bold text-sm transition-all transform active:scale-95 uppercase">Salvar Veículo</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DIALOG DE PERSONALIZAÇÃO E ORDENAÇÃO DE COLUNAS */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            
            {/* Header do Modal */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#022c22] to-risel-green text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <SlidersHorizontal size={20} className="text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-wide uppercase">
                    Personalizar Colunas da Frota
                  </h3>
                  <p className="text-white/80 text-xs font-medium">
                    Escolha as colunas visíveis e reordene para salvar suas preferências.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsColumnModalOpen(false)}
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Abas do Modal */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setColumnModalTab('visibility')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase transition-colors border-b-2 ${
                  columnModalTab === 'visibility'
                    ? 'border-risel-green text-risel-green bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Eye size={14} />
                <span>Visibilidade ({visibleColumns.length}/{ALL_FROTA_COLUMNS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setColumnModalTab('order')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase transition-colors border-b-2 ${
                  columnModalTab === 'order'
                    ? 'border-risel-green text-risel-green bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <GripVertical size={14} />
                <span>Reordenar Posições</span>
              </button>
            </div>

            {/* Conteúdo da Aba: Visibilidade */}
            {columnModalTab === 'visibility' && (
              <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden gap-3">
                {/* Barra de Filtros de Coluna */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Buscar coluna pelo nome..."
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  
                  {/* Categorias */}
                  <select
                    value={selectedColumnCategory}
                    onChange={(e) => setSelectedColumnCategory(e.target.value)}
                    className="text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white text-slate-700"
                  >
                    <option value="TODAS">Todas as Categorias</option>
                    <option value="Identificação">Identificação</option>
                    <option value="Localização & Operação">Localização & Operação</option>
                    <option value="Custos & Licenciamento">Custos & Licenciamento</option>
                  </select>
                </div>

                {/* Ações Rápidas */}
                <div className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-100 shrink-0 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = ALL_FROTA_COLUMNS.map(c => c.id);
                        setVisibleColumns(allIds);
                        saveUserColumnSelection(allIds);
                      }}
                      className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline text-[11px]"
                    >
                      <CheckSquare size={13} /> Marcar Todas
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        // Manter pelo menos a coluna 'placa'
                        const minCols = ['placa'];
                        setVisibleColumns(minCols);
                        saveUserColumnSelection(minCols);
                      }}
                      className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 hover:underline text-[11px]"
                    >
                      <Square size={13} /> Desmarcar Todas
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setVisibleColumns(DEFAULT_FROTA_COLUMNS);
                      saveUserColumnSelection(DEFAULT_FROTA_COLUMNS);
                    }}
                    className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 hover:underline text-[11px]"
                  >
                    <RotateCcw size={12} /> Restaurar Padrão
                  </button>
                </div>

                {/* Grid de Colunas com Checkboxes */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 divide-y divide-slate-100">
                  {ALL_FROTA_COLUMNS
                    .filter(c => {
                      const matchSearch = c.label.toLowerCase().includes(columnSearch.toLowerCase()) || c.id.toLowerCase().includes(columnSearch.toLowerCase());
                      const matchCategory = selectedColumnCategory === 'TODAS' || c.category === selectedColumnCategory;
                      return matchSearch && matchCategory;
                    })
                    .map((col) => {
                      const isChecked = visibleColumns.includes(col.id);
                      return (
                        <label
                          key={col.id}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                let updated: string[];
                                if (e.target.checked) {
                                  updated = [...visibleColumns, col.id];
                                } else {
                                  if (visibleColumns.length <= 1) {
                                    alert('Você deve manter ao menos uma coluna visível.');
                                    return;
                                  }
                                  updated = visibleColumns.filter(id => id !== col.id);
                                }
                                setVisibleColumns(updated);
                                saveUserColumnSelection(updated);
                              }}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-800">{col.label}</div>
                              <div className="text-[10px] text-slate-400 font-medium">Chave: {col.id} • Alinhamento: {col.align || 'left'}</div>
                            </div>
                          </div>

                          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            col.category === 'Identificação' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            col.category === 'Custos & Licenciamento' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {col.category}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Conteúdo da Aba: Reordenar Posições */}
            {columnModalTab === 'order' && (
              <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden gap-3">
                <p className="text-xs text-slate-500">
                  Use as setas ou arraste para organizar a ordem da esquerda para a direita na tabela.
                </p>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  {visibleColumnsDefs.map((col, idx) => (
                    <div
                      key={col.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, col.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border bg-white shadow-2xs transition-all ${
                        dragOverColumnId === col.id ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/30' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical size={16} className="text-slate-400 cursor-grab hover:text-slate-700" />
                        <span className="w-6 text-center text-xs font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{col.label}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{col.category}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveColumn(col.id, 'left')}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para cima/esquerda"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === visibleColumnsDefs.length - 1}
                          onClick={() => moveColumn(col.id, 'right')}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para baixo/direita"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rodapé do Modal */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <Check size={14} className="text-emerald-600" />
                <span>Salvo automaticamente no seu perfil</span>
              </div>
              <button
                type="button"
                onClick={() => setIsColumnModalOpen(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                Concluir
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default FrotasPage;
