import re

with open("src/pages/Frota.tsx", "r") as f:
    content = f.read()

# 1. Remove the incorrectly injected Pedágios Table View
pedagios_start = content.find("                ) : (\n                  /* Pedágios Table View */")
if pedagios_start != -1:
    pedagios_end = content.find("                )}", pedagios_start) + len("                )}")
    # We replace it back with what it originally was before the wrong patch:
    # "                  </div>\n                )"
    # Actually, let's see. The wrong patch did:
    # idx = content.rfind("                  </div>\n                )")
    # content[:idx] + "                  </div>\n" + pedagio_section + content[idx + len(end_of_oficina):]
    # So we just find `pedagio_section` and replace it with `)` (since `end_of_oficina` was replaced).
    
    # Let's extract the exact string that was inserted
    # It started with `\n                ) : (\n                  /* Pedágios Table View */`
    start_idx = content.find("                ) : (\n                  /* Pedágios Table View */")
    end_idx = content.find("                  </div>\n                )}\n", start_idx)
    if start_idx != -1 and end_idx != -1:
        # Restore the original closing
        content = content[:start_idx] + "                )" + content[end_idx + len("                  </div>\n                )}"): ]

# 2. Find the correct end of Oficina Table View
# It is the block ending with `/* Oficina Table View */` ... `</table>\n                    </div>\n                  </div>\n                )}`
oficina_start = content.find("/* Oficina Table View */")
if oficina_start != -1:
    oficina_end_search = "                  </div>\n                )}"
    oficina_end_idx = content.find(oficina_end_search, oficina_start)
    if oficina_end_idx != -1:
        # We want to change `)}` to `) : (\n                  /* Pedágios Table View */ ... )}`
        pedagio_section_correct = """ : (
                  /* Pedágios Table View */
                  <div className="bg-white rounded-[24px] border border-slate-150 p-5 shadow-sm text-left">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-500" /> Custos de Pedágio ({
                            pedagios.filter(pd => {
                              if (filterPlaca && !pd.placa.toLowerCase().includes(filterPlaca.toLowerCase())) return false;
                              if (filterPeriodoInicio && pd.data < filterPeriodoInicio) return false;
                              if (filterPeriodoFim && pd.data > filterPeriodoFim) return false;
                              if (filterBase && pd.base !== filterBase) {
                                const v = veiculos.find(veh => veh.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === pd.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
                                if (!v || v.filial !== filterBase) return false;
                              }
                              return true;
                            }).length
                          })
                        </h4>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider self-center">Colunas:</span>
                          {Object.keys(visColPedagio).map((col) => (
                             <button
                               key={col}
                               onClick={() => setVisColPedagio(prev => ({...prev, [col]: !(prev as any)[col]}))}
                               className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                                 (visColPedagio as any)[col] ? "bg-[#114D38] text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                               }`}
                             >
                               {col}
                             </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setCsvType("pedagios"); fileInputRef.current?.click(); }}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          Importar CSV
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[450px] overflow-y-auto border border-slate-100 rounded-xl relative">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gradient-to-r from-[#114D38] to-[#1a664c] sticky top-0 z-10 font-bold text-white uppercase tracking-wider text-[9px] border-b border-slate-100 shadow-sm">
                          <tr>
                            {visColPedagio.veiculo && <th className="py-2.5 px-3">Placa</th>}
                            {visColPedagio.base && <th className="py-2.5 px-3">Base</th>}
                            {visColPedagio.condutor && <th className="py-2.5 px-3">Condutor</th>}
                            {visColPedagio.locadora && <th className="py-2.5 px-3">Locadora</th>}
                            {visColPedagio.data && <th className="py-2.5 px-3">Data</th>}
                            {visColPedagio.valor && <th className="py-2.5 px-3 text-right">Valor</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                          {pedagios
                            .filter(pd => {
                              if (filterPlaca && !pd.placa.toLowerCase().includes(filterPlaca.toLowerCase())) return false;
                              if (filterPeriodoInicio && pd.data < filterPeriodoInicio) return false;
                              if (filterPeriodoFim && pd.data > filterPeriodoFim) return false;
                              if (filterBase) {
                                const v = veiculos.find(veh => veh.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === pd.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
                                if (!v || v.filial !== filterBase) return false;
                              }
                              return true;
                            })
                            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                            .map(pd => {
                              const vehicle = veiculos.find(v => v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === pd.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
                              return (
                                <tr key={pd.id} className="hover:bg-slate-50/50">
                                  {visColPedagio.veiculo && <td className="py-2.5 px-3 font-mono text-slate-800">{pd.placa}</td>}
                                  {visColPedagio.base && <td className="py-2.5 px-3 text-slate-500 text-[10px]">{pd.base || vehicle?.filial || "-"}</td>}
                                  {visColPedagio.condutor && <td className="py-2.5 px-3">{pd.condutor || "-"}</td>}
                                  {visColPedagio.locadora && <td className="py-2.5 px-3">{pd.locadora || "-"}</td>}
                                  {visColPedagio.data && <td className="py-2.5 px-3">{new Date(pd.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>}
                                  {visColPedagio.valor && <td className="py-2.5 px-3 text-right text-emerald-600 font-extrabold">
                                    {pd.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  </td>}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}"""
        
        # We replace `)}` at the end of oficina block with `) : ( ... )}`
        content = content[:oficina_end_idx + len("                  </div>\n                ")] + pedagio_section_correct + content[oficina_end_idx + len("                  </div>\n                )}"): ]

with open("src/pages/Frota.tsx", "w") as f:
    f.write(content)

print("Fixed Frota.tsx.")
