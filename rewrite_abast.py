import re

with open("src/pages/Frota.tsx", "r") as f:
    content = f.read()

# 1. Clean up unused states (we'll replace all activeCustoTab with activeAbastecimentoTab)
content = content.replace('activeCustoTab === "abastecimentos"', 'activeAbastecimentoTab === "tabela"')

# Find where the actual content starts for the tab
start_str = '{activeAbastecimentoTab === "tabela" ? ('
end_str = '              </div>\n            ) : (\n              <div className="space-y-6">'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = """{activeAbastecimentoTab === "tabela" ? (
                  <AbastecimentoTableView 
                    abastecimentos={abastecimentos} 
                    veiculos={veiculos} 
                    filterPlaca={filterPlaca}
                    filterBase={filterBase}
                    filterPeriodoInicio={filterPeriodoInicio}
                    filterPeriodoFim={filterPeriodoFim}
                    onImport={() => { setCsvType("abastecimentos"); fileInputRef.current?.click(); }}
                  />
                ) : (
                  <AbastecimentoDashboardView 
                    abastecimentos={abastecimentos} 
                    veiculos={veiculos}
                    filterPlaca={filterPlaca}
                    filterBase={filterBase}
                    filterPeriodoInicio={filterPeriodoInicio}
                    filterPeriodoFim={filterPeriodoFim}
                  />
                )}
"""
    content = content[:start_idx] + new_content + content[end_idx:]

with open("src/pages/Frota.tsx", "w") as f:
    f.write(content)

print("Rewrote the render block.")
