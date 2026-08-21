
import React from 'react';
import Modal from './Modal';
import { CarIcon, CheckCircleIcon, ClipboardListIcon, MapPinIcon } from './icons';

interface DailyUseGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DailyUseGuideModal: React.FC<DailyUseGuideModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Como Funciona: Uso Diário">
            <div className="max-h-[80vh] overflow-y-auto pr-2">
                {/* Header / Introduction */}
                <div className="text-center mb-6">
                    <p className="text-gray-600 text-sm">
                        Este módulo é destinado a saídas rápidas e uso rotineiro dos veículos da frota leve.
                        Siga o passo a passo abaixo para registrar sua saída e retorno.
                    </p>
                </div>

                {/* Visual Timeline Container */}
                <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:w-0.5 before:-translate-x-px before:h-full before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent md:before:mx-auto md:before:translate-x-0">
                    
                    {/* Step 1: Start */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8">
                        {/* Icon */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-green-600 bg-green-100 text-green-700 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <span className="font-bold text-lg">1</span>
                        </div>
                        
                        {/* Card */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-green-700">
                                <ClipboardListIcon className="h-5 w-5" />
                                <h4 className="font-bold">Registrar Saída</h4>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">
                                Ao pegar a chave do veículo, preencha o formulário de <strong>"Nova Viagem"</strong>.
                            </p>
                            <div className="bg-gray-50 p-3 rounded-md text-xs text-gray-500 space-y-1 border border-gray-100">
                                <div className="flex items-center gap-2">✅ Selecione o veículo disponível.</div>
                                <div className="flex items-center gap-2">✅ Informe seu nome e setor.</div>
                                <div className="flex items-center gap-2">✅ Confirme o KM Inicial (painel).</div>
                                <div className="flex items-center gap-2">✅ Indique o nível do tanque.</div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Drive */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8">
                        {/* Icon */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-blue-600 bg-blue-100 text-blue-700 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <span className="font-bold text-lg">2</span>
                        </div>
                        
                        {/* Card */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-blue-700">
                                <CarIcon className="h-5 w-5" />
                                <h4 className="font-bold">Durante a Viagem</h4>
                            </div>
                            <p className="text-sm text-gray-600">
                                O veículo ficará marcado como <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold text-xs">EM USO</span> no sistema.
                            </p>
                            <div className="mt-3 flex items-center justify-center">
                                <img src="https://placehold.co/200x100/eff6ff/1e40af?text=Status:+Em+Uso" alt="Visual Status" className="rounded border border-blue-100 opacity-80" />
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Return */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Icon */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-orange-600 bg-orange-100 text-orange-700 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <span className="font-bold text-lg">3</span>
                        </div>
                        
                        {/* Card */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-orange-700">
                                <CheckCircleIcon className="h-5 w-5" />
                                <h4 className="font-bold">Registrar Retorno</h4>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                Ao estacionar na empresa:
                            </p>
                            <ol className="text-xs text-gray-500 list-decimal list-inside bg-gray-50 p-3 rounded border border-gray-100 space-y-1">
                                <li>Abra este aplicativo novamente.</li>
                                <li>Sua viagem ativa aparecerá no topo.</li>
                                <li>Informe o <strong>KM Final</strong> do painel.</li>
                                <li>Informe o nível do tanque na chegada.</li>
                                <li>Clique em <strong className="text-green-700">"FINALIZAR VIAGEM"</strong>.</li>
                            </ol>
                        </div>
                    </div>

                </div>

                {/* Footer Info */}
                <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg flex items-start gap-3 shadow-sm">
                    <MapPinIcon className="h-6 w-6 text-yellow-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-yellow-800 font-bold">Importante:</p>
                        <p className="text-sm text-yellow-700">
                            Sempre devolva a chave no local designado (Gerenciamento de Riscos) e mantenha o veículo limpo para o próximo colega.
                        </p>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <button 
                        onClick={onClose} 
                        className="bg-primary text-white font-bold py-3 px-10 rounded-full hover:bg-green-800 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                    >
                        Entendi, vamos lá!
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default DailyUseGuideModal;
