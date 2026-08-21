
import React, { useState } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { DatabaseIcon, ExclamationTriangleIcon, MailIcon } from './icons';
import Modal from './Modal';
import { activeDatabaseId, activeEnv } from '../../firebaseConfig';
import config from '../../../firebase-applet-config.json';

const SettingsView: React.FC = () => {
    const { clearAllData, reservations, dailyTrips, isLoading } = useReservations();
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    // Configurações dinâmicas de projeto do Firebase (Histórico vs Sandbox)
    const [selectedProject, setSelectedProject] = useState(activeEnv);
    const [isSavingProject, setIsSavingProject] = useState(false);
    const [projectSuccessMessage, setProjectSuccessMessage] = useState<string | null>(null);

    // State for SMTP Email Test
    const [testEmailRecipient, setTestEmailRecipient] = useState('deny.goncalves@risel.com.br');
    const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleSendTestEmail = async () => {
        setIsSendingTestEmail(true);
        setTestEmailResult(null);
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: testEmailRecipient,
                    subject: "Risel Frota - Teste de Conexão SMTP Segura",
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                            <div style="background-color: #15803d; color: white; padding: 20px; text-align: center;">
                                <h1 style="margin: 0; font-size: 24px;">Risel Combustíveis</h1>
                                <p style="margin: 5px 0 0 0; opacity: 0.9;">Teste de Conexão SMTP do Sistema de Frota</p>
                            </div>
                            <div style="padding: 24px; color: #333; line-height: 1.6;">
                                <h2 style="color: #15803d; margin-top: 0;">Parabéns! Conexão realizada com sucesso.</h2>
                                <p>Este é um e-mail de teste automático enviado pelo sistema <strong>Risel Frota</strong> para certificar que as novas credenciais e configurações SMTP seguras do seu domínio estão 100% ativas e funcionais.</p>
                                
                                <div style="background-color: #f0fdf4; border-left: 4px solid #15803d; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                    <strong>Detalhes do Envio:</strong>
                                    <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                                        <li><strong>Remetente:</strong> deny.goncalves@risel.com.br</li>
                                        <li><strong>Destinatário:</strong> ${testEmailRecipient}</li>
                                        <li><strong>Data/Hora do Envio:</strong> ${new Date().toLocaleString('pt-BR')}</li>
                                        <li><strong>Status:</strong> Ativo &amp; Criptografado</li>
                                    </ul>
                                </div>
                                
                                <p>Toda a dinâmica de alertas, relatórios de abastecimento, solicitações de agendamento e finalizações de viagens agora será roteada por este canal oficial de forma totalmente integrada e transparente.</p>
                            </div>
                            <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee;">
                                Risel Combustíveis © ${new Date().getFullYear()} - Todos os direitos reservados.
                            </div>
                        </div>
                    `
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                setTestEmailResult({
                    success: true,
                    message: `E-mail de teste enviado com SUCESSO através do servidor SMTP (${data.host})!`
                });
            } else {
                setTestEmailResult({
                    success: false,
                    message: `Falha no envio: ${data.error || 'Erro desconhecido.'} ${data.details ? `Detalhes: ${data.details}` : ''}`
                });
            }
        } catch (error: any) {
            setTestEmailResult({
                success: false,
                message: `Erro de rede ou conexão: ${error.message || String(error)}`
            });
        } finally {
            setIsSendingTestEmail(false);
        }
    };

    const handleSaveProject = () => {
        setIsSavingProject(true);
        localStorage.setItem('custom_firebase_project', selectedProject);
        setProjectSuccessMessage("Conexão alterada! Recarregando o sistema...");
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    const handleClearData = async () => {
        setIsClearing(true);
        try {
            await clearAllData();
            setIsClearModalOpen(false);
            alert("Dados limpos com sucesso.");
        } catch (error) {
            alert("Erro ao limpar dados. Verifique o console.");
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Configurações do Sistema</h2>

            <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <DatabaseIcon className="h-6 w-6 text-gray-600" />
                    Status da Base de Dados
                </h3>
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">
                        <strong>Conexão:</strong> <span className="text-green-600 font-bold">Ativa</span> (Firebase Firestore)
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                        <strong>Reservas Registradas:</strong> {reservations.length}
                    </p>
                    <p className="text-sm text-gray-600">
                        <strong>Viagens Diárias:</strong> {dailyTrips.length}
                    </p>
                </div>
            </div>

            <div className="mb-8 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MailIcon className="h-6 w-6 text-primary" />
                    Teste de Envio de E-mail (SMTP Seguro)
                </h3>
                <div className="bg-green-50 p-4 rounded-md border border-green-200">
                    <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                        Utilize esta seção para verificar se as chaves e credenciais do seu e-mail <strong>deny.goncalves@risel.com.br</strong> estão funcionando corretamente.
                        O sistema tentará enviar uma mensagem de teste formatada utilizando conexões SMTP seguras.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
                        <div className="w-full sm:w-auto flex-1 max-w-lg">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Destinatário do Teste</label>
                            <input 
                                type="email"
                                value={testEmailRecipient} 
                                onChange={(e) => setTestEmailRecipient(e.target.value)}
                                placeholder="exemplo@risel.com.br"
                                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>

                        <button 
                            onClick={handleSendTestEmail}
                            disabled={isSendingTestEmail || !testEmailRecipient}
                            className="w-full sm:w-auto bg-primary text-white font-bold py-2 px-5 rounded hover:bg-green-800 transition-colors shrink-0 text-sm shadow disabled:opacity-50"
                        >
                            {isSendingTestEmail ? 'Enviando Teste...' : 'Enviar E-mail de Teste'}
                        </button>
                    </div>

                    {testEmailResult && (
                        <div className={`mt-4 p-3 rounded text-sm font-semibold border ${
                            testEmailResult.success 
                                ? 'bg-green-100 border-green-300 text-green-800' 
                                : 'bg-red-100 border-red-300 text-red-800'
                        }`}>
                            {testEmailResult.message}
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-8 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <DatabaseIcon className="h-6 w-6 text-orange-600" />
                    Selecionar Ambiente e Vínculo do Firebase
                </h3>
                <div className="bg-orange-50 p-4 rounded-md border border-orange-200">
                    <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                        Se os seus dados originais (veículos, reservas e histórico) estiverem "zerados", é provável que o sistema esteja apontando para a base de testes vazia.
                        Você pode alternar livremente entre o <strong>Ambiente de Produção (com todos os seus dados originais)</strong> e o <strong>Ambiente de Sandbox (testes do AI Studio)</strong>:
                    </p>

                    {projectSuccessMessage && (
                        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded text-sm font-bold animate-pulse">
                            {projectSuccessMessage}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="w-full sm:w-auto flex-1 max-w-lg">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Selecione o Projeto do Firebase</label>
                            <select 
                                value={selectedProject} 
                                onChange={(e) => setSelectedProject(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="production">Ambiente de Produção (Risel Frota - "clean-sector-477820-u3")</option>
                                <option value="sandbox">Ambiente de Sandbox (AI Studio - "{config.projectId}")</option>
                            </select>
                        </div>

                        <button 
                            onClick={handleSaveProject}
                            disabled={isSavingProject}
                            className="w-full sm:w-auto bg-orange-600 text-white font-bold py-2 px-5 rounded hover:bg-orange-700 transition-colors shrink-0 text-sm mt-5 sm:mt-0 shadow"
                        >
                            {isSavingProject ? 'Salvando...' : 'Aplicar Alteração e Reiniciar'}
                        </button>
                    </div>

                    <div className="mt-4 text-xs text-gray-600 font-medium border-t pt-3 border-orange-100">
                        <strong>Projeto Ativo Atualmente:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-orange-200 text-orange-700 font-mono">{activeEnv === "sandbox" ? config.projectId : "clean-sector-477820-u3"}</code>
                        <span className="mx-2">|</span>
                        <strong>Database:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-orange-200 text-orange-700 font-mono">{activeDatabaseId}</code>
                    </div>
                </div>
            </div>

            <div className="border-t pt-6">
                <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-6 w-6" />
                    Zona de Perigo
                </h3>
                <div className="bg-red-50 p-4 rounded-md border border-red-200">
                    <p className="text-sm text-red-800 mb-4">
                        A ação abaixo irá apagar <strong>todas</strong> as reservas e registros de uso diário do banco de dados. 
                        Esta ação é irreversível e útil apenas para reiniciar o sistema ou limpar dados de teste.
                        Os veículos e usuários não serão apagados.
                    </p>
                    <button 
                        onClick={() => setIsClearModalOpen(true)} 
                        className="bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700 transition-colors"
                        disabled={isLoading || isClearing}
                    >
                        {isClearing ? 'Limpando...' : 'Apagar Todas as Reservas e Usos Diários'}
                    </button>
                </div>
            </div>

            <Modal
                isOpen={isClearModalOpen}
                onClose={() => setIsClearModalOpen(false)}
                title="Confirmar Limpeza de Dados"
            >
                <div className="text-center">
                    <ExclamationTriangleIcon className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <p className="text-lg font-bold text-gray-800 mb-2">Tem certeza absoluta?</p>
                    <p className="text-gray-600 mb-6">
                        Você está prestes a excluir <strong>{reservations.length} reservas</strong> e <strong>{dailyTrips.length} registros de uso diário</strong>. 
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={() => setIsClearModalOpen(false)} 
                            className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleClearData} 
                            className="bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700"
                        >
                            Confirmar e Apagar Tudo
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SettingsView;
