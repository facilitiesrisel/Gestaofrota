import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

const CITY_COORDINATES: Record<string, [number, number]> = {
  'paulinia': [-22.7639, -47.1539],
  'paulínia': [-22.7639, -47.1539],
  'campinas': [-22.9056, -47.0608],
  'sao paulo': [-23.5505, -46.6333],
  'são paulo': [-23.5505, -46.6333],
  'sp': [-23.5505, -46.6333],
  'santos': [-23.9608, -46.3336],
  'piracicaba': [-22.7253, -47.6492],
  'sorocaba': [-23.5015, -47.4526],
  'jundiai': [-23.1857, -46.8978],
  'jundiaí': [-23.1857, -46.8978],
  'sao jose dos campos': [-23.1896, -45.8841],
  'são josé dos campos': [-23.1896, -45.8841],
  'sjc': [-23.1896, -45.8841],
  'ribeirao preto': [-21.1775, -47.8103],
  'ribeirão preto': [-21.1775, -47.8103],
  'americana': [-22.7392, -47.3314],
  'sumare': [-22.8206, -47.2669],
  'sumaré': [-22.8206, -47.2669],
  'indaiatuba': [-23.0903, -47.2181],
  'valinhos': [-22.9706, -46.9958],
  'hortolandia': [-22.8583, -47.2200],
  'hortolândia': [-22.8583, -47.2200],
  'limeira': [-22.5647, -47.4017],
  'rio claro': [-22.4114, -47.5614],
  'araras': [-22.3572, -47.3842],
  'rio de janeiro': [-22.9068, -43.1729],
  'rj': [-22.9068, -43.1729],
  'belo horizonte': [-19.9167, -43.9345],
  'bh': [-19.9167, -43.9345],
  'curitiba': [-25.4284, -49.2733],
  'porto alegre': [-30.0346, -51.2177],
  'brasilia': [-15.7975, -47.8919],
  'brasília': [-15.7975, -47.8919],
  'goiania': [-16.6869, -49.2648],
  'goiânia': [-16.6869, -49.2648],
  'guarulhos': [-23.4542, -46.5337],
  'osasco': [-23.5325, -46.7917],
  'santo andre': [-23.6639, -46.5383],
  'santo andré': [-23.6639, -46.5383],
  'sao bernardo': [-23.6914, -46.5647],
  'são bernardo': [-23.6914, -46.5647],
  'taubate': [-23.0264, -45.5553],
  'taubaté': [-23.0264, -45.5553],
  'barueri': [-23.5114, -46.8764],
  'mogi das cruzes': [-23.5208, -46.1853],
  'bertioga': [-23.8544, -46.1394],
  'guaruja': [-23.9931, -46.2564],
  'guarujá': [-23.9931, -46.2564],
  'ubatuba': [-23.4339, -45.0839],
  'caraguatatuba': [-23.6229, -45.4128],
  'sao sebastiao': [-23.7606, -45.4097],
  'são sebastião': [-23.7606, -45.4097],
  'itatiba': [-23.0058, -46.8406],
  'atibaia': [-23.1189, -46.5539],
  'braganca paulista': [-22.9528, -46.5419],
  'bragança paulista': [-22.9528, -46.5419],
  'cosmopolis': [-22.6453, -47.1961],
  'cosmópolis': [-22.6453, -47.1961],
  'artur nogueira': [-22.5731, -47.1728],
  'jaguariuna': [-22.7042, -46.9856],
  'jaguariúna': [-22.7042, -46.9856],
  'pedreira': [-22.7419, -46.9014],
  'amparo': [-22.7028, -46.7644],
  'serra negra': [-22.6128, -46.7003],
  'socorro': [-22.5919, -46.5289],
  'aguas de lindoia': [-22.4764, -46.6328],
  'águas de lindóia': [-22.4764, -46.6328],
  'vinhedo': [-23.0297, -46.9753],
  'louveira': [-23.0858, -46.9508],
  'itupeva': [-23.1531, -47.0578],
  'itu': [-23.2642, -47.2992],
  'salto': [-23.2008, -47.2869],
  'porto feliz': [-23.2144, -47.5239],
  'tiete': [-23.1022, -47.7144],
  'tietê': [-23.1022, -47.7144],
  'capivari': [-22.9961, -47.5075],
  'botucatu': [-22.8858, -48.4450],
  'bauru': [-22.3147, -49.0606],
  'marilia': [-22.2139, -49.9458],
  'marília': [-22.2139, -49.9458],
  'presidente prudente': [-22.1256, -51.3889],
  'sao carlos': [-22.0175, -47.8908],
  'são carlos': [-22.0175, -47.8908],
  'araraquara': [-21.7944, -48.1764],
  'franca': [-20.5386, -47.4008],
  'sao joao da boa vista': [-21.9694, -46.7972],
  'são joão da boa vista': [-21.9694, -46.7972],
  'pocos de caldas': [-21.7850, -46.5650],
  'poços de caldas': [-21.7850, -46.5650]
};

const getCityCoords = (cityName: string): [number, number] => {
  const norm = cityName.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (CITY_COORDINATES[norm]) return CITY_COORDINATES[norm];
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (norm.includes(key) || key.includes(norm)) return coords;
  }
  let hash = 0;
  for (let i = 0; i < cityName.length; i++) hash = (hash << 5) - hash + cityName.charCodeAt(i);
  const latOffset = ((Math.abs(hash) % 100) / 100 - 0.5) * 1.5;
  const lngOffset = ((Math.abs(hash >> 3) % 100) / 100 - 0.5) * 1.5;
  return [-22.75 + latOffset, -47.15 + lngOffset];
};

const createCityDivIcon = (cityName: string, count: number, isTop: boolean) => {
  return L.divIcon({
    className: 'custom-city-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
        <div style="background: ${isTop ? '#00753f' : '#0f172a'}; color: #fff; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 9999px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); border: 1.5px solid #fff; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
          <span>📍</span> <span>${cityName}</span> <span style="background: ${isTop ? '#ff9b00' : '#334155'}; color: #fff; padding: 1px 5px; border-radius: 9999px; font-size: 9px; font-weight: 900;">${count}</span>
        </div>
        <div style="width: 2px; height: 6px; background: ${isTop ? '#00753f' : '#0f172a'};"></div>
        <div style="width: 7px; height: 7px; border-radius: 50%; background: ${isTop ? '#ff9b00' : '#3b82f6'}; border: 1.5px solid #fff; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

const createSedeDivIcon = () => {
  return L.divIcon({
    className: 'custom-sede-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
        <div style="background: #114D38; color: #34d399; font-weight: 900; font-size: 10px; padding: 3px 9px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2px solid #34d399; white-space: nowrap; display: flex; align-items: center; gap: 5px;">
          <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399;"></span>
          <span>SEDE (PAULÍNIA)</span>
        </div>
        <div style="width: 2px; height: 8px; background: #114D38;"></div>
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; border: 2px solid #fff; box-shadow: 0 0 6px #10b981;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

interface DestinationMapProps {
  data: { name: string; value: number }[];
}

const DestinationMap: React.FC<DestinationMapProps> = ({ data }) => {
  const PAUNIA_SEDE: [number, number] = [-22.7639, -47.1539];
  const sorted = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data]);
  const total = useMemo(() => sorted.reduce((s, i) => s + i.value, 0), [sorted]);
  
  const mappedCities = useMemo(() => {
    return sorted.map((item, idx) => {
      const coords = getCityCoords(item.name);
      return {
        name: item.name,
        count: item.value,
        coords,
        isTop: idx < 3,
        percent: total > 0 ? Math.round((item.value / total) * 100) : 0
      };
    });
  }, [sorted, total]);

  return (
    <div className="w-full h-full flex flex-col justify-between rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
      {/* Map Container */}
      <div className="w-full h-[280px] relative rounded-t-2xl overflow-hidden bg-slate-900">
        <MapContainer
          center={PAUNIA_SEDE}
          zoom={8}
          scrollWheelZoom={false}
          style={{ width: '100%', height: '100%', zIndex: 1 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {/* Sede Marker */}
          <Marker position={PAUNIA_SEDE} icon={createSedeDivIcon()}>
            <Popup className="custom-leaflet-popup">
              <div className="p-1">
                <p className="font-extrabold text-emerald-400 text-xs">🏢 Sede Risel</p>
                <p className="text-[10px] text-slate-300">Paulínia - SP (Ponto Central de Saída)</p>
              </div>
            </Popup>
          </Marker>

          {/* Polylines & Destination Markers */}
          {mappedCities.map((city, idx) => (
            <React.Fragment key={idx}>
              <Polyline
                positions={[PAUNIA_SEDE, city.coords]}
                pathOptions={{
                  color: city.isTop ? '#00753f' : '#94a3b8',
                  weight: city.isTop ? 2.5 : 1.5,
                  dashArray: city.isTop ? '4, 4' : '2, 6',
                  opacity: city.isTop ? 0.85 : 0.45
                }}
              />
              <Marker position={city.coords} icon={createCityDivIcon(city.name, city.count, city.isTop)}>
                <Popup className="custom-leaflet-popup">
                  <div className="p-1 min-w-[140px]">
                    <p className="font-extrabold text-white text-xs flex items-center justify-between">
                      <span>📍 {city.name}</span>
                      <span className="text-emerald-400 font-mono text-[11px]">{city.count} viagens</span>
                    </p>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${city.percent}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{city.percent}% de todas as viagens</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </MapContainer>

        {/* Floating Top Badge */}
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{sorted.length} Cidades | {total} Viagens Mapeadas</span>
        </div>
      </div>

      {/* Mini ranking below map */}
      <div className="p-3 bg-white border-t border-slate-200">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {sorted.slice(0, 6).map((city, idx) => (
            <div key={idx} className="flex-1 min-w-[100px] bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-center hover:border-emerald-300 transition-colors">
              <span className="block text-[9px] font-extrabold uppercase text-slate-400">#{idx+1} Destino</span>
              <span className="block text-xs font-black text-slate-800 truncate" title={city.name}>{city.name}</span>
              <span className="block text-[10px] font-bold font-mono text-emerald-600">{city.value} viagens</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DestinationMap;
