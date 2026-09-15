import React, { useState, useEffect } from 'react';
import { 
  EmailSubmoduleKey, 
  SUBMODULES_METADATA, 
  fetchEmailRecipientsConfig, 
  saveSubmoduleRecipients, 
  sendTestEmailToSubmodule, 
  resetSubmoduleToDefaults,
  getSubmoduleRecipientsSync
} from '../../services/emailRecipientsService';

interface EmailRecipientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSubmodule?: EmailSubmoduleKey;
  currentUserEmail?: string;
  onSaved?: () => void;
}

export const EmailRecipientsModal: React.FC<EmailRecipientsModalProps> = ({
  isOpen,
  onClose,
  initialSubmodule = 'reservas',
  currentUserEmail = 'deny.goncalves@risel.com.br',
  onSaved
}) => {
  const [activeSubmodule, setActiveSubmodule] = useState<EmailSubmoduleKey>(initialSubmodule);
  const [allConfigs, setAllConfigs] = useState<Record<EmailSubmoduleKey, string[]>>({
    reservas: getSubmoduleRecipientsSync('reservas'),
    uso_diario: getSubmoduleRecipientsSync('uso_diario'),
    documentos: getSubmoduleRecipientsSync('documentos'),
    checklist: getSubmoduleRecipientsSync('checklist'),
    multas: getSubmoduleRecipientsSync('multas'),
    frota_alertas: getSubmoduleRecipientsSync('frota_alertas'),
    rastreamento: getSubmoduleRecipientsSync('rastreamento'),
    manutencao: getSubmoduleRecipientsSync('manutencao'),
  });

  const [newEmail, setNewEmail] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveSubmodule(initialSubmodule);
      setFeedback(null);
      setNewEmail('');
      setEditingIndex(null);
      
      // Carrega dados frescos do servidor no Render
      fetchEmailRecipientsConfig().then(cfg => {
        setAllConfigs(prev => ({ ...prev, ...cfg }));
      });
    }
  }, [isOpen, initialSubmodule]);

  if (!isOpen) return null;

  const currentRecipients = allConfigs[activeSubmodule] || [];
  const meta = SUBMODULES_METADATA[activeSubmodule];

  const handleAddEmail = () => {
    const clean = newEmail.trim().toLowerCase();
    if (!clean) return;

    if (!clean.includes('@') || !clean.includes('.')) {
      setFeedback({ type: 'error', message: 'Por favor, informe um endereço de e-mail corporativo válido.' });
      return;
    }

    if (currentRecipients.includes(clean)) {
      setFeedback({ type: 'info', message: 'Este endereço de e-mail já está incluído na lista.' });
      return;
    }

    const updated = [...currentRecipients, clean];
    setAllConfigs(prev => ({ ...prev, [activeSubmodule]: updated }));
    setNewEmail('');
    setFeedback({ type: 'info', message: 'Destinatário adicionado. Lembre-se de clicar em "Salvar no Render" para persistir as alterações.' });
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    const updated = currentRecipients.filter(e => e !== emailToRemove);
    if (updated.length === 0) {
      setFeedback({ type: 'error', message: 'O submódulo precisa de pelo menos 1 destinatário ativo.' });
      return;
    }
    setAllConfigs(prev => ({ ...prev, [activeSubmodule]: updated }));
    setFeedback({ type: 'info', message: 'Destinatário removido da lista local. Clique em "Salvar no Render" para aplicar.' });
  };

  const handleStartEdit = (index: number, email: string) => {
    setEditingIndex(index);
    setEditValue(email);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const clean = editValue.trim().toLowerCase();

    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setFeedback({ type: 'error', message: 'E-mail inválido para alteração.' });
      return;
    }

    const updated = [...currentRecipients];
    updated[editingIndex] = clean;
    setAllConfigs(prev => ({ ...prev, [activeSubmodule]: Array.from(new Set(updated)) }));
    setEditingIndex(null);
    setEditValue('');
    setFeedback({ type: 'info', message: 'E-mail alterado. Clique em "Salvar no Render" para sincronizar.' });
  };

  const handleSaveToRender = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await saveSubmoduleRecipients(activeSubmodule, currentRecipients, currentUserEmail);
      if (res.success) {
        setFeedback({ type: 'success', message: `✅ Sucesso! Os destinatários de ${meta.shortTitle} foram gravados no Render e nuvem.` });
        if (onSaved) onSaved();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: `Erro ao salvar: ${e.message || String(e)}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setFeedback(null);
    try {
      const res = await sendTestEmailToSubmodule(activeSubmodule, currentRecipients, currentUserEmail);
      if (res.success) {
        setFeedback({ type: 'success', message: `📬 E-mail de teste disparado com sucesso para todos os destinatários!` });
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: `Falha no teste: ${e.message || String(e)}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetDefaults = async () => {
    if (window.confirm(`Deseja restaurar os destinatários padrões da Risel para "${meta.title}"?`)) {
      const res = await resetSubmoduleToDefaults(activeSubmodule, currentUserEmail);
      if (res.success) {
        setAllConfigs(prev => ({ ...prev, [activeSubmodule]: res.recipients }));
        setFeedback({ type: 'success', message: 'Destinatários restaurados para o padrão oficial da Risel.' });
        if (onSaved) onSaved();
      }
    }
  };

  const submoduleKeys = Object.keys(SUBMODULES_METADATA) as EmailSubmoduleKey[];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Corporativo Risel */}
        <div className="bg-[#114D38] px-6 py-4 border-b-4 border-[#f47920] flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 text-xl shadow-inner">
              ✉️
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide uppercase text-white m-0">
                Gerenciamento de Destinatários de E-mail
              </h2>
              <p className="text-xs text-emerald-200 m-0 font-medium">
                Configuração Corporativa &bull; Sincronização Direta no Render
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-lg"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Abas dos Submódulos */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 pt-3 shrink-0 flex items-center gap-1 overflow-x-auto">
          {submoduleKeys.map(key => {
            const m = SUBMODULES_METADATA[key];
            const isActive = activeSubmodule === key;
            const count = (allConfigs[key] || []).length;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveSubmodule(key);
                  setFeedback(null);
                  setEditingIndex(null);
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap border-t border-x ${
                  isActive
                    ? 'bg-white text-[#0d4a36] border-slate-200 border-b-transparent shadow-sm'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>{m.badge}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          
          {/* Card Informativo do Submódulo */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {meta.category}
                </span>
                <h3 className="text-sm font-black text-slate-900 m-0">
                  {meta.title}
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-1 mb-0 leading-relaxed">
                {meta.description}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-emerald-700 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sincronizado no Render
            </div>
          </div>

          {/* Alertas de Feedback */}
          {feedback && (
            <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 animate-fadeIn ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : feedback.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              <span>{feedback.message}</span>
              <button 
                onClick={() => setFeedback(null)} 
                className="opacity-60 hover:opacity-100 text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Lista de Destinatários Atuais */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Destinatários Cadastrados ({currentRecipients.length})
              </label>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-500 hover:text-rose-700 underline transition-colors"
                title="Restaurar lista de e-mails para os padrões corporativos Risel"
              >
                Restaurar Padrão Risel
              </button>
            </div>

            <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-white max-h-56 overflow-y-auto">
              {currentRecipients.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Nenhum destinatário cadastrado para este submódulo.
                </div>
              ) : (
                currentRecipients.map((email, idx) => {
                  const isEditingThis = editingIndex === idx;

                  return (
                    <div 
                      key={email}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors group"
                    >
                      {isEditingThis ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="email"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 text-xs px-2.5 py-1.5 border border-emerald-500 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') setEditingIndex(null);
                            }}
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="px-2.5 py-1 bg-[#114D38] text-white text-xs font-bold rounded-md hover:bg-[#0d4a36]"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="px-2 py-1 text-slate-500 text-xs hover:text-slate-800"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 font-mono truncate">
                              {email}
                            </span>
                            {(email === 'deny.goncalves@risel.com.br' || email === 'lorena.padilha@risel.com.br') && (
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                                Oficial Risel
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEdit(idx, email)}
                              className="px-2 py-1 text-[11px] text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                              title="Editar endereço de e-mail"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => handleRemoveEmail(email)}
                              className="px-2 py-1 text-[11px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                              title="Excluir este destinatário"
                            >
                              🗑️ Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Campo para Incluir Novo Destinatário */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1.5">
              ➕ Incluir Novo Destinatário
            </label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddEmail();
                }}
                placeholder="exemplo: novo.destinatario@risel.com.br"
                className="flex-1 text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#114D38] focus:border-transparent font-mono"
              />
              <button
                type="button"
                onClick={handleAddEmail}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition-colors shadow-sm shrink-0"
              >
                + Adicionar à Lista
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 mb-0">
              Pressione Enter ou clique em Adicionar. Para efetivar no Render e banco de dados, clique em "Salvar no Render" abaixo.
            </p>
          </div>

        </div>

        {/* Rodapé com Ações Corporativas */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunTest}
              disabled={isTesting || currentRecipients.length === 0}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              title="Disparar e-mail de teste imediato para os destinatários deste submódulo"
            >
              {isTesting ? 'Disparando...' : '🚀 Testar Disparo de Notificação'}
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSaveToRender}
              disabled={isSaving}
              className="px-5 py-2 bg-[#114D38] hover:bg-[#0d4a36] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-1.5 border border-[#1d7053]"
            >
              {isSaving ? 'Salvando no Render...' : '💾 Salvar no Render'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
