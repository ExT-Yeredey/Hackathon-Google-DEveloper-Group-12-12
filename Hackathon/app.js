/*
  Dashboard Hackathon (HTML/CSS/JS)
  - Mapa mock con edificios + jardines verticales
  - Filtro por distrito + búsqueda
  - Comparativa: contaminación y temperatura (ahora vs hace 1 año)
*/

const el = (id) => document.getElementById(id);

const districtSelect = el("districtSelect");
const buildingSearch = el("buildingSearch");
const toggleGardensBtn = el("toggleGardens");
const toggleHeatBtn = el("toggleHeat");
const impactSlider = el("impactSlider");
const impactValue = el("impactValue");

const mapEl = el("map");
const kpisEl = el("kpis");
const aiRecommendationEl = el("aiRecommendation");
const districtBadge = el("districtBadge");
const buildingCardEl = el("buildingCard");

const pmBarsEl = el("pmBars");
const no2BarsEl = el("no2Bars");
const tempBarsEl = el("tempBars");

let state = {
  district: DISTRICTS[0].id,
  query: "",
  showGardens: true,
  showHeat: true,
  impact: 12,
  pollutant: "pm25",     // pm25 | no2 | uaqi
  timeMode: "now",       // now | last | diff
  selectedBuildingId: null,
  activeTab: "air",
};

function formatDelta(now, last) {
  const d = now - last;
  const sign = d > 0 ? "+" : d < 0 ? "" : "±";
  return `${sign}${d.toFixed(1)}`;
}

function kpiToneLowerIsBetter(now, last) {
  if (now < last) return "good";
  if (now > last) return "bad";
  return "neutral";
}

function setTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".tabPanel").forEach((p) => {
    p.classList.toggle("active", p.id === `tab-${tab}`);
  });
}

function getBuildingsForDistrict() {
  const q = state.query.trim().toLowerCase();
  return BUILDINGS
    .filter((b) => b.district === state.district)
    .filter((b) => (q ? b.name.toLowerCase().includes(q) : true));
}

function ensureSelected(buildings) {
  if (state.selectedBuildingId && buildings.some((b) => b.id === state.selectedBuildingId)) {
    return;
  }
  state.selectedBuildingId = buildings[0]?.id || null;
}

function renderDistrictSelect() {
  districtSelect.innerHTML = "";
  for (const d of DISTRICTS) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    districtSelect.appendChild(opt);
  }
  districtSelect.value = state.district;
}

async function renderKPIs() {
  const s = districtScore(state.district, state.impact);

  // Intento de datos reales (Google Air Quality) usando el centro del distrito
  const view = DISTRICT_VIEWS[state.district];
  const live = view ? await fetchAirQualityCurrent(view.lat, view.lng) : null;

  // Si hay datos reales, intentamos extraer un AQI y (si está) PM2.5 / NO2
  // Nota: la estructura exacta puede variar según cobertura/extraComputations.
  let liveAqi = null;
  let liveDominant = null;
  let livePm25 = null;
  let liveNo2 = null;

  if (live) {
    // AQI (si viene)
    if (Array.isArray(live.indexes) && live.indexes.length) {
      // Usamos el primero (normalmente UAQI)
      liveAqi = live.indexes[0]?.aqi ?? live.indexes[0]?.value ?? null;
    }

    // Dominant pollutant / concentraciones
    if (Array.isArray(live.pollutants)) {
      // Buscar PM2.5 y NO2 por código
      const pm = live.pollutants.find(p => (p.code || p.displayName || "").toString().toLowerCase().includes("pm2"));
      const no = live.pollutants.find(p => (p.code || p.displayName || "").toString().toLowerCase().includes("no2"));

      // Intentos de lectura (depende de la respuesta)
      livePm25 = pm?.concentration?.value ?? pm?.additionalInfo?.concentration?.value ?? null;
      liveNo2  = no?.concentration?.value ?? no?.additionalInfo?.concentration?.value ?? null;

      // Dominante
      liveDominant = live.pollutants.find(p => p.additionalInfo?.dominantPollutant)?.displayName
        || live.pollutants[0]?.displayName
        || null;
    }
  }

  kpisEl.innerHTML = "";

  const items = [
    {
      label: "Jardines instalados",
      value: String(s.gardens),
      delta: "",
      tone: "neutral",
    },
    ...(liveAqi !== null ? [{
      label: "AQI (Google)",
      value: String(liveAqi),
      delta: liveDominant ? `Dominante: ${liveDominant}` : "Datos reales",
      tone: "neutral",
    }] : []),
    {
      label: "PM2.5 (µg/m³)",
      value: (livePm25 !== null ? Number(livePm25).toFixed(1) : s.pm_now.toFixed(1)),
      delta: live ? "Actual (Google)" : `${formatDelta(s.pm_now, s.pm_last)} vs 1 año`,
      tone: live ? "neutral" : kpiToneLowerIsBetter(s.pm_now, s.pm_last),
    },
    {
      label: "NO₂ (µg/m³)",
      value: (liveNo2 !== null ? String(Math.round(liveNo2)) : String(Math.round(s.no2_now))),
      delta: live ? "Actual (Google)" : `${formatDelta(s.no2_now, s.no2_last)} vs 1 año`,
      tone: live ? "neutral" : kpiToneLowerIsBetter(s.no2_now, s.no2_last),
    },
    {
      label: "Temp (°C)",
      value: s.temp_now.toFixed(1),
      delta: `${formatDelta(s.temp_now, s.temp_last)} vs 1 año`,
      tone: kpiToneLowerIsBetter(s.temp_now, s.temp_last),
    },
  ];

  for (const it of items) {
    const div = document.createElement("div");
    div.className = `kpi ${it.tone}`;
    div.innerHTML = `
      <div class="kpiTop">
        <div class="kpiLabel">${it.label}</div>
        <div class="kpiDelta">${it.delta || ""}</div>
      </div>
      <div class="kpiValue">${it.value}</div>
    `;
    kpisEl.appendChild(div);
  }

  // Recomendación IA (simple, para demo)
  aiRecommendationEl.innerHTML = s.gardens === 0
    ? `Prioridad <b>ALTA</b>: instalar jardines verticales en fachadas cercanas a arterias de tráfico y calles estrechas.`
    : `Prioridad <b>MEDIA</b>: ampliar superficie verde en puntos rojos y mantener riego inteligente / mantenimiento.`;
}

let _map = null;
let _markerLayer = null;
let _googleAqTiles = null; // Google Air Quality heatmap tiles overlay
let _gridLayer = null;     // fallback grid overlay (no API key)
let _badgeControl = null;
let _districtLayer = null;
let _legendControl = null;

function markerIcon({ selected, hasGarden }) {
  const cls = ["markerDot", hasGarden ? "garden" : "", selected ? "selected" : ""]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    html: `<div class="${cls}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function initMapIfNeeded() {
  if (_map) return;

  _map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true,
  });

  // OSM tiles (gratis) – estilo parecido a base map
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(_map);

  _markerLayer = L.layerGroup().addTo(_map);

  _gridLayer = L.layerGroup().addTo(_map);

  // Badge arriba a la derecha dentro del mapa
  _badgeControl = L.control({ position: "topright" });
  _badgeControl.onAdd = function () {
    const div = L.DomUtil.create("div", "mapBadge");
    div.id = "mapBadge";
    div.textContent = "";
    return div;
  };
  _badgeControl.addTo(_map);

  // Leyenda abajo a la izquierda
  _legendControl = L.control({ position: "bottomleft" });
  _legendControl.onAdd = function () {
    const div = L.DomUtil.create("div", "mapLegend");
    div.id = "mapLegend";
    div.innerHTML = "";
    return div;
  };
  _legendControl.addTo(_map);
}

async function fetchAirQualityCurrent(lat, lng) {
  const key = (window.GOOGLE_AIR_QUALITY_API_KEY || "").trim();
  if (!key) return null;

  // Current Conditions endpoint
  // POST https://airquality.googleapis.com/v1/currentConditions:lookup?key=YOUR_API_KEY
  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(key)}`;

  const body = {
    location: { latitude: lat, longitude: lng },
    // Pedimos recomendaciones y detalles si están disponibles
    extraComputations: ["HEALTH_RECOMMENDATIONS", "POLLUTANT_CONCENTRATION", "DOMINANT_POLLUTANT_CONCENTRATION"],
    // universalAqi true por defecto
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function pollutantLabel(p) {
  if (p === "no2") return "NO₂";
  if (p === "uaqi") return "Índice";
  return "PM2.5";
}

function mapTypeForPollutant(p) {
  // Para tiles de Google. Si el tipo no existe en vuestra cuenta/cobertura, podéis cambiarlo en data.js.
  // Valores comunes: PM25_INDIGO_PERSIAN, UAQI_INDIGO_PERSIAN, NO2_INDIGO_PERSIAN (si está disponible).
  if (p === "no2") return window.AIR_QUALITY_MAP_TYPE_NO2 || "NO2_INDIGO_PERSIAN";
  if (p === "uaqi") return window.AIR_QUALITY_MAP_TYPE_UAQI || "UAQI_INDIGO_PERSIAN";
  return window.AIR_QUALITY_MAP_TYPE_PM25 || window.AIR_QUALITY_MAP_TYPE || "PM25_INDIGO_PERSIAN";
}

function valueFromCell(cell) {
  if (state.timeMode === "last") return cell.last;
  if (state.timeMode === "diff") return +(cell.now - cell.last).toFixed(1);
  return cell.now;
}

function colorForValue(pollutant, v) {
  // Normalizamos a 0..1 para una paleta verde->amarillo->rojo.
  const ranges = {
    pm25: { min: 8, max: 45 },
    no2:  { min: 15, max: 120 },
    uaqi: { min: 10, max: 200 },
  };
  const r = ranges[pollutant] || ranges.pm25;

  // Modo diferencia: azul si mejora, rojo si empeora
  if (state.timeMode === "diff") {
    if (v < -0.1) return "rgba(59,130,246,0.55)"; // mejora
    if (v > 0.1)  return "rgba(239,68,68,0.55)";  // empeora
    return "rgba(148,163,184,0.45)";             // neutro
  }

  const t = _clamp((v - r.min) / (r.max - r.min), 0, 1);
  // Interpolación simple: verde -> amarillo -> rojo
  if (t < 0.5) {
    const k = t / 0.5;
    return `rgba(${Math.round(16 + (234-16)*k)},${Math.round(185 + (179-185)*k)},${Math.round(129 + (8-129)*k)},0.55)`;
  }
  const k = (t - 0.5) / 0.5;
  return `rgba(${Math.round(234 + (239-234)*k)},${Math.round(179 + (68-179)*k)},${Math.round(8 + (68-8)*k)},0.55)`;
}

function renderLegend() {
  const legend = document.getElementById("mapLegend");
  if (!legend) return;

  const key = (window.GOOGLE_AIR_QUALITY_API_KEY || "").trim();
  const usingGoogleTiles = Boolean(key) && state.showHeat && state.timeMode === "now";

  const timeLabel = state.timeMode === "now" ? "Ahora" : state.timeMode === "last" ? "Hace 1 año" : "Diferencia";
  const title = `${pollutantLabel(state.pollutant)} · ${timeLabel}`;

  legend.innerHTML = `
    <div class="mapLegendTitle">${title}</div>
    <div class="mapLegendRow"><span>Overlay</span><b>${usingGoogleTiles ? "Google Tiles" : "Heatmap PRO"}</b></div>
    <div class="mapLegendBar"><div class="mapLegendBarInner" style="background:${state.timeMode === 'diff' ? 'linear-gradient(90deg,#3b82f6,#94a3b8,#ef4444)' : 'linear-gradient(90deg,#10b981,#eab308,#ef4444)'}"></div></div>
    <div class="mapLegendFoot">
      ${state.timeMode === "diff" ? "Azul=mejora, Rojo=empeora." : "Verde=mejor, Rojo=peor."}
      ${usingGoogleTiles ? "" : " (valores simulados)"}
    </div>
  `;
}

function updateHeatLayer() {
  if (!_map) return;

  // Limpieza overlays
  if (_googleAqTiles) {
    _map.removeLayer(_googleAqTiles);
    _googleAqTiles = null;
  }
  if (_gridLayer) {
    _gridLayer.clearLayers();
  }

  if (!state.showHeat) {
    renderLegend();
    return;
  }

  const key = (window.GOOGLE_AIR_QUALITY_API_KEY || "").trim();

  // 1) Si hay API key, usamos tiles tipo Google (solo "Ahora").
  // Para "Hace 1 año" y "Diferencia" no hay tiles directos: hacemos fallback a grid demo.
  if (key && state.timeMode === "now") {
    const mapType = mapTypeForPollutant(state.pollutant);

    const url = `https://airquality.googleapis.com/v1/mapTypes/${encodeURIComponent(mapType)}/heatmapTiles/{z}/{x}/{y}?key=${encodeURIComponent(key)}`;

    _googleAqTiles = L.tileLayer(url, {
      opacity: window.AIR_QUALITY_TILES_OPACITY ?? 0.65,
      errorTileUrl: "",
    });

    _googleAqTiles.addTo(_map);
    renderLegend();
    return;
  }

  // 2) Fallback: grid demo (cuadrícula coloreada) para hackathon.
  const cells = window.makeDistrictGrid(state.district, state.pollutant);
  for (const cell of cells) {
    const v = valueFromCell(cell);
    const fill = colorForValue(state.pollutant, v);

    const rect = L.rectangle(cell.bounds, {
      stroke: false,
      fillColor: fill,
      fillOpacity: 1,
      interactive: true,
    });

    rect.on("mouseover", (e) => {
      const unit = state.pollutant === "uaqi" ? "" : " µg/m³";
      const label = pollutantLabel(state.pollutant);
      const mode = state.timeMode === "now" ? "Ahora" : state.timeMode === "last" ? "Hace 1 año" : "Δ";
      const txt = `${label} ${mode}: <b>${v}${unit}</b>`;
      rect.bindTooltip(txt, { sticky: true, direction: "top" }).openTooltip(e.latlng);
    });

    rect.addTo(_gridLayer);
  }

  renderLegend();
}

function renderMap() {
  initMapIfNeeded();

  const buildings = getBuildingsForDistrict();
  ensureSelected(buildings);

  // Vista del distrito (fitBounds si hay bounds)
  const view = DISTRICT_VIEWS[state.district] || { lat: 40.4168, lng: -3.7038, zoom: 12 };
  const boundsCfg = window.DISTRICT_BOUNDS?.[state.district];

  if (boundsCfg) {
    const bounds = L.latLngBounds(boundsCfg.sw, boundsCfg.ne);
    _map.fitBounds(bounds, { padding: [20, 20] });

    // Contorno del distrito
    if (_districtLayer) {
      _map.removeLayer(_districtLayer);
      _districtLayer = null;
    }
    _districtLayer = L.rectangle(bounds, {
      color: "rgba(15,23,42,.85)",
      weight: 2,
      fill: false,
    }).addTo(_map);
  } else {
    _map.setView([view.lat, view.lng], view.zoom);
    if (_districtLayer) {
      _map.removeLayer(_districtLayer);
      _districtLayer = null;
    }
  }

  // Evita glitches de tiles cuando cambia layout
  setTimeout(() => _map.invalidateSize(), 0);

  // Badge exterior (ya existía) + badge dentro del mapa
  districtBadge.textContent = `Distrito: ${DISTRICTS.find(d => d.id === state.district)?.name || state.district}`;
  const mapBadge = document.getElementById("mapBadge");
  if (mapBadge) mapBadge.textContent = `Distrito: ${DISTRICTS.find(d => d.id === state.district)?.name || state.district}`;

  // Marcadores
  _markerLayer.clearLayers();

  for (const b of buildings) {
    const isSelected = b.id === state.selectedBuildingId;
    const icon = markerIcon({ selected: isSelected, hasGarden: state.showGardens && b.hasGarden });

    const m = L.marker([b.lat, b.lng], { icon }).addTo(_markerLayer);

    const popupHtml = `
      <div style="font-family: ui-sans-serif, system-ui; min-width: 180px;">
        <div style="font-weight:900; margin-bottom:4px;">${b.name}</div>
        <div style="font-size:12px; color:#64748b;">Distrito: <b>${b.district}</b></div>
        <div style="margin-top:6px; font-size:12px;">
          ${b.hasGarden ? `🌿 Jardín vertical · <b>${b.surfaceM2} m²</b>` : `⚠️ Sin jardín (candidato)`}
        </div>
      </div>
    `;
    m.bindPopup(popupHtml);

    m.on("click", () => {
      state.selectedBuildingId = b.id;
      renderAll();
      // Abrimos popup del seleccionado
      setTimeout(() => m.openPopup(), 0);
    });

    if (isSelected) {
      // Enfocar suave al seleccionado
      _map.panTo([b.lat, b.lng], { animate: true, duration: 0.5 });
      setTimeout(() => m.openPopup(), 0);
    }
  }

  updateHeatLayer();

  renderBuildingCard(buildings);
}

function renderBuildingCard(buildings) {
  const b = buildings.find(x => x.id === state.selectedBuildingId) || buildings[0];
  if (!b) {
    buildingCardEl.innerHTML = "No hay edificios para este filtro.";
    return;
  }

  const tagClass = b.hasGarden ? "good" : "warn";
  const tagText = b.hasGarden ? "Con jardín" : "Candidato";
  const gardenText = b.hasGarden
    ? `Instalado · <b>${b.surfaceM2} m²</b> · riego inteligente (mock)`
    : `No instalado · sugerido por IA`;

  buildingCardEl.innerHTML = `
    <div class="bcTitle">${b.name}</div>
    <div class="bcRow">Distrito: <b>${b.district}</b></div>
    <div class="bcRow"><span class="tag ${tagClass}">${tagText}</span></div>
    <div class="bcRow">Jardín vertical: ${gardenText}</div>
  `;
}

function renderBars(container, rows, maxValue, unit) {
  container.innerHTML = "";
  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "barRow";

    const label = document.createElement("div");
    label.className = "barLabel";
    label.textContent = r.m;

    const track = document.createElement("div");
    track.className = "barTrack";

    const a = document.createElement("div");
    a.className = "barA"; // hace 1 año
    a.style.width = `${(r.last / maxValue) * 100}%`;

    const b = document.createElement("div");
    b.className = "barB"; // ahora
    b.style.width = `${(r.now / maxValue) * 100}%`;

    const txt = document.createElement("div");
    txt.className = "barText";
    txt.textContent = `Ahora ${r.now}${unit} · 1 año ${r.last}${unit}`;

    track.appendChild(a);
    track.appendChild(b);
    track.appendChild(txt);

    row.appendChild(label);
    row.appendChild(track);
    container.appendChild(row);
  }
}

function renderCharts() {
  const seed = _seedFrom(state.district);

  // Series base
  const air = makeSeries(seed, "air");
  const temp = makeSeries(seed + 101, "temp");

  // Aplicar “impacto” simulado solo al valor actual si hay jardines en distrito
  const score = districtScore(state.district, state.impact);
  const effect = 1 - (score.gardens > 0 ? state.impact / 100 : 0);

  const pmRows = air.map(d => ({
    m: d.m,
    last: d.pm_last,
    now: +(d.pm_now * effect).toFixed(1),
  }));

  const no2Rows = air.map(d => ({
    m: d.m,
    last: d.no2_last,
    now: Math.round(d.no2_now * effect),
  }));

  const tempRows = temp.map(d => ({
    m: d.m,
    last: d.last,
    now: +(d.now - (score.gardens > 0 ? 0.4 : 0)).toFixed(1),
  }));

  renderBars(pmBarsEl, pmRows, 45, "");
  renderBars(no2BarsEl, no2Rows, 120, "");
  renderBars(tempBarsEl, tempRows, 35, "");
}

function renderButtons() {
  toggleGardensBtn.textContent = state.showGardens ? "🌱 Jardines: ON" : "🌱 Jardines: OFF";
  toggleGardensBtn.classList.toggle("primary", state.showGardens);

  toggleHeatBtn.textContent = state.showHeat ? "🔥 Capa calor: ON" : "🔥 Capa calor: OFF";
  toggleHeatBtn.classList.toggle("primary", state.showHeat);
}

async function renderAll() {
  impactValue.textContent = `${state.impact}%`;
  renderButtons();
  await renderKPIs();
  renderMap();
  renderLegend();
  renderCharts();
}

// Events
function wireEvents() {
  districtSelect.addEventListener("change", (e) => {
    state.district = e.target.value;
    state.query = "";
    buildingSearch.value = "";
    state.selectedBuildingId = null;
    renderAll();
  });

  buildingSearch.addEventListener("input", (e) => {
    state.query = e.target.value;
    state.selectedBuildingId = null;
    renderAll();
  });

  toggleGardensBtn.addEventListener("click", () => {
    state.showGardens = !state.showGardens;
    renderAll();
  });

  toggleHeatBtn.addEventListener("click", () => {
    state.showHeat = !state.showHeat;
    renderAll();
  });

  impactSlider.addEventListener("input", (e) => {
    state.impact = Number(e.target.value);
    renderAll();
  });

  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
  });

  // Segmented: pollutant selector
  document.querySelectorAll("#pollutantSeg .segBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#pollutantSeg .segBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.pollutant = btn.dataset.pollutant;
      renderAll();
    });
  });

  // Segmented: time mode selector
  document.querySelectorAll("#timeSeg .segBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#timeSeg .segBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.timeMode = btn.dataset.time;
      renderAll();
    });
  });
}

// Init
renderDistrictSelect();
wireEvents();
setTab("air");
renderAll();
