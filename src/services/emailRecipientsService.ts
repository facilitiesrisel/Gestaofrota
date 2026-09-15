/**
 * Serviço Corporativo Risel para Gestão de Destinatários de E-mail por Submódulo
 * Permite que deny.goncalves@risel.com.br inclua, exclua e edite destinatários,
 * refletindo imediatamente no servidor em nuvem (Render) e Firestore.
 */

export type EmailSubmoduleKey = 
  | 'reservas' 
  | 'uso_diario' 
  | 'documentos' 
  | 'checklist' 
  | 'multas' 
  | 'frota_alertas'
  | 'rastreamento'
  | 'manutencao';

export interface SubmoduleEmailConfig {
  key: EmailSubmoduleKey;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  badge: string;
  defaultRecipients: string[];
}

export const SUBMODULES_METADATA: Record<EmailSubmoduleKey, SubmoduleEmailConfig> = {
  reservas: {
    key: 'reservas',
    title: 'Gestão de Reservas & Locações RAC',
    shortTitle: 'Reservas & RAC',
    category: 'Frota Leve',
    description: 'Solicitações de reserva de veículos próprios e locados (RAC), aprovações, recusas e cancelamentos.',
    badge: '📅 Reservas',
    defaultRecipients: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
  },
  uso_diario: {
    key: 'uso_diario',
    title: 'Uso Diário & Deslocamentos',
    shortTitle: 'Uso Diário',
    category: 'Frota Leve',
    description: 'Notificações de saídas, diário de bordo e finalizações de viagens operacionais.',
    badge: '📋 Uso Diário',
    defaultRecipients: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
  },
  documentos: {
    key: 'documentos',
    title: 'Lançamento & Aprovação de Documentos Fiscais',
    shortTitle: 'Documentos & NF',
    category: 'Financeiro',
    description: 'Notificações formais de solicitação de aprovação de notas fiscais, boletos e despesas com anexo.',
    badge: '📑 Lançamentos',
    defaultRecipients: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
  },
  checklist: {
    key: 'checklist',
    title: 'Checklist Veicular & Vistorias',
    shortTitle: 'Checklist',
    category: 'Frota Leve',
    description: 'Envio de comprovante de vistoria digital, registro de avarias e relatórios periódicos da frota.',
    badge: '✅ Checklist',
    defaultRecipients: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
  },
  multas: {
    key: 'multas',
    title: 'Controle de Multas & Notificações de Trânsito',
    shortTitle: 'Multas',
    category: 'Frota Leve',
    description: 'Alertas de autuação por placa, indicação de condutor infrator e controle de prazos recursais.',
    badge: '🚨 Multas',
    defaultRecipients: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
  },
  frota_alertas: {
    key: 'frota_alertas',
    title: 'Alertas de Telemetria & Finais de Semana',
    shortTitle: 'Alertas FDS',
    category: 'Frota Leve',
    description: 'Movimentações não autorizadas em finais de semana e fora do horário comercial.',
    badge: '📡 Telemetria',
    defaultRecipients: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
  },
  rastreamento: {
    key: 'rastreamento',
    title: 'Rastreamento & Alertas FDS',
    shortTitle: 'Rastreamento',
    category: 'Frota Leve',
    description: 'Alertas de movimentações suspeitas de fim de semana com mapa integrado.',
    badge: '📍 Rastreamento',
    defaultRecipients: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
  },
  manutencao: {
    key: 'manutencao',
    title: 'Manutenção Preventiva & Termos de Avaria',
    shortTitle: 'Manutenção',
    category: 'Manutenção',
    description: 'Avisos automáticos de limite de quilometragem, revisão preventiva e avarias.',
    badge: '🔧 Manutenção',
    defaultRecipients: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
  }
};

const STORAGE_KEY = 'risel_email_recipients_config_v1';

// Memória local para acesso síncrono imediato
let inMemoryConfig: Record<EmailSubmoduleKey, string[]> = {
  reservas: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br'],
  uso_diario: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br'],
  documentos: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br'],
  checklist: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br'],
  multas: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br'],
  frota_alertas: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br'],
  rastreamento: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br'],
  manutencao: ['deny.goncalves@risel.com.br', 'lorena.padilha@risel.com.br']
};

// Inicializa cache a partir do localStorage
if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      inMemoryConfig = { ...inMemoryConfig, ...parsed };
    }
  } catch (e) {}
}

/**
 * Consulta síncrona aos destinatários do submódulo (garante resposta imediata na renderização e formulários)
 */
export function getSubmoduleRecipientsSync(submodule: EmailSubmoduleKey): string[] {
  const list = inMemoryConfig[submodule];
  if (Array.isArray(list) && list.length > 0) {
    return [...list];
  }
  return [...SUBMODULES_METADATA[submodule].defaultRecipients];
}

/**
 * Carrega a configuração atualizada diretamente da API do Render / Firestore
 */
export async function fetchEmailRecipientsConfig(): Promise<Record<EmailSubmoduleKey, string[]>> {
  try {
    const res = await fetch('/api/email-recipients-config');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        inMemoryConfig = { ...inMemoryConfig, ...data.config };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryConfig));
          } catch (e) {}
        }
        return { ...inMemoryConfig };
      }
    }
  } catch (err) {
    console.warn('[EmailRecipientsService] Aviso ao carregar do servidor, utilizando cache local:', err);
  }
  return { ...inMemoryConfig };
}

/**
 * Salva a lista de destinatários de um submódulo específico, refletindo diretamente no Render
 */
export async function saveSubmoduleRecipients(
  submodule: EmailSubmoduleKey,
  recipients: string[],
  userEmail: string = 'deny.goncalves@risel.com.br'
): Promise<{ success: boolean; message: string }> {
  // Limpar e validar e-mails
  const cleanList = Array.from(new Set(
    recipients
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && e.includes('@') && e.includes('.'))
  ));

  if (cleanList.length === 0) {
    return {
      success: false,
      message: 'Informe ao menos um endereço de e-mail corporativo válido.'
    };
  }

  // Atualiza cache local
  inMemoryConfig[submodule] = cleanList;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryConfig));
    } catch (e) {}
  }

  try {
    const res = await fetch('/api/email-recipients-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submodule,
        recipients: cleanList,
        userEmail
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: `Destinatários de ${SUBMODULES_METADATA[submodule].title} atualizados com sucesso e refletidos no Render!`
      };
    } else {
      return {
        success: false,
        message: data.error || 'Falha ao sincronizar com o servidor no Render.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro de conexão ao salvar no Render: ${err.message || String(err)}`
    };
  }
}

/**
 * Dispara um e-mail de teste para o submódulo específico no Render
 */
export async function sendTestEmailToSubmodule(
  submodule: EmailSubmoduleKey,
  recipients: string[],
  userEmail: string = 'deny.goncalves@risel.com.br'
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/email-recipients-config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submodule,
        recipients,
        userEmail
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'E-mail de teste enviado com sucesso!'
      };
    } else {
      return {
        success: false,
        message: data.error || 'Falha no disparo do e-mail de teste.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao enviar teste: ${err.message || String(err)}`
    };
  }
}

/**
 * Restaura os destinatários de um submódulo para os padrões oficiais da Risel
 */
export async function resetSubmoduleToDefaults(
  submodule: EmailSubmoduleKey,
  userEmail: string = 'deny.goncalves@risel.com.br'
): Promise<{ success: boolean; message: string; recipients: string[] }> {
  const defaults = [...SUBMODULES_METADATA[submodule].defaultRecipients];
  const saveRes = await saveSubmoduleRecipients(submodule, defaults, userEmail);
  return {
    ...saveRes,
    recipients: defaults
  };
}
