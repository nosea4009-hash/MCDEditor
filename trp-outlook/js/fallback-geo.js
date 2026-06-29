/*
 * fallback-geo.js
 * Contornos APROXIMADOS de Argentina y Paraguay para uso offline cuando
 * no se puede descargar Natural Earth y no hay caché. Baja resolución:
 * sirve para que la app funcione y la restricción de dibujo opere de forma
 * aproximada. Para precisión real, la app descarga Natural Earth (50m).
 */
(function (root) {
  'use strict';

  // Argentina (anillo aproximado, [lon, lat])
  var ARGENTINA = [
    [-66.0, -22.1], [-64.0, -22.3], [-62.8, -22.0], [-60.0, -24.0],
    [-58.2, -24.9], [-57.6, -25.6], [-55.6, -27.4], [-56.0, -28.0],
    [-57.6, -30.2], [-58.2, -32.0], [-58.4, -33.9], [-57.5, -35.0],
    [-57.4, -36.0], [-56.7, -36.4], [-57.0, -37.4], [-57.6, -38.2], [-62.3, -38.9],
    [-62.4, -40.9], [-65.0, -40.8], [-64.9, -42.1], [-65.7, -42.0],
    [-65.0, -43.5], [-65.3, -44.5], [-65.6, -45.0], [-67.6, -46.0],
    [-67.0, -48.7], [-68.3, -50.2], [-68.6, -52.3], [-68.6, -54.9],
    [-66.4, -54.9], [-65.2, -54.9], [-66.9, -54.5], [-70.0, -52.9],
    [-72.3, -51.1], [-72.0, -49.0], [-73.0, -47.0], [-71.9, -45.0],
    [-71.5, -42.9], [-71.7, -40.0], [-70.9, -38.5], [-70.4, -37.0],
    [-69.8, -34.5], [-70.0, -33.0], [-69.8, -32.0], [-68.4, -27.0],
    [-67.0, -24.0], [-66.5, -23.0], [-66.0, -22.1]
  ];

  // Paraguay (anillo aproximado, [lon, lat])
  var PARAGUAY = [
    [-62.4, -22.0], [-61.0, -21.0], [-60.0, -19.4], [-58.2, -19.8],
    [-57.9, -20.9], [-57.9, -22.1], [-56.4, -22.3], [-55.6, -22.3],
    [-54.6, -23.9], [-54.3, -24.0], [-54.4, -25.6], [-54.6, -25.6],
    [-55.0, -26.0], [-55.9, -27.4], [-56.6, -27.45], [-57.6, -27.4],
    [-58.45, -27.0], [-57.8, -25.9], [-58.2, -24.9], [-59.4, -24.4],
    [-60.0, -24.0], [-61.7, -23.2], [-62.3, -22.5], [-62.4, -22.0]
  ];

  function feature(ring, id, name) {
    return {
      type: 'Feature', id: id, properties: { name: name, fallback: true },
      geometry: { type: 'Polygon', coordinates: [ring] }
    };
  }

  var api = {
    featureCollection: {
      type: 'FeatureCollection',
      features: [
        feature(ARGENTINA, '032', 'Argentina'),
        feature(PARAGUAY, '600', 'Paraguay')
      ]
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FallbackGeo = api;
})(typeof window !== 'undefined' ? window : this);
