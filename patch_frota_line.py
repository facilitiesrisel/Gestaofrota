import re

with open('src/pages/Frota.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "Top Counters Summary Row - 5 Principal Indicators with Unique Colors" in line:
        lines[i+1] = "        {activeTab !== \"reservas\" && activeTab !== \"rastreamento\" && activeTab !== \"checklist\" && activeTab !== \"multas\" && subSectionFrota !== \"custos\" && (\n"
        break

with open('src/pages/Frota.tsx', 'w') as f:
    f.writelines(lines)
