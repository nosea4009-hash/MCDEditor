/* shapes.js — shape model: rendering, hit-testing, bounds, movement */
(function (global) {
  "use strict";

  const Shapes = {};

  // hidden canvas used to measure text
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");

  let _idCounter = 1;
  Shapes.newId = () => "obj_" + _idCounter++ + "_" + Math.random().toString(36).slice(2, 7);

  Shapes.fontString = function (s) {
    const style = s.italic ? "italic " : "";
    const weight = s.bold ? "bold " : "";
    return `${style}${weight}${s.fontSize || 18}px ${s.fontFamily || "Arial"}`;
  };

  // Wrap text into lines that fit within maxWidth (px). Respects explicit newlines.
  Shapes.wrapText = function (ctx, text, maxWidth) {
    const out = [];
    const paragraphs = String(text == null ? "" : text).split("\n");
    for (const para of paragraphs) {
      if (para === "") { out.push(""); continue; }
      const words = para.split(/(\s+)/); // keep spaces
      let line = "";
      for (const w of words) {
        const test = line + w;
        if (ctx.measureText(test).width > maxWidth && line !== "") {
          out.push(line.replace(/\s+$/, ""));
          line = w.replace(/^\s+/, "");
        } else {
          line = test;
        }
      }
      out.push(line.replace(/\s+$/, ""));
    }
    return out;
  };

  // ---- normalized box (handles negative width/height) ----
  function normBox(s) {
    let x = s.x, y = s.y, w = s.w, h = s.h;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    return { x, y, w, h };
  }
  Shapes.normBox = normBox;

  const POINT_TYPES = ["arrow", "polyline", "freehand", "polygon", "front"];
  Shapes.isPointBased = (s) => POINT_TYPES.includes(s.type);

  // ---- bounds ----
  Shapes.bounds = function (s) {
    if (Shapes.isPointBased(s)) {
      if (!s.points || s.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      return Geo.bbox(s.points);
    }
    if (s.type === "text") {
      measureCtx.font = Shapes.fontString(s);
      const lines = String(s.text || "").split("\n");
      let maxW = 0;
      for (const ln of lines) maxW = Math.max(maxW, measureCtx.measureText(ln || " ").width);
      const lh = (s.fontSize || 18) * 1.25;
      return { x: s.x, y: s.y, w: maxW + 4, h: lh * lines.length + 4 };
    }
    return normBox(s);
  };

  // ---- movement ----
  Shapes.move = function (s, dx, dy) {
    if (Shapes.isPointBased(s)) {
      for (const p of s.points) { p.x += dx; p.y += dy; }
    } else {
      s.x += dx; s.y += dy;
    }
  };

  // ---- hit testing ----
  Shapes.hitTest = function (s, p, tol) {
    tol = tol || 6;
    switch (s.type) {
      case "image":
      case "rect":
      case "textbox": {
        const b = normBox(s);
        return p.x >= b.x - tol && p.x <= b.x + b.w + tol &&
               p.y >= b.y - tol && p.y <= b.y + b.h + tol;
      }
      case "text": {
        const b = Shapes.bounds(s);
        return p.x >= b.x - tol && p.x <= b.x + b.w + tol &&
               p.y >= b.y - tol && p.y <= b.y + b.h + tol;
      }
      case "ellipse": {
        const b = normBox(s);
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        const rx = b.w / 2 + tol, ry = b.h / 2 + tol;
        if (rx <= 0 || ry <= 0) return false;
        const v = ((p.x - cx) ** 2) / (rx * rx) + ((p.y - cy) ** 2) / (ry * ry);
        return v <= 1;
      }
      case "polygon": {
        if (Geo.pointInPolygon(p, s.points)) return true;
        // also near edges
        const closed = s.points.concat([s.points[0]]);
        return Geo.pointPolylineDistance(p, closed) <= (s.strokeWidth || 2) + tol;
      }
      case "arrow":
      case "polyline":
      case "freehand":
        return Geo.pointPolylineDistance(p, s.points) <= (s.strokeWidth || 3) + tol;
      case "front": {
        const fine = Geo.smoothPath(s.points, 0.5);
        return Geo.pointPolylineDistance(p, fine) <= (s.lineWidth || 4) + tol + 6;
      }
      default:
        return false;
    }
  };

  // ---- arrowhead helper ----
  function drawArrowHead(ctx, from, to, size, color) {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const a1 = ang + Math.PI - 0.45;
    const a2 = ang + Math.PI + 0.45;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x + Math.cos(a1) * size, to.y + Math.sin(a1) * size);
    ctx.lineTo(to.x + Math.cos(a2) * size, to.y + Math.sin(a2) * size);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ---- rendering ----
  Shapes.draw = function (ctx, s) {
    ctx.save();
    ctx.globalAlpha = s.opacity == null ? 1 : s.opacity;

    switch (s.type) {
      case "image": {
        const b = normBox(s);
        if (s._img && s._img.complete) {
          ctx.drawImage(s._img, b.x, b.y, b.w, b.h);
        } else {
          ctx.fillStyle = "#dfe6ee";
          ctx.fillRect(b.x, b.y, b.w, b.h);
        }
        break;
      }
      case "rect": {
        const b = normBox(s);
        if (s.fill && s.fill !== "none") { ctx.fillStyle = s.fill; ctx.fillRect(b.x, b.y, b.w, b.h); }
        if (s.stroke && s.stroke !== "none") {
          ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 2;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
        break;
      }
      case "ellipse": {
        const b = normBox(s);
        ctx.beginPath();
        ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, Math.abs(b.w / 2), Math.abs(b.h / 2), 0, 0, Math.PI * 2);
        if (s.fill && s.fill !== "none") { ctx.fillStyle = s.fill; ctx.fill(); }
        if (s.stroke && s.stroke !== "none") {
          ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 2; ctx.stroke();
        }
        break;
      }
      case "textbox": {
        const b = normBox(s);
        const pad = s.padding == null ? 8 : s.padding;
        // box
        if (s.fill && s.fill !== "none") { ctx.fillStyle = s.fill; ctx.fillRect(b.x, b.y, b.w, b.h); }
        if (s.stroke && s.stroke !== "none") {
          ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 2;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
        // text
        ctx.font = Shapes.fontString(s);
        ctx.fillStyle = s.textColor || "#111";
        ctx.textBaseline = "top";
        ctx.textAlign = s.align || "left";
        const lines = Shapes.wrapText(ctx, s.text, b.w - pad * 2);
        const lh = (s.fontSize || 16) * 1.3;
        let tx = b.x + pad;
        if (s.align === "center") tx = b.x + b.w / 2;
        else if (s.align === "right") tx = b.x + b.w - pad;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], tx, b.y + pad + i * lh);
        }
        break;
      }
      case "text": {
        ctx.font = Shapes.fontString(s);
        ctx.fillStyle = s.color || "#111";
        ctx.textBaseline = "top";
        ctx.textAlign = s.align || "left";
        const lines = String(s.text || "").split("\n");
        const lh = (s.fontSize || 18) * 1.25;
        let tx = s.x;
        if (s.haloColor) {
          ctx.lineWidth = (s.haloWidth || 3);
          ctx.strokeStyle = s.haloColor;
          ctx.lineJoin = "round";
          for (let i = 0; i < lines.length; i++) ctx.strokeText(lines[i], tx, s.y + i * lh);
        }
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], tx, s.y + i * lh);
        break;
      }
      case "polygon": {
        if (!s.points || s.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.closePath();
        if (s.fill && s.fill !== "none") { ctx.fillStyle = s.fill; ctx.fill(); }
        if (s.stroke && s.stroke !== "none") {
          ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 2;
          ctx.setLineDash(s.dash || []);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case "polyline":
      case "freehand": {
        if (!s.points || s.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.strokeStyle = s.stroke || "#111";
        ctx.lineWidth = s.strokeWidth || 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.setLineDash(s.dash || []);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "arrow": {
        if (!s.points || s.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.strokeStyle = s.stroke || "#111";
        ctx.lineWidth = s.strokeWidth || 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
        const n = s.points.length;
        const head = Math.max(10, (s.strokeWidth || 3) * 3);
        drawArrowHead(ctx, s.points[n - 2], s.points[n - 1], head, s.stroke || "#111");
        if (s.doubleHead) drawArrowHead(ctx, s.points[1], s.points[0], head, s.stroke || "#111");
        break;
      }
      case "front": {
        Fronts.draw(ctx, s.points, {
          type: s.frontType,
          side: s.side,
          lineWidth: s.lineWidth,
          scale: s.scale,
        });
        break;
      }
    }
    ctx.restore();
  };

  // ---- defaults for new shapes, given current style settings ----
  Shapes.create = function (type, style) {
    style = style || {};
    const base = { id: Shapes.newId(), type, opacity: 1 };
    switch (type) {
      case "text":
        return Object.assign(base, {
          x: 0, y: 0, text: "Texto",
          fontFamily: style.fontFamily || "Arial",
          fontSize: style.fontSize || 22,
          color: style.textColor || "#111111",
          bold: !!style.bold, italic: !!style.italic,
          align: "left",
          haloColor: "#ffffff", haloWidth: 3,
        });
      case "textbox":
        return Object.assign(base, {
          x: 0, y: 0, w: 220, h: 90, text: "1",
          fontFamily: style.fontFamily || "Arial",
          fontSize: style.fontSize || 16,
          textColor: style.textColor || "#111111",
          fill: "#ffffff", stroke: "#e11414", strokeWidth: 3,
          bold: false, align: "left", padding: 8,
        });
      case "rect":
        return Object.assign(base, {
          x: 0, y: 0, w: 120, h: 80,
          fill: "none", stroke: style.stroke || "#e11414", strokeWidth: style.strokeWidth || 3,
        });
      case "ellipse":
        return Object.assign(base, {
          x: 0, y: 0, w: 120, h: 90,
          fill: "none", stroke: style.stroke || "#e11414", strokeWidth: style.strokeWidth || 3,
        });
      case "polygon":
        return Object.assign(base, {
          points: [],
          fill: "rgba(255,210,0,0.18)", stroke: style.stroke || "#d11", strokeWidth: style.strokeWidth || 3,
          dash: [],
        });
      case "polyline":
        return Object.assign(base, {
          points: [], stroke: style.stroke || "#111111", strokeWidth: style.strokeWidth || 3, dash: [],
        });
      case "freehand":
        return Object.assign(base, {
          points: [], stroke: style.stroke || "#111111", strokeWidth: style.strokeWidth || 3,
        });
      case "arrow":
        return Object.assign(base, {
          points: [], stroke: style.stroke || "#111111", strokeWidth: style.strokeWidth || 4, doubleHead: false,
        });
      case "front":
        return Object.assign(base, {
          points: [], frontType: style.frontType || "cold", side: style.side || 1,
          lineWidth: style.lineWidth || 4, scale: style.scale || 1,
        });
      default:
        return base;
    }
  };

  global.Shapes = Shapes;
})(window);
