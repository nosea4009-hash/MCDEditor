/* geometry.js — vector math & path helpers (no dependencies) */
(function (global) {
  "use strict";

  const Geo = {};

  // ---- basic vector helpers ----
  Geo.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  Geo.lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  Geo.sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  Geo.add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  Geo.scale = (a, s) => ({ x: a.x * s, y: a.y * s });

  Geo.norm = (v) => {
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / len, y: v.y / len };
  };

  // perpendicular (rotate 90deg CCW)
  Geo.perp = (v) => ({ x: -v.y, y: v.x });

  // rotate point p around center c by angle (radians)
  Geo.rotate = (p, c, ang) => {
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const dx = p.x - c.x, dy = p.y - c.y;
    return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
  };

  // ---- distance from point to segment ----
  Geo.pointSegmentDistance = function (p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Geo.dist(p, a);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * dx, y: a.y + t * dy };
    return Geo.dist(p, proj);
  };

  // distance from point to a polyline (array of points)
  Geo.pointPolylineDistance = function (p, pts) {
    if (!pts || pts.length === 0) return Infinity;
    if (pts.length === 1) return Geo.dist(p, pts[0]);
    let min = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Geo.pointSegmentDistance(p, pts[i], pts[i + 1]);
      if (d < min) min = d;
    }
    return min;
  };

  // point in polygon (ray casting)
  Geo.pointInPolygon = function (p, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect =
        yi > p.y !== yj > p.y &&
        p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // axis-aligned bounding box of points
  Geo.bbox = function (pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  // ---- Catmull-Rom spline -> flattened fine polyline ----
  // Returns an array of fine points that smoothly pass through the input points.
  Geo.smoothPath = function (points, tension) {
    if (!points || points.length < 3) return (points || []).slice();
    tension = tension == null ? 0.5 : tension;
    const result = [];
    const pts = points;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || pts[i + 1];
      const segLen = Geo.dist(p1, p2);
      const steps = Math.max(6, Math.floor(segLen / 6));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const x =
          0.5 *
          ((2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y =
          0.5 *
          ((2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        result.push({ x, y });
      }
    }
    result.push(pts[pts.length - 1]);
    return result;
  };

  // Walk along a fine polyline and return sample points spaced ~`spacing` apart,
  // each with a unit tangent. Used to place front symbols.
  Geo.sampleAlong = function (finePts, spacing) {
    const samples = [];
    if (!finePts || finePts.length < 2) return samples;
    let distSoFar = 0;
    let nextAt = spacing * 0.5; // start a little in from the beginning
    for (let i = 0; i < finePts.length - 1; i++) {
      const a = finePts[i];
      const b = finePts[i + 1];
      let segLen = Geo.dist(a, b);
      if (segLen === 0) continue;
      const dir = { x: (b.x - a.x) / segLen, y: (b.y - a.y) / segLen };
      while (nextAt <= distSoFar + segLen) {
        const t = (nextAt - distSoFar) / segLen;
        samples.push({
          x: a.x + dir.x * segLen * t,
          y: a.y + dir.y * segLen * t,
          tx: dir.x,
          ty: dir.y,
        });
        nextAt += spacing;
      }
      distSoFar += segLen;
    }
    return samples;
  };

  global.Geo = Geo;
})(window);
