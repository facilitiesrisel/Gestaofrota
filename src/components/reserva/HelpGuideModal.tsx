
import React from 'react';
import ReactDOM from 'react-dom';
import { RiselLogo } from './RiselLogo';
import { 
    ClipboardListIcon, 
    DocumentTextIcon, 
    DownloadIcon, 
    DashboardIcon, 
    MapPinIcon, 
    CarIcon, 
    CalendarIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    SteeringWheelIcon
} from './icons';

interface HelpGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    type?: 'public' | 'admin';
}

const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose, type = 'public' }) => {
    
    const handlePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    const renderPublicContent = () => (
        <div className="space-y-8 max-w-3xl mx-auto text-black">
            {/* Seção 1: Acesso */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-accent border-l-4 border-primary pl-3 mb-3 flex items-center gap-2">
                    1. Acesso ao Sistema
                </h2>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-700 text-justify">
                    <p className="mb-2">
                        O sistema é web e pode ser acessado de qualquer computador ou smartphone conectado à internet.
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>Endereço:</strong> Acesse o link fornecido pela administração.</li>
                        <li><strong>Dispositivos:</strong> Compatível com PC, Tablet e Celular.</li>
                        <li><strong>Login:</strong> Não é necessário login para solicitações básicas.</li>
                    </ul>
                </div>
            </section>

            {/* Seção 2: Reservas */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-accent border-l-4 border-primary pl-3 mb-3 flex items-center gap-2">
                    <DocumentTextIcon className="h-6 w-6 text-primary"/> 2. Como Solicitar uma Reserva
                </h2>
                <p className="text-sm text-gray-600 mb-4 italic">
                    Utilize esta opção para viagens agendadas, viagens longas ou para garantir um veículo específico.
                </p>
                
                <div className="space-y-3">
                    <div className="step bg-gray-50 border border-gray-200 p-3 rounded-lg break-inside-avoid">
                        <h3 className="font-bold text-gray-800 text-sm">Passo 1: Preenchimento</h3>
                        <p className="text-xs text-gray-600">No menu, clique em "Solicitar Reserva". Preencha Nome, Setor, Destino e Datas.</p>
                    </div>
                    <div className="step bg-gray-50 border border-gray-200 p-3 rounded-lg break-inside-avoid">
                        <h3 className="font-bold text-gray-800 text-sm">Passo 2: Envio e Análise</h3>
                        <p className="text-xs text-gray-600">Ao enviar, a solicitação fica <span className="text-yellow-600 font-bold">PENDENTE</span>. Um e-mail é enviado aos gestores.</p>
                    </div>
                    <div className="step bg-gray-50 border border-gray-200 p-3 rounded-lg break-inside-avoid">
                        <h3 className="font-bold text-gray-800 text-sm">Passo 3: Aprovação</h3>
                        <p className="text-xs text-gray-600">
                            Você receberá um e-mail quando for <span className="text-green-600 font-bold">APROVADA</span> ou <span className="text-red-600 font-bold">REJEITADA</span>.
                        </p>
                    </div>
                    <div className="step bg-gray-50 border border-gray-200 p-3 rounded-lg break-inside-avoid">
                        <h3 className="font-bold text-gray-800 text-sm">Passo 4: Retirada</h3>
                        <p className="text-xs text-gray-600">No dia agendado, retire a chave do veículo designado no gerenciamento de riscos.</p>
                    </div>
                </div>
            </section>

            {/* Seção 3: Uso Diário */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-accent border-l-4 border-primary pl-3 mb-3 flex items-center gap-2">
                    <ClipboardListIcon className="h-6 w-6 text-primary"/> 3. Uso Diário (Saídas Rápidas)
                </h2>
                <p className="text-sm text-gray-600 mb-4 italic">
                    Para saídas imediatas e rotineiras sem agendamento prévio.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4 bg-white break-inside-avoid">
                        <h3 className="text-primary font-bold mb-2 border-b pb-2 text-sm">🟢 Na Saída</h3>
                        <ol className="list-decimal list-inside text-xs text-gray-700 space-y-2">
                            <li>Acesse <strong>"Uso Diário"</strong>.</li>
                            <li>Preencha <strong>"Nova Viagem"</strong>.</li>
                            <li>Selecione o veículo.</li>
                            <li>Confira o <strong>KM Inicial</strong>.</li>
                            <li>Clique em <strong>INICIAR</strong>.</li>
                        </ol>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4 bg-white break-inside-avoid">
                        <h3 className="text-orange-600 font-bold mb-2 border-b pb-2 text-sm">🔴 No Retorno</h3>
                        <ol className="list-decimal list-inside text-xs text-gray-700 space-y-2">
                            <li>Acesse o sistema.</li>
                            <li>Sua viagem estará no topo.</li>
                            <li>Informe <strong>KM Final</strong>.</li>
                            <li>Informe o combustível.</li>
                            <li>Clique em <strong>FINALIZAR</strong>.</li>
                        </ol>
                    </div>
                </div>
            </section>

            <div className="mt-8 bg-yellow-50 p-4 rounded border border-yellow-200 text-center break-inside-avoid">
                <p className="text-xs text-yellow-800 font-bold">
                    Dúvidas ou Problemas? Contate o setor de GR.
                </p>
            </div>
        </div>
    );

    const renderAdminContent = () => (
        <div className="space-y-10 max-w-4xl mx-auto text-black">
            {/* Introdução */}
            <section className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-sm text-gray-700 break-inside-avoid">
                <p className="mb-2">
                    Bem-vindo ao <strong>Painel Administrativo da Frota Risel</strong>. Este manual descreve as funcionalidades de gestão, monitoramento e controle disponíveis para os administradores do sistema.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                    <strong>Nota:</strong> O sistema utiliza dados em tempo real. Ações como excluir viagens ou aprovar reservas enviam notificações automáticas por e-mail.
                </p>
            </section>

            {/* Módulo 1: Dashboard */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-gray-800 border-b-2 border-primary pb-2 mb-4 flex items-center gap-3">
                    <div className="bg-primary text-white p-1.5 rounded-md"><DashboardIcon className="h-5 w-5"/></div>
                    1. Dashboard Analítico
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-sm text-gray-600 text-justify">
                        <p className="mb-3">
                            A tela inicial oferece uma visão macro da operação. Utilize os filtros de <strong>Ano e Mês</strong> no topo para ajustar o período de análise.
                        </p>
                        <ul className="list-disc list-inside space-y-2 pl-2">
                            <li><strong>KPIs (Cartões Coloridos):</strong> Indicadores de desempenho (Total de Viagens, KM Rodado, Pendências). As setas indicam a variação em relação ao mês anterior.</li>
                            <li><strong>Gráficos:</strong> Visualize tendências de uso, departamentos que mais utilizam a frota e status dos veículos.</li>
                            <li><strong>Personalização:</strong> Clique no botão <strong>"Nova Análise"</strong> para criar gráficos personalizados cruzando dados de Reservas, Uso Diário ou Veículos.</li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4 border border-gray-200">
                        <div className="text-center">
                            <span className="text-4xl">📊</span>
                            <p className="text-xs text-gray-500 mt-2">Dados visuais para tomada de decisão.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Módulo 2: Mapa */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-gray-800 border-b-2 border-primary pb-2 mb-4 flex items-center gap-3">
                    <div className="bg-primary text-white p-1.5 rounded-md"><MapPinIcon className="h-5 w-5"/></div>
                    2. Monitoramento em Tempo Real
                </h2>
                <div className="text-sm text-gray-600 space-y-3">
                    <p>O mapa integra dados do rastreador GeoFrotas com o sistema de reservas.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                            <h4 className="font-bold text-primary mb-1">Modo Rastreio</h4>
                            <p className="text-xs">Visualize a posição atual. Ícones <span className="text-green-600 font-bold">Verdes</span> estão Online/Em movimento. <span className="text-gray-400 font-bold">Cinzas</span> estão parados/offline.</p>
                        </div>
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                            <h4 className="font-bold text-primary mb-1">Modo Histórico</h4>
                            <p className="text-xs">Selecione um veículo e um intervalo de datas para ver o trajeto percorrido no mapa (linha azul).</p>
                        </div>
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                            <h4 className="font-bold text-primary mb-1">Alertas FDS</h4>
                            <p className="text-xs">O sistema envia e-mail automático se detectar movimento no fim de semana sem reserva aprovada.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Módulo 3: Reservas */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-gray-800 border-b-2 border-primary pb-2 mb-4 flex items-center gap-3">
                    <div className="bg-primary text-white p-1.5 rounded-md"><CalendarIcon className="h-5 w-5"/></div>
                    3. Gestão de Reservas
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                    Gerencie as solicitações feitas pelos colaboradores. As reservas aparecem ordenadas pela data de solicitação.
                </p>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                        <thead className="bg-gray-100 text-gray-700 font-bold">
                            <tr>
                                <th className="p-3">Ação</th>
                                <th className="p-3">Descrição</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            <tr>
                                <td className="p-3 font-bold text-green-700">Aprovar (✅)</td>
                                <td className="p-3">Confirma a reserva e envia e-mail de aprovação ao solicitante.</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-bold text-red-700">Rejeitar (❌)</td>
                                <td className="p-3">Nega a solicitação e notifica o solicitante via e-mail.</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-bold text-blue-700">Editar (✏️)</td>
                                <td className="p-3">Permite alterar veículo, datas ou motorista da reserva.</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-bold text-green-800">Iniciar (▶️)</td>
                                <td className="p-3">Marca que o veículo saiu do pátio (Muda status para "Em Uso").</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Módulo 4: Frota */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-gray-800 border-b-2 border-primary pb-2 mb-4 flex items-center gap-3">
                    <div className="bg-primary text-white p-1.5 rounded-md"><CarIcon className="h-5 w-5"/></div>
                    4. Gestão de Veículos
                </h2>
                
                <div className="flex flex-col gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-700">
                        <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 text-orange-500"/> Regras de Manutenção
                        </h4>
                        <p className="mb-2">O sistema monitora automaticamente o hodômetro de cada veículo a cada viagem finalizada.</p>
                        <ul className="list-disc list-inside text-xs space-y-1 text-gray-600">
                            <li><strong>Alerta Amarelo:</strong> Faltando 1.000 km para revisão.</li>
                            <li><strong>Alerta Vermelho:</strong> KM de revisão excedido ou data anual vencida.</li>
                            <li><strong>Lavagem:</strong> Alerta se o veículo não for marcado como lavado há mais de 30 dias.</li>
                        </ul>
                    </div>

                    <div className="text-sm text-gray-600">
                        <p><strong>Edição de Veículos:</strong> No menu "Veículos", você pode corrigir o KM atual manualmente, atualizar a data da última revisão e registrar lavagens. Utilize o ícone de lápis no card do veículo.</p>
                    </div>
                </div>
            </section>

            {/* Módulo 5: Diário de Bordo (Novo) */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-gray-800 border-b-2 border-primary pb-2 mb-4 flex items-center gap-3">
                    <div className="bg-primary text-white p-1.5 rounded-md"><ClipboardListIcon className="h-5 w-5"/></div>
                    5. Diário de Bordo (Uso Diário)
                </h2>
                <div className="text-sm text-gray-700 space-y-3">
                    <p>
                        Este módulo gerencia as saídas rápidas e rotineiras (diferente das reservas agendadas).
                        Ele possui duas abas principais: <strong>Em Andamento</strong> e <strong>Histórico</strong>.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                            <h4 className="font-bold text-primary mb-1 flex items-center gap-2">
                                <SteeringWheelIcon className="h-4 w-4"/> Em Andamento
                            </h4>
                            <p className="text-xs mb-2">Lista todos os veículos que estão na rua neste momento.</p>
                            <ul className="list-disc list-inside text-xs text-gray-600">
                                <li><strong>Botão Retorno:</strong> Use para finalizar a viagem quando o motorista voltar.</li>
                                <li><strong>Validar KM:</strong> O sistema não aceita KM final menor que o inicial.</li>
                            </ul>
                        </div>
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                            <h4 className="font-bold text-primary mb-1 flex items-center gap-2">
                                <CheckCircleIcon className="h-4 w-4"/> Histórico
                            </h4>
                            <p className="text-xs mb-2">Arquivo de todas as viagens finalizadas.</p>
                            <ul className="list-disc list-inside text-xs text-gray-600">
                                <li><strong>Alerta KM:</strong> Se o KM percorrido for 20% maior que o estimado pelo Google Maps, aparece um alerta "Excede Previsto".</li>
                                <li><strong>Edição:</strong> Admins podem corrigir dados de viagens passadas (ex: KM digitado errado).</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-md text-xs text-blue-800 mt-2">
                        <strong>Dica:</strong> Admins podem forçar a criação de uma viagem ("Adicionar Utilização") caso o motorista tenha esquecido de registrar a saída.
                    </div>
                </div>
            </section>

            {/* Módulo 6: Status da Frota (Novo) */}
            <section className="break-inside-avoid">
                <h2 className="text-xl font-bold text-gray-800 border-b-2 border-primary pb-2 mb-4 flex items-center gap-3">
                    <div className="bg-primary text-white p-1.5 rounded-md"><CarIcon className="h-5 w-5"/></div>
                    6. Status da Frota
                </h2>
                <div className="text-sm text-gray-700">
                    <p className="mb-3">
                        Uma visão geral visual de cada veículo. Os cartões são ordenados automaticamente: 
                        <strong>Disponíveis</strong> primeiro, seguidos de <strong>Em Uso/Reservados</strong>.
                    </p>

                    <div className="overflow-hidden border border-gray-200 rounded-lg">
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-100 font-bold">
                                <tr>
                                    <th className="p-2 text-left">Indicador</th>
                                    <th className="p-2 text-left">Significado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                <tr>
                                    <td className="p-2"><span className="bg-green-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">DISPONÍVEL</span></td>
                                    <td className="p-2">Veículo no pátio, sem reservas para hoje.</td>
                                </tr>
                                <tr>
                                    <td className="p-2"><span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">EM USO</span></td>
                                    <td className="p-2">Veículo saiu (via Reserva ou Diário de Bordo). Mostra o condutor atual.</td>
                                </tr>
                                <tr>
                                    <td className="p-2"><span className="bg-accent text-white px-2 py-0.5 rounded text-[10px] font-bold">RESERVADO</span></td>
                                    <td className="p-2">Veículo ainda está no pátio, mas tem uma reserva agendada para hoje.</td>
                                </tr>
                                <tr>
                                    <td className="p-2 font-bold text-gray-500">GPS / Online</td>
                                    <td className="p-2">Se o rastreador estiver ativo, mostra a localização atual e se a ignição está ligada.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <div className="mt-8 pt-4 border-t border-gray-300 text-center break-inside-avoid">
                <p className="text-xs text-gray-500">
                    Sistema desenvolvido para Risel Combustíveis - Frota Leve.
                    <br/>Gerado automaticamente em {new Date().toLocaleDateString('pt-BR')}.
                </p>
            </div>
        </div>
    );

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm modal-overlay">
            <style>{`
                @media print {
                    /* Oculta tudo que não é o modal */
                    body > *:not(.modal-overlay) { display: none !important; }
                    #root { display: none !important; }
                    
                    /* Configurações do corpo para permitir fluxo total */
                    html, body { 
                        height: auto !important; 
                        overflow: visible !important; 
                        background: white !important; 
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Configurações do container do modal para impressão */
                    .modal-overlay { 
                        position: static !important; 
                        background: white !important; 
                        display: block !important; 
                        width: 100% !important; 
                        height: auto !important; 
                        padding: 0 !important; 
                        overflow: visible !important; 
                        z-index: 9999 !important; 
                    }

                    /* Configurações do conteúdo interno do modal */
                    .modal-content { 
                        box-shadow: none !important; 
                        border: none !important; 
                        width: 100% !important; 
                        max-width: 100% !important; 
                        height: auto !important; 
                        max-height: none !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        overflow: visible !important; 
                        position: static !important; 
                    }

                    .printable-content { 
                        overflow: visible !important; 
                        height: auto !important; 
                        max-height: none !important; 
                        display: block !important; 
                        padding: 20px !important; 
                    }

                    /* Esconde botões e barras de ferramentas */
                    .no-print { display: none !important; }

                    /* Força cores e quebras de página */
                    * { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        color: black !important; 
                        text-shadow: none !important; 
                    }
                    
                    .text-primary { color: #00753f !important; }
                    .text-accent { color: #ff9b00 !important; }
                    .bg-primary { background-color: #00753f !important; color: white !important; }
                    .bg-gray-50 { background-color: #f9fafb !important; }
                    
                    a { text-decoration: none !important; color: black !important; }
                    
                    /* Evita quebra de página dentro de seções importantes */
                    section, .step, tr, .break-inside-avoid { 
                        break-inside: avoid; 
                        page-break-inside: avoid; 
                    }

                    /* Configuração da página A4 */
                    @page { 
                        size: A4 portrait; 
                        margin: 1.5cm; 
                    }
                }
            `}</style>

            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col animate-fadeIn modal-content">
                
                {/* Header Toolbar (Hidden on Print) */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl shrink-0 no-print">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {type === 'admin' ? 'Manual do Administrador' : 'Manual do Usuário'}
                    </h2>
                    <div className="flex gap-3">
                        <button 
                            type="button"
                            onClick={handlePrint}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
                            title="Clique para abrir a janela de impressão e selecione 'Salvar como PDF'"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            Imprimir / Salvar PDF
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content Area - Visible in Modal & Print */}
                <div className="flex-1 overflow-y-auto p-8 bg-white printable-content">
                    
                    {/* Header do Documento */}
                    <div className="header text-center mb-8 pb-4 border-b-2 border-primary break-inside-avoid">
                        <div className="flex justify-center mb-4">
                            <RiselLogo className="h-24 w-24" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-primary uppercase tracking-wide">Gestão de Frota Leve</h1>
                        <p className="text-accent font-bold text-lg mt-1">
                            {type === 'admin' ? 'Manual de Administração do Sistema' : 'Manual de Utilização do Sistema'}
                        </p>
                    </div>

                    {type === 'admin' ? renderAdminContent() : renderPublicContent()}

                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default HelpGuideModal;
