/* main.js — UI wiring for the MCD editor */
(function () {
  "use strict";

  const editor = new Editor();
  const canvas = document.getElementById("board");
  editor.init(canvas);

  // ---- DOM refs ----
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const statusbar = $("statusbar");
  const panelBody = $("panelBody");
  const panelTitle = $("panelTitle");
  const toolHint = $("toolHint");
  const textEditor = $("textEditor");
  const canvasScroll = $("canvasScroll");

  const FONTS = [
    "Open Sans", "Arial", "Helvetica", "Verdana", "Tahoma", "Trebuchet MS",
    "Segoe UI", "Calibri", "Times New Roman", "Georgia",
    "Courier New", "Consolas", "Impact", "Comic Sans MS",
  ];

  const FRONT_TYPES = [
    ["cold", "Frente frío"],
    ["warm", "Frente cálido"],
    ["occluded", "Frente ocluido"],
    ["stationary", "Frente estacionario"],
    ["dryline", "Línea seca (dryline)"],
    ["outflow", "Límite de outflow"],
    ["trough", "Vaguada (trough)"],
  ];

  // ---- status ----
  function setStatus(msg) { statusbar.textContent = msg; }
  editor.onStatus = setStatus;

  // ============================================================
  // Tools
  // ============================================================
  const toolButtons = Array.from(document.querySelectorAll(".tool"));
  toolButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.dataset.tool;
      if (btn.dataset.front) editor.setStyle({ frontType: btn.dataset.front });
      editor.setTool(tool);
      activateToolButton(btn);
      updateToolHint(tool, btn.dataset.front);
    });
  });

  function activateToolButton(activeBtn) {
    toolButtons.forEach((b) => b.classList.remove("active"));
    if (activeBtn) activeBtn.classList.add("active");
    stage.classList.toggle("tool-select", editor.tool === "select");
  }

  function syncToolButtons() {
    let match = null;
    toolButtons.forEach((b) => {
      const isFront = b.dataset.tool === "front";
      const ok = b.dataset.tool === editor.tool &&
        (!isFront || b.dataset.front === editor.style.frontType);
      if (ok && !match) match = b;
    });
    activateToolButton(match);
  }

  editor.onToolChange = function () { syncToolButtons(); };

  const HINTS = {
    select: "Clic para seleccionar. Arrastra para mover. Tira de los puntos/tiradores para ajustar. Doble clic en un texto para editarlo.",
    text: "Clic en el lienzo para colocar texto. Se abrirá el editor.",
    citylabel: "Clic para colocar una etiqueta de ciudad (Open Sans Bold). Edita el texto, y cambia el color y el contorno en el panel de la derecha.",
    "place-textbox": "Clic para colocar una caja blanca con borde (estilo número MCD). Doble clic para editar su texto.",
    arrow: "Arrastra para dibujar una flecha. Mantén Shift para ángulos de 45°.",
    polyline: "Clic para añadir puntos. Doble clic o Enter para terminar. Esc cancela.",
    freehand: "Mantén presionado y arrastra para dibujar a mano alzada.",
    polygon: "Clic para añadir vértices del área. Doble clic o Enter para cerrar el polígono.",
    rect: "Arrastra para dibujar un rectángulo. Shift = cuadrado.",
    ellipse: "Arrastra para dibujar una elipse. Shift = círculo.",
    front: "Clic para añadir puntos del frente. Doble clic o Enter para terminar. Usa 'Voltear lado' para cambiar la dirección de los símbolos.",
    station: "Clic para colocar un modelo de estación. Luego edita viento, T, Td, presión y cielo en el panel de la derecha.",
    isobar: "Clic para añadir puntos de la isobara. Doble clic o Enter para terminar. Elige color y escribe el valor (p. ej. 1012) en el panel.",
    wxsymbol: "Clic para colocar un símbolo de tiempo (tormenta 'R', lluvia, nieve…). Cambia tipo, color y tamaño en el panel.",
  };
  function updateToolHint(tool, front) {
    let h = HINTS[tool] || "";
    if (tool === "front" && front) h = (Fronts.LABELS[front] || "Frente") + ". " + HINTS.front;
    toolHint.textContent = h;
  }

  // ============================================================
  // File actions
  // ============================================================
  $("imageInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.loadImageAsBackground(reader.result);
      setTimeout(fitZoom, 60);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  $("btnNewCanvas").addEventListener("click", () => {
    const w = parseInt(prompt("Ancho del lienzo (px):", "1200"), 10);
    const h = parseInt(prompt("Alto del lienzo (px):", "800"), 10);
    if (w > 0 && h > 0) {
      editor.objects = editor.objects.filter((o) => o.type !== "image");
      editor.setCanvasSize(w, h);
      editor.pushHistory();
      fitZoom();
      setStatus(`Lienzo en blanco ${w}×${h}px.`);
    }
  });

  // ---- SPC-style MCD template ----
  const tplModal = $("tplModal");
  const pad2 = (n) => ("0" + n).slice(-2);
  const utcStamp = (d) => pad2(d.getUTCDate()) + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes());
  $("btnTemplate").addEventListener("click", () => {
    const now = new Date();
    $("tplFrom").value = utcStamp(now);
    $("tplTo").value = utcStamp(new Date(now.getTime() + 2 * 3600 * 1000));
    tplModal.hidden = false;
  });
  $("tplCancel").addEventListener("click", () => { tplModal.hidden = true; });
  tplModal.addEventListener("click", (e) => { if (e.target === tplModal) tplModal.hidden = true; });
  tplModal.addEventListener("keydown", (e) => { if (e.key === "Escape") tplModal.hidden = true; });
  $("tplInsert").addEventListener("click", () => { insertTemplate(); tplModal.hidden = true; });

  function insertTemplate() {
    const W = canvas.width, H = canvas.height;
    const margin = Math.max(12, Math.round(W * 0.02));
    const fs = Math.max(14, Math.round(W * 0.016));
    const num = ($("tplNum").value || "").trim() || "0001";
    const office = ($("tplOffice").value || "").trim();
    const from = ($("tplFrom").value || "").trim();
    const to = ($("tplTo").value || "").trim();
    const prob = ($("tplProb").value || "").trim();
    const areas = ($("tplAreas").value || "").trim();
    const summary = ($("tplSummary").value || "").trim();

    let headerText = `DISCUSIÓN DE MESOESCALA ${num}`;
    if (office) headerText += `\n${office}`;
    const line3 = [];
    if (from || to) line3.push(`Válido ${from}Z - ${to}Z`);
    if (prob !== "") line3.push(`Prob. de aviso: ${prob}%`);
    if (line3.length) headerText += `\n${line3.join("   ·   ")}`;
    if (areas) headerText += `\nÁreas: ${areas}`;

    const lines = headerText.split("\n").length;
    const header = Shapes.create("textbox", editor.style);
    Object.assign(header, {
      x: margin, y: margin, w: W - margin * 2,
      h: Math.round(lines * fs * 1.4 + 20),
      text: headerText, fontFamily: "Arial", fontSize: fs, bold: true,
      textColor: "#111111", fill: "#ffffff", stroke: "#b00000", strokeWidth: 3,
      align: "left", padding: 10,
    });
    editor.objects.push(header);

    if (summary) {
      const sfs = Math.max(12, Math.round(fs * 0.85));
      const contentW = W - margin * 2 - 20;
      const cpl = Math.max(20, Math.floor(contentW / (sfs * 0.52)));
      const approxLines = summary.split("\n").reduce((acc, ln) => acc + Math.max(1, Math.ceil(ln.length / cpl)), 0) + 1;
      const box = Shapes.create("textbox", editor.style);
      Object.assign(box, {
        x: margin, y: header.y + header.h + Math.round(margin * 0.5), w: W - margin * 2,
        h: Math.round(approxLines * sfs * 1.35 + 18),
        text: "RESUMEN... " + summary, fontFamily: "Arial", fontSize: sfs, bold: false,
        textColor: "#111111", fill: "#ffffff", stroke: "#444444", strokeWidth: 2,
        align: "left", padding: 10,
      });
      editor.objects.push(box);
    }

    if ($("tplFooter").checked) {
      const ffs = Math.max(10, Math.round(fs * 0.7));
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ") + "Z";
      const footer = Shapes.create("text", editor.style);
      Object.assign(footer, {
        x: margin, y: H - margin - ffs * 1.4,
        text: `Generado con Editor MCD · ${stamp}`,
        fontFamily: "Arial", fontSize: ffs, color: "#111111",
        bold: false, italic: false, align: "left", haloColor: "#ffffff", haloWidth: 3,
      });
      editor.objects.push(footer);
    }

    editor.selectedId = header.id;
    editor.pushHistory();
    editor.render();
    forcePanelRebuild();
    setStatus(`Plantilla MCD ${num} insertada.`);
  }

  $("btnExportPng").addEventListener("click", () => {
    editor.exportPNG();
    setStatus("Exportado como PNG.");
  });

  $("btnSaveProj").addEventListener("click", () => {
    editor.exportProject();
    setStatus("Proyecto guardado (.json).");
  });

  $("projInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        editor.loadProject(JSON.parse(reader.result));
        setTimeout(fitZoom, 60);
        setStatus("Proyecto abierto.");
      } catch (err) {
        alert("No se pudo abrir el proyecto: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("btnUndo").addEventListener("click", () => { editor.undo(); forcePanelRebuild(); });
  $("btnRedo").addEventListener("click", () => { editor.redo(); forcePanelRebuild(); });

  // ============================================================
  // Zoom
  // ============================================================
  let zoom = 1;
  function applyZoom(z) {
    zoom = Math.max(0.1, Math.min(6, z));
    canvas.style.width = canvas.width * zoom + "px";
    canvas.style.height = canvas.height * zoom + "px";
    $("zoomLabel").textContent = Math.round(zoom * 100) + "%";
    editor.render();
  }
  function fitZoom() {
    const pad = 48;
    const aw = canvasScroll.clientWidth - pad;
    const ah = canvasScroll.clientHeight - pad;
    applyZoom(Math.min(aw / canvas.width, ah / canvas.height, 1));
  }
  $("btnZoomIn").addEventListener("click", () => applyZoom(zoom * 1.2));
  $("btnZoomOut").addEventListener("click", () => applyZoom(zoom / 1.2));
  $("btnZoom100").addEventListener("click", () => applyZoom(1));
  $("btnZoomFit").addEventListener("click", fitZoom);
  window.addEventListener("resize", () => { /* keep current zoom */ });

  // ============================================================
  // Color helpers
  // ============================================================
  function parseColor(str) {
    if (!str || str === "none") return { hex: "#ffffff", alpha: 1, none: true };
    if (str[0] === "#") {
      let h = str;
      if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
      return { hex: h.slice(0, 7), alpha: 1, none: false };
    }
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
      const toHex = (n) => ("0" + Math.round(n).toString(16)).slice(-2);
      return {
        hex: "#" + toHex(parts[0]) + toHex(parts[1]) + toHex(parts[2]),
        alpha: parts[3] == null ? 1 : parts[3],
        none: false,
      };
    }
    return { hex: "#ffffff", alpha: 1, none: false };
  }
  function rgba(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ============================================================
  // Properties panel
  // ============================================================
  let builtPanelKey = "__init__";

  function forcePanelRebuild() { builtPanelKey = "__force__"; refreshUI(); }

  editor.onChange = refreshUI;
  function refreshUI() {
    $("btnUndo").disabled = editor.history.length <= 1;
    $("btnRedo").disabled = editor.future.length === 0;
    const sel = editor.getSelected();
    const key = sel ? sel.id + ":" + sel.type : "none";
    if (key !== builtPanelKey) {
      buildPanel(sel);
      builtPanelKey = key;
    }
    syncToolButtons();
  }

  // helper builders ------------------------------------------------
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function fontOptions(selected) {
    return FONTS.map((f) => `<option value="${f}" ${f === selected ? "selected" : ""} style="font-family:'${f}'">${f}</option>`).join("");
  }

  function commit() { editor.pushHistory(); }

  function buildPanel(sel) {
    panelBody.innerHTML = "";
    if (!sel) { buildDefaultsPanel(); return; }
    panelTitle.textContent = typeTitle(sel.type);

    // ---- order / actions ----
    const actions = el(`
      <div class="field">
        <label>Orden y acciones</label>
        <div class="seg" style="margin-bottom:6px">
          <button id="pBack" title="Enviar al fondo">⤓ Fondo</button>
          <button id="pBackward" title="Atrás">−</button>
          <button id="pForward" title="Adelante">+</button>
          <button id="pFront" title="Traer al frente">⤒ Frente</button>
        </div>
        <button class="btn btn-block" id="pDup">⧉ Duplicar</button>
        <button class="btn btn-block danger" id="pDel">🗑 Eliminar</button>
      </div>
      <div class="divider"></div>
    `);
    panelBody.appendChild(actions);
    $("pBack").onclick = () => editor.reorder("back");
    $("pBackward").onclick = () => editor.reorder("backward");
    $("pForward").onclick = () => editor.reorder("forward");
    $("pFront").onclick = () => editor.reorder("front");
    $("pDup").onclick = () => editor.duplicateSelected();
    $("pDel").onclick = () => editor.deleteSelected();

    // ---- type-specific ----
    if (sel.type === "text") buildTextControls(sel, false);
    else if (sel.type === "textbox") buildTextControls(sel, true);
    else if (sel.type === "rect" || sel.type === "ellipse") buildShapeFillStroke(sel);
    else if (sel.type === "polygon") buildPolygonControls(sel);
    else if (sel.type === "polyline" || sel.type === "freehand") buildLineControls(sel, false);
    else if (sel.type === "arrow") buildLineControls(sel, true);
    else if (sel.type === "front") buildFrontControls(sel);
    else if (sel.type === "isobar") buildIsobarControls(sel);
    else if (sel.type === "station") buildStationControls(sel);
    else if (sel.type === "wxsymbol") buildWxSymbolControls(sel);
    else if (sel.type === "image") buildImageControls(sel);

    // ---- opacity (all) ----
    const op = el(`
      <div class="divider"></div>
      <div class="field">
        <label>Opacidad: <span id="opVal">${Math.round((sel.opacity ?? 1) * 100)}%</span></label>
        <input type="range" id="pOpacity" min="0" max="1" step="0.05" value="${sel.opacity ?? 1}" />
      </div>`);
    panelBody.appendChild(op);
    const opRange = $("pOpacity");
    opRange.oninput = () => { sel.opacity = parseFloat(opRange.value); $("opVal").textContent = Math.round(sel.opacity * 100) + "%"; editor.render(); };
    opRange.onchange = commit;
  }

  function colorField(labelTxt, id, value, withNone, noneChecked) {
    return `
      <div class="field">
        <label>${labelTxt}</label>
        <div class="row">
          <input type="color" id="${id}" value="${value}" />
          ${withNone ? `<label class="checkbox-row" style="flex:0 0 auto"><input type="checkbox" id="${id}None" ${noneChecked ? "checked" : ""}/> ninguno</label>` : ""}
        </div>
      </div>`;
  }

  function buildTextControls(sel, isBox) {
    const textColor = isBox ? (sel.textColor || "#111111") : (sel.color || "#111111");
    const wrap = el(`
      <div>
        <button class="btn btn-block" id="pEditText">✎ Editar texto</button>
        <div class="field">
          <label>Fuente</label>
          <select id="pFont">${fontOptions(sel.fontFamily || "Arial")}</select>
        </div>
        <div class="field">
          <label>Tamaño / Estilo</label>
          <div class="row">
            <input type="number" id="pFontSize" min="6" max="200" value="${sel.fontSize || 18}" />
            <div class="seg" style="flex:1.4">
              <button id="pBold" class="${sel.bold ? "on" : ""}" style="font-weight:bold">B</button>
              <button id="pItalic" class="${sel.italic ? "on" : ""}" style="font-style:italic">I</button>
            </div>
          </div>
        </div>
        <div class="field">
          <label>Alineación</label>
          <div class="seg">
            <button data-al="left" class="${(sel.align||'left')==='left'?'on':''}">⯇</button>
            <button data-al="center" class="${sel.align==='center'?'on':''}">≡</button>
            <button data-al="right" class="${sel.align==='right'?'on':''}">⯈</button>
          </div>
        </div>
        ${colorField("Color del texto", "pTextColor", textColor, false)}
        ${isBox ? colorField("Relleno de la caja", "pFill", parseColor(sel.fill).hex, true, parseColor(sel.fill).none) : ""}
        ${isBox ? colorField("Borde de la caja", "pStroke", parseColor(sel.stroke).hex, true, parseColor(sel.stroke).none) : ""}
        ${isBox ? `<div class="field"><label>Grosor del borde: <span id="bwVal">${sel.strokeWidth||3}</span>px</label><input type="range" id="pStrokeW" min="0" max="20" value="${sel.strokeWidth||3}" /></div>` : ""}
        ${!isBox ? colorField("Color del contorno", "pHaloColor", parseColor(sel.haloColor || "#ffffff").hex, false) : ""}
        ${!isBox ? `<div class="field"><label>Grosor del contorno: <span id="hwVal">${sel.haloWidth||0}</span>px</label><input type="range" id="pHaloW" min="0" max="14" value="${sel.haloWidth||0}" /></div>` : ""}
      </div>`);
    panelBody.appendChild(wrap);

    $("pEditText").onclick = () => openTextEditor(sel);
    $("pFont").onchange = (e) => { sel.fontFamily = e.target.value; editor.setStyle({ fontFamily: e.target.value }); editor.render(); commit(); };
    const fs = $("pFontSize");
    fs.oninput = () => { sel.fontSize = parseInt(fs.value, 10) || 12; editor.render(); };
    fs.onchange = () => { editor.setStyle({ fontSize: sel.fontSize }); commit(); };
    $("pBold").onclick = () => { sel.bold = !sel.bold; $("pBold").classList.toggle("on", sel.bold); editor.render(); commit(); };
    $("pItalic").onclick = () => { sel.italic = !sel.italic; $("pItalic").classList.toggle("on", sel.italic); editor.render(); commit(); };
    panelBody.querySelectorAll("[data-al]").forEach((b) => b.onclick = () => {
      sel.align = b.dataset.al; editor.render(); commit();
      panelBody.querySelectorAll("[data-al]").forEach((x) => x.classList.toggle("on", x === b));
    });
    const tc = $("pTextColor");
    tc.oninput = () => { if (isBox) sel.textColor = tc.value; else sel.color = tc.value; editor.render(); };
    tc.onchange = commit;

    if (isBox) {
      bindColorNone("pFill", (v) => { sel.fill = v; }, () => sel.fill);
      bindColorNone("pStroke", (v) => { sel.stroke = v; }, () => sel.stroke);
      const sw = $("pStrokeW");
      sw.oninput = () => { sel.strokeWidth = parseInt(sw.value, 10); $("bwVal").textContent = sel.strokeWidth; editor.render(); };
      sw.onchange = commit;
    } else {
      const hc = $("pHaloColor");
      hc.oninput = () => {
        sel.haloColor = hc.value;
        if (!(sel.haloWidth > 0)) { sel.haloWidth = 4; const hw = $("pHaloW"); hw.value = 4; $("hwVal").textContent = 4; }
        editor.render();
      };
      hc.onchange = commit;
      const hw = $("pHaloW");
      hw.oninput = () => {
        sel.haloWidth = parseInt(hw.value, 10);
        $("hwVal").textContent = sel.haloWidth;
        if (sel.haloWidth > 0 && !sel.haloColor) sel.haloColor = hc.value;
        editor.render();
      };
      hw.onchange = commit;
    }
  }

  function bindColorNone(id, setVal, getVal) {
    const color = $(id);
    const none = $(id + "None");
    function apply() {
      if (none && none.checked) setVal("none");
      else setVal(color.value);
      editor.render();
    }
    color.oninput = apply;
    color.onchange = () => { apply(); commit(); };
    if (none) none.onchange = () => { apply(); commit(); };
  }

  function buildShapeFillStroke(sel) {
    const wrap = el(`
      <div>
        ${colorField("Relleno", "pFill", parseColor(sel.fill).hex, true, parseColor(sel.fill).none)}
        ${colorField("Borde", "pStroke", parseColor(sel.stroke).hex, true, parseColor(sel.stroke).none)}
        <div class="field"><label>Grosor: <span id="swVal">${sel.strokeWidth||2}</span>px</label>
          <input type="range" id="pStrokeW" min="0" max="30" value="${sel.strokeWidth||2}" /></div>
      </div>`);
    panelBody.appendChild(wrap);
    bindColorNone("pFill", (v) => { sel.fill = v; }, () => sel.fill);
    bindColorNone("pStroke", (v) => { sel.stroke = v; }, () => sel.stroke);
    const sw = $("pStrokeW");
    sw.oninput = () => { sel.strokeWidth = parseInt(sw.value, 10); $("swVal").textContent = sel.strokeWidth; editor.render(); };
    sw.onchange = commit;
  }

  function buildPolygonControls(sel) {
    const fc = parseColor(sel.fill);
    const HATCH = [["none","(ninguna)"],["diagonal","Diagonal ╱"],["diagonal2","Diagonal ╲"],["cross","Cruzada ╳"],["horizontal","Horizontal"],["vertical","Vertical"]];
    const wrap = el(`
      <div>
        ${colorField("Color de relleno", "pFillC", fc.hex, false)}
        <div class="field"><label>Opacidad del relleno: <span id="faVal">${Math.round(fc.alpha*100)}%</span></label>
          <input type="range" id="pFillA" min="0" max="1" step="0.05" value="${fc.alpha}" /></div>
        <div class="divider"></div>
        <div class="field"><label>Trama (hatch)</label>
          <select id="pHatch">${HATCH.map(([v,l])=>`<option value="${v}" ${(sel.hatch||'none')===v?'selected':''}>${l}</option>`).join("")}</select></div>
        ${colorField("Color de la trama", "pHatchC", parseColor(sel.hatchColor||'#d11111').hex, false)}
        <div class="field"><label>Separación de la trama: <span id="hgVal">${sel.hatchGap||10}</span>px</label>
          <input type="range" id="pHatchGap" min="4" max="40" value="${sel.hatchGap||10}" /></div>
        <div class="divider"></div>
        ${colorField("Borde", "pStroke", parseColor(sel.stroke).hex, true, parseColor(sel.stroke).none)}
        <div class="field"><label>Grosor del borde: <span id="swVal">${sel.strokeWidth||2}</span>px</label>
          <input type="range" id="pStrokeW" min="0" max="20" value="${sel.strokeWidth||2}" /></div>
        <div class="field"><label class="checkbox-row"><input type="checkbox" id="pDash" ${(sel.dash&&sel.dash.length)?'checked':''}/> Borde discontinuo</label></div>
      </div>`);
    panelBody.appendChild(wrap);
    const fcInp = $("pFillC"), faInp = $("pFillA");
    function applyFill() { sel.fill = rgba(fcInp.value, parseFloat(faInp.value)); $("faVal").textContent = Math.round(faInp.value*100)+"%"; editor.render(); }
    fcInp.oninput = applyFill; fcInp.onchange = commit;
    faInp.oninput = applyFill; faInp.onchange = commit;
    $("pHatch").onchange = (e) => { sel.hatch = e.target.value; editor.setStyle({ hatch: e.target.value }); editor.render(); commit(); };
    const hc = $("pHatchC");
    hc.oninput = () => { sel.hatchColor = hc.value; editor.setStyle({ hatchColor: hc.value }); editor.render(); };
    hc.onchange = commit;
    const hg = $("pHatchGap");
    hg.oninput = () => { sel.hatchGap = parseInt(hg.value, 10); $("hgVal").textContent = sel.hatchGap; editor.render(); };
    hg.onchange = commit;
    bindColorNone("pStroke", (v) => { sel.stroke = v; }, () => sel.stroke);
    const sw = $("pStrokeW");
    sw.oninput = () => { sel.strokeWidth = parseInt(sw.value, 10); $("swVal").textContent = sel.strokeWidth; editor.render(); };
    sw.onchange = commit;
    $("pDash").onchange = (e) => { sel.dash = e.target.checked ? [12, 8] : []; editor.render(); commit(); };
  }

  function buildLineControls(sel, isArrow) {
    const wrap = el(`
      <div>
        ${colorField("Color", "pStroke", parseColor(sel.stroke).hex, false)}
        <div class="field"><label>Grosor: <span id="swVal">${sel.strokeWidth||3}</span>px</label>
          <input type="range" id="pStrokeW" min="1" max="30" value="${sel.strokeWidth||3}" /></div>
        ${!isArrow ? `<div class="field"><label class="checkbox-row"><input type="checkbox" id="pDash" ${(sel.dash&&sel.dash.length)?'checked':''}/> Línea discontinua</label></div>` : ""}
        ${isArrow ? `<div class="field"><label class="checkbox-row"><input type="checkbox" id="pDouble" ${sel.doubleHead?'checked':''}/> Doble punta</label></div>` : ""}
      </div>`);
    panelBody.appendChild(wrap);
    const sc = $("pStroke");
    sc.oninput = () => { sel.stroke = sc.value; editor.setStyle({ stroke: sc.value }); editor.render(); };
    sc.onchange = commit;
    const sw = $("pStrokeW");
    sw.oninput = () => { sel.strokeWidth = parseInt(sw.value, 10); $("swVal").textContent = sel.strokeWidth; editor.setStyle({ strokeWidth: sel.strokeWidth }); editor.render(); };
    sw.onchange = commit;
    if (!isArrow) $("pDash").onchange = (e) => { sel.dash = e.target.checked ? [14, 9] : []; editor.render(); commit(); };
    if (isArrow) $("pDouble").onchange = (e) => { sel.doubleHead = e.target.checked; editor.render(); commit(); };
  }

  function buildFrontControls(sel) {
    const wrap = el(`
      <div>
        <div class="field">
          <label>Tipo de frente</label>
          <select id="pFrontType">
            ${FRONT_TYPES.map(([v, l]) => `<option value="${v}" ${sel.frontType===v?'selected':''}>${l}</option>`).join("")}
          </select>
        </div>
        <button class="btn btn-block" id="pFlip">⇋ Voltear lado de los símbolos</button>
        <div class="field"><label>Grosor de línea: <span id="lwVal">${sel.lineWidth||4}</span>px</label>
          <input type="range" id="pLineW" min="2" max="14" value="${sel.lineWidth||4}" /></div>
        <div class="field"><label>Tamaño de símbolos: <span id="scVal">${Math.round((sel.scale||1)*100)}%</span></label>
          <input type="range" id="pScale" min="0.5" max="2.5" step="0.1" value="${sel.scale||1}" /></div>
        <div class="muted-note">Tira de los puntos blancos sobre la línea para ajustar la curva del frente.</div>
      </div>`);
    panelBody.appendChild(wrap);
    $("pFrontType").onchange = (e) => { sel.frontType = e.target.value; editor.setStyle({ frontType: e.target.value }); editor.render(); commit(); };
    $("pFlip").onclick = () => { sel.side = (sel.side === -1 ? 1 : -1); editor.render(); commit(); };
    const lw = $("pLineW");
    lw.oninput = () => { sel.lineWidth = parseInt(lw.value, 10); $("lwVal").textContent = sel.lineWidth; editor.render(); };
    lw.onchange = commit;
    const sc = $("pScale");
    sc.oninput = () => { sel.scale = parseFloat(sc.value); $("scVal").textContent = Math.round(sel.scale*100)+"%"; editor.render(); };
    sc.onchange = commit;
  }

  function buildStationControls(sel) {
    const COVER = [[0,"0 — despejado"],[1,"1 okta"],[2,"2 oktas"],[3,"3 oktas"],[4,"4 — medio"],[5,"5 oktas"],[6,"6 oktas"],[7,"7 oktas"],[8,"8 — cubierto"]];
    const WX = [["none","(ninguno)"],["rain","Lluvia"],["drizzle","Llovizna"],["showers","Chubascos"],["snow","Nieve"],["tstorm","Tormenta"],["fog","Niebla"]];
    const wrap = el(`
      <div>
        <div class="row">
          <div class="field" style="margin:0"><label>Temperatura</label><input type="text" id="stTemp" value="${sel.temp ?? ""}" /></div>
          <div class="field" style="margin:0"><label>Punto de rocío</label><input type="text" id="stDew" value="${sel.dewpoint ?? ""}" /></div>
        </div>
        <div class="field" style="margin-top:13px"><label>Presión (3 dígitos codificados)</label><input type="text" id="stPres" value="${sel.pressure ?? ""}" /></div>
        <div class="field"><label>Cobertura del cielo</label>
          <select id="stCover">${COVER.map(([v,l])=>`<option value="${v}" ${(+sel.cover)===v?'selected':''}>${l}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Tiempo presente</label>
          <select id="stWx">${WX.map(([v,l])=>`<option value="${v}" ${sel.presentWx===v?'selected':''}>${l}</option>`).join("")}</select>
        </div>
        <div class="row">
          <div class="field" style="margin:0"><label>Dir. viento (°)</label><input type="number" id="stDir" min="0" max="360" value="${sel.windDir ?? 0}" /></div>
          <div class="field" style="margin:0"><label>Veloc. (kt)</label><input type="number" id="stSpd" min="0" max="200" value="${sel.windSpeed ?? 0}" /></div>
        </div>
        <div class="field" style="margin-top:13px"><label>Hemisferio (lado de las barbas)</label>
          <select id="stHem"><option value="S" ${sel.hemisphere==='S'?'selected':''}>Sur</option><option value="N" ${sel.hemisphere==='N'?'selected':''}>Norte</option></select>
        </div>
        ${colorField("Color", "stColor", parseColor(sel.color).hex, false)}
        <div class="field"><label>Tamaño: <span id="stSizeVal">${sel.size||72}</span>px</label>
          <input type="range" id="stSize" min="36" max="180" value="${sel.size||72}" /></div>
        <div class="muted-note">Veloc. en nudos: media barba=5, barba=10, banderín=50. Calma (&lt;3 kt) = círculo.</div>
      </div>`);
    panelBody.appendChild(wrap);
    const bindText = (id, key) => { const e = $(id); e.oninput = () => { sel[key] = e.value; editor.render(); }; e.onchange = commit; };
    const bindNum = (id, key) => { const e = $(id); e.oninput = () => { sel[key] = parseFloat(e.value) || 0; editor.render(); }; e.onchange = commit; };
    bindText("stTemp", "temp"); bindText("stDew", "dewpoint"); bindText("stPres", "pressure");
    bindNum("stDir", "windDir"); bindNum("stSpd", "windSpeed");
    $("stCover").onchange = (e) => { sel.cover = parseInt(e.target.value, 10); editor.render(); commit(); };
    $("stWx").onchange = (e) => { sel.presentWx = e.target.value; editor.render(); commit(); };
    $("stHem").onchange = (e) => { sel.hemisphere = e.target.value; editor.setStyle({ hemisphere: e.target.value }); editor.render(); commit(); };
    const col = $("stColor");
    col.oninput = () => { sel.color = col.value; editor.render(); };
    col.onchange = commit;
    const sz = $("stSize");
    sz.oninput = () => { sel.size = parseInt(sz.value, 10); $("stSizeVal").textContent = sel.size; editor.render(); };
    sz.onchange = commit;
  }

  function buildIsobarControls(sel) {
    const wrap = el(`
      <div>
        ${colorField("Color", "ibStroke", parseColor(sel.stroke).hex, false)}
        <div class="field"><label>Grosor: <span id="ibwVal">${sel.strokeWidth||2}</span>px</label>
          <input type="range" id="ibW" min="1" max="14" value="${sel.strokeWidth||2}" /></div>
        <div class="field"><label>Valor / etiqueta (p. ej. 1012)</label><input type="text" id="ibLabel" value="${(sel.label||"").replace(/"/g,'&quot;')}" /></div>
        <div class="field"><label>Tamaño de etiqueta: <span id="ibLsVal">${sel.labelSize||14}</span>px</label>
          <input type="range" id="ibLs" min="8" max="48" value="${sel.labelSize||14}" /></div>
        <div class="field"><label class="checkbox-row"><input type="checkbox" id="ibDash" ${sel.dash?'checked':''}/> Línea discontinua</label></div>
        <div class="field"><label class="checkbox-row"><input type="checkbox" id="ibSmooth" ${sel.smooth!==false?'checked':''}/> Curva suavizada</label></div>
        <div class="muted-note">Tira de los puntos para ajustar la curva. La etiqueta aparece en los extremos.</div>
      </div>`);
    panelBody.appendChild(wrap);
    const sc = $("ibStroke");
    sc.oninput = () => { sel.stroke = sc.value; editor.setStyle({ isobarColor: sc.value }); editor.render(); };
    sc.onchange = commit;
    const w = $("ibW");
    w.oninput = () => { sel.strokeWidth = parseInt(w.value, 10); $("ibwVal").textContent = sel.strokeWidth; editor.render(); };
    w.onchange = commit;
    const lb = $("ibLabel");
    lb.oninput = () => { sel.label = lb.value; editor.render(); };
    lb.onchange = commit;
    const ls = $("ibLs");
    ls.oninput = () => { sel.labelSize = parseInt(ls.value, 10); $("ibLsVal").textContent = sel.labelSize; editor.render(); };
    ls.onchange = commit;
    $("ibDash").onchange = (e) => { sel.dash = e.target.checked; editor.render(); commit(); };
    $("ibSmooth").onchange = (e) => { sel.smooth = e.target.checked; editor.render(); commit(); };
  }

  function buildWxSymbolControls(sel) {
    const SYMS = [["thunderstorm","Tormenta (R)"],["tstorm-bolt","Tormenta (rayo)"],["rain","Lluvia"],["drizzle","Llovizna"],["showers","Chubascos"],["snow","Nieve"],["fog","Niebla"]];
    const wrap = el(`
      <div>
        <div class="field"><label>Símbolo</label>
          <select id="wxSym">${SYMS.map(([v,l])=>`<option value="${v}" ${sel.symbol===v?'selected':''}>${l}</option>`).join("")}</select></div>
        ${colorField("Color", "wxColor", parseColor(sel.color).hex, false)}
        <div class="field"><label>Tamaño: <span id="wxSzVal">${sel.size||48}</span>px</label>
          <input type="range" id="wxSz" min="20" max="160" value="${sel.size||48}" /></div>
        <div class="muted-note">El símbolo de tormenta (R) imita el de las cartas sinópticas. Por defecto en rojo.</div>
      </div>`);
    panelBody.appendChild(wrap);
    $("wxSym").onchange = (e) => { sel.symbol = e.target.value; editor.setStyle({ wxSymbol: e.target.value }); editor.render(); commit(); };
    const c = $("wxColor");
    c.oninput = () => { sel.color = c.value; editor.setStyle({ wxColor: c.value }); editor.render(); };
    c.onchange = commit;
    const sz = $("wxSz");
    sz.oninput = () => { sel.size = parseInt(sz.value, 10); $("wxSzVal").textContent = sel.size; editor.render(); };
    sz.onchange = commit;
  }

  function buildImageControls(sel) {
    const wrap = el(`<div class="muted-note">Imagen de fondo. Puedes moverla y redimensionarla con los tiradores. Carga una nueva imagen desde la barra superior para reemplazarla.</div>`);
    panelBody.appendChild(wrap);
  }

  function buildDefaultsPanel() {
    panelTitle.textContent = "Estilo por defecto";
    const s = editor.style;
    const wrap = el(`
      <div>
        <div class="muted-note" style="margin-bottom:12px">No hay nada seleccionado. Estos ajustes se aplican a los <b>nuevos</b> objetos que dibujes.</div>
        <div class="field">
          <label>Fuente de texto</label>
          <select id="dFont">${fontOptions(s.fontFamily)}</select>
        </div>
        <div class="field">
          <label>Tamaño de fuente</label>
          <input type="number" id="dFontSize" min="6" max="200" value="${s.fontSize}" />
        </div>
        ${colorField("Color de texto", "dTextColor", s.textColor, false)}
        <div class="divider"></div>
        ${colorField("Color de trazo (líneas/flechas)", "dStroke", s.stroke, false)}
        <div class="field"><label>Grosor de trazo: <span id="dswVal">${s.strokeWidth}</span>px</label>
          <input type="range" id="dStrokeW" min="1" max="30" value="${s.strokeWidth}" /></div>
        <div class="divider"></div>
        <button class="btn btn-block danger" id="dClearAnn">🧹 Borrar anotaciones (conservar imagen)</button>
        <button class="btn btn-block danger" id="dClearAll">🗑 Borrar todo</button>
      </div>`);
    panelBody.appendChild(wrap);
    $("dFont").onchange = (e) => editor.setStyle({ fontFamily: e.target.value });
    $("dFontSize").onchange = (e) => editor.setStyle({ fontSize: parseInt(e.target.value, 10) || 18 });
    $("dTextColor").onchange = (e) => editor.setStyle({ textColor: e.target.value });
    $("dStroke").onchange = (e) => editor.setStyle({ stroke: e.target.value });
    const dsw = $("dStrokeW");
    dsw.oninput = () => { $("dswVal").textContent = dsw.value; editor.setStyle({ strokeWidth: parseInt(dsw.value, 10) }); };
    $("dClearAnn").onclick = () => { if (confirm("¿Borrar todas las anotaciones y conservar la imagen?")) editor.clearAnnotations(); };
    $("dClearAll").onclick = () => { if (confirm("¿Borrar TODO el lienzo?")) editor.clearAll(); };
  }

  function typeTitle(t) {
    return ({
      text: "Texto", textbox: "Caja de texto", rect: "Rectángulo", ellipse: "Elipse",
      polygon: "Área / polígono", polyline: "Poli-línea", freehand: "Trazo libre",
      arrow: "Flecha", front: "Frente", image: "Imagen de fondo",
      station: "Estación meteorológica",
      isobar: "Isobara", wxsymbol: "Símbolo de tiempo",
    })[t] || "Propiedades";
  }

  // ============================================================
  // Inline text editor
  // ============================================================
  let editingShape = null;
  editor.onEditText = openTextEditor;

  function openTextEditor(shape) {
    editingShape = shape;
    const b = Shapes.bounds(shape);
    const r = canvas.getBoundingClientRect();
    const scale = r.width / canvas.width;
    const left = r.left + b.x * scale;
    const top = r.top + b.y * scale;
    const fontPx = (shape.fontSize || 18) * scale;
    textEditor.style.display = "block";
    textEditor.style.left = left + "px";
    textEditor.style.top = top + "px";
    textEditor.style.width = Math.max(60, (shape.type === "textbox" ? b.w * scale : 200)) + "px";
    textEditor.style.minHeight = Math.max(fontPx * 1.4, b.h * scale) + "px";
    textEditor.style.fontFamily = shape.fontFamily || "Arial";
    textEditor.style.fontSize = fontPx + "px";
    textEditor.style.fontWeight = shape.bold ? "bold" : "normal";
    textEditor.style.fontStyle = shape.italic ? "italic" : "normal";
    textEditor.style.textAlign = shape.align || "left";
    textEditor.value = shape.text || "";
    setStatus("Editando texto — Esc o Ctrl+Enter para confirmar.");
    setTimeout(() => { textEditor.focus(); textEditor.select(); autoGrow(); }, 10);
  }
  function autoGrow() {
    textEditor.style.height = "auto";
    textEditor.style.height = textEditor.scrollHeight + "px";
  }
  function commitTextEditor() {
    if (!editingShape) return;
    const val = textEditor.value;
    const shape = editingShape;
    editingShape = null;
    textEditor.style.display = "none";
    if (shape.type === "text" && val.trim() === "") {
      editor.objects = editor.objects.filter((o) => o.id !== shape.id);
      if (editor.selectedId === shape.id) editor.selectedId = null;
    } else {
      shape.text = val;
    }
    editor.pushHistory();
    editor.render();
    forcePanelRebuild();
    setStatus("Texto actualizado.");
  }
  textEditor.addEventListener("input", autoGrow);
  textEditor.addEventListener("blur", commitTextEditor);
  textEditor.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault(); textEditor.blur();
    }
  });

  // ============================================================
  // Keyboard shortcuts
  // ============================================================
  window.addEventListener("keydown", (e) => {
    if (document.activeElement === textEditor) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); editor.undo(); forcePanelRebuild(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); editor.redo(); forcePanelRebuild(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); editor.duplicateSelected(); return; }

    if (e.key === "Delete" || e.key === "Backspace") { editor.deleteSelected(); return; }
    if (e.key === "Enter") { if (editor.draft) editor._finishDraft(); return; }
    if (e.key === "Escape") { if (editor.draft) editor.cancelDraft(); else { editor.setTool("select"); selectToolBtn("select"); } return; }

    // nudge
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      const sel = editor.getSelected();
      if (sel) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
        Shapes.move(sel, d[0], d[1]); editor.render(); editor.pushHistory();
      }
      return;
    }

    // tool shortcuts
    const map = { v: "select", t: "text", c: "citylabel", b: "place-textbox", a: "arrow", l: "polyline", p: "freehand", g: "polygon", r: "rect", e: "ellipse", s: "station", i: "isobar", k: "wxsymbol" };
    if (map[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
      editor.setTool(map[e.key.toLowerCase()]);
      selectToolBtn(map[e.key.toLowerCase()]);
    }
  });

  function selectToolBtn(tool) {
    const btn = toolButtons.find((b) => b.dataset.tool === tool && !b.dataset.front);
    activateToolButton(btn);
    updateToolHint(tool);
  }

  // ============================================================
  // init
  // ============================================================
  selectToolBtn("select");
  refreshUI();
  fitZoom();
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(() => editor.render()); }
  setStatus("Listo. Carga una imagen de radar/satélite para comenzar (botón 'Cargar imagen').");
})();
