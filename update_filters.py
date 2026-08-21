import re

with open("src/pages/Frota.tsx", "r") as f:
    content = f.read()

# 1. Add state
content = content.replace(
    'const [filterBase, setFilterBase] = useState("");',
    'const [filterBase, setFilterBase] = useState("");\n  const [filterCondutor, setFilterCondutor] = useState("");'
)

# 2. Add Condutor select to filters UI
condutor_html = """                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gestor / Condutor</label>
                          <input
                            type="text"
                            placeholder="Nome do condutor..."
                            value={filterCondutor}
                            onChange={(e) => setFilterCondutor(e.target.value)}
                            className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] text-xs font-semibold bg-white text-slate-700"
                          />
                        </div>"""

content = content.replace(
    '<div className="sm:col-span-2 md:col-span-4 flex justify-end gap-2 mt-1">',
    condutor_html + '\n                        <div className="sm:col-span-2 md:col-span-5 flex justify-end gap-2 mt-1">'
)

content = content.replace('md:grid-cols-4', 'md:grid-cols-5')

# 3. Pass prop
content = content.replace('filterBase={filterBase}', 'filterBase={filterBase}\n                    filterCondutor={filterCondutor}')

with open("src/pages/Frota.tsx", "w") as f:
    f.write(content)

with open("src/components/reserva/AbastecimentoViews.tsx", "r") as f:
    views_content = f.read()

views_content = views_content.replace('filterBase: string;', 'filterBase: string;\n  filterCondutor?: string;')
views_content = views_content.replace('filterPeriodoFim, onImport', 'filterPeriodoFim, filterCondutor, onImport')
views_content = views_content.replace('filterPeriodoFim \n})', 'filterPeriodoFim, filterCondutor\n})')

# Add condutor filter logic
filter_logic_old = """    let filtered = abastecimentos;
    if (filterPlaca) filtered = filtered.filter(a => a.placa.includes(filterPlaca));
    if (filterBase) filtered = filtered.filter(a => a.base === filterBase);"""

filter_logic_new = """    let filtered = abastecimentos;
    if (filterPlaca) filtered = filtered.filter(a => a.placa.includes(filterPlaca));
    if (filterBase) filtered = filtered.filter(a => a.base === filterBase);
    if (filterCondutor) filtered = filtered.filter(a => a.condutor.toLowerCase().includes(filterCondutor.toLowerCase()));"""

views_content = views_content.replace(filter_logic_old, filter_logic_new)

with open("src/components/reserva/AbastecimentoViews.tsx", "w") as f:
    f.write(views_content)

print("Updated filters with Condutor/Gestor")
