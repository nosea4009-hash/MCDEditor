/* fronts.js — render meteorological fronts onto a 2D canvas context */
(function (global) {
  "use strict";

  const Fronts = {};

  // Standard meteorological colors
  Fronts.COLORS = {
    cold: "#2b6cff",      // blue
    warm: "#e23b3b",      // red
    occluded: "#9b30d0",  // purple
    stationary_cold: "#2b6cff",
    stationary_warm: "#e23b3b",
    dryline: "#c8861f",   // orange/brown
    outflow: "#1f9e6b",   // teal/green
    trough: "#7a4ad0",
  };

  // Draw a filled triangle (cold-front pip) sitting on the line at sample s,
  // pointing to the chosen side. size = pip size in px.
  function drawTriangle(ctx, s, side, size, color) {
    const t = { x: s.tx, y: s.ty };
    const n = { x: -t.y * side, y: t.x * side }; // perpendicular toward side
    const base1 = { x: s.x - t.x * size * 0.5, y: s.y - t.y * size * 0.5 };
    const base2 = { x: s.x + t.x * size * 0.5, y: s.y + t.y * size * 0.5 };
    const apex = { x: s.x + n.x * size, y: s.y + n.y * size };
    ctx.beginPath();
    ctx.moveTo(base1.x, base1.y);
    ctx.lineTo(base2.x, base2.y);
    ctx.lineTo(apex.x, apex.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Draw a filled semicircle (warm-front bump) bulging to the chosen side.
  function drawSemicircle(ctx, s, side, size, color) {
    const r = size * 0.55;
    const baseAngle = Math.atan2(s.ty, s.tx);
    // The flat side lies along the tangent; bump bulges toward `side`.
    ctx.beginPath();
    // sweep direction depends on side
    if (side > 0) {
      ctx.arc(s.x, s.y, r, baseAngle, baseAngle + Math.PI, true);
    } else {
      ctx.arc(s.x, s.y, r, baseAngle, baseAngle - Math.PI, false);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Stroke a smoothed line through the given fine points.
  function strokeLine(ctx, finePts, color, width, dash) {
    if (finePts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(finePts[0].x, finePts[0].y);
    for (let i = 1; i < finePts.length; i++) ctx.lineTo(finePts[i].x, finePts[i].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Draw a front.
   * @param ctx canvas 2d context
   * @param points array of {x,y} anchor points (user clicks)
   * @param opts { type, side, lineWidth, scale }
   *   type: 'cold' | 'warm' | 'occluded' | 'stationary' | 'dryline' | 'outflow' | 'trough'
   *   side: +1 or -1 (which side the pips face)
   */
  Fronts.draw = function (ctx, points, opts) {
    opts = opts || {};
    const type = opts.type || "cold";
    const side = opts.side === -1 ? -1 : 1;
    const lineWidth = opts.lineWidth || 4;
    const scale = opts.scale || 1;
    const pipSize = 13 * scale;
    const spacing = 42 * scale;

    if (!points || points.length < 2) {
      // Not enough to render a full front; draw what we have as a thin guide
      if (points && points.length === 1) return;
      return;
    }

    const fine = Geo.smoothPath(points, 0.5);
    const samples = Geo.sampleAlong(fine, spacing);

    ctx.save();
    ctx.lineDash = [];

    if (type === "cold") {
      strokeLine(ctx, fine, Fronts.COLORS.cold, lineWidth);
      for (const s of samples) drawTriangle(ctx, s, side, pipSize, Fronts.COLORS.cold);
    } else if (type === "warm") {
      strokeLine(ctx, fine, Fronts.COLORS.warm, lineWidth);
      for (const s of samples) drawSemicircle(ctx, s, side, pipSize, Fronts.COLORS.warm);
    } else if (type === "occluded") {
      strokeLine(ctx, fine, Fronts.COLORS.occluded, lineWidth);
      samples.forEach((s, i) => {
        if (i % 2 === 0) drawTriangle(ctx, s, side, pipSize, Fronts.COLORS.occluded);
        else drawSemicircle(ctx, s, side, pipSize, Fronts.COLORS.occluded);
      });
    } else if (type === "stationary") {
      // Alternating: blue triangles on one side, red semicircles on the other.
      strokeLine(ctx, fine, Fronts.COLORS.cold, lineWidth);
      samples.forEach((s, i) => {
        if (i % 2 === 0) drawTriangle(ctx, s, side, pipSize, Fronts.COLORS.stationary_cold);
        else drawSemicircle(ctx, s, -side, pipSize, Fronts.COLORS.stationary_warm);
      });
    } else if (type === "dryline") {
      // Brown line with open scallops (semicircles) facing the dry side.
      strokeLine(ctx, fine, Fronts.COLORS.dryline, lineWidth);
      for (const s of samples) {
        const r = pipSize * 0.55;
        const baseAngle = Math.atan2(s.ty, s.tx);
        ctx.beginPath();
        if (side > 0) ctx.arc(s.x, s.y, r, baseAngle, baseAngle + Math.PI, true);
        else ctx.arc(s.x, s.y, r, baseAngle, baseAngle - Math.PI, false);
        ctx.strokeStyle = Fronts.COLORS.dryline;
        ctx.lineWidth = Math.max(2, lineWidth - 1);
        ctx.stroke();
      }
    } else if (type === "outflow") {
      // Outflow boundary: dashed teal line, no pips.
      strokeLine(ctx, fine, Fronts.COLORS.outflow, lineWidth, [lineWidth * 3, lineWidth * 2.2]);
    } else if (type === "trough") {
      // Trough: thick dashed purple line.
      strokeLine(ctx, fine, Fronts.COLORS.trough, lineWidth + 1, [lineWidth * 4, lineWidth * 2]);
    } else {
      strokeLine(ctx, fine, opts.color || "#000", lineWidth);
    }

    ctx.restore();
  };

  Fronts.LABELS = {
    cold: "Frente frío",
    warm: "Frente cálido",
    occluded: "Frente ocluido",
    stationary: "Frente estacionario",
    dryline: "Línea seca (dryline)",
    outflow: "Límite de outflow",
    trough: "Vaguada (trough)",
  };

  global.Fronts = Fronts;
})(window);
