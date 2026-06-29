/* ============================================================
   TRP Meteorología — Sección Pronóstico
   App principal: mapa, dibujo de outlooks (restringido a AR/PY),
   personalización y leyenda.
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------- Constantes ----------------------- */
  var LS = { config: 'trp_config_v2', geo: 'trp_geo_50m_v1', outlook: 'trp_outlook_v1', prov: 'trp_prov_v1', adm: 'trp_adm_v1', texts: 'trp_texts_v1' };

  // Niveles SPC en orden ascendente de severidad.
  var LEVELS = [
    { id: 'TSTM', name: 'Tormentas generales', n: 0 },
    { id: 'MRGL', name: 'Marginal (1)', n: 1 },
    { id: 'SLGT', name: 'Leve · Slight (2)', n: 2 },
    { id: 'ENH',  name: 'Realzado · Enh (3)', n: 3 },
    { id: 'MDT',  name: 'Moderado (4)', n: 4 },
    { id: 'HIGH', name: 'Alto · High (5)', n: 5 }
  ];
  var LEVEL_BY_ID = {};
  LEVELS.forEach(function (l) { LEVEL_BY_ID[l.id] = l; });

  // Presets de colores (relleno) según la SPC.
  var PRESET_VIVID = { TSTM: '#bfe8bf', MRGL: '#7dc87d', SLGT: '#ffeb6b', ENH: '#ffa64d', MDT: '#fe6a6a', HIGH: '#ff39ff' };
  var PRESET_OFFICIAL = { TSTM: '#c1e9c1', MRGL: '#80c580', SLGT: '#f7f780', ENH: '#e6c280', MDT: '#e68080', HIGH: '#ff80ff' };
  var STROKES = { TSTM: '#646464', MRGL: '#3c783c', SLGT: '#d5b000', ENH: '#e07000', MDT: '#cd0000', HIGH: '#cc00cc' };

  var THEMES = {
    classic:   { water: '#9ec9ea', land: '#e9e4d6', neighbor: '#d7dbe0', borderColor: '#6b7480', provinceColor: '#9aa3b2', cityDotColor: '#243042', cityLabelColor: '#16202e', graticuleColor: '#b9c4d4' },
    dark:      { water: '#0d1b2a', land: '#27313f', neighbor: '#1a2330', borderColor: '#42536c', provinceColor: '#44516a', cityDotColor: '#cfe0f6', cityLabelColor: '#dbe7f7', graticuleColor: '#2c3e5e' },
    blueprint: { water: '#08263d', land: '#0e3a5c', neighbor: '#0b2e49', borderColor: '#6fb7ff', provinceColor: '#4f93cf', cityDotColor: '#d7ecff', cityLabelColor: '#eaf4ff', graticuleColor: '#1f5b8a' }
  };

  var TILE = {
    osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap', max: 19 },
    topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenTopoMap (CC-BY-SA)', max: 17 },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri World Imagery', max: 19 },
    dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CARTO © OpenStreetMap', max: 20, sub: 'abcd' },
    light: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© CARTO © OpenStreetMap', max: 20, sub: 'abcd' }
  };

  var GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
  var AMERICAS_BBOX = [-95, -60, -25, 18]; // minLon, minLat, maxLon, maxLat

  /* ----------------------- Configuración ----------------------- */
  function defaultConfig() {
    return {
      basemap: 'vector',
      water: '#9ec9ea', land: '#e9e4d6', neighbor: '#d7dbe0',
      borderColor: '#5b6675', borderWidth: 1,
      showProvinces: false, provinceColor: '#8a93a3', provinceWidth: 0.6,
      showMunicipios: false, municipioColor: '#9aa3b2', municipioWidth: 0.4,
      showCities: true, cityRank: 2, showCityLabels: true,
      cityDotColor: '#243042', cityLabelColor: '#16202e', cityLabelSize: 12,
      showCountryLabels: true,
      showGraticule: false, graticuleColor: '#9fb0c8', graticuleStep: 5,
      fillOpacity: 0.55, outlookStroke: 2,
      fills: Object.assign({}, PRESET_VIVID),
      strokes: Object.assign({}, STROKES),
      showLegend: true, legendPos: 'bottomleft', legendOnlyUsed: false,
      legendTitle: 'Riesgo de tiempo severo',
      showOutlookHeader: false,
      outlookTitle: 'Pronóstico de Tiempo Severo — Argentina & Paraguay',
      outlookValid: '',
      text: { fill: '#111111', stroke: '#ffffff', strokeWidth: 2, font: 'sans-serif', size: 16, bold: true }
    };
  }

  var cfg = loadConfig();

  function loadConfig() {
    try {
      var raw = localStorage.getItem(LS.config);
      if (!raw) return defaultConfig();
      var saved = JSON.parse(raw);
      var d = defaultConfig();
      var merged = Object.assign(d, saved);
      merged.fills = Object.assign({}, PRESET_VIVID, saved.fills || {});
      merged.strokes = Object.assign({}, STROKES, saved.strokes || {});
      merged.text = Object.assign({}, d.text, saved.text || {});
      return merged;
    } catch (e) { return defaultConfig(); }
  }
  function saveConfig() { try { localStorage.setItem(LS.config, JSON.stringify(cfg)); } catch (e) {} }

  /* ----------------------- Estado ----------------------- */
  var map, panes = {};
  var tileLayer = null;
  var layers = { neighbors: null, countries: null, provinces: null, municipios: null, graticule: null, outlooks: null, cities: null, countryLabels: null, texts: null };
  var geo = { ar: null, py: null, neighbors: [], fallback: false };
  var provinceGeoJSON = null;
  var adminData = { adm1: null, adm2: null };  // geoBoundaries (municipios/provincias)
  var admLoading = false;
  var outlooks = [];            // { id, level, geometry }
  var texts = [];               // { id, lat, lng, text, style }
  var selectedId = null;
  var selectedTextId = null;
  var currentLevel = 'SLGT';
  var legendControl = null;
  var textMode = false;

  // dibujo
  var drawing = false;
  var drawPts = [];             // array de L.LatLng
  var drawVertexLayer = null;   // featureGroup de vértices
  var drawPreview = null;       // L.polygon preview
  var drawRubber = null;        // L.polyline al cursor
  var clickTimer = null;

  /* ----------------------- Utilidades ----------------------- */
  function $(id) { return document.getElementById(id); }
  function toast(msg, kind) {
    var t = $('toast'); t.textContent = msg; t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false; clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function setStatus(text, cls) {
    var b = $('dataStatus'); b.textContent = text; b.className = 'badge ' + (cls || 'badge-muted');
  }
  function featureBBox(f) {
    var min = [Infinity, Infinity], max = [-Infinity, -Infinity];
    eachCoord(f.geometry, function (c) {
      if (c[0] < min[0]) min[0] = c[0]; if (c[1] < min[1]) min[1] = c[1];
      if (c[0] > max[0]) max[0] = c[0]; if (c[1] > max[1]) max[1] = c[1];
    });
    return [min[0], min[1], max[0], max[1]];
  }
  function eachCoord(geom, fn) {
    if (!geom) return;
    var c = geom.coordinates;
    if (geom.type === 'Polygon') c.forEach(function (r) { r.forEach(fn); });
    else if (geom.type === 'MultiPolygon') c.forEach(function (p) { p.forEach(function (r) { r.forEach(fn); }); });
  }
  function bboxOverlap(a, b) {
    return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  }
  function approxCentroid(f) {
    var sx = 0, sy = 0, n = 0;
    eachCoord(f.geometry, function (c) { sx += c[0]; sy += c[1]; n++; });
    return n ? [sx / n, sy / n] : [0, 0];
  }

  /* ----------------------- Init mapa ----------------------- */
  function initMap() {
    map = L.map('map', {
      center: [-32, -60], zoom: 4, minZoom: 2, maxZoom: 19,
      zoomControl: true, doubleClickZoom: true, worldCopyJump: true,
      attributionControl: true
    });
    map.attributionControl.setPrefix('TRP Meteorología');

    [['neighbors', 250], ['countries', 300], ['municipios', 340], ['provinces', 350],
     ['graticule', 360], ['outlooks', 420], ['countryLabels', 630], ['texts', 650]].forEach(function (p) {
      var pane = map.createPane(p[0]); pane.style.zIndex = p[1];
      panes[p[0]] = pane;
      if (p[0] === 'countryLabels') pane.style.pointerEvents = 'none';
    });

    layers.outlooks = L.featureGroup([], { pane: 'outlooks' }).addTo(map);
    layers.texts = L.featureGroup([], { pane: 'texts' }).addTo(map);

    map.on('mousemove', function (e) {
      $('coordReadout').textContent = 'lat ' + e.latlng.lat.toFixed(2) + ', lon ' + e.latlng.lng.toFixed(2);
      if (drawing) updateRubber(e.latlng);
    });
    map.on('click', onMapClick);
    map.on('dblclick', function () { if (drawing) { clearTimeout(clickTimer); finishDrawing(); } });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (drawing) cancelDrawing(); else if (textMode) stopTextMode(); }
      else if (e.key === 'Enter' && drawing) finishDrawing();
    });
  }

  /* ----------------------- Mapa base ----------------------- */
  function setBasemap(mode) {
    cfg.basemap = mode; saveConfig();
    if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
    var vectorMode = (mode === 'vector' || mode === 'vectordetail');

    if (vectorMode) {
      applyWaterColor();
      renderVectorBasemap();
      renderCountryLabels();
      if (mode === 'vectordetail') loadAdminDetail();
    } else {
      // ocultar capas vectoriales de fondo
      if (layers.neighbors) { map.removeLayer(layers.neighbors); layers.neighbors = null; }
      if (layers.countries) { map.removeLayer(layers.countries); layers.countries = null; }
      if (layers.countryLabels) { map.removeLayer(layers.countryLabels); layers.countryLabels = null; }
      var t = TILE[mode];
      if (t) {
        tileLayer = L.tileLayer(t.url, {
          maxZoom: t.max, attribution: t.attr,
          subdomains: t.sub || 'abc'
        }).addTo(map);
        tileLayer.bringToBack();
      }
    }
    // overlays funcionan en cualquier base
    renderProvinces(); renderMunicipios(); renderGraticule(); renderCities(); restyleOutlooks(); renderTexts();
  }

  function applyWaterColor() {
    var el = map.getContainer();
    var vec = (cfg.basemap === 'vector' || cfg.basemap === 'vectordetail');
    el.style.background = vec ? cfg.water : '#000';
  }

  function renderVectorBasemap() {
    if (cfg.basemap !== 'vector' && cfg.basemap !== 'vectordetail') return;
    if (layers.neighbors) { map.removeLayer(layers.neighbors); layers.neighbors = null; }
    if (layers.countries) { map.removeLayer(layers.countries); layers.countries = null; }

    if (geo.neighbors && geo.neighbors.length) {
      layers.neighbors = L.geoJSON({ type: 'FeatureCollection', features: geo.neighbors }, {
        pane: 'neighbors',
        style: { color: cfg.borderColor, weight: cfg.borderWidth * 0.7, fillColor: cfg.neighbor, fillOpacity: 1 }
      }).addTo(map);
    }
    var tgt = [];
    if (geo.ar) tgt.push(geo.ar);
    if (geo.py) tgt.push(geo.py);
    if (tgt.length) {
      layers.countries = L.geoJSON({ type: 'FeatureCollection', features: tgt }, {
        pane: 'countries',
        style: { color: cfg.borderColor, weight: cfg.borderWidth, fillColor: cfg.land, fillOpacity: 1 }
      }).addTo(map);
    }
  }

  function renderCountryLabels() {
    if (layers.countryLabels) { map.removeLayer(layers.countryLabels); layers.countryLabels = null; }
    if ((cfg.basemap !== 'vector' && cfg.basemap !== 'vectordetail') || !cfg.showCountryLabels) return;
    var g = L.layerGroup([], { pane: 'countryLabels' });
    [['Argentina', geo.ar], ['Paraguay', geo.py]].forEach(function (pair) {
      if (!pair[1]) return;
      var c = approxCentroid(pair[1]);
      var m = L.marker([c[1], c[0]], { pane: 'countryLabels', interactive: false, opacity: 0 });
      m.bindTooltip(pair[0], { permanent: true, direction: 'center', className: 'country-label', pane: 'countryLabels' });
      g.addLayer(m);
    });
    g.addTo(map); layers.countryLabels = g;
  }

  /* ----------------------- Provincias y municipios ----------------------- */
  function renderProvinces() {
    if (layers.provinces) { map.removeLayer(layers.provinces); layers.provinces = null; }
    if (!cfg.showProvinces) return;
    var data = adminData.adm1 || provinceGeoJSON;
    if (!data) return;
    layers.provinces = L.geoJSON(data, {
      pane: 'provinces',
      style: { color: cfg.provinceColor, weight: cfg.provinceWidth, fill: false, dashArray: '3,3' }
    }).addTo(map);
  }

  function renderMunicipios() {
    if (layers.municipios) { map.removeLayer(layers.municipios); layers.municipios = null; }
    if (!cfg.showMunicipios || !adminData.adm2) return;
    layers.municipios = L.geoJSON(adminData.adm2, {
      pane: 'municipios',
      style: { color: cfg.municipioColor, weight: cfg.municipioWidth, fill: false }
    }).addTo(map);
  }

  // Descarga ADM1 (provincias/departamentos) y ADM2 (municipios/distritos)
  // de Argentina y Paraguay desde geoBoundaries (gbOpen, CC BY 4.0).
  function loadAdminDetail(force) {
    if (admLoading) return;
    if (adminData.adm1 && adminData.adm2 && !force) { renderProvinces(); renderMunicipios(); return; }

    // caché local
    if (!force) {
      try {
        var c = localStorage.getItem(LS.adm);
        if (c) {
          var o = JSON.parse(c);
          if (o && o.adm1 && o.adm2) {
            adminData.adm1 = o.adm1; adminData.adm2 = o.adm2;
            setStatus('Municipios en caché', 'badge-ok');
            afterAdmin(); return;
          }
        }
      } catch (e) {}
    }

    admLoading = true;
    setStatus('Descargando municipios…', 'badge-muted');
    toast('Descargando provincias y municipios de AR/PY (geoBoundaries). Puede tardar unos segundos…');
    Promise.all([
      fetchAdmin('ARG', 'ADM1'), fetchAdmin('PRY', 'ADM1'),
      fetchAdmin('ARG', 'ADM2'), fetchAdmin('PRY', 'ADM2')
    ]).then(function (res) {
      adminData.adm1 = mergeFC([res[0], res[1]]);
      adminData.adm2 = mergeFC([res[2], res[3]]);
      try { localStorage.setItem(LS.adm, JSON.stringify({ adm1: adminData.adm1, adm2: adminData.adm2 })); } catch (e) { /* cuota */ }
      try { map.attributionControl.addAttribution('Límites admin.: geoBoundaries (CC BY 4.0)'); } catch (e) {}
      setStatus('Municipios cargados (geoBoundaries)', 'badge-ok');
      admLoading = false; afterAdmin();
      toast('Provincias y municipios cargados.', 'ok');
    }).catch(function (err) {
      admLoading = false;
      console.warn('geoBoundaries:', err);
      setStatus('Sin municipios (error de descarga)', 'badge-err');
      toast('No se pudieron descargar los municipios (sin conexión o fuente no disponible).', 'err');
    });

    function afterAdmin() {
      if (!cfg.showProvinces) { cfg.showProvinces = true; setCheck('showProvinces', true); }
      if (!cfg.showMunicipios) { cfg.showMunicipios = true; setCheck('showMunicipios', true); }
      saveConfig(); renderProvinces(); renderMunicipios();
    }
  }

  function fetchAdmin(iso, level) {
    var api = 'https://www.geoboundaries.org/api/current/gbOpen/' + iso + '/' + level + '/';
    return fetch(api).then(function (r) {
      if (!r.ok) throw new Error('API ' + iso + ' ' + level + ': ' + r.status);
      return r.json();
    }).then(function (meta) {
      if (Array.isArray(meta)) meta = meta[0];
      var url = meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL;
      if (!url) throw new Error('Sin URL de descarga para ' + iso + ' ' + level);
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('GeoJSON ' + iso + ' ' + level + ': ' + r.status);
        return r.json();
      });
    });
  }
  function mergeFC(list) {
    var feats = [];
    list.forEach(function (fc) { if (fc && fc.features) feats = feats.concat(fc.features); });
    return { type: 'FeatureCollection', features: feats };
  }

  /* ----------------------- Ciudades ----------------------- */
  function renderCities() {
    if (layers.cities) { map.removeLayer(layers.cities); layers.cities = null; }
    if (!cfg.showCities) return;
    var g = L.layerGroup();
    (window.CityData ? CityData.CITIES : []).forEach(function (c) {
      if (c.rank > cfg.cityRank) return;
      var r = c.rank === 1 ? 4.5 : (c.rank === 2 ? 3.2 : 2.4);
      var mk = L.circleMarker([c.lat, c.lon], {
        radius: r, color: '#ffffff', weight: 1, fillColor: cfg.cityDotColor, fillOpacity: 1
      });
      if (cfg.showCityLabels) {
        mk.bindTooltip(
          '<span style="color:' + cfg.cityLabelColor + ';font-size:' + cfg.cityLabelSize + 'px">' + c.name + '</span>',
          { permanent: true, direction: 'right', offset: [4, 0], className: 'city-label' }
        );
      }
      g.addLayer(mk);
    });
    g.addTo(map); layers.cities = g;
  }

  /* ----------------------- Cuadrícula ----------------------- */
  function renderGraticule() {
    if (layers.graticule) { map.removeLayer(layers.graticule); layers.graticule = null; }
    if (!cfg.showGraticule) return;
    var step = parseFloat(cfg.graticuleStep);
    var lines = [];
    var lon0 = -90, lon1 = -30, lat0 = -60, lat1 = -15;
    for (var lon = lon0; lon <= lon1; lon += step)
      lines.push(L.polyline([[lat0, lon], [lat1, lon]], { color: cfg.graticuleColor, weight: 0.5, opacity: 0.7, pane: 'graticule', interactive: false }));
    for (var lat = lat0; lat <= lat1; lat += step)
      lines.push(L.polyline([[lat, lon0], [lat, lon1]], { color: cfg.graticuleColor, weight: 0.5, opacity: 0.7, pane: 'graticule', interactive: false }));
    layers.graticule = L.layerGroup(lines).addTo(map);
  }

  /* ----------------------- Dibujo de outlooks ----------------------- */
  function startDrawing() {
    if (drawing) return;
    if (textMode) stopTextMode();
    drawing = true;
    drawPts = [];
    map.doubleClickZoom.disable();
    L.DomUtil.addClass(map.getContainer(), 'leaflet-crosshair');
    drawVertexLayer = L.featureGroup().addTo(map);
    $('drawBtn').classList.add('active'); $('drawBtn').textContent = '■ Dibujando…';
    $('finishBtn').disabled = false; $('undoPointBtn').disabled = false;
    $('drawState').textContent = 'Dibujando ' + currentLevel + ' — clic para agregar puntos, doble clic para cerrar';
    clearSelection();
  }
  function cancelDrawing() {
    stopDrawingUI();
    if (drawVertexLayer) { map.removeLayer(drawVertexLayer); drawVertexLayer = null; }
    if (drawPreview) { map.removeLayer(drawPreview); drawPreview = null; }
    if (drawRubber) { map.removeLayer(drawRubber); drawRubber = null; }
    drawPts = [];
  }
  function stopDrawingUI() {
    drawing = false;
    map.doubleClickZoom.enable();
    L.DomUtil.removeClass(map.getContainer(), 'leaflet-crosshair');
    $('drawBtn').classList.remove('active'); $('drawBtn').textContent = '✏️ Dibujar área';
    $('finishBtn').disabled = true; $('undoPointBtn').disabled = true;
    $('drawState').textContent = '';
  }
  function onMapClick(e) {
    if (textMode) { placeTextAt(e.latlng); return; }
    if (!drawing) {
      if (selectedId) clearSelection();
      if (selectedTextId) clearTextSelection();
      return;
    }
    clearTimeout(clickTimer);
    var ll = e.latlng;
    clickTimer = setTimeout(function () { addVertex(ll); }, 220);
  }
  function addVertex(ll) {
    // cerrar si se clickea cerca del primer vértice
    if (drawPts.length >= 3) {
      var p0 = map.latLngToContainerPoint(drawPts[0]);
      var pc = map.latLngToContainerPoint(ll);
      if (p0.distanceTo(pc) < 12) { finishDrawing(); return; }
    }
    drawPts.push(ll);
    L.circleMarker(ll, { radius: 4, color: '#fff', weight: 1.5, fillColor: cfg.fills[currentLevel] || '#fff', fillOpacity: 1, pane: 'outlooks' }).addTo(drawVertexLayer);
    refreshPreview();
  }
  function refreshPreview() {
    if (drawPreview) { map.removeLayer(drawPreview); drawPreview = null; }
    if (drawPts.length >= 2) {
      drawPreview = L.polygon(drawPts, {
        color: cfg.strokes[currentLevel] || '#333', weight: cfg.outlookStroke,
        fillColor: cfg.fills[currentLevel], fillOpacity: cfg.fillOpacity * 0.6,
        dashArray: '5,5', pane: 'outlooks'
      }).addTo(map);
    }
  }
  function updateRubber(ll) {
    if (!drawPts.length) return;
    var pts = [drawPts[drawPts.length - 1], ll];
    if (drawRubber) drawRubber.setLatLngs(pts);
    else drawRubber = L.polyline(pts, { color: cfg.strokes[currentLevel] || '#333', weight: 1, dashArray: '4,4', pane: 'outlooks', interactive: false }).addTo(map);
  }
  function finishDrawing() {
    if (!drawing) return;
    if (drawPts.length < 3) { toast('Se necesitan al menos 3 puntos.', 'err'); return; }
    var clipped = clipToRegion(drawPts);
    cancelDrawing();
    stopDrawingUI();
    if (!clipped) { toast('El área está completamente fuera de Argentina/Paraguay. Descartada.', 'err'); return; }
    var id = 'o' + Date.now() + Math.floor(Math.random() * 1000);
    outlooks.push({ id: id, level: currentLevel, geometry: clipped.geometry });
    persistOutlooks(); renderOutlooks(); updateLegend();
    toast('Área ' + currentLevel + ' agregada (recortada a AR/PY).', 'ok');
  }

  // Recorta el polígono dibujado a la unión AR ∪ PY usando turf.
  function clipToRegion(latlngs) {
    var coords = latlngs.map(function (p) { return [p.lng, p.lat]; });
    coords.push(coords[0].slice());
    if (!window.turf) {
      // Fallback sin turf: aceptar solo si todos los vértices están dentro.
      var allIn = latlngs.every(function (p) { return pointInRegionRaw(p.lng, p.lat); });
      if (!allIn) { toast('Sin librería de geometría: parte del área cae fuera. Cargá con conexión.', 'err'); return null; }
      return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
    }
    var subject;
    try { subject = turf.polygon([coords]); }
    catch (e) { toast('Polígono inválido.', 'err'); return null; }

    var pieces = [];
    [geo.ar, geo.py].forEach(function (country) {
      countryPolygons(country).forEach(function (polyCoords) {
        var cp;
        try { cp = turf.polygon(polyCoords); } catch (e) { return; }
        try {
          var inter = turf.intersect(subject, cp);
          if (inter) pushPolys(pieces, inter.geometry);
        } catch (e) { /* ignorar piezas problemáticas */ }
      });
    });
    if (!pieces.length) return null;
    var geomOut = pieces.length === 1
      ? { type: 'Polygon', coordinates: pieces[0] }
      : { type: 'MultiPolygon', coordinates: pieces };
    return { type: 'Feature', properties: {}, geometry: geomOut };
  }
  function pushPolys(arr, geom) {
    if (geom.type === 'Polygon') arr.push(geom.coordinates);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(function (p) { arr.push(p); });
  }
  // Devuelve la lista de polígonos (coordenadas) de un Feature Polygon/MultiPolygon.
  function countryPolygons(f) {
    var out = [];
    if (!f || !f.geometry) return out;
    var g = f.geometry;
    if (g.type === 'Polygon') out.push(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(function (p) { out.push(p); });
    return out;
  }

  // Ray-casting simple para el fallback sin turf.
  function pointInRing(lon, lat, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      var hit = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }
  function pointInFeature(lon, lat, f) {
    if (!f) return false;
    var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (var p = 0; p < polys.length; p++) {
      var rings = polys[p];
      if (pointInRing(lon, lat, rings[0])) {
        var inHole = false;
        for (var h = 1; h < rings.length; h++) if (pointInRing(lon, lat, rings[h])) { inHole = true; break; }
        if (!inHole) return true;
      }
    }
    return false;
  }
  function pointInRegionRaw(lon, lat) {
    return pointInFeature(lon, lat, geo.ar) || pointInFeature(lon, lat, geo.py);
  }

  /* ----------------------- Render de outlooks ----------------------- */
  function renderOutlooks() {
    layers.outlooks.clearLayers();
    var sorted = outlooks.slice().sort(function (a, b) {
      return (LEVEL_BY_ID[a.level].n) - (LEVEL_BY_ID[b.level].n);
    });
    sorted.forEach(function (o) {
      var lyr = L.geoJSON({ type: 'Feature', geometry: o.geometry, properties: {} }, {
        pane: 'outlooks', style: styleFor(o)
      });
      lyr.eachLayer(function (l) {
        l._oid = o.id;
        l.on('click', function (ev) { if (!drawing) { L.DomEvent.stop(ev); selectOutlook(o.id); } });
      });
      layers.outlooks.addLayer(lyr);
    });
    refreshSelectionStyle();
  }
  function styleFor(o) {
    var sel = (o.id === selectedId);
    return {
      color: cfg.strokes[o.level] || '#333',
      weight: sel ? cfg.outlookStroke + 2 : cfg.outlookStroke,
      fillColor: cfg.fills[o.level] || '#999',
      fillOpacity: cfg.fillOpacity,
      dashArray: sel ? '6,4' : null
    };
  }
  function restyleOutlooks() {
    layers.outlooks.eachLayer(function (gj) {
      gj.eachLayer(function (l) {
        var o = findOutlook(l._oid); if (o) l.setStyle(styleFor(o));
      });
    });
  }
  function refreshSelectionStyle() { restyleOutlooks(); }
  function findOutlook(id) { for (var i = 0; i < outlooks.length; i++) if (outlooks[i].id === id) return outlooks[i]; return null; }

  function selectOutlook(id) {
    selectedId = id; selectedTextId = null;
    $('deleteTextBtn').disabled = true; renderTexts();
    refreshSelectionStyle();
    var o = findOutlook(id);
    $('selectedBox').hidden = !o;
    $('deleteSelBtn').disabled = !o;
    if (o) $('selectedLevel').value = o.level;
  }
  function clearSelection() {
    selectedId = null; $('selectedBox').hidden = true; $('deleteSelBtn').disabled = true; refreshSelectionStyle();
  }
  function deleteSelected() {
    if (!selectedId) return;
    outlooks = outlooks.filter(function (o) { return o.id !== selectedId; });
    clearSelection(); persistOutlooks(); renderOutlooks(); updateLegend();
  }
  function undoLastPolygon() {
    if (drawing) { cancelDrawing(); stopDrawingUI(); return; }
    if (!outlooks.length) return;
    outlooks.pop(); persistOutlooks(); renderOutlooks(); updateLegend();
  }
  function clearAll() {
    if (!outlooks.length) return;
    if (!confirm('¿Borrar todas las áreas dibujadas?')) return;
    outlooks = []; clearSelection(); persistOutlooks(); renderOutlooks(); updateLegend();
  }
  function persistOutlooks() { try { localStorage.setItem(LS.outlook, JSON.stringify(outlooks)); } catch (e) {} }
  function loadOutlooks() {
    try { var r = localStorage.getItem(LS.outlook); if (r) outlooks = JSON.parse(r) || []; } catch (e) { outlooks = []; }
  }

  /* ----------------------- Leyenda ----------------------- */
  function updateLegend() {
    if (legendControl) { map.removeControl(legendControl); legendControl = null; }
    if (!cfg.showLegend) return;
    var used = {};
    outlooks.forEach(function (o) { used[o.level] = true; });
    legendControl = L.control({ position: cfg.legendPos });
    legendControl.onAdd = function () {
      var div = L.DomUtil.create('div', 'spc-legend');
      var html = '<div class="legend-title">' + escapeHtml(cfg.legendTitle) + '</div>';
      LEVELS.forEach(function (l) {
        if (cfg.legendOnlyUsed && !used[l.id]) return;
        html += '<div class="legend-row">' +
          '<span class="legend-sq" style="background:' + cfg.fills[l.id] + ';border-color:' + cfg.strokes[l.id] + '"></span>' +
          '<span class="legend-lv">' + l.id + '</span>' +
          '<span class="legend-name">' + l.name + '</span></div>';
      });
      div.innerHTML = html;
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    legendControl.addTo(map);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ----------------------- Encabezado del outlook ----------------------- */
  function updateOutlookHeader() {
    var ov = $('outlookHeaderOverlay');
    if (!cfg.showOutlookHeader) { ov.hidden = true; return; }
    ov.hidden = false;
    $('ohTitle').textContent = cfg.outlookTitle || '';
    $('ohValid').textContent = cfg.outlookValid || '';
  }

  /* ----------------------- Texto / etiquetas ----------------------- */
  function textStyleCss(st) {
    var halo = (st.strokeWidth > 0)
      ? ('-webkit-text-stroke:' + st.strokeWidth + 'px ' + st.stroke + ';paint-order:stroke fill;')
      : '';
    return 'color:' + st.fill + ';font-family:' + st.font + ';font-size:' + st.size + 'px;' +
      (st.bold ? 'font-weight:700;' : 'font-weight:400;') + halo;
  }
  function findText(id) { for (var i = 0; i < texts.length; i++) if (texts[i].id === id) return texts[i]; return null; }
  function persistTexts() { try { localStorage.setItem(LS.texts, JSON.stringify(texts)); } catch (e) {} }
  function loadTexts() { try { var r = localStorage.getItem(LS.texts); if (r) texts = JSON.parse(r) || []; } catch (e) { texts = []; } }

  function renderTexts() {
    if (!layers.texts) return;
    layers.texts.clearLayers();
    texts.forEach(function (it) {
      var sel = (it.id === selectedTextId);
      var icon = L.divIcon({
        className: 'text-anno' + (sel ? ' selected' : ''),
        html: '<span style="' + textStyleCss(it.style) + '">' + escapeHtml(it.text) + '</span>',
        iconSize: null
      });
      var m = L.marker([it.lat, it.lng], { icon: icon, draggable: true, pane: 'texts' });
      m._tid = it.id;
      m.on('click', function (ev) { L.DomEvent.stopPropagation(ev); selectText(it.id); });
      m.on('dblclick', function (ev) { L.DomEvent.stop(ev); editText(it.id); });
      m.on('dragend', function () { var ll = m.getLatLng(); it.lat = ll.lat; it.lng = ll.lng; persistTexts(); });
      layers.texts.addLayer(m);
    });
  }
  function startTextMode() {
    if (drawing) { cancelDrawing(); stopDrawingUI(); }
    textMode = true;
    L.DomUtil.addClass(map.getContainer(), 'leaflet-crosshair');
    $('textBtn').classList.add('active'); $('textBtn').textContent = '■ Colocando texto…';
    $('drawState').textContent = 'Modo texto — hacé clic en el mapa para escribir (Esc para salir)';
  }
  function stopTextMode() {
    textMode = false;
    if (!drawing) L.DomUtil.removeClass(map.getContainer(), 'leaflet-crosshair');
    $('textBtn').classList.remove('active'); $('textBtn').textContent = '🔤 Agregar texto';
    $('drawState').textContent = '';
  }
  function placeTextAt(ll) {
    var t = prompt('Texto de la etiqueta:', '');
    if (t === null) return;
    t = t.trim(); if (!t) return;
    var item = { id: 't' + Date.now() + Math.floor(Math.random() * 1000), lat: ll.lat, lng: ll.lng, text: t, style: Object.assign({}, cfg.text) };
    texts.push(item); persistTexts(); selectText(item.id); renderTexts();
  }
  function editText(id) {
    var it = findText(id); if (!it) return;
    var t = prompt('Editar texto:', it.text);
    if (t === null) return; t = t.trim(); if (!t) return;
    it.text = t; persistTexts(); renderTexts();
  }
  function selectText(id) {
    selectedTextId = id; selectedId = null;
    var it = findText(id);
    $('deleteTextBtn').disabled = !it;
    if (it) {
      // refleja el estilo del texto seleccionado en los controles
      cfg.text = Object.assign({}, it.style); saveConfig(); syncTextInputs();
    }
    refreshSelectionStyle(); renderTexts();
  }
  function clearTextSelection() { selectedTextId = null; $('deleteTextBtn').disabled = true; renderTexts(); }
  function deleteSelectedText() {
    if (!selectedTextId) return;
    texts = texts.filter(function (t) { return t.id !== selectedTextId; });
    selectedTextId = null; $('deleteTextBtn').disabled = true; persistTexts(); renderTexts();
  }
  function clearAllTexts() {
    if (!texts.length) return;
    if (!confirm('¿Borrar todos los textos?')) return;
    texts = []; selectedTextId = null; $('deleteTextBtn').disabled = true; persistTexts(); renderTexts();
  }
  function syncTextInputs() {
    setVal('textFill', cfg.text.fill); setVal('textStroke', cfg.text.stroke);
    setRange('textStrokeWidth', cfg.text.strokeWidth, 'textStrokeWidthVal');
    setVal('textFont', cfg.text.font); setRange('textSize', cfg.text.size, 'textSizeVal');
    setCheck('textBold', cfg.text.bold);
  }

  /* ----------------------- Carga de datos geográficos ----------------------- */
  function processCountries(fc) {
    var ar = null, py = null, neighbors = [];
    fc.features.forEach(function (f) {
      var nid = parseInt(f.id, 10);
      if (nid === 32) ar = f;
      else if (nid === 600) py = f;
      else {
        var bb = featureBBox(f);
        if (bboxOverlap(bb, AMERICAS_BBOX)) neighbors.push(f);
      }
    });
    return { ar: ar, py: py, neighbors: neighbors };
  }

  function useFallback() {
    var fb = window.FallbackGeo.featureCollection;
    var p = processCountries(fb);
    geo.ar = p.ar; geo.py = p.py; geo.neighbors = []; geo.fallback = true;
    setStatus('Datos aproximados (offline)', 'badge-warn');
  }

  function loadGeo() {
    // 0) datos pre-incrustados por build_standalone.py --offline
    if (window.__TRP_GEO__) {
      try {
        var fcEmb = TopoMini.feature(window.__TRP_GEO__, 'countries');
        var pe = processCountries(fcEmb);
        if (pe.ar && pe.py) {
          geo.ar = pe.ar; geo.py = pe.py; geo.neighbors = pe.neighbors; geo.fallback = false;
          setStatus('Natural Earth 50m (incrustado)', 'badge-ok');
          return Promise.resolve();
        }
      } catch (e) { /* sigue con caché/descarga */ }
    }
    // 1) caché
    try {
      var cached = localStorage.getItem(LS.geo);
      if (cached) {
        var obj = JSON.parse(cached);
        if (obj && obj.ar && obj.py) {
          geo.ar = obj.ar; geo.py = obj.py; geo.neighbors = obj.neighbors || [];
          setStatus('Datos en caché (Natural Earth)', 'badge-ok');
          return Promise.resolve();
        }
      }
    } catch (e) {}

    // 2) descargar
    setStatus('Descargando límites…', 'badge-muted');
    return fetch(GEO_URL).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (topo) {
      var fc = TopoMini.feature(topo, 'countries');
      var p = processCountries(fc);
      if (!p.ar || !p.py) throw new Error('No se hallaron AR/PY');
      geo.ar = p.ar; geo.py = p.py; geo.neighbors = p.neighbors; geo.fallback = false;
      try { localStorage.setItem(LS.geo, JSON.stringify({ ar: p.ar, py: p.py, neighbors: p.neighbors })); } catch (e) {}
      setStatus('Natural Earth 50m', 'badge-ok');
    }).catch(function (err) {
      console.warn('Fallo descarga de datos:', err);
      useFallback();
    });
  }

  /* ----------------------- UI: construir controles ----------------------- */
  function buildLevelButtons() {
    var wrap = $('levelButtons'); wrap.innerHTML = '';
    LEVELS.forEach(function (l) {
      var b = document.createElement('button');
      b.className = 'level-btn' + (l.id === currentLevel ? ' active' : '');
      b.style.background = cfg.fills[l.id];
      b.dataset.level = l.id;
      b.innerHTML = '<span>' + l.id + '</span>';
      b.title = l.name;
      b.addEventListener('click', function () {
        currentLevel = l.id;
        Array.prototype.forEach.call(wrap.children, function (c) { c.classList.remove('active'); });
        b.classList.add('active');
        if (drawing) { $('drawState').textContent = 'Dibujando ' + currentLevel; refreshPreview(); }
      });
      wrap.appendChild(b);
    });
  }
  function refreshLevelButtonColors() {
    Array.prototype.forEach.call($('levelButtons').children, function (c) {
      c.style.background = cfg.fills[c.dataset.level];
    });
  }

  function buildLevelColorControls() {
    var wrap = $('levelColorControls'); wrap.innerHTML = '';
    LEVELS.forEach(function (l) {
      var row = document.createElement('div'); row.className = 'level-color-row';
      row.innerHTML =
        '<span class="lcr-tag" style="background:' + cfg.fills[l.id] + '">' + l.id + '</span>' +
        '<span class="lcr-name">' + l.name + '</span>' +
        '<input type="color" id="fill_' + l.id + '" value="' + cfg.fills[l.id] + '" title="Relleno">' +
        '<input type="color" id="stroke_' + l.id + '" value="' + cfg.strokes[l.id] + '" title="Contorno">';
      wrap.appendChild(row);
      row.querySelector('#fill_' + l.id).addEventListener('input', function (e) {
        cfg.fills[l.id] = e.target.value; saveConfig();
        row.querySelector('.lcr-tag').style.background = e.target.value;
        refreshLevelButtonColors(); restyleOutlooks(); updateLegend();
      });
      row.querySelector('#stroke_' + l.id).addEventListener('input', function (e) {
        cfg.strokes[l.id] = e.target.value; saveConfig(); restyleOutlooks(); updateLegend();
      });
    });
  }

  function buildSelectedLevelOptions() {
    var sel = $('selectedLevel'); sel.innerHTML = '';
    LEVELS.forEach(function (l) {
      var o = document.createElement('option'); o.value = l.id; o.textContent = l.id + ' — ' + l.name; sel.appendChild(o);
    });
  }

  /* ----------------------- UI: sincronizar inputs ----------------------- */
  function syncInputs() {
    setVal('basemapSelect', cfg.basemap);
    setVal('waterColor', cfg.water); setVal('landColor', cfg.land); setVal('neighborColor', cfg.neighbor);
    setVal('borderColor', cfg.borderColor); setRange('borderWidth', cfg.borderWidth, 'borderWidthVal');
    setCheck('showProvinces', cfg.showProvinces); setVal('provinceColor', cfg.provinceColor);
    setRange('provinceWidth', cfg.provinceWidth, 'provinceWidthVal');
    setCheck('showMunicipios', cfg.showMunicipios); setVal('municipioColor', cfg.municipioColor);
    setRange('municipioWidth', cfg.municipioWidth, 'municipioWidthVal');
    setCheck('showCities', cfg.showCities); setVal('cityRank', String(cfg.cityRank));
    setCheck('showCityLabels', cfg.showCityLabels); setVal('cityDotColor', cfg.cityDotColor);
    setVal('cityLabelColor', cfg.cityLabelColor); setRange('cityLabelSize', cfg.cityLabelSize, 'cityLabelSizeVal');
    setCheck('showCountryLabels', cfg.showCountryLabels);
    setCheck('showGraticule', cfg.showGraticule); setVal('graticuleColor', cfg.graticuleColor); setVal('graticuleStep', String(cfg.graticuleStep));
    setRange('fillOpacity', cfg.fillOpacity, 'fillOpacityVal'); setRange('outlookStroke', cfg.outlookStroke, 'outlookStrokeVal');
    setCheck('showLegend', cfg.showLegend); setVal('legendPos', cfg.legendPos);
    setCheck('legendOnlyUsed', cfg.legendOnlyUsed); setVal('legendTitle', cfg.legendTitle);
    setCheck('showOutlookHeader', cfg.showOutlookHeader); setVal('outlookTitle', cfg.outlookTitle); setVal('outlookValid', cfg.outlookValid);
    syncTextInputs();
  }
  function setVal(id, v) { var e = $(id); if (e) e.value = v; }
  function setCheck(id, v) { var e = $(id); if (e) e.checked = !!v; }
  function setRange(id, v, valId) { var e = $(id); if (e) { e.value = v; if (valId) $(valId).textContent = v; } }

  /* ----------------------- UI: wiring de eventos ----------------------- */
  function wireEvents() {
    // paneles colapsables
    Array.prototype.forEach.call(document.querySelectorAll('.panel-title'), function (t) {
      t.addEventListener('click', function () { t.parentElement.classList.toggle('collapsed'); });
    });
    $('toggleSidebarBtn').addEventListener('click', function () {
      $('sidebar').classList.toggle('collapsed'); setTimeout(function () { map.invalidateSize(); }, 260);
    });

    // herramientas dibujo
    $('drawBtn').addEventListener('click', function () { drawing ? cancelDrawing() : startDrawing(); });
    $('finishBtn').addEventListener('click', finishDrawing);
    $('undoPointBtn').addEventListener('click', function () {
      if (!drawing || !drawPts.length) return;
      drawPts.pop();
      drawVertexLayer.clearLayers();
      drawPts.forEach(function (ll) { L.circleMarker(ll, { radius: 4, color: '#fff', weight: 1.5, fillColor: cfg.fills[currentLevel], fillOpacity: 1, pane: 'outlooks' }).addTo(drawVertexLayer); });
      refreshPreview();
    });
    $('undoPolyBtn').addEventListener('click', undoLastPolygon);
    $('deleteSelBtn').addEventListener('click', deleteSelected);
    $('clearAllBtn').addEventListener('click', clearAll);
    $('selectedLevel').addEventListener('change', function (e) {
      var o = findOutlook(selectedId); if (o) { o.level = e.target.value; persistOutlooks(); renderOutlooks(); updateLegend(); }
    });

    // mapa base
    $('basemapSelect').addEventListener('change', function (e) { setBasemap(e.target.value); });

    // personalización vector
    bindColor('waterColor', 'water', function () { applyWaterColor(); });
    bindColor('landColor', 'land', renderVectorBasemap);
    bindColor('neighborColor', 'neighbor', renderVectorBasemap);
    bindColor('borderColor', 'borderColor', renderVectorBasemap);
    bindRange('borderWidth', 'borderWidth', 'borderWidthVal', renderVectorBasemap);
    bindCheck('showProvinces', 'showProvinces', renderProvinces);
    bindColor('provinceColor', 'provinceColor', renderProvinces);
    bindRange('provinceWidth', 'provinceWidth', 'provinceWidthVal', renderProvinces);
    bindCheck('showMunicipios', 'showMunicipios', renderMunicipios);
    bindColor('municipioColor', 'municipioColor', renderMunicipios);
    bindRange('municipioWidth', 'municipioWidth', 'municipioWidthVal', renderMunicipios);
    $('loadAdminBtn').addEventListener('click', function () { loadAdminDetail(true); });
    bindCheck('showCities', 'showCities', renderCities);
    bindSelectNum('cityRank', 'cityRank', renderCities);
    bindCheck('showCityLabels', 'showCityLabels', renderCities);
    bindColor('cityDotColor', 'cityDotColor', renderCities);
    bindColor('cityLabelColor', 'cityLabelColor', renderCities);
    bindRange('cityLabelSize', 'cityLabelSize', 'cityLabelSizeVal', renderCities);
    bindCheck('showCountryLabels', 'showCountryLabels', renderCountryLabels);
    bindCheck('showGraticule', 'showGraticule', renderGraticule);
    bindColor('graticuleColor', 'graticuleColor', renderGraticule);
    bindSelectNum('graticuleStep', 'graticuleStep', renderGraticule);

    // temas
    Array.prototype.forEach.call(document.querySelectorAll('.theme-btn'), function (b) {
      b.addEventListener('click', function () { applyTheme(b.dataset.theme); });
    });

    // colores alerta
    bindRange('fillOpacity', 'fillOpacity', 'fillOpacityVal', function () { restyleOutlooks(); });
    bindRange('outlookStroke', 'outlookStroke', 'outlookStrokeVal', function () { restyleOutlooks(); });
    $('presetVivid').addEventListener('click', function () { applyPalette(PRESET_VIVID); });
    $('presetOfficial').addEventListener('click', function () { applyPalette(PRESET_OFFICIAL); });

    // leyenda
    bindCheck('showLegend', 'showLegend', updateLegend);
    bindSelect('legendPos', 'legendPos', updateLegend);
    bindCheck('legendOnlyUsed', 'legendOnlyUsed', updateLegend);
    bindText('legendTitle', 'legendTitle', updateLegend);

    // encabezado outlook
    bindCheck('showOutlookHeader', 'showOutlookHeader', updateOutlookHeader);
    bindText('outlookTitle', 'outlookTitle', updateOutlookHeader);
    bindText('outlookValid', 'outlookValid', updateOutlookHeader);

    // texto y etiquetas
    $('textBtn').addEventListener('click', function () { textMode ? stopTextMode() : startTextMode(); });
    $('deleteTextBtn').addEventListener('click', deleteSelectedText);
    $('clearTextsBtn').addEventListener('click', clearAllTexts);
    bindTextStyle('textFill', 'fill', 'color');
    bindTextStyle('textStroke', 'stroke', 'color');
    bindTextStyle('textStrokeWidth', 'strokeWidth', 'range', 'textStrokeWidthVal');
    bindTextStyle('textFont', 'font', 'select');
    bindTextStyle('textSize', 'size', 'range', 'textSizeVal');
    bindTextStyle('textBold', 'bold', 'check');

    // datos / archivos
    $('provinceFile').addEventListener('change', onProvinceFile);
    $('exportOutlookBtn').addEventListener('click', exportOutlook);
    $('importOutlookFile').addEventListener('change', importOutlook);
    $('exportSettingsBtn').addEventListener('click', exportSettings);
    $('importSettingsFile').addEventListener('change', importSettings);
    $('reloadDataBtn').addEventListener('click', function () {
      try { localStorage.removeItem(LS.geo); } catch (e) {}
      setStatus('Recargando…', 'badge-muted');
      loadGeo().then(function () { if (cfg.basemap === 'vector' || cfg.basemap === 'vectordetail') { renderVectorBasemap(); renderCountryLabels(); } toast('Mapa base recargado.', 'ok'); });
    });
    $('clearCacheBtn').addEventListener('click', function () {
      [LS.geo, LS.prov, LS.adm].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      toast('Caché de datos borrada.', 'ok');
    });
    $('resetAllBtn').addEventListener('click', function () {
      if (!confirm('Restablecer toda la configuración y borrar las áreas dibujadas?')) return;
      [LS.config, LS.outlook, LS.texts].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      location.reload();
    });
  }

  // helpers de binding
  function bindColor(id, key, render) { var e = $(id); if (!e) return; e.addEventListener('input', function () { cfg[key] = e.value; saveConfig(); render && render(); }); }
  function bindText(id, key, render) { var e = $(id); if (!e) return; e.addEventListener('input', function () { cfg[key] = e.value; saveConfig(); render && render(); }); }
  function bindCheck(id, key, render) { var e = $(id); if (!e) return; e.addEventListener('change', function () { cfg[key] = e.checked; saveConfig(); render && render(); }); }
  function bindSelect(id, key, render) { var e = $(id); if (!e) return; e.addEventListener('change', function () { cfg[key] = e.value; saveConfig(); render && render(); }); }
  function bindSelectNum(id, key, render) { var e = $(id); if (!e) return; e.addEventListener('change', function () { cfg[key] = parseFloat(e.value); saveConfig(); render && render(); }); }
  function bindRange(id, key, valId, render) {
    var e = $(id); if (!e) return;
    e.addEventListener('input', function () { cfg[key] = parseFloat(e.value); if (valId) $(valId).textContent = e.value; saveConfig(); render && render(); });
  }
  // Estilo de texto: actualiza cfg.text y, si hay un texto seleccionado, también ese.
  function bindTextStyle(id, key, kind, valId) {
    var e = $(id); if (!e) return;
    var evt = (kind === 'check' || kind === 'select') ? 'change' : 'input';
    e.addEventListener(evt, function () {
      var v = (kind === 'check') ? e.checked : (kind === 'range' ? parseFloat(e.value) : e.value);
      cfg.text[key] = v; if (valId) $(valId).textContent = e.value; saveConfig();
      if (selectedTextId) { var t = findText(selectedTextId); if (t) { t.style[key] = v; persistTexts(); } }
      renderTexts();
    });
  }

  function applyTheme(name) {
    var t = THEMES[name]; if (!t) return;
    Object.keys(t).forEach(function (k) { cfg[k] = t[k]; });
    saveConfig(); syncInputs();
    applyWaterColor(); renderVectorBasemap(); renderCountryLabels(); renderProvinces(); renderCities(); renderGraticule();
    toast('Tema "' + name + '" aplicado.', 'ok');
  }
  function applyPalette(pal) {
    cfg.fills = Object.assign({}, pal); saveConfig();
    buildLevelColorControls(); refreshLevelButtonColors(); restyleOutlooks(); updateLegend();
    toast('Paleta de colores aplicada.', 'ok');
  }

  /* ----------------------- Import / Export ----------------------- */
  function onProvinceFile(e) {
    var file = e.target.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        provinceGeoJSON = JSON.parse(rd.result);
        try { localStorage.setItem(LS.prov, rd.result); } catch (x) {}
        if (!cfg.showProvinces) { cfg.showProvinces = true; setCheck('showProvinces', true); saveConfig(); }
        renderProvinces(); toast('Provincias cargadas.', 'ok');
      } catch (x) { toast('GeoJSON inválido.', 'err'); }
    };
    rd.readAsText(file);
  }
  function download(filename, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }
  function exportOutlook() {
    var feats = outlooks.map(function (o) {
      return { type: 'Feature', properties: { kind: 'outlook', level: o.level, name: LEVEL_BY_ID[o.level].name }, geometry: o.geometry };
    });
    texts.forEach(function (t) {
      feats.push({ type: 'Feature', properties: { kind: 'text', text: t.text, style: t.style }, geometry: { type: 'Point', coordinates: [t.lng, t.lat] } });
    });
    var fc = {
      type: 'FeatureCollection',
      properties: { title: cfg.outlookTitle, valid: cfg.outlookValid, generator: 'TRP Meteorología' },
      features: feats
    };
    download('outlook_trp.geojson', JSON.stringify(fc, null, 2));
  }
  function importOutlook(e) {
    var file = e.target.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var fc = JSON.parse(rd.result);
        var feats = fc.features || [];
        var addedA = 0, addedT = 0;
        feats.forEach(function (f) {
          if (!f.geometry) return;
          if (f.geometry.type === 'Point' && f.properties && f.properties.kind === 'text') {
            var c = f.geometry.coordinates;
            texts.push({ id: 't' + Date.now() + Math.floor(Math.random() * 100000), lng: c[0], lat: c[1], text: f.properties.text || '', style: Object.assign({}, cfg.text, f.properties.style || {}) });
            addedT++; return;
          }
          if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
            var lvl = (f.properties && f.properties.level) || 'SLGT';
            if (!LEVEL_BY_ID[lvl]) lvl = 'SLGT';
            outlooks.push({ id: 'o' + Date.now() + Math.floor(Math.random() * 100000), level: lvl, geometry: f.geometry });
            addedA++;
          }
        });
        persistOutlooks(); renderOutlooks(); persistTexts(); renderTexts(); updateLegend();
        toast(addedA + ' área(s) y ' + addedT + ' texto(s) importados.', 'ok');
      } catch (x) { toast('Archivo de outlook inválido.', 'err'); }
    };
    rd.readAsText(file);
    e.target.value = '';
  }
  function exportSettings() { download('trp_config.json', JSON.stringify(cfg, null, 2)); }
  function importSettings(e) {
    var file = e.target.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var obj = JSON.parse(rd.result);
        cfg = Object.assign(defaultConfig(), obj);
        cfg.fills = Object.assign({}, PRESET_VIVID, obj.fills || {});
        cfg.strokes = Object.assign({}, STROKES, obj.strokes || {});
        saveConfig(); applyEverything(); toast('Configuración importada.', 'ok');
      } catch (x) { toast('Config inválida.', 'err'); }
    };
    rd.readAsText(file);
    e.target.value = '';
  }

  function applyEverything() {
    syncInputs();
    buildLevelButtons(); buildLevelColorControls();
    setBasemap(cfg.basemap);
    updateLegend(); updateOutlookHeader();
  }

  /* ----------------------- Arranque ----------------------- */
  function boot() {
    initMap();
    buildLevelButtons(); buildLevelColorControls(); buildSelectedLevelOptions();
    syncInputs(); wireEvents();
    updateOutlookHeader();

    // provincias cacheadas
    try { var pr = localStorage.getItem(LS.prov); if (pr) provinceGeoJSON = JSON.parse(pr); } catch (e) {}
    // municipios/provincias en caché (geoBoundaries)
    try { var ad = localStorage.getItem(LS.adm); if (ad) { var ao = JSON.parse(ad); if (ao && ao.adm1 && ao.adm2) adminData = ao; } } catch (e) {}
    loadOutlooks();
    loadTexts();

    if (!window.turf) toast('No se cargó la librería de geometría (sin conexión). El recorte exacto a AR/PY estará limitado.', 'err');

    loadGeo().then(function () {
      setBasemap(cfg.basemap);
      renderOutlooks();
      renderTexts();
      updateLegend();
      // ajustar vista a AR/PY
      try {
        var feats = [];
        if (geo.ar) feats.push(geo.ar); if (geo.py) feats.push(geo.py);
        if (feats.length) {
          var b = L.geoJSON({ type: 'FeatureCollection', features: feats }).getBounds();
          map.fitBounds(b, { padding: [20, 20] });
        }
      } catch (e) {}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
