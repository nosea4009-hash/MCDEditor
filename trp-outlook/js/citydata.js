/*
 * citydata.js
 * Ciudades principales de Argentina y Paraguay (coordenadas [lon, lat]).
 * rank: 1 = capital nacional, 2 = capital provincial/principal, 3 = ciudad importante.
 */
(function (root) {
  'use strict';

  var CITIES = [
    // ---- Argentina ----
    { name: 'Buenos Aires', country: 'AR', lon: -58.3816, lat: -34.6037, rank: 1 },
    { name: 'Córdoba', country: 'AR', lon: -64.1888, lat: -31.4201, rank: 2 },
    { name: 'Rosario', country: 'AR', lon: -60.6393, lat: -32.9442, rank: 2 },
    { name: 'Mendoza', country: 'AR', lon: -68.8458, lat: -32.8895, rank: 2 },
    { name: 'La Plata', country: 'AR', lon: -57.9545, lat: -34.9215, rank: 2 },
    { name: 'San Miguel de Tucumán', country: 'AR', lon: -65.2226, lat: -26.8083, rank: 2 },
    { name: 'Mar del Plata', country: 'AR', lon: -57.5575, lat: -38.0055, rank: 3 },
    { name: 'Salta', country: 'AR', lon: -65.4117, lat: -24.7821, rank: 2 },
    { name: 'Santa Fe', country: 'AR', lon: -60.7000, lat: -31.6333, rank: 2 },
    { name: 'San Juan', country: 'AR', lon: -68.5364, lat: -31.5375, rank: 2 },
    { name: 'Resistencia', country: 'AR', lon: -58.9867, lat: -27.4514, rank: 2 },
    { name: 'Neuquén', country: 'AR', lon: -68.0591, lat: -38.9516, rank: 2 },
    { name: 'Santiago del Estero', country: 'AR', lon: -64.2615, lat: -27.7951, rank: 2 },
    { name: 'Corrientes', country: 'AR', lon: -58.8341, lat: -27.4692, rank: 2 },
    { name: 'Posadas', country: 'AR', lon: -55.8961, lat: -27.3621, rank: 2 },
    { name: 'Bahía Blanca', country: 'AR', lon: -62.2724, lat: -38.7183, rank: 3 },
    { name: 'Paraná', country: 'AR', lon: -60.5238, lat: -31.7320, rank: 2 },
    { name: 'Formosa', country: 'AR', lon: -58.1781, lat: -26.1849, rank: 2 },
    { name: 'San Salvador de Jujuy', country: 'AR', lon: -65.2977, lat: -24.1858, rank: 2 },
    { name: 'La Rioja', country: 'AR', lon: -66.8559, lat: -29.4111, rank: 2 },
    { name: 'San Luis', country: 'AR', lon: -66.3356, lat: -33.2950, rank: 2 },
    { name: 'Catamarca', country: 'AR', lon: -65.7795, lat: -28.4696, rank: 2 },
    { name: 'Río Gallegos', country: 'AR', lon: -69.2161, lat: -51.6230, rank: 2 },
    { name: 'Ushuaia', country: 'AR', lon: -68.3030, lat: -54.8019, rank: 2 },
    { name: 'Comodoro Rivadavia', country: 'AR', lon: -67.5039, lat: -45.8641, rank: 3 },
    { name: 'San Carlos de Bariloche', country: 'AR', lon: -71.3103, lat: -41.1335, rank: 3 },
    { name: 'Santa Rosa', country: 'AR', lon: -64.2906, lat: -36.6203, rank: 2 },
    { name: 'Viedma', country: 'AR', lon: -62.9967, lat: -40.8135, rank: 2 },
    { name: 'Rawson', country: 'AR', lon: -65.1023, lat: -43.3002, rank: 2 },
    { name: 'Concordia', country: 'AR', lon: -58.0209, lat: -31.3929, rank: 3 },
    { name: 'San Rafael', country: 'AR', lon: -68.3336, lat: -34.6177, rank: 3 },
    { name: 'Tandil', country: 'AR', lon: -59.1332, lat: -37.3217, rank: 3 },
    { name: 'Río Cuarto', country: 'AR', lon: -64.3499, lat: -33.1232, rank: 3 },
    { name: 'Reconquista', country: 'AR', lon: -59.6531, lat: -29.1450, rank: 3 },
    { name: 'Trelew', country: 'AR', lon: -65.3051, lat: -43.2530, rank: 3 },

    // ---- Paraguay ----
    { name: 'Asunción', country: 'PY', lon: -57.6359, lat: -25.2637, rank: 1 },
    { name: 'Ciudad del Este', country: 'PY', lon: -54.6111, lat: -25.5096, rank: 2 },
    { name: 'San Lorenzo', country: 'PY', lon: -57.5089, lat: -25.3397, rank: 3 },
    { name: 'Luque', country: 'PY', lon: -57.4872, lat: -25.2667, rank: 3 },
    { name: 'Capiatá', country: 'PY', lon: -57.4456, lat: -25.3553, rank: 3 },
    { name: 'Lambaré', country: 'PY', lon: -57.6333, lat: -25.3500, rank: 3 },
    { name: 'Encarnación', country: 'PY', lon: -55.8667, lat: -27.3306, rank: 2 },
    { name: 'Pedro Juan Caballero', country: 'PY', lon: -55.7333, lat: -22.5472, rank: 2 },
    { name: 'Coronel Oviedo', country: 'PY', lon: -56.4400, lat: -25.4475, rank: 2 },
    { name: 'Concepción', country: 'PY', lon: -57.4344, lat: -23.4064, rank: 2 },
    { name: 'Villarrica', country: 'PY', lon: -56.4467, lat: -25.7833, rank: 2 },
    { name: 'Pilar', country: 'PY', lon: -58.3000, lat: -26.8628, rank: 2 },
    { name: 'Caaguazú', country: 'PY', lon: -56.0167, lat: -25.4667, rank: 3 },
    { name: 'Filadelfia', country: 'PY', lon: -60.0333, lat: -22.3500, rank: 2 },
    { name: 'Mariscal Estigarribia', country: 'PY', lon: -60.6167, lat: -22.0333, rank: 3 },
    { name: 'Caacupé', country: 'PY', lon: -57.1411, lat: -25.3858, rank: 3 }
  ];

  var api = { CITIES: CITIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CityData = api;
})(typeof window !== 'undefined' ? window : this);
