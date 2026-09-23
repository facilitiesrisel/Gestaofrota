import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Server, 
  ShieldCheck, 
  RotateCcw, 
  RefreshCw, 
  Upload, 
  X, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  getLancamentosUnified,
  getLancamentosSnapshotInfo,
  restoreLancamentosFromSnapshot,
  restoreLancamentosFromList,
  exportLancamentosBackupJson,
  createDatabaseBackup,
  restoreFromDatabaseBackup,
  fetchDatabaseBackups,
  DatabaseBackupInfo
} from '../../services/lancamentosService';

interface LancamentosBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  lancamentosCount?: number;
}

export const LancamentosBackupModal: React.FC<LancamentosBackupModalProps> = ({
  isOpen,
  onClose,
  lancamentosCount
}) => {
  const [lancamentos, setLancamentos] = useState<any[]>(() => getLancamentosUnified());
  const [backupSyncLoading, setBackupSyncLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [snapshotInfo, setSnapshotInfo] = useState<{ hasSnapshot: boolean; count: number; timestamp?: string }>(() => getLancamentosSnapshotInfo());
  const [serverBackups, setServerBackups] = useState<DatabaseBackupInfo[]>([]);
  const [loadingServerBackups, setLoadingServerBackups] = useState(false);

  const loadServerBackups = async () => {
    setLoadingServerBackups(true);
    try {
      const backups = await fetchDatabaseBackups();
      setServerBackups(backups);
    } catch (e) {
      console.warn("Erro ao buscar backups do servidor:", e);
    } finally {
      setLoadingServerBackups(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLancamentos(getLancamentosUnified());
      setSnapshotInfo(getLancamentosSnapshotInfo());
      loadServerBackups();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCount = typeof lancamentosCount === 'number' ? lancamentosCount : lancamentos.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-200 text-emerald-700 shrink-0 shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Segurança & Banco de Dados de Lançamentos</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Persistência permanente no Banco de Dados • Exclusivo Deny Gonçalves</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensagem de Feedback */}
        {backupMessage && (
          <div className={cn(
            "p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2 shrink-0",
            backupMessage.type === "success" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
            backupMessage.type === "error" && "bg-rose-50 text-rose-800 border border-rose-200",
            backupMessage.type === "info" && "bg-blue-50 text-blue-800 border border-blue-200"
          )}>
            {backupMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{backupMessage.text}</span>
          </div>
        )}

        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Status das 3 Camadas do Banco de Dados */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-left">
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
                <Database className="w-4 h-4" />
                <span>Banco Atual</span>
              </div>
              <span className="text-[12px] text-slate-700 font-bold block">
                {currentCount} documentos
              </span>
              <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                Banco de dados oficial ativo
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-left">
              <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-bold mb-1">
                <Server className="w-4 h-4" />
                <span>Backups Servidor</span>
              </div>
              <span className="text-[12px] text-slate-700 font-bold block">
                {serverBackups.length} versionados
              </span>
              <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                Snapshots físicos no servidor
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-left">
              <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Cofre Local</span>
              </div>
              <span className="text-[12px] text-slate-700 font-bold block">
                {snapshotInfo.hasSnapshot ? `${snapshotInfo.count} registros` : "Nenhum"}
              </span>
              <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                Backup de emergência local
              </span>
            </div>
          </div>

          {/* Ações de Gestão de Banco de Dados */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider text-left">
              Ações de Banco de Dados e Restauração Imediata
            </div>

            {/* Botão Criar Ponto de Restauração no Banco de Dados Agora */}
            <button
              type="button"
              disabled={backupSyncLoading || currentCount === 0}
              onClick={async () => {
                setBackupSyncLoading(true);
                setBackupMessage(null);
                try {
                  const res = await createDatabaseBackup();
                  if (res.success) {
                    setBackupMessage({
                      type: "success",
                      text: `Ponto de restauração gravado com sucesso no Banco de Dados do Servidor! (${res.count} lançamentos protegidos)`
                    });
                    loadServerBackups();
                  } else {
                    setBackupMessage({
                      type: "error",
                      text: res.error || "Erro ao criar backup no banco de dados."
                    });
                  }
                } catch (e: any) {
                  setBackupMessage({
                    type: "error",
                    text: "Erro de conexão ao gravar backup: " + (e?.message || "")
                  });
                } finally {
                  setBackupSyncLoading(false);
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-700" />
                <div className="text-left">
                  <span className="block font-bold">Criar Novo Ponto de Backup no Banco de Dados</span>
                  <span className="block text-[10px] text-emerald-700/80 font-normal">Gera uma cópia física e versionada no disco rígido do servidor</span>
                </div>
              </div>
              <span className="text-[11px] text-emerald-800 font-bold">Gravar Backup</span>
            </button>

            {/* Botão Restaurar do Último Backup do Banco de Dados */}
            <button
              type="button"
              disabled={backupSyncLoading}
              onClick={async () => {
                setBackupSyncLoading(true);
                setBackupMessage(null);
                try {
                  const res = await restoreFromDatabaseBackup();
                  if (res.success && res.count > 0) {
                    setLancamentos(getLancamentosUnified());
                    setBackupMessage({
                      type: "success",
                      text: `Sucesso absoluto! ${res.count} lançamentos restaurados diretamente do Banco de Dados do Servidor!`
                    });
                  } else {
                    setBackupMessage({
                      type: "info",
                      text: res.error || "Nenhum backup em arquivo encontrado no servidor. Tente restaurar do cofre local ou importar um JSON."
                    });
                  }
                } catch (e: any) {
                  setBackupMessage({
                    type: "error",
                    text: "Erro ao restaurar do banco de dados: " + (e?.message || "")
                  });
                } finally {
                  setBackupSyncLoading(false);
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-indigo-700" />
                <div className="text-left">
                  <span className="block font-bold">Restaurar do Banco de Dados do Servidor</span>
                  <span className="block text-[10px] text-indigo-700/80 font-normal">Recupera a base de dados a partir do arquivo de backup do servidor</span>
                </div>
              </div>
              <span className="text-[11px] text-indigo-800 font-bold">Restaurar Banco</span>
            </button>

            {/* Botão Restaurar do Snapshot Local */}
            {snapshotInfo.hasSnapshot && (
              <button
                type="button"
                onClick={() => {
                  const res = restoreLancamentosFromSnapshot();
                  if (res.success && res.count > 0) {
                    setLancamentos(getLancamentosUnified());
                    setBackupMessage({
                      type: "success",
                      text: `Sucesso! ${res.count} lançamentos recuperados do Cofre Local e salvos no Banco de Dados!`
                    });
                    loadServerBackups();
                  } else {
                    setBackupMessage({
                      type: "error",
                      text: "Não foi possível restaurar do snapshot local."
                    });
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <div className="text-left">
                    <span className="block font-bold">Restaurar do Cofre de Segurança Local</span>
                    <span className="block text-[10px] text-amber-700/80 font-normal">
                      Contém {snapshotInfo.count} lançamentos preservados na memória deste computador
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-amber-800 font-bold">Restaurar Local</span>
              </button>
            )}

            {/* Lista de Histórico de Backups Disponíveis no Servidor */}
            {serverBackups.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Histórico de Backups no Banco de Dados ({serverBackups.length})
                  </span>
                  <button
                    type="button"
                    onClick={loadServerBackups}
                    className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={cn("w-3 h-3", loadingServerBackups && "animate-spin")} />
                    <span>Atualizar</span>
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {serverBackups.slice(0, 5).map((b, idx) => (
                    <div key={b.filename || idx} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 text-xs shadow-2xs">
                      <div className="text-left">
                        <span className="font-bold text-slate-800 block leading-tight">
                          {b.count} lançamentos
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {b.timestamp ? new Date(b.timestamp).toLocaleString("pt-BR") : b.filename}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={backupSyncLoading}
                        onClick={async () => {
                          if (!window.confirm(`Deseja restaurar este backup do banco contendo ${b.count} lançamentos?`)) return;
                          setBackupSyncLoading(true);
                          try {
                            const res = await restoreFromDatabaseBackup(b.filename);
                            if (res.success) {
                              setLancamentos(getLancamentosUnified());
                              setBackupMessage({
                                type: "success",
                                text: `Sucesso! ${res.count} lançamentos restaurados do backup selecionado!`
                              });
                            }
                          } finally {
                            setBackupSyncLoading(false);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botão Download Backup JSON */}
            <button
              type="button"
              onClick={() => {
                exportLancamentosBackupJson();
                setBackupMessage({
                  type: "success",
                  text: "Backup do banco de dados exportado com sucesso! Arquivo .JSON salvo no seu computador."
                });
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-emerald-600 rotate-180" />
                <div className="text-left">
                  <span className="block font-bold">Exportar Backup Completo do Banco (.JSON)</span>
                  <span className="block text-[10px] text-slate-400 font-normal">Baixa arquivo de contingência com todos os documentos salvos</span>
                </div>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold">Exportar</span>
            </button>

            {/* Botão Importar Arquivo de Backup ou Planilha CSV/JSON para o Banco */}
            <label className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-indigo-600" />
                <div className="text-left">
                  <span className="block font-bold">Importar Arquivo Real (.JSON ou .CSV) para o Banco de Dados</span>
                  <span className="block text-[10px] text-slate-400 font-normal">Processa e grava o histórico real diretamente no Banco de Dados</span>
                </div>
              </div>
              <span className="text-[11px] text-indigo-700 font-bold">Selecionar Arquivo</span>
              <input
                type="file"
                accept=".json,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    try {
                      const content = event.target?.result as string;
                      let itemsList: any[] = [];
                      
                      if (file.name.endsWith(".json") || content.trim().startsWith("[") || content.trim().startsWith("{")) {
                        try {
                          const parsed = JSON.parse(content);
                          itemsList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
                        } catch (errJson) {
                          itemsList = [];
                        }
                      }

                      if (itemsList.length === 0 && (content.includes(";") || content.includes(","))) {
                        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
                        if (lines.length > 1) {
                          const delimiter = lines[0].includes(";") ? ";" : ",";
                          const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, "").toUpperCase());
                          for (let i = 1; i < lines.length; i++) {
                            const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ""));
                            if (cols.length >= 2) {
                              const itemObj: any = { id: Date.now() + i };
                              headers.forEach((h, hIdx) => {
                                if (h.includes("FORNECEDOR")) itemObj.fornecedor = cols[hIdx];
                                else if (h.includes("CNPJ")) itemObj.cnpj = cols[hIdx];
                                else if (h.includes("VALOR")) itemObj.valor = cols[hIdx];
                                else if (h.includes("VENCIMENTO")) itemObj.dataVencimento = cols[hIdx];
                                else if (h.includes("STATUS")) itemObj.status = cols[hIdx];
                                else if (h.includes("DOC")) itemObj.doc = cols[hIdx];
                              });
                              if (itemObj.fornecedor || itemObj.valor) itemsList.push(itemObj);
                            }
                          }
                        }
                      }

                      if (itemsList.length > 0) {
                        setBackupSyncLoading(true);
                        const res = await restoreLancamentosFromList(itemsList);
                        if (res.success) {
                          setLancamentos(getLancamentosUnified());
                          setBackupMessage({
                            type: "success",
                            text: `Sucesso! ${res.count} lançamentos do arquivo foram importados e salvos no Banco de Dados!`
                          });
                          loadServerBackups();
                        } else {
                          setBackupMessage({
                            type: "error",
                            text: "Falha ao gravar arquivo no banco de dados."
                          });
                        }
                      } else {
                        setBackupMessage({
                          type: "error",
                          text: "Arquivo inválido ou sem formato reconhecível de lançamentos (.json ou .csv)."
                        });
                      }
                    } catch (errParse: any) {
                      setBackupMessage({
                        type: "error",
                        text: "Erro ao ler arquivo: " + errParse.message
                      });
                    } finally {
                      setBackupSyncLoading(false);
                      e.target.value = "";
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>

        <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            🔒 Sincronizado automaticamente entre Banco de Dados do Servidor, Supabase e Nuvem.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#114D38] text-white hover:bg-[#0d3b2b] transition-all cursor-pointer shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
