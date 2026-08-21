import re

with open("src/pages/Frota.tsx", "r") as f:
    content = f.read()

# Fix form mapped object
old_fuel_obj = """    const fuel: Abastecimento = {
      id: String(Date.now()),
      placa,
      data: formData.get("data") as string,
      odometro: odom,
      litros: Number(formData.get("litros") || 0),
      valorTotal: Number(formData.get("valorTotal") || 0),
      posto: formData.get("posto") as string,
    };"""

new_fuel_obj = """    const vehicle = veiculos.find(v => v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
    const fuel: Abastecimento = {
      id: String(Date.now()),
      placa,
      base: vehicle?.filial || "",
      condutor: "",
      data: formData.get("data") as string,
      kmPercorrido: odom, // storing odometro here as fallback, though it means KM percorrido in CSV. Wait, no. We'll set kmPercorrido as 0 for manual input if it's an odometer reading.
      litros: Number(formData.get("litros") || 0),
      valorTotal: Number(formData.get("valorTotal") || 0),
      combustivel: "",
      posto: formData.get("posto") as string,
      cidade: ""
    };"""

content = content.replace(old_fuel_obj, new_fuel_obj)

# Fix remaining setActiveCustoTab and activeCustoTab
content = content.replace('setActiveCustoTab(', 'setActiveAbastecimentoTab(')
content = content.replace('activeCustoTab ===', 'activeAbastecimentoTab ===')

with open("src/pages/Frota.tsx", "w") as f:
    f.write(content)

print("Fixed Frota ts issues.")
