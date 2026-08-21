import re

with open('src/pages/multas/MultasDashboard.tsx', 'r') as f:
    content = f.read()

cards_code = """
                {/* DASHBOARD METRICS GRID - GRADIENT CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-2">
                
                {/* CARD 1: Quantidade de Multas (Filtro Global) - BLUE GRADIENT */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-blue-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><FileText size={18}/></div>
                            {dashboardMetrics.showTrend && (
                                <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border border-white/20 ${dashboardMetrics.percentChange > 0 ? 'bg-red-500/20 text-white' : 'bg-emerald-500/20 text-white'}`}>
                                        {dashboardMetrics.percentChange > 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
                                        {Math.abs(dashboardMetrics.percentChange).toFixed(1)}%
                                </div>
                            )}
                            {!dashboardMetrics.showTrend && (
                                <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/20 text-white border border-white/20">
                                    GERAL
                                </div>
                            )}
                        </div>
                        <h3 className="text-3xl font-black text-white">{dashboardMetrics.qtdMultas}</h3>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wide">Total Selecionado</p>
                            <span className="text-[10px] font-medium text-blue-200">Média: {dashboardMetrics.mediaMultasPorFrota.toFixed(2)}/veíc</span>
                        </div>
                    </div>
                </div>

                {/* CARD 2: Valor Total Estimado - AMBER GRADIENT */}
                <div className="bg-gradient-to-br from-amber-600 to-amber-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-amber-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><DollarSign size={18}/></div>
                        </div>
                        <h3 className="text-xl font-black text-white">
                            {dashboardMetrics.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        <p className="text-[10px] font-bold text-amber-100 uppercase tracking-wide mt-1">Valor Estimado</p>
                    </div>
                </div>

                {/* CARD 3: Total de Frotas - INDIGO GRADIENT */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-indigo-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><Truck size={18}/></div>
                            <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/20 text-white border border-white/20">
                                    {dashboardMetrics.totalFrotasAtivas} ATIVOS
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-white">{dashboardMetrics.totalVeiculos}</h3>
                        <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-wide mt-1">Frota Total</p>
                    </div>
                </div>

                {/* CARD 4: Frotas COM Multas - RED GRADIENT */}
                <div className="bg-gradient-to-br from-red-600 to-red-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-red-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><Siren size={18}/></div>
                            <span className="text-[10px] font-black text-white bg-red-800/30 px-2 py-0.5 rounded">{dashboardMetrics.percentFrotasComMulta.toFixed(1)}%</span>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white">{dashboardMetrics.qtdFrotasComMulta}</h3>
                            <p className="text-[10px] font-bold text-red-100 uppercase tracking-wide mt-1">Ativos c/ Multas</p>
                            
                            {/* Visual Indicator Bar */}
                            <div className="w-full bg-black/20 h-1 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className="h-full bg-white/90 rounded-full"
                                    style={{ width: `${dashboardMetrics.percentFrotasComMulta}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CARD 5: Frotas SEM Multas - GREEN/EMERALD GRADIENT */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-emerald-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><CheckCircle2 size={18}/></div>
                            <span className="text-[10px] font-black text-white bg-emerald-800/30 px-2 py-0.5 rounded">{dashboardMetrics.percentFrotasSemMulta.toFixed(1)}%</span>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white">{dashboardMetrics.qtdFrotasSemMulta}</h3>
                            <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wide mt-1">Ativos s/ Multas</p>
                            {/* Visual Indicator Bar */}
                            <div className="w-full bg-black/20 h-1 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className="h-full bg-white/90 rounded-full"
                                    style={{ width: `${dashboardMetrics.percentFrotasSemMulta}%` }}
                                ></div>
                                </div>
                        </div>
                    </div>
                </div>

                </div>
                
                {/* NEW: DYNAMIC CHARTS SECTION */}
"""

content = content.replace("{/* NEW: DYNAMIC CHARTS SECTION */}", cards_code)

with open('src/pages/multas/MultasDashboard.tsx', 'w') as f:
    f.write(content)
