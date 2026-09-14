import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Mail, 
  FileText, 
  UserCheck, 
  Car, 
  Wrench, 
  DollarSign, 
  ShieldCheck, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Plus,
  Trash2,
  Maximize2,
  UploadCloud,
  RefreshCw,
  Sparkles,
  Camera,
  Paperclip
} from 'lucide-react';
import { 
  ManutencaoComAvaria, 
  AutorizacaoDescontoAvaria, 
  AnexoManutencao,
  generateTermoAvariaPdf,
  generateTermoAvariaEmailHtml
} from '../../services/termoAvariaPdfService';
import { RISEL_LOGO_URL } from '../../pages/multas/services/pdfGenerator';

interface TermoAvariaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  manutencao: ManutencaoComAvaria;
  autorizacao: AutorizacaoDescontoAvaria;
  anexos?: AnexoManutencao[];
  onEmailSentSuccess?: (emailDestino: string) => void;
  onSaveAnexos?: (novosAnexos: AnexoManutencao[]) => void;
}

export const TermoAvariaViewerModal: React.FC<TermoAvariaViewerModalProps> = ({
  isOpen,
  onClose,
  manutencao,
  autorizacao,
  anexos = [],
  onEmailSentSuccess,
  onSaveAnexos
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailDestinatario, setEmailDestinatario] = useState(
    autorizacao.destinatarioEmail || (manutencao.condutor?.toLowerCase().includes('@') ? manutencao.condutor : '')
  );
  const [emailCC, setEmailCC] = useState('frota@risel.com.br');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gerenciamento dinâmico de anexos / fotos das avarias vindas do lançamento da manutenção
  const [currentAnexos, setCurrentAnexos] = useState<AnexoManutencao[]>(() => {
    const list = (anexos && anexos.length > 0) ? anexos : (manutencao.anexos || []);
    return list;
  });

  // Rastreamento dos IDs iniciais para saber se novas fotos foram adicionadas
  const initialAnexosIdsRef = useRef<string[]>(
    ((anexos && anexos.length > 0) ? anexos : (manutencao.anexos || [])).map(a => a.id)
  );

  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [updateNotification, setUpdateNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Verifica se há novas imagens anexadas ou se a lista foi alterada desde a última geração
  const hasNewPhotos = currentAnexos.some(a => !initialAnexosIdsRef.current.includes(a.id));
  const hasPhotosChanged = hasNewPhotos || currentAnexos.length !== initialAnexosIdsRef.current.length;

  const fmtMoney = (v: number) =>
    `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (dStr?: string) => {
    if (!dStr) return '-';
    try {
      if (dStr.includes('T')) {
        const [dPart] = dStr.split('T');
        const [y, m, dNum] = dPart.split('-');
        return `${dNum}/${m}/${y}`;
      }
      if (dStr.includes('-')) {
        const [y, m, dNum] = dStr.split('-');
        return `${dNum}/${m}/${y}`;
      }
    } catch (e) {}
    return dStr;
  };

  const totalReparo = autorizacao.valorTotalReparo || manutencao.custo;
  const valorDesconto = autorizacao.valorDesconto || totalReparo;
  const parcelas = autorizacao.quantidadeParcelas || 1;
  const valorParcela = autorizacao.valorParcela || (valorDesconto / parcelas);
  const subsidio = autorizacao.subsidioEmpresa || (totalReparo - valorDesconto > 0 ? totalReparo - valorDesconto : 0);

  const servicos = Array.isArray(manutencao.servicos) && manutencao.servicos.length > 0
    ? manutencao.servicos
    : [{
        id: '1',
        descricao: manutencao.descricao || 'Reparo e recuperação de avarias veiculares',
        tipo: 'Serviço' as const,
        quantidade: 1,
        valorUnitario: totalReparo,
        valorTotal: totalReparo
      }];

  const fotosAvarias = currentAnexos.filter(
    a => a && a.dataUrl && (
      a.tipo?.startsWith('image/') || 
      a.dataUrl.startsWith('data:image/') ||
      /\.(jpe?g|png|webp|gif|bmp)$/i.test(a.nome || '')
    )
  );

  const pdfsAvarias = currentAnexos.filter(
    a => a && a.dataUrl && (
      a.tipo === 'application/pdf' ||
      a.dataUrl.startsWith('data:application/pdf') ||
      /\.pdf$/i.test(a.nome || '')
    )
  );

  // Upload direto de fotos e PDFs no termo
  const handleAddFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let countFotos = 0;
    let countPdfs = 0;

    Array.from(files).forEach((file: File) => {
      const isImg = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

      if (!isImg && !isPdf) return;

      if (isImg) countFotos++;
      if (isPdf) countPdfs++;

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const dataUrl = loadEvt.target?.result as string;
        if (dataUrl) {
          const newAnexo: AnexoManutencao = {
            id: `anexo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            nome: file.name,
            tipo: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
            tamanho: file.size,
            dataUrl,
            criadoEm: new Date().toISOString()
          };
          setCurrentAnexos(prev => [...prev, newAnexo]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const total = countFotos + countPdfs;
    if (total > 0) {
      let desc = '';
      if (countFotos > 0 && countPdfs > 0) {
        desc = `${countFotos} imagem(ns) e ${countPdfs} PDF(s)`;
      } else if (countPdfs > 0) {
        desc = `${countPdfs} arquivo(s) PDF`;
      } else {
        desc = `${countFotos} nova(s) imagem(ns)`;
      }
      setUpdateNotification(`Você adicionou ${desc}. Clique em "Gerar Novamente Termo Atualizado" para consolidar e unir em um único arquivo PDF.`);
      setTimeout(() => setUpdateNotification(null), 6000);
    }
  };

  const handleRemoveFoto = (id: string) => {
    setCurrentAnexos(prev => prev.filter(f => f.id !== id));
    setUpdateNotification("Item removido. Clique em 'Gerar Novamente Termo Atualizado' para consolidar.");
    setTimeout(() => setUpdateNotification(null), 5000);
  };

  // Gerar novamente termo atualizado (só acionado se anexarmos novas fotos ou alterarmos as imagens)
  const handleRegerarTermoAtualizado = () => {
    setIsRegenerating(true);
    // Persiste no registro da manutenção via callback
    onSaveAnexos?.(currentAnexos);
    // Sincroniza os IDs atuais como baseline
    initialAnexosIdsRef.current = currentAnexos.map(a => a.id);

    setTimeout(() => {
      setIsRegenerating(false);
      setUpdateNotification("Termo regerado e atualizado com sucesso! As fotos foram sincronizadas com o lançamento da manutenção.");
      setTimeout(() => setUpdateNotification(null), 5000);
    }, 400);
  };

  // Datação por extenso
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mes = meses[hoje.getMonth()];
  const ano = hoje.getFullYear();
  const dataHojeExtenso = `${autorizacao.base || manutencao.base || 'Filial'}, ${dia} de ${mes} de ${ano}`;

  // Baixar PDF
  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const res = await generateTermoAvariaPdf(manutencao, autorizacao, currentAnexos);
      res.download();
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Não foi possível gerar o arquivo PDF. Tente novamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Imprimir diretamente
  const handlePrint = () => {
    window.print();
  };

  // Enviar por e-mail
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailDestinatario.trim()) {
      setEmailStatusMessage({ type: 'error', text: 'Por favor, informe o e-mail do destinatário.' });
      return;
    }

    try {
      setIsSendingEmail(true);
      setEmailStatusMessage(null);

      // Gera o PDF oficial em memória para anexar
      const pdfResult = await generateTermoAvariaPdf(manutencao, autorizacao, currentAnexos);
      const htmlEmail = generateTermoAvariaEmailHtml(manutencao, autorizacao, RISEL_LOGO_URL);

      const attachmentsPayload = [
        {
          filename: pdfResult.fileName,
          dataUrl: pdfResult.dataUrl,
          contentType: 'application/pdf'
        }
      ];

      // Adiciona fotos às mensagens se houver
      fotosAvarias.slice(0, 4).forEach((foto, i) => {
        attachmentsPayload.push({
          filename: foto.nome || `Avaria_Foto_${i + 1}.jpg`,
          dataUrl: foto.dataUrl,
          contentType: foto.tipo || 'image/jpeg'
        });
      });

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailDestinatario.trim(),
          cc: emailCC.trim() || undefined,
          fromName: "Controle de Frotas",
          source: "frota",
          subject: `Autorização de Desconto em Folha por Avaria - Veículo ${manutencao.placa} - Risel Combustíveis`,
          html: htmlEmail,
          attachments: attachmentsPayload
        })
      });

      const resData = await response.json();

      if (response.ok && (resData.success || resData.delivered)) {
        setEmailStatusMessage({
          type: 'success',
          text: `E-mail enviado com sucesso com o Termo e PDF anexados para ${emailDestinatario}!`
        });
        onEmailSentSuccess?.(emailDestinatario.trim());
        setTimeout(() => {
          setIsEmailModalOpen(false);
          setEmailStatusMessage(null);
        }, 2200);
      } else {
        throw new Error(resData.error || resData.message || 'Falha no envio');
      }
    } catch (err: any) {
      console.error('Erro ao enviar e-mail:', err);
      setEmailStatusMessage({
        type: 'error',
        text: `Não foi possível enviar o e-mail: ${err.message || 'Verifique as configurações de SMTP'}`
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Barra de Ações Superior (Fixa) */}
        <div className="bg-[#114D38] px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md border-b-2 border-[#00A859]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-sm tracking-wide">
                Termo de Autorização de Desconto por Avaria
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Veículo: <strong className="font-mono text-white">{manutencao.placa}</strong> &bull; Colaborador: <strong>{autorizacao.colaboradorNome}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão para Gerar Novamente Termo Atualizado - Destaque acionado só se anexarmos novas fotos ou alterarmos as imagens */}
            {hasPhotosChanged ? (
              <button
                onClick={handleRegerarTermoAtualizado}
                disabled={isRegenerating}
                className="px-3 py-1.5 bg-linear-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-900 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md border border-amber-200 animate-pulse active:scale-95"
                title="Novas imagens foram detectadas! Clique para gerar novamente o termo atualizado e sincronizar com o lançamento"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-slate-900" />
                )}
                <span>Gerar Novamente Termo Atualizado</span>
                <span className="ml-0.5 px-1.5 py-0.2 bg-slate-900 text-amber-300 rounded-full text-[9px] font-black">
                  {fotosAvarias.length}
                </span>
              </button>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg text-[11px] font-semibold text-emerald-200 border border-white/10">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Termo Sincronizado ({fotosAvarias.length} {fotosAvarias.length === 1 ? 'imagem' : 'imagens'})</span>
              </div>
            )}

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border border-white/20"
              title="Imprimir folha A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-emerald-400 disabled:opacity-50"
              title="Baixar em formato PDF"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>

            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-amber-300 active:scale-95"
              title="Enviar Autorização por E-mail"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar por E-mail</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer ml-1"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Banner de Aviso de Novas Imagens e Confirmações */}
        {updateNotification && (
          <div className="bg-emerald-700 text-white px-5 py-2 text-xs font-bold flex items-center justify-between border-b border-emerald-600 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{updateNotification}</span>
            </div>
            {hasPhotosChanged && (
              <button
                onClick={handleRegerarTermoAtualizado}
                className="px-2.5 py-1 bg-white text-emerald-900 rounded-lg text-[11px] font-black hover:bg-emerald-50 transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                Gerar Agora
              </button>
            )}
          </div>
        )}

        {/* Conteúdo com Visualização Realista da Folha A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/80 custom-scrollbar">
          <div 
            id="termo-avaria-printable"
            className="bg-white text-slate-800 w-full max-w-[800px] shadow-2xl rounded-sm p-8 border border-slate-300 text-xs font-sans print:m-0 print:p-6 print:border-none print:shadow-none min-h-[1050px]"
          >
            {/* Topo Timbrado Corporativo Risel */}
            <div className="bg-[#114D38] text-white p-4 rounded-t-sm flex items-center space-x-4 border-b-2 border-[#00A859] relative">
              <div className="w-14 h-14 bg-white rounded-lg p-1 shrink-0 flex items-center justify-center shadow-md">
                <img src={RISEL_LOGO_URL} alt="Risel Combustíveis" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex-1 text-center pr-14">
                <h1 className="text-base font-black tracking-wide uppercase">RISEL COMBUSTÍVEIS LTDA</h1>
                <h2 className="text-xs font-bold text-emerald-100 mt-0.5 tracking-tight uppercase">
                  TERMO DE AUTORIZAÇÃO DE DESCONTO EM FOLHA POR AVARIA DE VEÍCULO
                </h2>
              </div>
            </div>

            {/* Corpo do Termo */}
            <div className="p-4 space-y-4">
              
              {/* 1. DADOS DO COLABORADOR */}
              <div>
                <div className="flex items-center text-[#114D38] font-black text-xs uppercase mb-1.5">
                  <UserCheck size={14} className="mr-1.5 text-emerald-700" />
                  <span>1. DADOS DO COLABORADOR / CONDUTOR RESPONSÁVEL</span>
                </div>
                <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                  <thead className="bg-[#114D38] text-white text-[10px] font-bold">
                    <tr>
                      <th className="p-2 border border-slate-300 w-1/2">Nome Completo do Colaborador</th>
                      <th className="p-2 border border-slate-300">CPF / Matrícula</th>
                      <th className="p-2 border border-slate-300">Base / Filial</th>
                      <th className="p-2 border border-slate-300">Função / Cargo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-50">
                    <tr>
                      <td className="p-2 border border-slate-300 font-bold text-slate-900">
                        {autorizacao.colaboradorNome || 'COLABORADOR NÃO INFORMADO'}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono">
                        {autorizacao.cpfMatricula || '-'}
                      </td>
                      <td className="p-2 border border-slate-300 font-semibold">
                        {autorizacao.base || manutencao.base || 'FILIAL'}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        {autorizacao.cargoFuncao || 'Condutor'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2. DADOS DO VEÍCULO E DA ORDEM DE SERVIÇO */}
              <div>
                <div className="flex items-center text-[#114D38] font-black text-xs uppercase mb-1.5">
                  <Car size={14} className="mr-1.5 text-emerald-700" />
                  <span>2. DADOS DO VEÍCULO E DA ORDEM DE SERVIÇO (OS)</span>
                </div>
                <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                  <thead className="bg-[#114D38] text-white text-[10px] font-bold">
                    <tr>
                      <th className="p-2 border border-slate-300">Placa</th>
                      <th className="p-2 border border-slate-300">Modelo do Veículo</th>
                      <th className="p-2 border border-slate-300">Odômetro</th>
                      <th className="p-2 border border-slate-300">Data da Ocorrência</th>
                      <th className="p-2 border border-slate-300">Nº da OS / NF</th>
                      <th className="p-2 border border-slate-300">Oficina / Prestador</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-50 font-medium">
                    <tr>
                      <td className="p-2 border border-slate-300 font-black font-mono text-emerald-900">
                        {manutencao.placa || '-'}
                      </td>
                      <td className="p-2 border border-slate-300 font-bold text-slate-800">
                        {manutencao.modelo || 'Veículo'}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono">
                        {manutencao.odometro > 0 ? `${manutencao.odometro.toLocaleString('pt-BR')} km` : '-'}
                      </td>
                      <td className="p-2 border border-slate-300">
                        {fmtDate(autorizacao.dataOcorrencia || manutencao.data)}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono font-bold text-slate-800">
                        {manutencao.nf_os || '-'}
                      </td>
                      <td className="p-2 border border-slate-300">
                        {manutencao.oficina || '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 3. DISCRIMINAÇÃO DOS SERVIÇOS E PEÇAS DANIFICADAS */}
              <div>
                <div className="flex items-center text-[#114D38] font-black text-xs uppercase mb-1.5">
                  <Wrench size={14} className="mr-1.5 text-emerald-700" />
                  <span>3. DISCRIMINAÇÃO DOS SERVIÇOS E PRODUTOS / PEÇAS DANIFICADAS</span>
                </div>
                <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                  <thead className="bg-[#114D38] text-white text-[10px] font-bold">
                    <tr>
                      <th className="p-2 border border-slate-300 w-10 text-center">#</th>
                      <th className="p-2 border border-slate-300">Descrição do Serviço / Peça Danificada</th>
                      <th className="p-2 border border-slate-300 w-28 text-center">Categoria</th>
                      <th className="p-2 border border-slate-300 w-16 text-center">Qtd</th>
                      <th className="p-2 border border-slate-300 w-28 text-right">Valor Unitário</th>
                      <th className="p-2 border border-slate-300 w-28 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-50">
                    {servicos.map((s, idx) => (
                      <tr key={s.id || idx}>
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-500">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="p-2 border border-slate-300 font-medium text-slate-800">
                          {s.descricao}
                        </td>
                        <td className="p-2 border border-slate-300 text-center text-slate-600">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.tipo === 'Peça / Produto' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {s.tipo}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-bold">
                          {s.quantidade}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono">
                          {fmtMoney(s.valorUnitario)}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-bold text-slate-900">
                          {fmtMoney(s.valorTotal)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50/80 font-black text-xs">
                      <td colSpan={5} className="p-2.5 border border-slate-300 text-right text-emerald-950 uppercase tracking-wider">
                        Valor Total dos Reparos e Peças:
                      </td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono text-emerald-900 text-sm">
                        {fmtMoney(totalReparo)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4. DEMONSTRATIVO FINANCEIRO E PARCELAMENTO EM FOLHA */}
              <div>
                <div className="flex items-center text-[#114D38] font-black text-xs uppercase mb-1.5">
                  <DollarSign size={14} className="mr-1.5 text-emerald-700" />
                  <span>4. DEMONSTRATIVO FINANCEIRO E CONDIÇÃO DE DESCONTO EM FOLHA</span>
                </div>
                <table className="w-full text-center border-collapse border border-slate-300 text-xs">
                  <thead className="bg-[#114D38] text-white text-[10px] font-bold">
                    <tr>
                      <th className="p-2.5 border border-slate-300 w-1/4">Valor Total do Reparo</th>
                      <th className="p-2.5 border border-slate-300 w-1/4">Participação Empresa</th>
                      <th className="p-2.5 border border-slate-300 w-1/4">Valor Líquido a Descontar</th>
                      <th className="p-2.5 border border-slate-300 w-1/4">Condição de Parcelamento</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-50 font-bold">
                    <tr>
                      <td className="p-3 border border-slate-300 text-slate-700 font-mono">
                        {fmtMoney(totalReparo)}
                      </td>
                      <td className="p-3 border border-slate-300 text-emerald-700 font-mono">
                        {fmtMoney(subsidio)}
                      </td>
                      <td className="p-3 border border-slate-300 text-rose-700 font-black text-sm bg-rose-50 font-mono">
                        {fmtMoney(valorDesconto)}
                      </td>
                      <td className="p-3 border border-slate-300 text-slate-800 text-[11px]">
                        {parcelas === 1 ? (
                          <span className="font-extrabold text-slate-900">1 parcela única de {fmtMoney(valorDesconto)}</span>
                        ) : (
                          <span className="font-extrabold text-slate-900">
                            {parcelas}x de {fmtMoney(valorParcela)} na Folha
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 5. DECLARAÇÃO DE RESPONSABILIDADE E TERMO CLT */}
              <div className="bg-slate-50 p-4 rounded border border-slate-300 text-slate-700 space-y-2.5">
                <div className="flex items-center text-[#114D38] font-black text-xs uppercase">
                  <ShieldCheck size={14} className="mr-1.5 text-emerald-700" />
                  <span>5. DECLARAÇÃO DE RESPONSABILIDADE E AUTORIZAÇÃO EXPRESSA DE DESCONTO</span>
                </div>
                <p className="text-[11px] leading-relaxed text-justify">
                  Eu, <strong className="text-slate-900 uppercase">{autorizacao.colaboradorNome || 'COLABORADOR'}</strong>, identificado(a) neste termo, declaro para todos os fins de direito e efeitos legais que me encontrava na condução/posse do veículo de placa <strong className="font-mono text-slate-900">{manutencao.placa}</strong> ({manutencao.modelo || 'Veículo'}) na data da ocorrência, sendo de minha responsabilidade os danos e avarias ocorridos.
                </p>
                <p className="text-[11px] leading-relaxed text-justify">
                  Com fulcro no <strong className="text-slate-900">Artigo 462, § 1º da Consolidação das Leis do Trabalho (CLT)</strong>, <strong className="text-emerald-900">AUTORIZO EXPRESSAMENTE</strong> a empresa RISEL COMBUSTÍVEIS LTDA a efetuar o desconto em minha folha de pagamento do montante de <strong className="text-rose-700">{fmtMoney(valorDesconto)}</strong> ({parcelas === 1 ? 'em cota única' : `em ${parcelas} parcelas de ${fmtMoney(valorParcela)}`}) para fins de ressarcimento dos serviços e peças discriminados na presente Ordem de Serviço.
                </p>
              </div>

              {/* 6. REGISTRO FOTOGRÁFICO E ANEXOS EM PDF */}
              <div className="pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center text-[#114D38] font-black text-xs uppercase">
                    <ImageIcon size={14} className="mr-1.5 text-emerald-700" />
                    <span>6. REGISTRO FOTOGRÁFICO E ANEXOS (IMAGENS E LAUDOS EM PDF)</span>
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {fotosAvarias.length} {fotosAvarias.length === 1 ? 'foto' : 'fotos'}
                      {pdfsAvarias.length > 0 && ` • ${pdfsAvarias.length} PDF(s)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleAddFotos} 
                      accept="image/*,application/pdf" 
                      multiple 
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold tracking-wide transition-all cursor-pointer shadow-xs active:scale-95"
                      title="Adicionar fotos de avarias ou arquivos PDF anexos"
                    >
                      <Plus size={13} />
                      <span>Anexar Fotos / PDFs</span>
                    </button>
                  </div>
                </div>

                {/* Sub-barra informativa sobre integração e união dos anexos */}
                {(fotosAvarias.length > 0 || pdfsAvarias.length > 0) && (
                  <div className="mb-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Imagens são inseridas direto nas páginas do PDF. Arquivos em PDF são unidos automaticamente em um único arquivo consolidado.
                      </span>
                    </div>

                    {hasPhotosChanged && (
                      <button
                        type="button"
                        onClick={handleRegerarTermoAtualizado}
                        disabled={isRegenerating}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-[11px] rounded-lg transition-all shadow-xs cursor-pointer border border-amber-300 active:scale-95"
                        title="Clique para regerar o termo e sincronizar novos anexos"
                      >
                        {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>Gerar Novamente Termo Atualizado</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Grade de Fotos */}
                {fotosAvarias.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-emerald-700" />
                      Fotos Registradas das Avarias ({fotosAvarias.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {fotosAvarias.map((foto, idx) => {
                        const isNewPhoto = !initialAnexosIdsRef.current.includes(foto.id);
                        return (
                          <div 
                            key={foto.id || idx} 
                            className={`group relative border rounded-lg overflow-hidden bg-white shadow-xs transition-all ${
                              isNewPhoto ? 'border-amber-400 ring-2 ring-amber-300/40' : 'border-slate-200 hover:border-emerald-500'
                            }`}
                          >
                            <div 
                              className="relative h-28 bg-slate-100 cursor-pointer overflow-hidden flex items-center justify-center"
                              onClick={() => setPreviewImage({ url: foto.dataUrl, title: foto.nome || `Avaria ${idx + 1}` })}
                            >
                              <img 
                                src={foto.dataUrl} 
                                alt={foto.nome || `Avaria ${idx + 1}`} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="p-1.5 rounded-full bg-white/90 text-slate-800 shadow">
                                  <Maximize2 size={14} />
                                </span>
                              </div>
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono font-bold">
                                #{idx + 1}
                              </span>
                              {isNewPhoto && (
                                <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black tracking-wider uppercase shadow-xs">
                                  Nova
                                </span>
                              )}
                            </div>

                            <div className="p-1.5 flex items-center justify-between gap-1 border-t border-slate-100">
                              <p className="text-[10px] text-slate-700 font-semibold truncate flex-1" title={foto.nome || `Foto ${idx + 1}`}>
                                {foto.nome || `Foto ${idx + 1}`}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleRemoveFoto(foto.id)}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                title="Remover foto"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lista de Documentos em PDF Anexados (Unidos ao Arquivo Final) */}
                {pdfsAvarias.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-rose-600" />
                      Documentos em PDF Anexados ({pdfsAvarias.length}) - Mesclados no arquivo final
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pdfsAvarias.map((pdf, idx) => {
                        const isNewPdf = !initialAnexosIdsRef.current.includes(pdf.id);
                        return (
                          <div
                            key={pdf.id || idx}
                            className={`flex items-center justify-between p-2.5 rounded-xl border bg-white shadow-2xs ${
                              isNewPdf ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-rose-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate" title={pdf.nome}>
                                  {pdf.nome}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <span>{Math.round(pdf.tamanho / 1024)} KB</span>
                                  <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Mesclado ao PDF
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFoto(pdf.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer shrink-0 ml-2"
                              title="Remover anexo PDF"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Estado vazio quando não há fotos nem PDFs */}
                {fotosAvarias.length === 0 && pdfsAvarias.length === 0 && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-5 text-center transition-colors cursor-pointer group"
                  >
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mx-auto mb-1.5 transition-colors" />
                    <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-800">
                      Clique aqui para anexar fotos comprobatórias ou arquivos em PDF (orçamentos, laudos)
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Formatos aceitos: Imagens (JPG, PNG, WEBP) e Documentos (PDF). Os arquivos em PDF são unidos automaticamente em um único arquivo.
                    </p>
                  </div>
                )}
              </div>

              {/* Datação */}
              <div className="text-center pt-3 text-slate-500 italic text-[11px]">
                {dataHojeExtenso}.
              </div>

              {/* 7. ASSINATURAS */}
              <div className="grid grid-cols-2 gap-8 pt-8 pb-4">
                <div className="text-center">
                  <div className="border-t border-slate-500 w-4/5 mx-auto mb-1.5"></div>
                  <p className="font-black text-slate-800 text-[11px] uppercase">ASSINATURA DO COLABORADOR</p>
                  <p className="text-[10px] text-slate-400">(Idêntica à assinatura constante no documento oficial)</p>
                  <p className="text-[10px] text-slate-600 font-bold mt-0.5">{autorizacao.colaboradorNome || '-'}</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-500 w-4/5 mx-auto mb-1.5"></div>
                  <p className="font-black text-slate-800 text-[11px] uppercase">RISEL COMBUSTÍVEIS LTDA</p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Modal de Disparo de E-mail */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-[#114D38] px-5 py-3.5 text-white flex justify-between items-center border-b-2 border-[#00A859]">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-300" />
                <h4 className="font-display font-extrabold text-sm">
                  Enviar Autorização de Desconto por E-mail
                </h4>
              </div>
              <button 
                onClick={() => setIsEmailModalOpen(false)} 
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-5 space-y-4 text-xs font-bold text-slate-700">
              {emailStatusMessage && (
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  emailStatusMessage.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {emailStatusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="text-[11px] font-semibold">{emailStatusMessage.text}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-slate-700">E-mail do Colaborador (Destinatário Principal) *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: colaborador@risel.com.br"
                  value={emailDestinatario}
                  onChange={(e) => setEmailDestinatario(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700">Com Cópia (CC)</label>
                <input
                  type="text"
                  placeholder="Ex: frota@risel.com.br, rh@risel.com.br"
                  value={emailCC}
                  onChange={(e) => setEmailCC(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] font-normal"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Veículo:</span>
                  <strong className="font-mono text-slate-800">{manutencao.placa} ({manutencao.modelo})</strong>
                </div>
                <div className="flex justify-between">
                  <span>Colaborador:</span>
                  <strong className="text-slate-800">{autorizacao.colaboradorNome}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Valor a Descontar:</span>
                  <strong className="text-rose-700 font-bold">{fmtMoney(valorDesconto)} ({parcelas}x)</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span>Anexos Inclusos:</span>
                  <strong className="text-emerald-800 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-emerald-600" /> Termo Oficial (PDF) {fotosAvarias.length > 0 && `+ ${fotosAvarias.length} foto(s)`}
                  </strong>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="px-5 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                      <span>Disparando E-mail...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-emerald-300" />
                      <span>Enviar Autorização</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Zoom da Imagem (Lightbox) */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-70 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full text-white mb-2 px-1">
              <span className="text-xs font-bold truncate">{previewImage.title}</span>
              <button 
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <img 
              src={previewImage.url} 
              alt={previewImage.title} 
              className="max-h-[80vh] max-w-full rounded-lg shadow-2xl object-contain border border-white/20" 
            />
          </div>
        </div>
      )}

    </div>
  );
};
