import { useState, useEffect } from "react";
import { ClipboardCheck, ShieldCheck, HelpCircle } from "lucide-react";
import { ChecklistForm } from "../components/reserva/ChecklistForm";

interface Vehicle {
  id: string;
  modelo: string;
  placa: string;
  base?: string;
  status?: string;
}

export default function ChecklistPublico() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVehicles() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/api/veiculos/data");
        if (res.ok) {
          const data = await res.json();
          const mapped: Vehicle[] = (data || []).map((v: any, index: number) => ({
            id: v.id || `veh_${index}`,
            modelo: v.modelo || v.marcaModelo || "",
            placa: v.placa || "",
            base: v.base || "",
            status: v.status || "ATIVO"
          }));
          if (mapped.length > 0) {
            setVehicles(mapped);
            return;
          }
        }
        
        // Fallback caso a API esteja indisponível no momento
        const cached = localStorage.getItem("risel_frota_veiculos");
        if (cached) {
          try {
            setVehicles(JSON.parse(cached));
            return;
          } catch (e) {}
        }

        // Veículos de fallback emergencial para garantir preenchimento
        setVehicles([
          { id: "v1", modelo: "MOBI", placa: "TZA6J27", base: "CAMPINEIRA" },
          { id: "v2", modelo: "ONIX", placa: "RSL1A23", base: "PAULÍNIA" },
          { id: "v3", modelo: "HB20", placa: "RSL2B45", base: "FROTA RISEL" }
        ]);
      } catch (err: any) {
        console.warn("Aviso ao carregar veículos do backend, usando fallback:", err);
        setVehicles([
          { id: "v1", modelo: "MOBI", placa: "TZA6J27", base: "CAMPINEIRA" },
          { id: "v2", modelo: "ONIX", placa: "RSL1A23", base: "PAULÍNIA" }
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    loadVehicles();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Header Institucional */}
      <header className="bg-gradient-to-r from-[#114D38] to-[#0d3b2b] text-white py-5 px-6 shadow-md border-b-4 border-[#F47920]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F47920]/20 text-[#F47920] rounded-xl flex items-center justify-center border border-[#F47920]/30 shadow-inner">
              <ClipboardCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-black tracking-wider uppercase font-display">Risel Combustíveis</h1>
              <p className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-widest">Portal de Checklist de Frota Leve</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-[#F47920]/10 border border-[#F47920]/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-orange-400">
            <ShieldCheck className="w-4 h-4 text-[#F47920]" />
            Acesso Direto Seguro
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-center">
        {isLoading ? (
          <div className="text-center py-20 space-y-4 bg-white rounded-3xl border border-slate-100 shadow-lg p-8">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Carregando lista de veículos ativos...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 space-y-4 bg-white rounded-3xl border border-rose-100 shadow-lg p-8">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-slate-800 uppercase">Falha na Inicialização</h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase text-white rounded-xl shadow-md transition-all"
            >
              Recarregar Página
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Aviso Informativo */}
            <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-2xl text-left text-xs font-bold text-amber-800 shadow-xs">
              <span className="uppercase text-amber-950 font-black block mb-1">📢 Instruções Importantes:</span>
              Preencha com atenção todos os campos solicitados e envie as fotos reais do veículo. Sua auditoria de checklist é indispensável para a manutenção preventiva e segurança da frota.
            </div>

            {/* Formulário Principal */}
            <ChecklistForm 
              vehicles={vehicles} 
              onFormSubmitSuccess={(newCheck) => {
                console.log("Checklist público enviado com sucesso!", newCheck);
              }} 
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 text-[10px] font-bold py-6 text-center select-none">
        <p className="uppercase tracking-wider">© {new Date().getFullYear()} Risel Combustíveis • Tecnologia e Frota</p>
        <p className="text-slate-600 uppercase tracking-widest mt-1 text-[8px]">Desenvolvimento de Sistemas de Frota Leve</p>
      </footer>
    </div>
  );
}
