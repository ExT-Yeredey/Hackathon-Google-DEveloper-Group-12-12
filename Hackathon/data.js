// Datos simulados (hackathon). Sustituir por Open Data cuando toque.

// =============================
// Google Air Quality API (REAL)
// 1) Crea una API key en Google Cloud
// 2) Activa "Air Quality API"
// 3) Pega tu key aquí (solo para hackathon)
// =============================
window.GOOGLE_AIR_QUALITY_API_KEY = ""; // <- Pega aquí tu API KEY

// Tipo de mapa (heatmap tiles) - opciones comunes:
// "UAQI_RED_GREEN", "UAQI_INDIGO_PERSIAN", "PM25_INDIGO_PERSIAN", "US_AQI", etc.
window.AIR_QUALITY_MAP_TYPE = "PM25_INDIGO_PERSIAN";

// Opacidad del overlay tipo Google
window.AIR_QUALITY_TILES_OPACITY = 0.65;

window.DISTRICTS = [
  { id: "centro", name: "Centro" },
  { id: "salamanca", name: "Salamanca" },
  { id: "chamberi", name: "Chamberí" },
  { id: "retiro", name: "Retiro" },
  { id: "tetuan", name: "Tetuán" },
  { id: "carabanchel", name: "Carabanchel" },
];

// Vista inicial por distrito (Madrid aproximado). Ajusta zoom/centros si quieres.
window.DISTRICT_VIEWS = {
  centro:      { name: "Centro",      lat: 40.4169, lng: -3.7036, zoom: 14 },
  salamanca:   { name: "Salamanca",   lat: 40.4272, lng: -3.6766, zoom: 14 },
  chamberi:    { name: "Chamberí",    lat: 40.4342, lng: -3.7030, zoom: 14 },
  retiro:      { name: "Retiro",      lat: 40.4096, lng: -3.6766, zoom: 14 },
  tetuan:      { name: "Tetuán",      lat: 40.4591, lng: -3.6982, zoom: 13 },
  carabanchel: { name: "Carabanchel", lat: 40.3857, lng: -3.7443, zoom: 13 },
};

// Bounds aproximados por distrito (SW/NE). Sirve para fitBounds y para pintar un contorno.
// Hackathon: no tienen por qué ser perfectos.
window.DISTRICT_BOUNDS = {
  centro:      { sw: [40.4045, -3.7195], ne: [40.4295, -3.6880] },
  salamanca:   { sw: [40.4125, -3.7000], ne: [40.4445, -3.6535] },
  chamberi:    { sw: [40.4210, -3.7190], ne: [40.4505, -3.6865] },
  retiro:      { sw: [40.3955, -3.6960], ne: [40.4255, -3.6560] },
  tetuan:      { sw: [40.4435, -3.7165], ne: [40.4775, -3.6705] },
  carabanchel: { sw: [40.3600, -3.7795], ne: [40.4055, -3.7160] },
};

// Puntos para heatmap por distrito: [lat, lng, intensidad(0..1)] (simulados)
window.HEAT_POINTS = {
  centro: [
    [40.4184, -3.7065, 0.9],
    [40.4157, -3.6995, 0.8],
    [40.4132, -3.7110, 0.7],
    [40.4200, -3.7000, 0.6],
  ],
  salamanca: [
    [40.4287, -3.6750, 0.75],
    [40.4250, -3.6805, 0.65],
    [40.4310, -3.6680, 0.55],
  ],
  chamberi: [
    [40.4352, -3.7070, 0.70],
    [40.4330, -3.6985, 0.55],
    [40.4390, -3.7040, 0.60],
  ],
  retiro: [
    [40.4115, -3.6760, 0.55],
    [40.4070, -3.6810, 0.45],
    [40.4140, -3.6700, 0.50],
  ],
  tetuan: [
    [40.4620, -3.7000, 0.65],
    [40.4560, -3.7045, 0.55],
    [40.4650, -3.6920, 0.50],
  ],
  carabanchel: [
    [40.3890, -3.7470, 0.60],
    [40.3835, -3.7400, 0.50],
    [40.3920, -3.7360, 0.45],
  ],
};

// Generador de grid (celdas) para overlay tipo Google cuando NO hay API key.
// Devuelve una lista de celdas: { bounds: [[lat1,lng1],[lat2,lng2]], now, last }
window.makeDistrictGrid = function makeDistrictGrid(districtId, pollutant) {
  const b = window.DISTRICT_BOUNDS[districtId];
  if (!b) return [];

  // Grid 8x6 (suficiente para demo)
  const rows = 6;
  const cols = 8;

  const swLat = b.sw[0], swLng = b.sw[1];
  const neLat = b.ne[0], neLng = b.ne[1];

  const dLat = (neLat - swLat) / rows;
  const dLng = (neLng - swLng) / cols;

  // random determinista por distrito + contaminante
  const seed = window._seedFrom(districtId + "::" + pollutant);
  let x = 424242 + seed;
  const rand = () => {
    x = (1664525 * x + 1013904223) % 2 ** 32;
    return x / 2 ** 32;
  };

  // rangos “creíbles” (hackathon)
  const ranges = {
    pm25: { min: 8,  max: 45 },
    no2:  { min: 15, max: 120 },
    uaqi: { min: 10, max: 200 },
  };
  const r = ranges[pollutant] || ranges.pm25;

  const cells = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const lat1 = swLat + i * dLat;
      const lat2 = swLat + (i + 1) * dLat;
      const lng1 = swLng + j * dLng;
      const lng2 = swLng + (j + 1) * dLng;

      // patrón suave (centro más alto) + ruido
      const cx = (j + 0.5) / cols;
      const cy = (i + 0.5) / rows;
      const hotspot = 1 - Math.sqrt((cx - 0.55) ** 2 + (cy - 0.45) ** 2);
      const base = r.min + (r.max - r.min) * window._clamp(hotspot, 0, 1);
      const last = window._clamp(base + (rand() - 0.5) * (r.max - r.min) * 0.15, r.min, r.max);
      const now  = window._clamp(last + (rand() - 0.5) * (r.max - r.min) * 0.18, r.min, r.max);

      cells.push({
        bounds: [[lat1, lng1], [lat2, lng2]],
        now: +now.toFixed(pollutant === "no2" || pollutant === "uaqi" ? 0 : 1),
        last: +last.toFixed(pollutant === "no2" || pollutant === "uaqi" ? 0 : 1),
      });
    }
  }
  return cells;
};

// Edificios (lat/lng reales aproximados) para el mapa Leaflet
window.BUILDINGS = [
  { id: "b1", district: "centro", name: "Edificio Plaza",   lat: 40.4173, lng: -3.7039, hasGarden: true,  surfaceM2: 220 },
  { id: "b2", district: "centro", name: "Parking Santo",   lat: 40.4192, lng: -3.6986, hasGarden: false, surfaceM2: 0 },
  { id: "b3", district: "salamanca", name: "Hospital Norte", lat: 40.4276, lng: -3.6738, hasGarden: true,  surfaceM2: 140 },
  { id: "b4", district: "chamberi",  name: "Biblioteca Central", lat: 40.4344, lng: -3.7035, hasGarden: true,  surfaceM2: 95 },
  { id: "b5", district: "retiro",    name: "Colegio Parque", lat: 40.4138, lng: -3.6732, hasGarden: false, surfaceM2: 0 },
  { id: "b6", district: "tetuan",    name: "Torre Azul",    lat: 40.4612, lng: -3.6957, hasGarden: true,  surfaceM2: 180 },
  { id: "b7", district: "carabanchel", name: "Mercado Sur", lat: 40.3874, lng: -3.7448, hasGarden: true,  surfaceM2: 120 },
];

// Helpers
window._clamp = (n, min, max) => Math.max(min, Math.min(max, n));
window._seedFrom = (s) => s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

// Serie mensual simulada para gráficos: 12 meses, ahora vs hace 1 año
window.makeSeries = function makeSeries(seed, mode) {
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  let x = 1234567 + seed * 7919;
  const rand = () => {
    x = (1103515245 * x + 12345) % 2 ** 31;
    return x / 2 ** 31;
  };

  return months.map((m, i) => {
    const season = Math.sin((i / 12) * Math.PI * 2);

    if (mode === "temp") {
      const last = 18 + season * 7 + (rand() - 0.5) * 1.2;
      const now  = last + (rand() - 0.5) * 1.6;
      return { m, now: +now.toFixed(1), last: +last.toFixed(1) };
    }

    // air
    const basePm  = 18 - season * 4;
    const baseNo2 = 42 - season * 10;
    const lastPm  = _clamp(basePm + (rand() - 0.5) * 3.2, 6, 45);
    const nowPm   = _clamp(lastPm + (rand() - 0.5) * 4.0, 6, 45);
    const lastNo2 = _clamp(baseNo2 + (rand() - 0.5) * 8.0, 10, 120);
    const nowNo2  = _clamp(lastNo2 + (rand() - 0.5) * 10.0, 10, 120);

    return {
      m,
      pm_now:  +nowPm.toFixed(1),
      pm_last: +lastPm.toFixed(1),
      no2_now:  +nowNo2.toFixed(0),
      no2_last: +lastNo2.toFixed(0),
    };
  });
};

// Resumen por distrito (KPIs): ahora vs hace 1 año
window.districtScore = function districtScore(districtId, gardenBoostPct) {
  const seed = _seedFrom(districtId);

  let x = 99991 + seed;
  const rand = () => {
    x = (1664525 * x + 1013904223) % 2 ** 32;
    return x / 2 ** 32;
  };

  const basePm   = 16 + rand() * 10;
  const baseNo2  = 35 + rand() * 25;
  const baseTemp = 21 + rand() * 3;

  const gardens = BUILDINGS.filter(b => b.district === districtId && b.hasGarden).length;
  const effect = 1 - (gardens > 0 ? gardenBoostPct / 100 : 0);

  const pm_last  = _clamp(basePm  + rand() * 3.5, 6, 45);
  const pm_now   = _clamp(pm_last * effect + (rand() - 0.5) * 1.8, 6, 45);

  const no2_last = _clamp(baseNo2 + rand() * 9, 10, 120);
  const no2_now  = _clamp(no2_last * effect + (rand() - 0.5) * 6, 10, 120);

  const temp_last = _clamp(baseTemp + (rand() - 0.5) * 1.0, 10, 45);
  const temp_now  = _clamp(temp_last + (rand() - 0.5) * 0.8 - (gardens > 0 ? 0.4 : 0), 10, 45);

  return { gardens, pm_now, pm_last, no2_now, no2_last, temp_now, temp_last };
};
