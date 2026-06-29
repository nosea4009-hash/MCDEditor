/* editor.js — canvas editor core: tools, selection, transforms, history */
(function (global) {
  "use strict";

  function Editor() {
    this.canvas = null;
    this.ctx = null;
    this.objects = [];
    this.selectedId = null;
    this.tool = "select";
    this.style = {
      stroke: "#111111",
      strokeWidth: 3,
      fontFamily: "Arial",
      fontSize: 22,
      textColor: "#111111",
      bold: false,
      italic: false,
      frontType: "cold",
      side: 1,
      lineWidth: 4,
      scale: 1,
    };
    this.history = [];
    this.future = [];
    this.draft = null;        // multi-point draft shape
    this.draftPreview = null; // cursor preview point
    this.drag = null;         // active drag operation
    this._screenScale = 1;
    this._rafPending = false;
    this.onChange = null;     // callback() for UI sync
    this.onStatus = null;     // callback(msg)
  }

  Editor.prototype.init = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this._bindEvents();
    this.pushHistory();
    this.render();
  };

  // ---------- coordinate mapping ----------
  Editor.prototype.toCanvas = function (clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (this.canvas.width / r.width),
      y: (clientY - r.top) * (this.canvas.height / r.height),
    };
  };

  Editor.prototype._updateScreenScale = function () {
    const r = this.canvas.getBoundingClientRect();
    this._screenScale = r.width / this.canvas.width || 1;
  };

  // ---------- history ----------
  Editor.prototype.serializeObjects = function () {
    return this.objects.map((o) => {
      const c = Object.assign({}, o);
      delete c._img;
      return c;
    });
  };

  Editor.prototype.pushHistory = function () {
    this.history.push(JSON.stringify(this.serializeObjects()));
    if (this.history.length > 100) this.history.shift();
    this.future = [];
  };

  Editor.prototype._restore = function (json) {
    const data = JSON.parse(json);
    this.objects = data.map((o) => this._reattach(o));
    if (!this.objects.find((o) => o.id === this.selectedId)) this.selectedId = null;
    this.render();
    this._emitChange();
  };

  Editor.prototype._reattach = function (o) {
    if (o.type === "image" && o.src) {
      const img = new Image();
      img.onload = () => this.render();
      img.src = o.src;
      o._img = img;
    }
    return o;
  };

  Editor.prototype.undo = function () {
    if (this.history.length <= 1) return;
    this.future.push(this.history.pop());
    this._restore(this.history[this.history.length - 1]);
  };

  Editor.prototype.redo = function () {
    if (!this.future.length) return;
    const json = this.future.pop();
    this.history.push(json);
    this._restore(json);
  };

  // ---------- object management ----------
  Editor.prototype.add = function (shape, opts) {
    this.objects.push(shape);
    if (!opts || opts.select !== false) this.selectedId = shape.id;
    this.pushHistory();
    this.render();
    this._emitChange();
    return shape;
  };

  Editor.prototype.getSelected = function () {
    return this.objects.find((o) => o.id === this.selectedId) || null;
  };

  Editor.prototype.select = function (id) {
    this.selectedId = id;
    this.render();
    this._emitChange();
  };

  Editor.prototype.updateSelected = function (props, commit) {
    const s = this.getSelected();
    if (!s) return;
    Object.assign(s, props);
    this.render();
    if (commit) { this.pushHistory(); }
    this._emitChange();
  };

  Editor.prototype.deleteSelected = function () {
    if (!this.selectedId) return;
    this.objects = this.objects.filter((o) => o.id !== this.selectedId);
    this.selectedId = null;
    this.pushHistory();
    this.render();
    this._emitChange();
  };

  Editor.prototype.duplicateSelected = function () {
    const s = this.getSelected();
    if (!s) return;
    const copy = JSON.parse(JSON.stringify(Object.assign({}, s, { _img: undefined })));
    delete copy._img;
    copy.id = Shapes.newId();
    Shapes.move(copy, 24, 24);
    this._reattach(copy);
    this.objects.push(copy);
    this.selectedId = copy.id;
    this.pushHistory();
    this.render();
    this._emitChange();
  };

  Editor.prototype.reorder = function (dir) {
    const i = this.objects.findIndex((o) => o.id === this.selectedId);
    if (i < 0) return;
    const [obj] = this.objects.splice(i, 1);
    if (dir === "front") this.objects.push(obj);
    else if (dir === "back") this.objects.unshift(obj);
    else if (dir === "forward") this.objects.splice(Math.min(this.objects.length, i + 1), 0, obj);
    else if (dir === "backward") this.objects.splice(Math.max(0, i - 1), 0, obj);
    this.pushHistory();
    this.render();
    this._emitChange();
  };

  Editor.prototype.clearAnnotations = function () {
    this.objects = this.objects.filter((o) => o.type === "image");
    this.selectedId = null;
    this.pushHistory();
    this.render();
    this._emitChange();
  };

  Editor.prototype.clearAll = function () {
    this.objects = [];
    this.selectedId = null;
    this.pushHistory();
    this.render();
    this._emitChange();
  };

  // ---------- image / canvas sizing ----------
  Editor.prototype.loadImageAsBackground = function (dataURL) {
    const img = new Image();
    img.onload = () => {
      const maxW = 1800, maxH = 1400;
      let w = img.naturalWidth, h = img.naturalHeight;
      const ratio = Math.min(1, maxW / w, maxH / h);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
      this.canvas.width = w;
      this.canvas.height = h;
      // remove existing background images, add new at the back
      this.objects = this.objects.filter((o) => o.type !== "image");
      const shape = Shapes.create("image", {});
      Object.assign(shape, { x: 0, y: 0, w, h, src: dataURL, _img: img });
      this.objects.unshift(shape);
      this.selectedId = null;
      this.pushHistory();
      this.render();
      this._emitChange();
      if (this.onStatus) this.onStatus(`Imagen cargada (${w}×${h}px).`);
    };
    img.src = dataURL;
  };

  Editor.prototype.setCanvasSize = function (w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.render();
  };

  // ---------- rendering ----------
  Editor.prototype.render = function () {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      this._draw();
    });
  };

  Editor.prototype._draw = function () {
    const ctx = this.ctx;
    this._updateScreenScale();
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // white backdrop when no image fills it
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const o of this.objects) Shapes.draw(ctx, o);

    // draft preview
    if (this.draft) {
      const preview = Object.assign({}, this.draft);
      preview.points = this.draft.points.slice();
      if (this.draftPreview) preview.points.push(this.draftPreview);
      Shapes.draw(ctx, preview);
      this._drawDraftVertices(ctx, preview.points);
    }

    // selection overlay
    const sel = this.getSelected();
    if (sel && this.tool === "select") this._drawSelection(ctx, sel);
    ctx.restore();
  };

  Editor.prototype._drawDraftVertices = function (ctx, pts) {
    const r = 4 / this._screenScale;
    ctx.fillStyle = "#1769ff";
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  Editor.prototype._handleRects = function (s) {
    const b = Shapes.bounds(s);
    const hs = 5 / this._screenScale;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, ex = b.x + b.w, ey = b.y + b.h;
    return [
      { name: "nw", x: b.x, y: b.y },
      { name: "n", x: cx, y: b.y },
      { name: "ne", x: ex, y: b.y },
      { name: "e", x: ex, y: cy },
      { name: "se", x: ex, y: ey },
      { name: "s", x: cx, y: ey },
      { name: "sw", x: b.x, y: ey },
      { name: "w", x: b.x, y: cy },
    ].map((h) => ({ name: h.name, x: h.x, y: h.y, r: hs }));
  };

  Editor.prototype._drawSelection = function (ctx, s) {
    const b = Shapes.bounds(s);
    ctx.save();
    ctx.strokeStyle = "#1769ff";
    ctx.lineWidth = 1.5 / this._screenScale;
    ctx.setLineDash([6 / this._screenScale, 4 / this._screenScale]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);

    if (Shapes.isPointBased(s)) {
      // vertex handles
      const r = 5 / this._screenScale;
      for (const p of s.points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#1769ff";
        ctx.lineWidth = 1.5 / this._screenScale;
        ctx.stroke();
      }
    } else if (s.type !== "station") {
      for (const h of this._handleRects(s)) {        ctx.beginPath();
        ctx.rect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#1769ff";
        ctx.lineWidth = 1.5 / this._screenScale;
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  // ---------- hit testing helpers ----------
  Editor.prototype._topAt = function (p) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      if (Shapes.hitTest(this.objects[i], p, 6 / this._screenScale)) return this.objects[i];
    }
    return null;
  };

  Editor.prototype._handleAt = function (s, p) {
    const tol = 7 / this._screenScale;
    if (Shapes.isPointBased(s)) {
      for (let i = 0; i < s.points.length; i++) {
        if (Geo.dist(p, s.points[i]) <= tol) return { vertex: i };
      }
      return null;
    }
    if (s.type === "station") return null;
    for (const h of this._handleRects(s)) {
      if (Math.abs(p.x - h.x) <= tol && Math.abs(p.y - h.y) <= tol) return { handle: h.name };
    }
    return null;
  };

  // ---------- event binding ----------
  Editor.prototype._bindEvents = function () {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this._onDown(e));
    c.addEventListener("pointermove", (e) => this._onMove(e));
    window.addEventListener("pointerup", (e) => this._onUp(e));
    c.addEventListener("dblclick", (e) => this._onDblClick(e));
  };

  Editor.prototype._onDown = function (e) {
    e.preventDefault();
    this._updateScreenScale();
    const p = this.toCanvas(e.clientX, e.clientY);
    const tool = this.tool;

    // multi-point tools accumulate via clicks
    if (["polyline", "polygon", "front"].includes(tool)) {
      if (!this.draft) {
        this.draft = Shapes.create(tool, this.style);
        this.draft.points = [];
      }
      this.draft.points.push({ x: p.x, y: p.y });
      this.draftPreview = { x: p.x, y: p.y };
      this.render();
      return;
    }

    if (tool === "select") {
      const sel = this.getSelected();
      if (sel) {
        const h = this._handleAt(sel, p);
        if (h) {
          this.drag = { mode: "transform", h, startBox: Shapes.bounds(sel), startPts: JSON.parse(JSON.stringify(sel.points || null)), last: p, moved: false };
          try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
          return;
        }
      }
      const hit = this._topAt(p);
      this.selectedId = hit ? hit.id : null;
      if (hit) {
        this.drag = { mode: "move", last: p, moved: false };
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      }
      this.render();
      this._emitChange();
      return;
    }

    // drag-to-create tools
    if (["rect", "ellipse", "textbox", "arrow", "freehand"].includes(tool)) {
      const s = Shapes.create(tool, this.style);
      if (tool === "arrow" || tool === "freehand") {
        s.points = [{ x: p.x, y: p.y }];
        if (tool === "arrow") s.points.push({ x: p.x, y: p.y });
      } else {
        s.x = p.x; s.y = p.y; s.w = 1; s.h = 1;
      }
      this.objects.push(s);
      this.selectedId = s.id;
      this.drag = { mode: "create", tool, start: p, last: p };
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      this.render();
      return;
    }

    if (tool === "text" || tool === "place-textbox") {
      const s = Shapes.create(tool === "text" ? "text" : "textbox", this.style);
      if (s.type === "text") { s.x = p.x; s.y = p.y; }
      else { s.x = p.x; s.y = p.y; }
      this.objects.push(s);
      this.selectedId = s.id;
      this.pushHistory();
      this.render();
      this._emitChange();
      this.setTool("select");
      if (this.onEditText) this.onEditText(s);
      return;
    }

    if (tool === "station") {
      const s = Shapes.create("station", this.style);
      s.x = p.x; s.y = p.y;
      this.objects.push(s);
      this.selectedId = s.id;
      this.pushHistory();
      this.render();
      this._emitChange();
      this.setTool("select");
      return;
    }
  };

  Editor.prototype._onMove = function (e) {
    const p = this.toCanvas(e.clientX, e.clientY);

    if (this.draft) {
      this.draftPreview = { x: p.x, y: p.y };
      this.render();
      return;
    }

    if (!this.drag) {
      // cursor feedback could go here
      return;
    }

    const d = this.drag;
    const sel = this.getSelected();

    if (d.mode === "create" && sel) {
      if (d.tool === "arrow") {
        sel.points[1] = { x: p.x, y: p.y };
        if (e.shiftKey) sel.points[1] = this._constrain(sel.points[0], p);
      } else if (d.tool === "freehand") {
        const last = sel.points[sel.points.length - 1];
        if (Geo.dist(last, p) > 2) sel.points.push({ x: p.x, y: p.y });
      } else {
        sel.w = p.x - sel.x;
        sel.h = p.y - sel.y;
        if (e.shiftKey) { const m = Math.max(Math.abs(sel.w), Math.abs(sel.h)); sel.w = Math.sign(sel.w || 1) * m; sel.h = Math.sign(sel.h || 1) * m; }
      }
      this.render();
      return;
    }

    if (d.mode === "move" && sel) {
      const dx = p.x - d.last.x, dy = p.y - d.last.y;
      Shapes.move(sel, dx, dy);
      d.last = p; d.moved = true;
      this.render();
      return;
    }

    if (d.mode === "transform" && sel) {
      if (d.h.vertex != null) {
        sel.points[d.h.vertex] = { x: p.x, y: p.y };
      } else {
        this._resizeBox(sel, d.h.handle, d.startBox, p, e.shiftKey);
      }
      d.moved = true;
      this.render();
      return;
    }
  };

  Editor.prototype._onUp = function (e) {
    if (this.drag) {
      const d = this.drag;
      const sel = this.getSelected();
      if (d.mode === "create" && sel) {
        // discard degenerate shapes
        const b = Shapes.bounds(sel);
        const tiny = (b.w < 3 && b.h < 3);
        if ((sel.type === "rect" || sel.type === "ellipse" || sel.type === "textbox") && tiny) {
          // give a default size if just a click
          sel.w = sel.type === "textbox" ? 220 : 120;
          sel.h = sel.type === "textbox" ? 90 : 80;
        }
        this.pushHistory();
        if (sel.type === "textbox" && this.onEditText) this.onEditText(sel);
        this.setTool("select");
        this._emitChange();
      } else if (d.moved) {
        this.pushHistory();
      }
      this.drag = null;
      this.render();
    }
  };

  Editor.prototype._onDblClick = function (e) {
    const p = this.toCanvas(e.clientX, e.clientY);
    if (this.draft) { this._finishDraft(); return; }
    const hit = this._topAt(p);
    if (hit && (hit.type === "text" || hit.type === "textbox")) {
      this.selectedId = hit.id;
      this.render();
      this._emitChange();
      if (this.onEditText) this.onEditText(hit);
    }
  };

  Editor.prototype._constrain = function (a, b) {
    // snap to 0/45/90 degrees
    const dx = b.x - a.x, dy = b.y - a.y;
    const ang = Math.atan2(dy, dx);
    const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(dx, dy);
    return { x: a.x + Math.cos(snap) * len, y: a.y + Math.sin(snap) * len };
  };

  Editor.prototype._resizeBox = function (s, handle, start, p, keepAspect) {
    let x = start.x, y = start.y, w = start.w, h = start.h;
    const right = x + w, bottom = y + h;
    if (handle.includes("w")) { x = p.x; w = right - p.x; }
    if (handle.includes("e")) { w = p.x - x; }
    if (handle.includes("n")) { y = p.y; h = bottom - p.y; }
    if (handle.includes("s")) { h = p.y - y; }
    if (keepAspect && start.w && start.h) {
      const ar = start.w / start.h;
      if (Math.abs(w) / ar > Math.abs(h)) h = Math.sign(h || 1) * Math.abs(w) / ar;
      else w = Math.sign(w || 1) * Math.abs(h) * ar;
    }
    s.x = x; s.y = y; s.w = w; s.h = h;
  };

  // ---------- draft finishing ----------
  Editor.prototype._finishDraft = function () {
    if (!this.draft) return;
    const d = this.draft;
    // need minimum points
    const min = d.type === "polygon" ? 3 : 2;
    if (d.points.length >= min) {
      this.objects.push(d);
      this.selectedId = d.id;
      this.pushHistory();
    }
    this.draft = null;
    this.draftPreview = null;
    this.setTool("select");
    this.render();
    this._emitChange();
  };

  Editor.prototype.cancelDraft = function () {
    this.draft = null;
    this.draftPreview = null;
    this.render();
  };

  // ---------- tools ----------
  Editor.prototype.setTool = function (tool) {
    if (this.draft && tool !== this.tool) this.cancelDraft();
    this.tool = tool;
    if (tool !== "select") { /* keep selection visible only in select mode */ }
    this.render();
    if (this.onToolChange) this.onToolChange(tool);
  };

  Editor.prototype.setStyle = function (partial) {
    Object.assign(this.style, partial);
  };

  // ---------- export / project ----------
  Editor.prototype.exportPNG = function (filename) {
    const prevSel = this.selectedId;
    const prevTool = this.tool;
    this.selectedId = null;
    this.tool = "export";
    this._draw(); // draw without selection overlay synchronously
    const url = this.canvas.toDataURL("image/png");
    this.selectedId = prevSel;
    this.tool = prevTool;
    this.render();
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "discusion-mesoescala.png";
    a.click();
  };

  Editor.prototype.exportProject = function () {
    const data = {
      version: 1,
      width: this.canvas.width,
      height: this.canvas.height,
      objects: this.serializeObjects(),
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mcd-proyecto.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  Editor.prototype.loadProject = function (data) {
    if (!data || !data.objects) return;
    if (data.width && data.height) this.setCanvasSize(data.width, data.height);
    this.objects = data.objects.map((o) => this._reattach(o));
    this.selectedId = null;
    this.history = [];
    this.future = [];
    this.pushHistory();
    this.render();
    this._emitChange();
  };

  Editor.prototype._emitChange = function () {
    if (this.onChange) this.onChange();
  };

  global.Editor = Editor;
})(window);
