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

  const POINT_TYPES = ["arrow", "polyline", "freehand", "polygon", "front", "isobar"];
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
    if (s.type === "station") {
      const size = s.size || 72;
      return { x: s.x - size, y: s.y - size, w: size * 2, h: size * 2 };
    }
    if (s.type === "wxsymbol") {
      const h = (s.size || 48) * 0.6;
      return { x: s.x - h, y: s.y - h, w: h * 2, h: h * 2 };
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
      case "isobar": {
        if (!s.points || s.points.length < 2) return false;
        const fine = s.smooth === false ? s.points : Geo.smoothPath(s.points, 0.5);
        return Geo.pointPolylineDistance(p, fine) <= (s.strokeWidth || 2) + tol + 4;
      }
      case "station": {
        const b = Shapes.bounds(s);
        return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      }
      case "wxsymbol": {
        const b = Shapes.bounds(s);
        return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
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

  // ---- wind barb ----
  // dirDeg = meteorological direction the wind comes FROM (0=N, 90=E).
  // southern=true mirrors the barbs (Southern-Hemisphere convention).
  function drawWindBarb(ctx, cx, cy, dirDeg, speedKt, length, color, southern) {
    speedKt = Math.max(0, Math.round((speedKt || 0) / 5) * 5);
    const ang = (dirDeg || 0) * Math.PI / 180;
    const ux = Math.sin(ang), uy = -Math.cos(ang); // toward source direction (N=up)
    const ex = cx + ux * length, ey = cy + uy * length; // staff tip away from station
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.5, length * 0.05);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (speedKt < 3) {
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, length * 0.13), 0, Math.PI * 2); ctx.stroke();
      ctx.restore(); return;
    }
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    const sx = -ux, sy = -uy;                  // tip -> station direction
    const sgn = southern ? -1 : 1;
    const px = -uy * sgn, py = ux * sgn;        // perpendicular (barb side)
    const barbLen = length * 0.42;
    const step = length * 0.15;
    const pointAt = (d) => ({ x: ex + sx * d, y: ey + sy * d });
    let cursor = 0, rem = speedKt;
    while (rem >= 50) { // pennants
      const a = pointAt(cursor), b = pointAt(cursor + step);
      const tip = { x: a.x + px * barbLen, y: a.y + py * barbLen };
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(b.x, b.y); ctx.closePath(); ctx.fill();
      cursor += step * 1.25; rem -= 50;
    }
    while (rem >= 10) { // full barbs
      const a = pointAt(cursor);
      const tip = { x: a.x + px * barbLen, y: a.y + py * barbLen };
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      cursor += step; rem -= 10;
    }
    if (rem >= 5) { // half barb
      if (cursor === 0) cursor = step;
      const a = pointAt(cursor);
      const tip = { x: a.x + px * barbLen * 0.5, y: a.y + py * barbLen * 0.5 };
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    }
    ctx.restore();
  }
  Shapes.drawWindBarb = drawWindBarb;

  // ---- sky-cover circle (oktas 0..8) ----
  function drawSkyCover(ctx, cx, cy, r, oktas, color) {
    oktas = Math.max(0, Math.min(8, oktas == null ? 0 : oktas));
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (oktas <= 0) { ctx.restore(); return; }
    if (oktas >= 8) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    const start = -Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + (oktas / 8) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- present-weather symbols (simplified) ----
  function drawPresentWx(ctx, cx, cy, sz, code, color) {
    if (!code || code === "none") return;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.4, sz * 0.08);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const dot = (x, y, rr) => { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); };
    if (code === "rain") {
      dot(cx - sz * 0.18, cy - sz * 0.05, sz * 0.09);
      dot(cx + sz * 0.18, cy - sz * 0.05, sz * 0.09);
      dot(cx, cy + sz * 0.20, sz * 0.09);
    } else if (code === "drizzle") {
      const comma = (x, y) => { ctx.beginPath(); ctx.arc(x, y, sz * 0.08, Math.PI * 0.2, Math.PI * 1.4); ctx.stroke(); };
      comma(cx - sz * 0.16, cy); comma(cx + sz * 0.16, cy); comma(cx, cy + sz * 0.22);
    } else if (code === "snow") {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        ctx.moveTo(cx - Math.cos(a) * sz * 0.22, cy - Math.sin(a) * sz * 0.22);
        ctx.lineTo(cx + Math.cos(a) * sz * 0.22, cy + Math.sin(a) * sz * 0.22);
      }
      ctx.stroke();
    } else if (code === "showers") {
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz * 0.24); ctx.lineTo(cx - sz * 0.20, cy + sz * 0.12); ctx.lineTo(cx + sz * 0.20, cy + sz * 0.12);
      ctx.closePath(); ctx.fill();
      dot(cx, cy + sz * 0.26, sz * 0.08);
    } else if (code === "tstorm") {
      ctx.beginPath();
      ctx.moveTo(cx - sz * 0.12, cy - sz * 0.26);
      ctx.lineTo(cx + sz * 0.06, cy - sz * 0.26);
      ctx.lineTo(cx - sz * 0.04, cy + sz * 0.02);
      ctx.lineTo(cx + sz * 0.14, cy + sz * 0.02);
      ctx.lineTo(cx - sz * 0.10, cy + sz * 0.30);
      ctx.lineTo(cx - sz * 0.02, cy + sz * 0.06);
      ctx.lineTo(cx - sz * 0.16, cy + sz * 0.06);
      ctx.closePath(); ctx.fill();
    } else if (code === "fog") {
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        const y = cy + i * sz * 0.16;
        ctx.moveTo(cx - sz * 0.24, y); ctx.lineTo(cx + sz * 0.24, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- station model ----
  function drawStation(ctx, s) {
    const size = s.size || 72;
    const cx = s.x, cy = s.y;
    const color = s.color || "#111111";
    const r = size * 0.16;
    drawWindBarb(ctx, cx, cy, s.windDir || 0, s.windSpeed || 0, size * 0.85, color, s.hemisphere === "S");
    drawSkyCover(ctx, cx, cy, r, s.cover == null ? 0 : s.cover, color);
    const ts = Math.max(9, size * 0.2);
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(ts)}px Arial`;
    ctx.textBaseline = "middle";
    const dx = size * 0.30, dy = size * 0.24;
    if (s.temp !== "" && s.temp != null) { ctx.textAlign = "right"; ctx.fillText(String(s.temp), cx - dx, cy - dy); }
    if (s.dewpoint !== "" && s.dewpoint != null) { ctx.textAlign = "right"; ctx.fillText(String(s.dewpoint), cx - dx, cy + dy); }
    if (s.pressure !== "" && s.pressure != null) { ctx.textAlign = "left"; ctx.fillText(String(s.pressure), cx + dx, cy - dy); }
    drawPresentWx(ctx, cx - dx - ts * 0.7, cy, ts * 1.1, s.presentWx, color);
  }
  Shapes.drawStation = drawStation;

  // ---- hatch fill (caller must set the clip path first) ----
  function drawHatch(ctx, b, style, gap, color, width) {
    gap = Math.max(3, gap || 10);
    ctx.save();
    ctx.strokeStyle = color || "#d11111";
    ctx.lineWidth = width || 1.5;
    ctx.beginPath();
    const x = b.x, y = b.y, x1 = b.x + b.w, y1 = b.y + b.h, w = b.w, h = b.h;
    const diag = (sign) => {
      for (let d = -h; d <= w; d += gap) {
        if (sign > 0) { ctx.moveTo(x + d, y1); ctx.lineTo(x + d + h, y1 - h); }
        else { ctx.moveTo(x + d, y); ctx.lineTo(x + d + h, y + h); }
      }
    };
    if (style === "horizontal") { for (let yy = y; yy <= y1; yy += gap) { ctx.moveTo(x, yy); ctx.lineTo(x1, yy); } }
    else if (style === "vertical") { for (let xx = x; xx <= x1; xx += gap) { ctx.moveTo(xx, y); ctx.lineTo(xx, y1); } }
    else if (style === "diagonal") { diag(1); }
    else if (style === "diagonal2") { diag(-1); }
    else if (style === "cross") { diag(1); diag(-1); }
    ctx.stroke();
    ctx.restore();
  }
  Shapes.drawHatch = drawHatch;

  // ---- synoptic thunderstorm symbol (R-shape with lightning arrow) ----
  function drawThunderstormR(ctx, cx, cy, sz, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, sz * 0.1);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const x0 = cx - sz * 0.28;
    const top = cy - sz * 0.5, bot = cy + sz * 0.5, mid = cy;
    // stem
    ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bot); ctx.stroke();
    // bowl (top half of the R)
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(cx + sz * 0.05, top);
    ctx.quadraticCurveTo(cx + sz * 0.32, top, cx + sz * 0.32, (top + mid) / 2);
    ctx.quadraticCurveTo(cx + sz * 0.32, mid, cx + sz * 0.05, mid);
    ctx.lineTo(x0, mid);
    ctx.stroke();
    // leg
    ctx.beginPath(); ctx.moveTo(cx + sz * 0.02, mid); ctx.lineTo(cx + sz * 0.30, bot); ctx.stroke();
    // lightning arrowhead at the leg tip (points down)
    const ax = cx + sz * 0.30, ay = bot;
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(ax - sz * 0.16, ay - sz * 0.03);
    ctx.moveTo(ax, ay); ctx.lineTo(ax - sz * 0.03, ay - sz * 0.18);
    ctx.stroke();
    ctx.restore();
  }
  Shapes.drawThunderstormR = drawThunderstormR;

  // ---- standalone weather symbol ----
  function drawWxSymbol(ctx, s) {
    const sz = s.size || 48;
    const color = s.color || "#d11111";
    const code = s.symbol || "thunderstorm";
    if (code === "thunderstorm") { drawThunderstormR(ctx, s.x, s.y, sz, color); return; }
    if (code === "tstorm-bolt") { drawPresentWx(ctx, s.x, s.y, sz, "tstorm", color); return; }
    drawPresentWx(ctx, s.x, s.y, sz, code, color);
  }
  Shapes.drawWxSymbol = drawWxSymbol;

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
        if (s.haloColor && (s.haloWidth || 0) > 0) {
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
        const poly = () => {
          ctx.beginPath();
          ctx.moveTo(s.points[0].x, s.points[0].y);
          for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
          ctx.closePath();
        };
        poly();
        if (s.fill && s.fill !== "none") { ctx.fillStyle = s.fill; ctx.fill(); }
        if (s.hatch && s.hatch !== "none") {
          ctx.save();
          poly(); ctx.clip();
          drawHatch(ctx, Geo.bbox(s.points), s.hatch, s.hatchGap, s.hatchColor, s.hatchWidth);
          ctx.restore();
        }
        if (s.stroke && s.stroke !== "none") {
          poly();
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
      case "station": {
        drawStation(ctx, s);
        break;
      }
      case "isobar": {
        if (!s.points || s.points.length < 2) break;
        const fine = s.smooth === false ? s.points : Geo.smoothPath(s.points, 0.5);
        ctx.beginPath();
        ctx.moveTo(fine[0].x, fine[0].y);
        for (let i = 1; i < fine.length; i++) ctx.lineTo(fine[i].x, fine[i].y);
        ctx.strokeStyle = s.stroke || "#333333";
        ctx.lineWidth = s.strokeWidth || 2;
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        const lw = s.strokeWidth || 2;
        ctx.setLineDash(s.dash ? [Math.max(8, lw * 3), lw * 2] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        if (s.label != null && String(s.label) !== "") {
          const ls = s.labelSize || 14;
          ctx.font = `bold ${ls}px Arial`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          const ends = [fine[0], fine[fine.length - 1]];
          for (const pt of ends) {
            ctx.lineWidth = Math.max(3, ls * 0.28);
            ctx.strokeStyle = "#ffffff";
            ctx.strokeText(String(s.label), pt.x, pt.y);
            ctx.fillStyle = s.stroke || "#333333";
            ctx.fillText(String(s.label), pt.x, pt.y);
          }
        }
        break;
      }
      case "wxsymbol": {
        drawWxSymbol(ctx, s);
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
          hatch: style.hatch || "none", hatchColor: style.hatchColor || "#d11111",
          hatchGap: style.hatchGap || 10, hatchWidth: style.hatchWidth || 1.5,
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
      case "station":
        return Object.assign(base, {
          x: 0, y: 0, size: style.stationSize || 72,
          temp: "12", dewpoint: "9", pressure: "132",
          cover: 4, presentWx: "none",
          windDir: 320, windSpeed: 15,
          hemisphere: style.hemisphere || "S",
          color: "#111111",
        });
      case "isobar":
        return Object.assign(base, {
          points: [], stroke: style.isobarColor || "#7a4a00", strokeWidth: style.strokeWidth || 2,
          dash: false, smooth: true, label: "", labelSize: 14,
        });
      case "wxsymbol":
        return Object.assign(base, {
          x: 0, y: 0, symbol: style.wxSymbol || "thunderstorm",
          size: style.wxSize || 48, color: style.wxColor || "#d11111",
        });
      default:
        return base;
    }
  };

  global.Shapes = Shapes;
})(window);
