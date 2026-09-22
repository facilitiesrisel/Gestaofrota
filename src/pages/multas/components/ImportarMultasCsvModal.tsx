import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Search,
  Check,
  Building2,
  Calendar,
  DollarSign,
  ShieldAlert,
  Car,
  Clock,
  MapPin,
  FileText
} from 'lucide-react';
import { Multa, StatusMulta, TipoMulta, Veiculo, CodigoMulta } from '../types';
import {
  parseCsvMultas,
  CsvMultaItem,
  CsvParseResult
} from '../utils/csvMultasParser';

interface ImportarMultasCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMultas: any[];
  veiculos: any[];
  codigos: any[];
  onImportSuccess: (
    importedMultas: any[],
    onProgress?: (percent: number, current: number, total: number) => void
  ) => Promise<void>;
}

export const ImportarMultasCsvModal: React.FC<ImportarMultasCsvModalProps> = ({
  isOpen,
  onClose,
  existingMultas,
  veiculos,
  codigos,
  onImportSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'valid' | 'duplicate'>('all');
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('');
  const [importCompleted, setImportCompleted] = useState(false);

  // Hook de limpeza e sincronização de estado
  useEffect(() => {
    if (!isOpen) {
      setDragActive(false);
      setFileName(null);
      setFileSize(null);
      setParseResult(null);
      setSearchTerm('');
      setTabFilter('all');
      setSelectedItems({});
      setIsImporting(false);
      setImportProgress(0);
      setImportMessage('');
      setImportCompleted(false);
    }
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.items.filter((item) => {
      if (tabFilter === 'valid' && item.isDuplicate) return false;
      if (tabFilter === 'duplicate' && !item.isDuplicate) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.placa.toLowerCase().includes(term) ||
        item.ait.toLowerCase().includes(term) ||
        item.municipio.toLowerCase().includes(term) ||
        item.descricaoInfracao.toLowerCase().includes(term) ||
        item.enquadramento.toLowerCase().includes(term)
      );
    });
  }, [parseResult, tabFilter, searchTerm]);

  const totalSelectedCount = useMemo(() => {
    if (!parseResult) return 0;
    return parseResult.items.filter((item) => selectedItems[item.id]).length;
  }, [parseResult, selectedItems]);

  const totalSelectedValor = useMemo(() => {
    if (!parseResult) return 0;
    return parseResult.items
      .filter((item) => selectedItems[item.id])
      .reduce((acc, it) => acc + (it.valorComDesconto || 0), 0);
  }, [parseResult, selectedItems]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const result = parseCsvMultas(text, existingMultas, veiculos, codigos);
        setParseResult(result);

        // Inicializa a seleção: se ignoreDuplicates for true, seleciona apenas os válidos
        const initialSelection: Record<string, boolean> = {};
        result.items.forEach((item) => {
          initialSelection[item.id] = !item.isDuplicate;
        });
        setSelectedItems(initialSelection);
      }
    };
    reader.readAsText(file, 'ISO-8859-1'); // Suporta caracteres pt-BR de exportações Windows/Excel
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const toggleSelectAll = () => {
    if (!parseResult) return;
    const allSelected = filteredItems.every((item) => selectedItems[item.id]);
    const updated = { ...selectedItems };
    filteredItems.forEach((item) => {
      if (!allSelected) {
        // Seleciona se não for duplicado ou se o usuário explicitamente quiser
        if (!ignoreDuplicates || !item.isDuplicate) {
          updated[item.id] = true;
        }
      } else {
        updated[item.id] = false;
      }
    });
    setSelectedItems(updated);
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirmImport = async () => {
    if (!parseResult) return;
    const itemsToImport = parseResult.items.filter((item) => selectedItems[item.id]);
    if (itemsToImport.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportMessage('Preparando registros para gravação...');

    const multasParaGravar: Multa[] = itemsToImport.map((item) => {
      return {
        id: item.ait || item.id,
        ait: item.ait,
        placa: item.placa,
        frota: item.frota || '',
        base: item.base || '',
        dataHoraInfracao: item.dataHoraInfracao,
        dataRecebimento: item.dataRecebimento, // Data de hoje (data da importação)
        prazoIndicacao: '',
        enquadramento: item.enquadramento || '',
        artigoCtb: item.artigoCtb || '',
        descricaoInfracao: item.descricaoInfracao || '',
        pontosCnh: item.pontosCnh || 0,
        responsavelCodigo: '',
        responsavelNome: '',
        orgaoAutuador: '',
        endereco: item.endereco || '',
        municipio: item.municipio || '',
        uf: item.uf || '',
        rodoviaOuUrbano: item.rodoviaOuUrbano,
        valor: item.valor || 0,
        desconto: item.desconto || 0,
        valorComDesconto: item.valorComDesconto || 0,
        status: StatusMulta.IMPORTACAO_VAMOS, // Status Importação Vamos no Status
        tipo: item.tipo || TipoMulta.NOTIFICACAO,
        empresaOuCondutor: (item.empresaOuCondutor as 'EMPRESA' | 'CONDUTOR') || 'CONDUTOR',
        descontarMotorista: (item.descontarMotorista as 'SIM' | 'NÃO') || 'SIM',
        pagoComDesconto: (item.pagoComDesconto as 'SIM' | 'NÃO') || 'SIM',
        recebidaComPrazo: (item.recebidaComPrazo as 'SIM' | 'NÃO') || 'SIM',
        retornouComPrazo: (item.retornouComPrazo as 'SIM' | 'NÃO') || 'NÃO',
        descontoEnviadoRH: '',
        numDocumento: '',
        vencimento: '',
        obs: item.obs || '',
        linkAit: '',
        linkAuth: ''
      };
    });

    try {
      setImportMessage(`Iniciando gravação de ${multasParaGravar.length} multas...`);
      setImportProgress(20);

      await onImportSuccess(multasParaGravar, (percent, current, total) => {
        setImportProgress(percent);
        if (current > 0) {
          setImportMessage(`Gravando multas no sistema (${current}/${total})...`);
        } else {
          setImportMessage(`Processando ${total} multas...`);
        }
      });

      setImportProgress(100);
      setImportCompleted(true);
      setImportMessage(`${multasParaGravar.length} multas importadas com sucesso!`);

      setTimeout(() => {
        setIsImporting(false);
        onClose();
      }, 1200);
    } catch (error: any) {
      console.error('Erro ao importar multas:', error);
      setImportMessage(`Erro durante a gravação: ${error?.message || 'Tente novamente.'}`);
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-importar-multas-csv"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Importação de Multas via CSV
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Demonstrativo Vamos
                </span>
              </h2>
              <p className="text-xs text-emerald-100/70">
                Puxa dados automaticamente, separa o município e valida duplicidades por AIT e Placa/Data
              </p>
            </div>
          </div>
          <button
            id="btn-fechar-modal-importar"
            onClick={onClose}
            disabled={isImporting}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Se nenhum arquivo foi carregado ou usuário quer trocar */}
          {!parseResult ? (
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-gray-300 hover:border-emerald-400 bg-gray-50/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">
                Selecione ou arraste o arquivo CSV de Multas da Vamos
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                Formato com cabeçalho contendo Placa, AIT Principal, Data e Hora da Infração, Cód. da Infração, Local da Infração e Valor com Desconto.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all">
                <FileSpreadsheet className="w-4 h-4" />
                Procurar arquivo no computador
              </div>
              <div className="mt-4 flex items-center justify-center gap-6 text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Detecção automática de duplicidades
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Separação inteligente de Cidade
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Status "IMPORTAÇÃO VAMOS"
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Card com Metadados e Informações do Arquivo */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800">{fileName}</span>
                      <span className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                        {fileSize}
                      </span>
                      {parseResult.metadata.cliente && (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {parseResult.metadata.cliente}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-3 mt-0.5">
                      <span>Linhas processadas: <strong>{parseResult.totalRows}</strong></span>
                      {parseResult.metadata.qtdMultasDeclarada && (
                        <span>Qtd. Declarada no Cabeçalho: <strong>{parseResult.metadata.qtdMultasDeclarada}</strong></span>
                      )}
                      {parseResult.metadata.valorFaturadoDeclarado && (
                        <span>{parseResult.metadata.valorFaturadoDeclarado}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-trocar-arquivo"
                    onClick={() => {
                      setParseResult(null);
                      setFileName(null);
                    }}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Trocar arquivo
                  </button>
                </div>
              </div>

              {/* Métricas do Processamento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
                  <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Lidas</div>
                  <div className="text-xl font-black text-gray-800 mt-1">{parseResult.totalRows}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Do demonstrativo</div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 shadow-xs">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Aptas (Novas)
                  </div>
                  <div className="text-xl font-black text-emerald-800 mt-1">{parseResult.newCount}</div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">Sem duplicidades</div>
                </div>

                <div className={`rounded-xl p-3 shadow-xs border ${
                  parseResult.duplicateCount > 0
                    ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1">
                    {parseResult.duplicateCount > 0 ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-gray-400" />
                    )}
                    Duplicadas
                  </div>
                  <div className="text-xl font-black mt-1">
                    {parseResult.duplicateCount}
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {parseResult.duplicateCount > 0 ? 'Já no sistema' : 'Nenhuma detectada'}
                  </div>
                </div>

                <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 shadow-xs">
                  <div className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-purple-600" />
                    Valor Total c/ Desc.
                  </div>
                  <div className="text-xl font-black text-purple-900 mt-1">
                    R$ {parseResult.totalValorDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-purple-600 mt-0.5">Soma da importação</div>
                </div>
              </div>

              {/* Barra de Filtros e Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setTabFilter('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      tabFilter === 'all'
                        ? 'bg-white text-gray-800 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Todas ({parseResult.totalRows})
                  </button>
                  <button
                    onClick={() => setTabFilter('valid')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                      tabFilter === 'valid'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Aptas ({parseResult.newCount})
                  </button>
                  <button
                    onClick={() => setTabFilter('duplicate')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                      tabFilter === 'duplicate'
                        ? 'bg-white text-amber-800 shadow-xs'
                        : 'text-amber-700 hover:text-amber-900'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Duplicadas ({parseResult.duplicateCount})
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por placa, AIT, cidade..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer select-none whitespace-nowrap bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <input
                      type="checkbox"
                      checked={ignoreDuplicates}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIgnoreDuplicates(checked);
                        if (checked && parseResult) {
                          const updated = { ...selectedItems };
                          parseResult.items.forEach((it) => {
                            if (it.isDuplicate) updated[it.id] = false;
                          });
                          setSelectedItems(updated);
                        }
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    Ignorar duplicadas
                  </label>
                </div>
              </div>

              {/* Tabela de Prévia */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-100/80 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredItems.length > 0 &&
                              filteredItems.every((item) => selectedItems[item.id])
                            }
                            onChange={toggleSelectAll}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                        </th>
                        <th className="py-2.5 px-3">Validação</th>
                        <th className="py-2.5 px-3">Placa / Frota</th>
                        <th className="py-2.5 px-3">AIT Principal</th>
                        <th className="py-2.5 px-3">Data e Hora</th>
                        <th className="py-2.5 px-3">Infração / Enquadr.</th>
                        <th className="py-2.5 px-3">Cidade / Município</th>
                        <th className="py-2.5 px-3">Endereço Completo</th>
                        <th className="py-2.5 px-3 text-right">Valor c/ Desc.</th>
                        <th className="py-2.5 px-3 text-center">Status Atribuído</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-gray-400">
                            Nenhum registro encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => {
                          const isSelected = !!selectedItems[item.id];
                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-gray-50/80 transition-colors ${
                                item.isDuplicate
                                  ? 'bg-amber-50/40 text-amber-900'
                                  : isSelected
                                  ? 'bg-emerald-50/30'
                                  : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleItemSelection(item.id)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                                />
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {item.isDuplicate ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                                    title={item.duplicateReason}
                                  >
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Duplicada
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    Nova
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-[11px]">
                                    {item.placa}
                                  </span>
                                  {item.frota && item.frota !== item.placa && (
                                    <span className="text-[10px] text-gray-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      Frota {item.frota}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap font-mono font-semibold text-gray-800">
                                {item.ait}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <div className="text-[11px] font-medium text-gray-800">
                                  {item.dataHoraInfracao
                                    ? item.dataHoraInfracao.replace('T', ' ')
                                    : '-'}
                                </div>
                                <div className="text-[9.5px] text-gray-400">
                                  Rec: {item.dataRecebimento} (Hoje)
                                </div>
                              </td>
                              <td className="py-2 px-3 max-w-[200px]">
                                <div className="font-mono font-bold text-emerald-700 text-[10.5px]">
                                  {item.enquadramento}
                                </div>
                                <div
                                  className="truncate text-[10.5px] text-gray-600"
                                  title={item.descricaoInfracao}
                                >
                                  {item.descricaoInfracao}
                                </div>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-gray-900 bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 text-[10.5px]">
                                    {item.municipio || 'Não detectado'}
                                  </span>
                                  {item.uf && (
                                    <span className="text-[9.5px] text-gray-500 font-semibold">
                                      /{item.uf}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] text-gray-400 mt-0.5">
                                  {item.rodoviaOuUrbano}
                                </div>
                              </td>
                              <td className="py-2 px-3 max-w-[220px]">
                                <div
                                  className="truncate text-[10px] text-gray-600"
                                  title={item.endereco}
                                >
                                  {item.endereco}
                                </div>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-right font-mono font-bold text-gray-900">
                                R$ {item.valorComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-center">
                                <span className="inline-block px-2 py-0.5 rounded text-[9.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                                  IMPORTAÇÃO VAMOS
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Barra de Progresso durante a Importação */}
          {isImporting && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center animate-pulse">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 mb-2">
                <span>{importMessage}</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="text-xs text-gray-600">
            {parseResult && (
              <span>
                Selecionadas: <strong>{totalSelectedCount}</strong> multas | Total:{' '}
                <strong>
                  R$ {totalSelectedValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-cancelar-importacao"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {parseResult && (
              <button
                id="btn-confirmar-importacao-csv"
                onClick={handleConfirmImport}
                disabled={isImporting || totalSelectedCount === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Gravando multas...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Importação ({totalSelectedCount})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
