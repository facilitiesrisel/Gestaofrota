import re

with open('src/layouts/MainLayout.tsx', 'r') as f:
    content = f.read()

pattern = r"(\} else if \(activeTab === \"multas\"\) \{.*?baseMenuItems\.push\(\n).*?(\);\n\s*\} else if \(activeTab === \"rastreamento\"\))"
replacement = r"""\1          { name: "Dashboard", path: "/frota?tab=multas&sub=dashboard", icon: LayoutDashboard, visible: true },
          { name: "Multas", path: "/frota?tab=multas&sub=multas", icon: Siren, visible: true },
          { name: "Alertas", path: "/frota?tab=multas&sub=alertas", icon: BellRing, visible: true },
          { name: "Frotas", path: "/frota?tab=multas&sub=frotas", icon: Truck, visible: true },
          { name: "Motoristas", path: "/frota?tab=multas&sub=motoristas", icon: Users, visible: true },
          { name: "Configurações", path: "/frota?tab=multas&sub=config", icon: Settings, visible: true }
        \2"""
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/layouts/MainLayout.tsx', 'w') as f:
    f.write(content)
