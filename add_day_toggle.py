import re

with open("src/components/reserva/AbastecimentoViews.tsx", "r") as f:
    content = f.read()

# Add a state for time grouping
state_hook = 'const [filterCidade, setFilterCidade] = useState("");'
state_hook_new = 'const [filterCidade, setFilterCidade] = useState("");\n  const [timeView, setTimeView] = useState<"month"|"day">("month");'
content = content.replace(state_hook, state_hook_new)

# Update chartData logic to return dayData as well
chart_logic_old = """    const monthData = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).map(m => {
       const [year, mo] = m.month.split("-");
       return { ...m, label: `${mo}/${year}` };
    });"""

chart_logic_new = """    const byDay: Record<string, { day: string, valor: number, litros: number, km: number }> = {};
    filtered.forEach(ab => {
      const d = ab.data; // YYYY-MM-DD
      if (!byDay[d]) byDay[d] = { day: d, valor: 0, litros: 0, km: 0 };
      byDay[d].valor += ab.valorTotal;
      byDay[d].litros += ab.litros;
      byDay[d].km += ab.kmPercorrido;
    });

    const monthData = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).map(m => {
       const [year, mo] = m.month.split("-");
       return { ...m, label: `${mo}/${year}` };
    });

    const dayData = Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)).map(d => {
       const [year, mo, day] = d.day.split("-");
       return { ...d, label: `${day}/${mo}` };
    });"""

content = content.replace(chart_logic_old, chart_logic_new)
content = content.replace('return { monthData, baseData, fuelData, postoData };', 'return { monthData, dayData, baseData, fuelData, postoData };')

# Update the AreaChart header to include the button
chart_html_old = """        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex flex-col gap-4">
           <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
             <LineChartIcon className="w-4 h-4 text-emerald-600" /> Valor Abastecido por Mês
           </h4>
           <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData.monthData}>"""

chart_html_new = """        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex flex-col gap-4">
           <div className="flex justify-between items-center">
             <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
               <LineChartIcon className="w-4 h-4 text-emerald-600" /> Valor Abastecido
             </h4>
             <div className="flex bg-slate-100 rounded-lg p-0.5">
               <button onClick={() => setTimeView('month')} className={`px-2 py-1 text-[9px] font-bold uppercase rounded ${timeView === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Mês</button>
               <button onClick={() => setTimeView('day')} className={`px-2 py-1 text-[9px] font-bold uppercase rounded ${timeView === 'day' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Dia</button>
             </div>
           </div>
           <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={timeView === 'month' ? chartData.monthData : chartData.dayData}>"""

content = content.replace(chart_html_old, chart_html_new)

with open("src/components/reserva/AbastecimentoViews.tsx", "w") as f:
    f.write(content)

