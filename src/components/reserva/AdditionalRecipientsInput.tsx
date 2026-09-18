import React, { useState } from 'react';
import { Mail, Plus, X, Users, Sparkles, Check } from 'lucide-react';

export interface DefaultRecipientInfo {
  label: string;
  email: string;
  isPrimary?: boolean;
}

interface AdditionalRecipientsInputProps {
  additionalEmails: string[];
  onChange: (emails: string[]) => void;
  defaultRecipients?: DefaultRecipientInfo[];
  title?: string;
  description?: string;
  theme?: 'emerald' | 'rose' | 'amber';
  quickSuggestions?: string[];
}

export const AdditionalRecipientsInput: React.FC<AdditionalRecipientsInputProps> = ({
  additionalEmails,
  onChange,
  defaultRecipients = [],
  title = "Destinatários Adicionais (Em Cópia)",
  description = "Adicione e-mails de outros gestores ou departamentos que também devem receber esta notificação.",
  theme = 'emerald',
  quickSuggestions = []
}) => {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [showDefaultList, setShowDefaultList] = useState(false);

  const themeClasses = {
    emerald: {
      border: 'border-emerald-200',
      bgLight: 'bg-emerald-50/50',
      textTitle: 'text-emerald-900',
      textSubtitle: 'text-emerald-700',
      focusRing: 'focus:border-emerald-500 focus:ring-emerald-500/20',
      chipBg: 'bg-emerald-100/80 text-emerald-800 border-emerald-300',
      btnBg: 'bg-[#114D38] hover:bg-[#0d3b2c] text-white',
      badgeBg: 'bg-emerald-100 text-emerald-800'
    },
    rose: {
      border: 'border-rose-200',
      bgLight: 'bg-rose-50/50',
      textTitle: 'text-rose-900',
      textSubtitle: 'text-rose-700',
      focusRing: 'focus:border-rose-500 focus:ring-rose-500/20',
      chipBg: 'bg-rose-100/80 text-rose-800 border-rose-300',
      btnBg: 'bg-rose-600 hover:bg-rose-700 text-white',
      badgeBg: 'bg-rose-100 text-rose-800'
    },
    amber: {
      border: 'border-amber-200',
      bgLight: 'bg-amber-50/50',
      textTitle: 'text-amber-900',
      textSubtitle: 'text-amber-700',
      focusRing: 'focus:border-amber-500 focus:ring-amber-500/20',
      chipBg: 'bg-amber-100/80 text-amber-800 border-amber-300',
      btnBg: 'bg-amber-600 hover:bg-amber-700 text-white',
      badgeBg: 'bg-amber-100 text-amber-800'
    }
  }[theme];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleAddEmail = (emailToAdd: string) => {
    setInputError('');
    const raw = emailToAdd.trim().toLowerCase();
    if (!raw) return;

    // Suporta múltiplos e-mails colados de uma vez separados por vírgula, ponto e vírgula ou espaço
    const parts = raw.split(/[\s,;]+/).filter(Boolean);
    const validToAdd: string[] = [];
    let hasInvalid = false;

    for (const part of parts) {
      if (emailRegex.test(part)) {
        // Verifica se já está na lista adicional ou na lista padrão
        const inAdditional = additionalEmails.some(e => e.toLowerCase() === part);
        const inDefault = defaultRecipients.some(d => d.email.toLowerCase() === part);

        if (!inAdditional && !inDefault) {
          validToAdd.push(part);
        }
      } else {
        hasInvalid = true;
      }
    }

    if (hasInvalid && validToAdd.length === 0) {
      setInputError('Informe um e-mail válido (ex: gestor@risel.com.br)');
      return;
    }

    if (validToAdd.length > 0) {
      onChange([...additionalEmails, ...validToAdd]);
      setInputValue('');
    } else if (!hasInvalid) {
      setInputError('Este e-mail já está na lista de envio.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      handleAddEmail(inputValue);
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    onChange(additionalEmails.filter(e => e !== emailToRemove));
  };

  // Filtra sugestões que ainda não foram adicionadas e não são os destinatários padrão
  const availableSuggestions = quickSuggestions
    .filter(s => {
      const clean = s.trim().toLowerCase();
      if (!clean || !emailRegex.test(clean)) return false;
      const inAdditional = additionalEmails.some(e => e.toLowerCase() === clean);
      const inDefault = defaultRecipients.some(d => d.email.toLowerCase() === clean);
      return !inAdditional && !inDefault;
    })
    .slice(0, 6);

  return (
    <div className={`p-3.5 rounded-xl border ${themeClasses.border} ${themeClasses.bgLight} space-y-2.5 text-xs text-left`}>
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className={`w-4 h-4 ${themeClasses.textTitle}`} />
          <span className={`font-bold ${themeClasses.textTitle}`}>
            {title}
          </span>
        </div>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${themeClasses.badgeBg}`}>
          {additionalEmails.length === 0
            ? 'Nenhum extra'
            : `+${additionalEmails.length} adicional${additionalEmails.length > 1 ? 'is' : ''}`}
        </span>
      </div>

      <p className={`text-[11px] ${themeClasses.textSubtitle} leading-relaxed`}>
        {description}
      </p>

      {/* Lista de Destinatários Padrão (Colapsável) */}
      {defaultRecipients.length > 0 && (
        <div className="bg-white/80 rounded-lg p-2 border border-slate-200/80 space-y-1">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Destinatários padrão que já receberão ({defaultRecipients.length}):
            </span>
            <button
              type="button"
              onClick={() => setShowDefaultList(!showDefaultList)}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              {showDefaultList ? 'Ocultar' : 'Ver lista'}
            </button>
          </div>

          {showDefaultList ? (
            <div className="pt-1.5 space-y-1 border-t border-slate-100 max-h-24 overflow-y-auto pr-1">
              {defaultRecipients.map((rec, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] text-slate-600">
                  <span className="truncate">
                    <span className="font-bold text-slate-700">{rec.label}:</span> {rec.email}
                  </span>
                  {rec.isPrimary && (
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold shrink-0">
                      Principal
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-500 truncate">
              {defaultRecipients.map(d => d.email).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Campo de inserção de novo e-mail */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="email"
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value);
                if (inputError) setInputError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="Digite o e-mail (ex: gestor@risel.com.br) e tecle Enter..."
              className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 ${themeClasses.focusRing} outline-none transition-all`}
            />
          </div>
          <button
            type="button"
            onClick={() => handleAddEmail(inputValue)}
            disabled={!inputValue.trim()}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${themeClasses.btnBg}`}
            title="Adicionar à lista de e-mails extras"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        </div>

        {inputError && (
          <p className="text-[10.5px] font-medium text-rose-600">
            {inputError}
          </p>
        )}
      </div>

      {/* Sugestões Rápidas (se houver) */}
      {availableSuggestions.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Sugestões rápidas de contatos corporativos:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {availableSuggestions.map(email => (
              <button
                key={email}
                type="button"
                onClick={() => handleAddEmail(email)}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium transition-colors cursor-pointer"
                title={`Clique para adicionar ${email}`}
              >
                <Plus className="w-2.5 h-2.5 text-slate-500" />
                <span>{email}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags dos e-mails adicionais incluídos */}
      {additionalEmails.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="font-bold text-[10.5px] text-slate-700 block">
            E-mails extras incluídos ({additionalEmails.length}):
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white/60 rounded-lg border border-slate-200/60">
            {additionalEmails.map(email => (
              <span
                key={email}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold ${themeClasses.chipBg}`}
              >
                <Check className="w-3 h-3 opacity-70" />
                <span className="truncate max-w-[220px]">{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  className="hover:opacity-75 p-0.5 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
                  title={`Remover ${email}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
