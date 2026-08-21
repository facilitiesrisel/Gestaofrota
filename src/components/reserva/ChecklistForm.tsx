import { useState, ChangeEvent } from "react";
import { 
  ClipboardCheck, ChevronRight, ChevronLeft, Check, Upload, 
  HelpCircle, Sparkles, Database, Plus, RefreshCw, Star, Info, AlertTriangle, Play,
  Car, Paintbrush, Gauge, Fuel, Calendar, Layers, MapPin, UserCheck, Mail
} from "lucide-react";
import { addFirebaseChecklist, ChecklistData } from "../../services/firebaseService";

interface Vehicle {
  id: string;
  modelo: string;
  placa: string;
  base?: string;
  status?: string;
}

interface ChecklistFormProps {
  vehicles: Vehicle[];
  onFormSubmitSuccess: (newCheck: any) => void;
}

export function ChecklistForm({ vehicles, onFormSubmitSuccess }: ChecklistFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState(false);

  // Form Fields State
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split("T")[0],
    tipo: "MENSAL",
    base: "PAULÍNIA",
    placa: "",
    modelo: "",
    cor: "",
    kmAtual: "",
    nivelTanque: "CHEIO",
    itens: [] as string[],
    email: "deny.risel@gmail.com",
    
    pneuDianteiroDireito: "BOM",
    pneuDianteiroEsquerdo: "BOM",
    pneuTraseiroDireito: "BOM",
    pneuTraseiroEsquerdo: "BOM",
    pneuEstepe: "BOM",

    obsDianteira: "Ok",
    obsMotorista: "Ok",
    obsPassageiro: "Ok",
    obsTraseira: "Ok",

    entreguePor: "",
    recebidoPor: "",
    
    // Uploaded files
    fotoFrente: "" as string,
    fotoMotorista: "" as string,
    fotoPassageiro: "" as string,
    fotoTraseira: "" as string,
    fotosInterior: "" as string,
    fotoRetrovisorMotorista: "" as string,
    fotoRetrovisorPassageiro: "" as string,
    fotoFaroisTraseiros: "" as string,
    fotoFaroisDianteiros: "" as string
  });

  const availableBases = ["PAULÍNIA", "OURINHOS", "JALES", "CAPÃO BONITO", "CUBATÃO", "SÃO BERNARDO", "AGUAÍ", "ASSTAM"];
  const availableTypes = ["MENSAL", "ENTREGA", "DEVOLUÇÃO", "FÉRIAS", "ADMISSÃO", "RETORNO DE FÉRIAS", "DESLIGAMENTO", "TROCA DE CONDUTOR", "OUTROS"];
  const availableTires = ["BOM", "NOVO", "REGULAR", "RUIM"];
  const availableTanks = ["CHEIO", "3/4", "1/2", "1/4", "VAZIO"];
  
  const checklistItemsOptions = [
    "CRLV", "TAG PEDÁGIOS", "CARTÃO ABASTECIMENTO", "CHAVE RESERVA", 
    "SOM", "MANUAL", "TAPETE", "TRIÂNGULO", "MACACO", "CHAVE DE RODA", "EXTINTOR"
  ];

  // Autofill vehicle details when plate is selected
  const handlePlateChange = (plate: string) => {
    const v = vehicles.find(veh => veh.placa.toUpperCase() === plate.toUpperCase());
    setFormData(prev => ({
      ...prev,
      placa: plate,
      modelo: v ? v.modelo : prev.modelo,
      base: v && v.base ? v.base.toUpperCase() : prev.base
    }));
  };

  const toggleCheklistItem = (item: string) => {
    setFormData(prev => {
      const exists = prev.itens.includes(item);
      const nextItens = exists 
        ? prev.itens.filter(i => i !== item)
        : [...prev.itens, item];
      return { ...prev, itens: nextItens };
    });
  };

  const handleSelectAllItems = () => {
    setFormData(prev => ({ ...prev, itens: checklistItemsOptions }));
  };

  const handleClearAllItems = () => {
    setFormData(prev => ({ ...prev, itens: [] }));
  };

  // Mock Upload simulation that generates a local placeholder URL
  const handlePhotoUploadSimulation = (field: string) => {
    const randomIdx = Math.floor(Math.random() * 1000);
    // Let's use clean professional un-watermarked vehicle mock images
    const placeholderUrls: { [key: string]: string } = {
      fotoFrente: `https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400`,
      fotoMotorista: `https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=400`,
      fotoPassageiro: `https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&q=80&w=400`,
      fotoTraseira: `https://images.unsplash.com/photo-1617469167446-80e3a44665c1?auto=format&fit=crop&q=80&w=400`,
      fotosInterior: `https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400`
    };
    
    const fallbackUrl = `https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400`;

    setFormData(prev => ({
      ...prev,
      [field]: placeholderUrls[field] || fallbackUrl
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.placa) return "Por favor, informe a placa do veículo.";
      if (!formData.modelo) return "Por favor, informe a marca/modelo.";
      if (!formData.kmAtual) return "Por favor, insira o KM atual do veículo.";
      if (!formData.entreguePor) return "Por favor, indique quem está entregando o veículo.";
      if (!formData.email) return "Por favor, insira o e-mail do inspetor responsável.";
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError(null);
    setStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setSubmitError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const err = validateStep();
    if (err) {
      setSubmitError(err);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Heuristic to determine the derived status
      const tires = [
        formData.pneuDianteiroDireito,
        formData.pneuDianteiroEsquerdo,
        formData.pneuTraseiroDireito,
        formData.pneuTraseiroEsquerdo
      ];
      const hasRuimPneu = tires.some(t => t === "RUIM");
      const hasRegularPneu = tires.some(t => t === "REGULAR");
      
      let status: "Aprovado" | "Ressalvas" | "Retido" = "Aprovado";
      if (hasRuimPneu) {
        status = "Retido";
      } else if (hasRegularPneu) {
        status = "Ressalvas";
      } else {
        const checkObs = (obs: string) => {
          const clean = obs.toLowerCase().trim();
          return clean && clean !== "ok" && clean !== "ok " && clean !== "não" && clean !== "sem avarias";
        };
        if (checkObs(formData.obsDianteira) || checkObs(formData.obsMotorista) || checkObs(formData.obsPassageiro) || checkObs(formData.obsTraseira)) {
          status = "Ressalvas";
        }
      }

      // Format checklist data for Firestore / local memory (Standardized to UPPERCASE)
      const cleanU = (v: string) => v ? String(v).toUpperCase().trim() : "";
      
      const checklistPayload: any = {
        placa: formData.placa.toUpperCase().replace(/[^A-Z0-9]/g, "").trim(),
        condutor: cleanU(formData.entreguePor) || "CONDUTOR",
        data: formData.data,
        odometro: parseInt(formData.kmAtual, 10) || 0,
        itens: {
          pneus: hasRuimPneu ? "Crítico" : hasRegularPneu ? "Atenção" : "OK",
          freios: "OK",
          farois: "OK",
          seguranca: "OK",
          fluidos: "OK",
          lataria: (formData.obsDianteira || formData.obsMotorista || formData.obsPassageiro || formData.obsTraseira) ? "Atenção" : "OK"
        },
        observacoes: [formData.obsDianteira, formData.obsMotorista, formData.obsPassageiro, formData.obsTraseira].filter(Boolean).map(o => cleanU(o)).join(" | ").trim(),
        status: status,

        // Rich details
        timestamp: new Date().toLocaleString("pt-BR"),
        email: String(formData.email || "").toLowerCase().trim(),
        tipo: cleanU(formData.tipo) || "MENSAL",
        base: cleanU(formData.base) || "PAULÍNIA",
        marcaModelo: cleanU(formData.modelo),
        cor: cleanU(formData.cor),
        nivelTanque: cleanU(formData.nivelTanque) || "CHEIO",
        listaItens: formData.itens,
        pneuDianteiroDireito: cleanU(formData.pneuDianteiroDireito),
        pneuDianteiroEsquerdo: cleanU(formData.pneuDianteiroEsquerdo),
        pneuTraseiroDireito: cleanU(formData.pneuTraseiroDireito),
        pneuTraseiroEsquerdo: cleanU(formData.pneuTraseiroEsquerdo),
        pneuEstepe: cleanU(formData.pneuEstepe),
        obsDianteira: cleanU(formData.obsDianteira),
        fotoFrente: formData.fotoFrente,
        obsMotorista: cleanU(formData.obsMotorista),
        fotoMotorista: formData.fotoMotorista,
        obsPassageiro: cleanU(formData.obsPassageiro),
        fotoPassageiro: formData.fotoPassageiro,
        obsTraseira: cleanU(formData.obsTraseira),
        fotoTraseira: formData.fotoTraseira,
        entreguePor: cleanU(formData.entreguePor),
        recebidoPor: cleanU(formData.recebidoPor),
        fotosInterior: formData.fotosInterior,
        fotoRetrovisorMotorista: formData.fotoRetrovisorMotorista,
        fotoRetrovisorPassageiro: formData.fotoRetrovisorPassageiro,
        fotoFaroisTraseiros: formData.fotoFaroisTraseiros,
        fotoFaroisDianteiros: formData.fotoFaroisDianteiros,
        isGoogleSheet: false
      };

      let savedId = `local_form_${Date.now()}`;
      let finalChecklistObj = { id: savedId, ...checklistPayload };

      // 1. Enviar para a API Backend (Salva em banco de dados, gera e-mail e atualiza cache)
      try {
        console.log("ChecklistForm: Registrando checklist no servidor backend e enviando e-mail...");
        const responseSubmit = await fetch("/api/checklist/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(checklistPayload)
        });
        const resJson = await responseSubmit.json();
        if (resJson.success && resJson.checklist) {
          finalChecklistObj = resJson.checklist;
          savedId = resJson.id || savedId;
          console.log("ChecklistForm: Sucesso ao gravar no backend e disparar notificação!", resJson);
        }
      } catch (submitErr) {
        console.error("ChecklistForm: Erro na chamada do backend:", submitErr);
      }

      // 2. Tenta adicionar ao Firebase Firestore caso configurado
      try {
        const firestoreId = await addFirebaseChecklist(checklistPayload as any);
        if (firestoreId) savedId = firestoreId;
      } catch (err) {
        console.warn("Firestore indisponível, usando persistência do servidor e localStorage.", err);
      }

      // 3. Persistência local no navegador (localStorage)
      try {
        const localChecks = localStorage.getItem("risel_frota_checklists");
        let parsed: any[] = [];
        if (localChecks) {
          try { parsed = JSON.parse(localChecks); } catch (e) {}
        }
        parsed.unshift(finalChecklistObj);
        localStorage.setItem("risel_frota_checklists", JSON.stringify(parsed));
      } catch (e) {
        console.warn("Erro ao salvar localmente:", e);
      }

      // 4. Notifica a interface para inclusão imediata do checklist na lista e no dashboard
      onFormSubmitSuccess(finalChecklistObj);

      setIsSubmitting(false);
      setSubmitSuccess(true);
    } catch (error: any) {
      console.error("Erro ao enviar formulário:", error);
      setIsSubmitting(false);
      setSubmitError("Houve um erro técnico ao registrar o checklist. Por favor, tente novamente.");
    }
  };

  const handleResetForm = () => {
    setFormData({
      data: new Date().toISOString().split("T")[0],
      tipo: "MENSAL",
      base: "PAULÍNIA",
      placa: "",
      modelo: "",
      cor: "",
      kmAtual: "",
      nivelTanque: "CHEIO",
      itens: [],
      email: "deny.risel@gmail.com",
      pneuDianteiroDireito: "BOM",
      pneuDianteiroEsquerdo: "BOM",
      pneuTraseiroDireito: "BOM",
      pneuTraseiroEsquerdo: "BOM",
      pneuEstepe: "BOM",
      obsDianteira: "Ok",
      obsMotorista: "Ok",
      obsPassageiro: "Ok",
      obsTraseira: "Ok",
      entreguePor: "",
      recebidoPor: "",
      fotoFrente: "",
      fotoMotorista: "",
      fotoPassageiro: "",
      fotoTraseira: "",
      fotosInterior: "",
      fotoRetrovisorMotorista: "",
      fotoRetrovisorPassageiro: "",
      fotoFaroisTraseiros: "",
      fotoFaroisDianteiros: ""
    });
    setStep(1);
    setSubmitSuccess(false);
    setSubmitError(null);
  };

  if (submitSuccess) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden p-8 text-center space-y-6 min-h-[400px] flex flex-col justify-center items-center">
        <div className="w-16 h-16 bg-emerald-50 text-[#114D38] rounded-2xl flex items-center justify-center shadow-md">
          <Check className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-display font-black text-slate-850">Checklist Enviado com Sucesso!</h3>
          <p className="text-sm text-slate-500 font-bold leading-relaxed max-w-md mx-auto">
            Obrigado pelo preenchimento! As informações foram enviadas para a planilha do Google e processadas com sucesso. Uma cópia será enviada ao e-mail registrado.
          </p>
        </div>

        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={handleResetForm}
            className="px-6 py-3 bg-[#114D38] hover:bg-[#1d7053] text-xs font-extrabold uppercase tracking-wider text-white rounded-xl shadow-md transition-all cursor-pointer"
          >
            Realizar Novo Checklist
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden text-left p-6 md:p-8 space-y-6">
      
      {/* Wizard Progress Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 text-[#114D38] rounded-xl flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Formulário de Inspeção</h3>
            <p className="text-xs text-slate-400 font-semibold">Nova Auditoria de Frota</p>
          </div>
        </div>

        {/* Form step dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map(s => (
            <div 
              key={s} 
              className={`h-2 rounded-full transition-all duration-300 ${
                step === s ? "w-6 bg-[#114D38]" : s < step ? "w-2 bg-emerald-600" : "w-2 bg-slate-200"
              }`} 
            />
          ))}
        </div>
      </div>

      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-bold">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* STEP 1: IDENTIFICAÇÃO DO VEÍCULO E CONDUTOR */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Mobile App Header Mockup */}
            <div className="bg-gradient-to-br from-[#005C30] to-[#00361C] p-6 rounded-3xl border-b-4 border-[#F47920] shadow-md flex flex-col items-center text-center relative overflow-hidden -mx-2 md:mx-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#F47920]/10 rounded-full blur-xl -ml-5 -mb-5 pointer-events-none" />
              
              <div className="bg-white px-4 py-2 rounded-2xl shadow-sm mb-3">
                <img 
                  src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" 
                  alt="Logo Risel" 
                  className="h-8 object-contain"
                />
              </div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">Identificação do Veículo</h4>
              <p className="text-[10px] text-emerald-200 font-bold mt-1">Preencha os dados básicos para iniciar o checklist</p>
            </div>

            {/* Grid of App-style Interactive Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Plate Selection Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <Car className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Selecione o Veículo (Placa)</label>
                  <select
                    value={formData.placa}
                    onChange={(e) => handlePlateChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 font-mono shadow-sm cursor-pointer"
                  >
                    <option value="">-- Escolha uma Placa --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.placa}>{v.placa}</option>
                    ))}
                    <option value="MANUAL">-- INSERIR MANUALMENTE --</option>
                  </select>
                </div>
              </div>

              {/* Manual Plate Input Card */}
              {formData.placa === "MANUAL" && (
                <div className="bg-slate-50 border border-amber-200 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-amber-50/10 transition-all shadow-sm animation-fade-in">
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5 shadow-sm">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-[10px] font-black text-amber-700 uppercase tracking-wider block">Digitar Placa Manual</label>
                    <input
                      type="text"
                      placeholder="Ex: ABC1D23"
                      onChange={(e) => setFormData(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:outline-none focus:border-emerald-500 font-mono shadow-sm"
                    />
                  </div>
                </div>
              )}

              {/* Marca / Modelo Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Marca / Modelo</label>
                  <input
                    type="text"
                    placeholder="Ex: Fiat Mobi Like 1.0"
                    value={formData.modelo}
                    onChange={(e) => setFormData(prev => ({ ...prev, modelo: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Color Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <Paintbrush className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Cor do Veículo</label>
                  <input
                    type="text"
                    placeholder="Ex: Branca, Cinza, Preta"
                    value={formData.cor}
                    onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Odometer Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <Gauge className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">KM Atual do Odômetro</label>
                  <input
                    type="number"
                    placeholder="Ex: 48500"
                    value={formData.kmAtual}
                    onChange={(e) => setFormData(prev => ({ ...prev, kmAtual: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 font-mono shadow-sm"
                  />
                </div>
              </div>

              {/* Tank Level Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <Fuel className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Nível do Tanque</label>
                  <select
                    value={formData.nivelTanque}
                    onChange={(e) => setFormData(prev => ({ ...prev, nivelTanque: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
                  >
                    {availableTanks.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              {/* Inspection Date Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Data da Inspeção</label>
                  <input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 font-mono shadow-sm"
                  />
                </div>
              </div>

              {/* Checklist Type Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Tipo de Checklist</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
                  >
                    {availableTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              {/* Operational Base Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Base Ativa</label>
                  <select
                    value={formData.base}
                    onChange={(e) => setFormData(prev => ({ ...prev, base: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
                  >
                    {availableBases.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              {/* Condutor Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Entregue Por (Condutor)</label>
                  <input
                    type="text"
                    placeholder="Nome do motorista que entrega..."
                    value={formData.entreguePor}
                    onChange={(e) => setFormData(prev => ({ ...prev, entreguePor: e.target.value.toUpperCase() }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-sm uppercase"
                  />
                </div>
              </div>

              {/* Recebido Por Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Recebido Por</label>
                  <input
                    type="text"
                    placeholder="Nome do responsável que recebe..."
                    value={formData.recebidoPor}
                    onChange={(e) => setFormData(prev => ({ ...prev, recebidoPor: e.target.value.toUpperCase() }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-sm uppercase"
                  />
                </div>
              </div>

              {/* Responsible Email Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-3.5 items-start hover:border-emerald-500 hover:bg-emerald-50/10 transition-all shadow-sm col-span-1 md:col-span-2">
                <div className="p-2.5 bg-emerald-100 text-[#005C30] rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">E-mail</label>
                  <input
                    type="email"
                    placeholder="Ex: deny.risel@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-sm"
                  />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* STEP 2: ESTADO DOS PNEUS E DOCUMENTOS */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-2">
              <h4 className="text-xs font-black text-[#114D38] uppercase tracking-wide">Passo 2: Pneus & Acessórios</h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Inspecione os itens obrigatórios e o estado de conservação dos pneus.</p>
            </div>

            {/* Tires wear selector */}
            <div className="space-y-3">
              <h5 className="text-[11px] font-black text-slate-600 uppercase">Desgaste dos Pneus</h5>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <TireSelectorField label="Dianteiro Direito" val={formData.pneuDianteiroDireito} onChange={(v) => setFormData(p => ({ ...p, pneuDianteiroDireito: v }))} options={availableTires} />
                <TireSelectorField label="Dianteiro Esquerdo" val={formData.pneuDianteiroEsquerdo} onChange={(v) => setFormData(p => ({ ...p, pneuDianteiroEsquerdo: v }))} options={availableTires} />
                <TireSelectorField label="Traseiro Direito" val={formData.pneuTraseiroDireito} onChange={(v) => setFormData(p => ({ ...p, pneuTraseiroDireito: v }))} options={availableTires} />
                <TireSelectorField label="Traseiro Esquerdo" val={formData.pneuTraseiroEsquerdo} onChange={(v) => setFormData(p => ({ ...p, pneuTraseiroEsquerdo: v }))} options={availableTires} />
                <TireSelectorField label="Estepe" val={formData.pneuEstepe} onChange={(v) => setFormData(p => ({ ...p, pneuEstepe: v }))} options={availableTires} />
              </div>
            </div>

            {/* Vehicle checklist items checkboxes */}
            <div className="space-y-3 pt-3 border-t border-slate-100 text-left">
              <div className="flex justify-between items-center">
                <h5 className="text-[11px] font-black text-slate-600 uppercase">Documentos & Acessórios Inspecionados</h5>
                <div className="flex gap-2">
                  <button type="button" onClick={handleSelectAllItems} className="text-[9px] font-black text-[#114D38] hover:underline uppercase cursor-pointer">Selecionar Todos</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={handleClearAllItems} className="text-[9px] font-black text-rose-500 hover:underline uppercase cursor-pointer">Limpar</button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {checklistItemsOptions.map((item) => {
                  const isChecked = formData.itens.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleCheklistItem(item)}
                      className={`flex items-center justify-between p-3 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                        isChecked 
                          ? "bg-emerald-50 border-emerald-150 text-[#114D38] font-extrabold" 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50"
                      }`}
                    >
                      <span>{item}</span>
                      <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-colors ${
                        isChecked ? "bg-[#114D38] border-[#114D38] text-white" : "border-slate-300 bg-white"
                      }`}>
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* STEP 3: REGISTROS FOTOGRÁFICOS E OBSERVAÇÕES */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-2">
              <h4 className="text-xs font-black text-[#114D38] uppercase tracking-wide">Passo 3: Registro Visual</h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Anexe fotos reais das laterais, interior, retrovisores e faróis do veículo e adicione comentários de avarias.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Front side upload & obs */}
              <PhotoUploadAndObsField 
                title="Dianteira" 
                obsVal={formData.obsDianteira} 
                photoVal={formData.fotoFrente}
                onObsChange={(v) => setFormData(p => ({ ...p, obsDianteira: v }))}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotoFrente: base64 }))}
              />

              {/* Driver side upload & obs */}
              <PhotoUploadAndObsField 
                title="Lado Motorista" 
                obsVal={formData.obsMotorista} 
                photoVal={formData.fotoMotorista}
                onObsChange={(v) => setFormData(p => ({ ...p, obsMotorista: v }))}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotoMotorista: base64 }))}
              />

              {/* Passenger side upload & obs */}
              <PhotoUploadAndObsField 
                title="Lado Passageiro" 
                obsVal={formData.obsPassageiro} 
                photoVal={formData.fotoPassageiro}
                onObsChange={(v) => setFormData(p => ({ ...p, obsPassageiro: v }))}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotoPassageiro: base64 }))}
              />

              {/* Rear side upload & obs */}
              <PhotoUploadAndObsField 
                title="Traseira" 
                obsVal={formData.obsTraseira} 
                photoVal={formData.fotoTraseira}
                onObsChange={(v) => setFormData(p => ({ ...p, obsTraseira: v }))}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotoTraseira: base64 }))}
              />

              {/* Interior */}
              <PhotoUploadAndObsField 
                title="Interior" 
                photoVal={formData.fotosInterior}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotosInterior: base64 }))}
              />

              {/* Retrovisor Motorista */}
              <PhotoUploadAndObsField 
                title="Retrovisor Motorista" 
                photoVal={formData.fotoRetrovisorMotorista}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotoRetrovisorMotorista: base64 }))}
              />

              {/* Retrovisor Passageiro */}
              <PhotoUploadAndObsField 
                title="Retrovisor Passageiro" 
                photoVal={formData.fotoRetrovisorPassageiro}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotoRetrovisorPassageiro: base64 }))}
              />

              {/* Faróis Dianteiros */}
              <PhotoUploadAndObsField 
                title="Faróis Dianteiros" 
                photoVal={formData.fotoFaroisDianteiros}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotoFaroisDianteiros: base64 }))}
              />

              {/* Faróis Traseiros */}
              <PhotoUploadAndObsField 
                title="Faróis Traseiros" 
                photoVal={formData.fotoFaroisTraseiros}
                onPhotoUploaded={(base64) => setFormData(p => ({ ...p, fotoFaroisTraseiros: base64 }))}
              />

            </div>
          </div>
        )}

        {/* STEP 4: REVISÃO DE DADOS & ENVIO */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-2">
              <h4 className="text-xs font-black text-[#114D38] uppercase tracking-wide">Passo 4: Revisar e Concluir</h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Confirme todos os dados inseridos e finalize o registro da inspeção.</p>
            </div>

            {/* Quick summary grid */}
            <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase text-slate-400 block font-black">Placa do Veículo</span>
                <span className="font-mono text-slate-800 text-sm font-black">{formData.placa}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase text-slate-400 block font-black">Odômetro</span>
                <span className="text-slate-800 text-sm font-black">{formData.kmAtual} KM</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase text-slate-400 block font-black">Condutor</span>
                <span className="text-slate-800 font-black">{formData.entreguePor}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase text-slate-400 block font-black">Base Ativa</span>
                <span className="text-slate-800 font-black">{formData.base}</span>
              </div>
            </div>

            {/* Warning notes */}
            <div className="p-4 rounded-2xl border border-amber-150 bg-amber-50/50 text-amber-800 text-xs flex gap-3 leading-relaxed">
              <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-left">
                <strong className="font-extrabold uppercase text-[10px] tracking-wide block mb-0.5">Termo de Responsabilidade</strong>
                Ao enviar este formulário, o condutor declara que as informações de quilometragem, combustível, acessórios e desgaste de pneus informados correspondem rigorosamente ao estado atual do veículo leve Risel.
              </div>
            </div>

            {/* Submit progress banner if active */}
            {isSubmitting && (
              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                <span className="text-xs font-bold font-mono">Salvando e persistindo auditoria de veículo...</span>
              </div>
            )}

          </div>
        )}

        {/* Form Wizard Navigation Buttons */}
        <div className="pt-4 border-t border-slate-100 flex justify-between gap-3 bg-white mt-auto">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-black uppercase rounded-xl text-slate-600 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-2 bg-[#114D38] hover:bg-[#1d7053] text-[11px] font-black uppercase text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
            >
              Próximo <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-[11px] font-black uppercase text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
            >
              {isSubmitting ? "Enviando..." : "Enviar Checklist"} <Check className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </form>
    </div>
  );
}

// Internal small sub-components for form fields
interface TireSelectorFieldProps {
  label: string;
  val: string;
  onChange: (v: string) => void;
  options: string[];
}
function TireSelectorField({ label, val, onChange, options }: TireSelectorFieldProps) {
  return (
    <div className="space-y-1.5 text-left">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">{label}</span>
      <select
        value={val}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

interface PhotoUploadAndObsFieldProps {
  title: string;
  obsVal?: string;
  photoVal: string;
  onObsChange?: (v: string) => void;
  onPhotoUploaded: (base64: string) => void;
}
function PhotoUploadAndObsField({ title, obsVal, photoVal, onObsChange, onPhotoUploaded }: PhotoUploadAndObsFieldProps) {
  const fileInputId = `file-input-${title.replace(/\s+/g, "-").toLowerCase()}`;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          onPhotoUploaded(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3 text-left">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">{title}</span>

      <input
        type="file"
        id={fileInputId}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Photo drag/drop upload simulation */}
      <button
        type="button"
        onClick={() => document.getElementById(fileInputId)?.click()}
        className={`w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-2 transition-all cursor-pointer relative overflow-hidden ${
          photoVal 
            ? "border-emerald-300 bg-emerald-50/20" 
            : "border-slate-300 bg-white hover:bg-slate-50"
        }`}
      >
        {photoVal ? (
          <>
            <img 
              src={photoVal} 
              alt={`Foto ${title}`} 
              className="w-full h-full object-cover rounded-lg"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center text-white text-[9px] font-black uppercase opacity-0 hover:opacity-100 transition-opacity">
              Alterar Imagem <Upload className="w-3.5 h-3.5 ml-1" />
            </div>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-slate-400" />
            <div className="text-center">
              <span className="text-[10px] font-black text-slate-700 uppercase block">Anexar Foto</span>
              <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Clique para enviar imagem real</span>
            </div>
          </>
        )}
      </button>

      {/* Observations comment input */}
      {onObsChange && (
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase">Observações / Avarias</label>
          <input
            type="text"
            value={obsVal || ""}
            onChange={(e) => onObsChange(e.target.value)}
            placeholder="Ex: Riscado, amassado, ou Ok"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
          />
        </div>
      )}
    </div>
  );
}
