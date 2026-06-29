/*
 * topojson-mini.js
 * Decodificador minimalista de TopoJSON -> GeoJSON.
 * Soporta: transform (quantizado/delta), Polygon, MultiPolygon, LineString,
 * MultiLineString, Point, MultiPoint y GeometryCollection.
 * Funciona en navegador (window.TopoMini) y en Node (module.exports).
 */
(function (root) {
  'use strict';

  function transformPoint(transform) {
    if (!transform) {
      return function (p) { return [p[0], p[1]]; };
    }
    var sx = transform.scale[0], sy = transform.scale[1];
    var tx = transform.translate[0], ty = transform.translate[1];
    // Estado de acumulacion para arcos (delta encoding)
    return function (p, isFirst, state) {
      // gestionado externamente; aqui solo escala absoluta
      return [p[0] * sx + tx, p[1] * sy + ty];
    };
  }

  // Decodifica un arco (lista de [x,y]) aplicando delta + transform si existe.
  function decodeArc(arc, transform) {
    var out = [];
    if (!transform) {
      for (var i = 0; i < arc.length; i++) out.push([arc[i][0], arc[i][1]]);
      return out;
    }
    var x = 0, y = 0;
    var sx = transform.scale[0], sy = transform.scale[1];
    var tx = transform.translate[0], ty = transform.translate[1];
    for (var j = 0; j < arc.length; j++) {
      x += arc[j][0];
      y += arc[j][1];
      out.push([x * sx + tx, y * sy + ty]);
    }
    return out;
  }

  function buildDecodedArcs(topology) {
    var arcs = topology.arcs || [];
    var decoded = new Array(arcs.length);
    for (var i = 0; i < arcs.length; i++) {
      decoded[i] = decodeArc(arcs[i], topology.transform);
    }
    return decoded;
  }

  // Reconstruye una linea a partir de una lista de indices de arco.
  function stitch(arcIndexes, decodedArcs) {
    var coords = [];
    for (var i = 0; i < arcIndexes.length; i++) {
      var idx = arcIndexes[i];
      var reverse = idx < 0;
      var realIdx = reverse ? ~idx : idx; // ~idx === -idx - 1
      var arc = decodedArcs[realIdx];
      if (!arc) continue;
      var pts = reverse ? arc.slice().reverse() : arc.slice();
      if (coords.length === 0) {
        for (var k = 0; k < pts.length; k++) coords.push(pts[k]);
      } else {
        // saltar el primer punto (compartido con el arco previo)
        for (var m = 1; m < pts.length; m++) coords.push(pts[m]);
      }
    }
    return coords;
  }

  function geometryToCoords(geom, decodedArcs) {
    switch (geom.type) {
      case 'Point':
        return geom.coordinates;
      case 'MultiPoint':
        return geom.coordinates;
      case 'LineString':
        return stitch(geom.arcs, decodedArcs);
      case 'MultiLineString':
        return geom.arcs.map(function (line) { return stitch(line, decodedArcs); });
      case 'Polygon':
        return geom.arcs.map(function (ring) { return stitch(ring, decodedArcs); });
      case 'MultiPolygon':
        return geom.arcs.map(function (poly) {
          return poly.map(function (ring) { return stitch(ring, decodedArcs); });
        });
      default:
        return null;
    }
  }

  function geometryToFeature(geom, decodedArcs) {
    var coords = geometryToCoords(geom, decodedArcs);
    return {
      type: 'Feature',
      id: geom.id,
      properties: geom.properties || {},
      geometry: coords == null ? null : { type: geom.type, coordinates: coords }
    };
  }

  // API principal: equivalente a topojson.feature(topology, object)
  function feature(topology, object) {
    if (typeof object === 'string') object = topology.objects[object];
    var decodedArcs = buildDecodedArcs(topology);
    if (object.type === 'GeometryCollection') {
      return {
        type: 'FeatureCollection',
        features: object.geometries.map(function (g) {
          return geometryToFeature(g, decodedArcs);
        })
      };
    }
    return geometryToFeature(object, decodedArcs);
  }

  var api = { feature: feature, decodeArc: decodeArc };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.TopoMini = api;
  }
})(typeof window !== 'undefined' ? window : this);
