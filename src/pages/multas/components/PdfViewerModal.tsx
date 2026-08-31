import React, { useEffect } from 'react';
import { X, Download, Printer, FileText, CheckCircle2, ShieldCheck, UserCheck, Car, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { Multa } from '../types';
import { RISEL_LOGO_URL } from '../services/pdfGenerator';
import { generateAutorizacaoDescontoPdf } from '../services/pdfGenerator';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrlOrData?: string | null;
  title?: string;
  fileName?: string;
  multaData?: Partial<Multa> | null;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfUrlOrData,
  title = "Visualização do Documento (PDF)",
  fileName = "documento.pdf",
  multaData = null,
}) => {
  // Fechar ao pressionar a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Formatação de valores e datas
  const fmtMoney = (v?: number) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const fmtDate = (dStr?: string) => {
    if (!dStr) return '-';
    try {
      if (dStr.includes('T')) {
        const [dPart, t] = dStr.split('T');
        const [y, m, dNum] = dPart.split('-');
        return `${dNum}/${m}/${y} ${t ? t.substring(0, 5) : ''}`.trim();
      }
      if (dStr.includes('-')) {
        const [y, m, dNum] = dStr.split('-');
        return `${dNum}/${m}/${y}`;
      }
    } catch (e) {}
    return dStr;
  };

  const handleDownload = async () => {
    try {
      if (multaData) {
        const res = await generateAutorizacaoDescontoPdf(multaData);
        res.download();
        return;
      }

      if (pdfUrlOrData) {
        if (pdfUrlOrData.startsWith('data:')) {
          const parts = pdfUrlOrData.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
          const byteString = atob(parts[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          return;
        }

        const a = document.createElement('a');
        a.href = pdfUrlOrData;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error("Erro ao baixar documento:", e);
      if (pdfUrlOrData) window.open(pdfUrlOrData, '_blank');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isImageAttachment = pdfUrlOrData && (
    pdfUrlOrData.startsWith('data:image') || 
    pdfUrlOrData.toLowerCase().includes('.png') || 
    pdfUrlOrData.toLowerCase().includes('.jpg') || 
    pdfUrlOrData.toLowerCase().includes('.jpeg')
  );

  const valorOriginal = Number(multaData?.valor || 0);
  const desconto = Number(multaData?.desconto || 0);
  const valorFinal = Number(multaData?.valorComDesconto ?? (valorOriginal - desconto));
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const localCidade = multaData?.municipio && multaData.municipio !== '-' ? multaData.municipio : 'Campinas';
  const localUF = multaData?.uf && multaData.uf !== '-' ? multaData.uf : 'SP';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        // Fechar ao clicar no backdrop (fora do container da modal)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/80 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden select-text animate-in zoom-in-95 duration-200">
        
        {/* Header da Modal de Visualização */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800 gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <FileText size={20} />
            </div>
            <div className="truncate">
              <h3 className="text-sm sm:text-base font-black tracking-wide text-white truncate flex items-center">
                {title}
                <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  PDF Salvo & Vinculado
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">{fileName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-black flex items-center shadow-lg shadow-emerald-950/40 transition-all active:scale-95 border border-emerald-400/30"
              title="Baixar Arquivo PDF no seu Computador"
            >
              <Download size={15} className="mr-1.5 stroke-[2.5]" /> 
              <span className="hidden sm:inline">Baixar PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center transition-all border border-slate-700 active:scale-95"
              title="Imprimir Documento"
            >
              <Printer size={15} className="mr-1.5 hidden sm:inline" /> Imprimir
            </button>
            
            {/* Botão de Fechar com Alto Destaque */}
            <button
              type="button"
              onClick={onClose}
              className="bg-orange-600 hover:bg-orange-500 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black flex items-center shadow-md transition-all active:scale-95 border border-orange-400/40 ml-1"
              title="Fechar Visualização e Continuar Preenchimento"
            >
              <ArrowLeft size={15} className="mr-1.5" />
              <span>Fechar e Continuar</span>
            </button>
          </div>
        </div>

        {/* Notificação de Sucesso informando que o PDF está salvo */}
        <div className="bg-emerald-950/70 border-b border-emerald-800/60 px-4 py-2 flex items-center justify-between text-xs text-emerald-200 shrink-0">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="font-medium">
              O Termo de Autorização foi <strong>gerado com sucesso</strong> e já está <strong>salvo e anexado</strong> ao formulário desta infração.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-emerald-300 hover:text-white font-bold underline ml-2"
          >
            Voltar ao Lançamento &rarr;
          </button>
        </div>

        {/* Área de Conteúdo / Visualização */}
        <div className="flex-1 bg-slate-950/60 p-4 sm:p-6 overflow-y-auto custom-scrollbar flex justify-center items-start">
          
          {/* Caso 1: Termo de Autorização de Desconto em Folha (Renderização A4 Fiel e Nítida) */}
          {multaData ? (
            <div 
              id="printable-a4-sheet"
              className="bg-white text-slate-800 w-full max-w-[800px] shadow-2xl rounded-sm p-8 my-2 border border-slate-200 text-xs font-sans print:m-0 print:p-6 print:border-none print:shadow-none"
              style={{ minHeight: '1050px' }}
            >
              {/* Topo Timbrado Institucional */}
              <div className="bg-[#114D38] text-white p-4 rounded-t-sm flex items-center space-x-4 border-b-2 border-[#00A859] relative">
                <div className="w-14 h-14 bg-white rounded-lg p-1 shrink-0 flex items-center justify-center shadow-md">
                  <img src={RISEL_LOGO_URL} alt="Risel Combustíveis" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex-1 text-center pr-14">
                  <h1 className="text-base font-black tracking-wide uppercase">RISEL COMBUSTÍVEIS LTDA</h1>
                  <h2 className="text-xs font-medium text-emerald-100 mt-0.5 tracking-tight">
                    TERMO DE AUTORIZAÇÃO DE DESCONTO EM FOLHA & INDICAÇÃO DE CONDUTOR
                  </h2>
                </div>
              </div>

              {/* Corpo do Documento */}
              <div className="p-4 space-y-4">
                
                {/* 1. DADOS DO CONDUTOR */}
                <div>
                  <div className="flex items-center text-[#114D38] font-black text-xs uppercase mb-1.5">
                    <UserCheck size={14} className="mr-1.5 text-emerald-700" />
                    <span>1. DADOS DO CONDUTOR RESPONSÁVEL</span>
                  </div>
                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-[#114D38] text-white text-[10px] font-bold">
                      <tr>
                        <th className="p-2 border border-slate-300 w-1/2">Nome Completo do Motorista</th>
                        <th className="p-2 border border-slate-300">CPF / Matrícula</th>
                        <th className="p-2 border border-slate-300">Base / Filial</th>
                        <th className="p-2 border border-slate-300">Responsabilidade</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-50">
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold text-slate-900">{multaData.responsavelNome || 'MOTORISTA NÃO INFORMADO'}</td>
                        <td className="p-2 border border-slate-300 font-mono">{multaData.responsavelCodigo || 'NÃO INFORMADO'}</td>
                        <td className="p-2 border border-slate-300">{multaData.base || 'FILIAL'}</td>
                        <td className="p-2 border border-slate-300 font-bold text-emerald-800">{multaData.empresaOuCondutor || 'CONDUTOR'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. DADOS DA INFRAÇÃO E DO VEÍCULO */}
                <div>
                  <div className="flex items-center text-[#114D38] font-black text-xs uppercase mb-1.5">
                    <Car size={14} className="mr-1.5 text-emerald-700" />
                    <span>2. DADOS DA INFRAÇÃO DE TRÂNSITO E DO VEÍCULO</span>
                  </div>
                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-[#114D38] text-white text-[10px] font-bold">
                      <tr>
                        <th className="p-2 border border-slate-300">Placa</th>
                        <th className="p-2 border border-slate-300">Frota</th>
                        <th className="p-2 border border-slate-300">Auto de Infração (AIT)</th>
                        <th className="p-2 border border-slate-300">Data / Hora Infração</th>
                        <th className="p-2 border border-slate-300">Prazo Indicação</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-50 font-medium">
                      <tr>
                        <td className="p-2 border border-slate-300 font-black font-mono text-emerald-900">{multaData.placa || '-'}</td>
                        <td className="p-2 border border-slate-300 font-bold">{multaData.frota || '-'}</td>
                        <td className="p-2 border border-slate-300 font-mono font-bold text-slate-800">{multaData.ait || '-'}</td>
                        <td className="p-2 border border-slate-300">{fmtDate(multaData.dataHoraInfracao)}</td>
                        <td className="p-2 border border-slate-300 font-bold text-red-700">{fmtDate(multaData.prazoIndicacao)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px] mt-1.5">
                    <thead className="bg-[#285F4B] text-white text-[10px] font-bold">
                      <tr>
                        <th className="p-2 border border-slate-300">Órgão Autuador</th>
                        <th className="p-2 border border-slate-300">Cód. Enquadramento</th>
                        <th className="p-2 border border-slate-300">Artigo CTB</th>
                        <th className="p-2 border border-slate-300">Pontos CNH</th>
                        <th className="p-2 border border-slate-300">Tipo de Via</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-50">
                      <tr>
                        <td className="p-2 border border-slate-300">{multaData.orgaoAutuador || '-'}</td>
                        <td className="p-2 border border-slate-300 font-mono">{multaData.enquadramento || '-'}</td>
                        <td className="p-2 border border-slate-300">{multaData.artigoCtb || '-'}</td>
                        <td className="p-2 border border-slate-300 font-bold text-orange-700">{multaData.pontosCnh !== undefined ? `${multaData.pontosCnh} PONTOS` : '0 PONTOS'}</td>
                        <td className="p-2 border border-slate-300">{multaData.rodoviaOuUrbano === 'RODOVIA' ? 'RODOVIA' : 'URBANO'}</td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px] mt-1.5">
                    <thead className="bg-[#285F4B] text-white text-[10px] font-bold">
                      <tr>
                        <th className="p-2 border border-slate-300 w-1/3">Descrição da Infração Cometida</th>
                        <th className="p-2 border border-slate-300 w-1/3">Local / Endereço Completo</th>
                        <th className="p-2 border border-slate-300 w-1/3">Município / UF</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-50">
                      <tr>
                        <td className="p-2 border border-slate-300 font-medium">{multaData.descricaoInfracao || 'INFRAÇÃO DE TRÂNSITO'}</td>
                        <td className="p-2 border border-slate-300">{multaData.endereco || '-'}</td>
                        <td className="p-2 border border-slate-300 font-bold">{multaData.municipio || '-'} - {multaData.uf || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. DEMONSTRATIVO FINANCEIRO */}
                <div>
                  <div className="flex items-center text-[#114D38] font-black text-xs uppercase mb-1.5">
                    <FileSpreadsheet size={14} className="mr-1.5 text-emerald-700" />
                    <span>3. DEMONSTRATIVO FINANCEIRO E VALOR DO DESCONTO</span>
                  </div>
                  <table className="w-full text-center border-collapse border border-slate-300 text-xs">
                    <thead className="bg-[#114D38] text-white text-[10px] font-bold">
                      <tr>
                        <th className="p-2.5 border border-slate-300 w-1/3">Valor Integral (R$)</th>
                        <th className="p-2.5 border border-slate-300 w-1/3">Desconto Concedido (R$)</th>
                        <th className="p-2.5 border border-slate-300 w-1/3">Valor Líquido a Descontar (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-50 font-bold">
                      <tr>
                        <td className="p-3 border border-slate-300 text-slate-700">{fmtMoney(valorOriginal)}</td>
                        <td className="p-3 border border-slate-300 text-emerald-700">{fmtMoney(desconto)}</td>
                        <td className="p-3 border border-slate-300 text-emerald-800 font-black text-sm bg-emerald-50">
                          {fmtMoney(valorFinal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. TERMO LEGAL E DECLARAÇÃO CLT */}
                <div className="bg-slate-50 p-4 rounded border border-slate-300 text-slate-700 space-y-2">
                  <div className="flex items-center text-[#114D38] font-black text-xs uppercase">
                    <ShieldCheck size={14} className="mr-1.5 text-emerald-700" />
                    <span>4. DECLARAÇÃO DE RESPONSABILIDADE E AUTORIZAÇÃO EXPRESSA DE DESCONTO</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-justify">
                    Eu, <strong className="text-slate-900 uppercase">{multaData.responsavelNome || 'CONDUTOR'}</strong>, identificado(a) neste termo, declaro para todos os fins de direito que me encontrava na condução do veículo placa <strong className="font-mono text-slate-900">{multaData.placa || '-'}</strong> (Frota {multaData.frota || '-'}) na data e horário indicados, sendo de minha inteira responsabilidade a infração de trânsito autuada sob o AIT nº <strong className="font-mono text-slate-900">{multaData.ait || '-'}</strong>.
                  </p>
                  <p className="text-[11px] leading-relaxed text-justify">
                    Com fulcro no <strong className="text-slate-900">Artigo 462, § 1º da Consolidação das Leis do Trabalho (CLT)</strong> e no Regulamento Interno de Uso de Veículos da Empresa, <strong className="text-emerald-900">AUTORIZO EXPRESSAMENTE</strong> a empresa RISEL COMBUSTÍVEIS LTDA a efetuar o desconto em minha folha de pagamento no valor de <strong className="text-emerald-900">{fmtMoney(valorFinal)}</strong> referente à referida infração, bem como concordo com a pontuação atribuída ao meu prontuário de habilitação.
                  </p>
                </div>

                {/* Datação */}
                <div className="text-center pt-2 text-slate-500 italic text-[11px]">
                  {localCidade} - {localUF}, {dataHoje}.
                </div>

                {/* 5. ASSINATURAS (Sem Visto de Supervisão) */}
                <div className="grid grid-cols-2 gap-8 pt-8 pb-4">
                  <div className="text-center">
                    <div className="border-t border-slate-500 w-4/5 mx-auto mb-1.5"></div>
                    <p className="font-black text-slate-800 text-[11px] uppercase">ASSINATURA DO CONDUTOR</p>
                    <p className="text-[10px] text-slate-400">(Idêntica à assinatura constante na CNH)</p>
                    <p className="text-[10px] text-slate-600 font-bold mt-0.5">{multaData.responsavelNome || '-'}</p>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-slate-500 w-4/5 mx-auto mb-1.5"></div>
                    <p className="font-black text-slate-800 text-[11px] uppercase">RISEL COMBUSTÍVEIS LTDA</p>
                    <p className="text-[10px] text-emerald-800 font-bold">Gerenciamento de Riscos</p>
                  </div>
                </div>

                {/* Rodapé institucional */}
                <div className="text-center border-t border-slate-200 pt-2 text-[9px] text-slate-400">
                  Documento gerado eletronicamente pelo Sistema Integrado Risel Combustíveis Ltda. Obrigatório anexar cópia legível da CNH do condutor.
                </div>

              </div>
            </div>
          ) : isImageAttachment ? (
            /* Caso 2: Anexo de Imagem (AIT / CNH digitalizada) */
            <div className="bg-slate-900 p-4 rounded-2xl flex flex-col items-center justify-center max-w-3xl w-full">
              <img 
                src={pdfUrlOrData!} 
                alt="Documento Anexo" 
                className="max-h-[75vh] object-contain rounded-xl shadow-2xl border border-slate-700" 
              />
            </div>
          ) : (
            /* Caso 3: Documento ou Link Genérico com Fallback */
            <div className="bg-white rounded-2xl p-8 max-w-xl text-center space-y-4 my-auto shadow-2xl border border-slate-200">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
                <FileText size={32} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800">{title}</h4>
                <p className="text-xs text-slate-500 mt-1 font-mono">{fileName}</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                O arquivo oficial está pronto para download e armazenamento em seu dispositivo.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center shadow-lg transition-all"
                >
                  <Download size={16} className="mr-2" /> Baixar Documento (.pdf)
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer com Ações e Fechamento Rápido */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center space-x-2 text-[11px] text-emerald-400 font-medium">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>Documento oficial padronizado Risel Combustíveis Ltda.</span>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center"
            >
              <Download size={14} className="mr-1.5" /> Baixar Cópia
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-950/50 transition-all flex items-center"
            >
              <CheckCircle2 size={14} className="mr-1.5" /> Concluir e Voltar ao Lançamento
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default PdfViewerModal;
