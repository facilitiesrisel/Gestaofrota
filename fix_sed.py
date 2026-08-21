with open("src/components/reserva/AbastecimentoViews.tsx", "r") as f:
    content = f.read()

content = content.replace('<Search, Crown ', '<Search ')

with open("src/components/reserva/AbastecimentoViews.tsx", "w") as f:
    f.write(content)
