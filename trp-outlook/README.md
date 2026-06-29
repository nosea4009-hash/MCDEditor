# TRP Meteorología — Sección Pronóstico

Aplicación web **local** para dibujar *outlooks* de tiempo severo al estilo del
**SPC (Storm Prediction Center)** de NOAA, pero para **Argentina y Paraguay**.

Los outlooks se recortan automáticamente a los límites de Argentina y Paraguay:
**no es posible dibujar un área sobre otro país** (el polígono se corta en la frontera).

---

## Archivo único (doble clic, sin servidor)

Si querés **todo en un solo archivo**, usá **`trp-outlook-standalone.html`**: tiene el
CSS y el JavaScript embebidos. Lo abrís con **doble clic** y funciona (no hace falta
Python ni servidor). Leaflet/Turf y los límites de países se cargan por CDN y el
navegador los cachea, así que tras la primera carga el modo *Vectorial personalizado*
anda también sin conexión. (Los fondos OSM/Satélite/Topográfico sí requieren internet.)

Para regenerarlo si cambiás el código:
```bash
python3 build_standalone.py
```

¿Querés una versión **100% offline** (con Leaflet, Turf y los límites también
embebidos)? Ejecutá una vez **con internet**:
```bash
python3 build_standalone.py --offline
```

---

## Cómo ejecutarla

No requiere instalación ni compilación. Es HTML + CSS + JavaScript puro.

### Opción recomendada (servidor local)
Desde la carpeta del proyecto:

```bash
# Python 3
python3 -m http.server 8077
```
Luego abrí en el navegador: <http://localhost:8077>

O con Node:
```bash
npx serve .
```

### Opción rápida
También podés abrir `index.html` directamente con doble clic. Si tu navegador
bloquea la descarga de datos por seguridad (`file://`), usá el servidor local.

> **Primera carga:** necesita internet **una sola vez** para bajar Leaflet, Turf.js
> y los límites de los países (Natural Earth). Todo queda **cacheado en el navegador**
> y luego funciona **offline** en el modo *Vectorial personalizado*.

---

## Niveles de riesgo (colores SPC)

| Sigla  | Nivel               | Color por defecto |
|--------|---------------------|-------------------|
| TSTM   | Tormentas generales | verde claro       |
| MRGL   | Marginal (1)        | verde             |
| SLGT   | Leve / Slight (2)   | amarillo          |
| ENH    | Realzado / Enh (3)  | naranja           |
| MDT    | Moderado (4)        | rojo              |
| HIGH   | Alto / High (5)     | magenta           |

Los colores son editables. Hay dos presets:
- **Preset vívido (barra):** coincide con la barra de referencia.
- **Preset relleno oficial:** los rellenos exactos que usa la SPC en sus mapas.

---

## Funciones principales

- **Dibujo de outlooks** por niveles, con recorte automático a Argentina + Paraguay.
- **Menú de tipo de mapa:** Vectorial personalizado (offline), OpenStreetMap,
  Topográfico, Satélite, Oscuro y Claro/Positron.
- **Personalización amplia:** color de agua, terreno (AR/PY), países vecinos,
  fronteras (color y grosor), provincias, ciudades (punto/etiqueta/tamaño),
  etiquetas de países, cuadrícula lat/lon y **temas rápidos** (Clásico/Oscuro/Blueprint).
- **Leyenda** en el mapa (cuadrado de color + nivel), con posición configurable y
  opción de mostrar solo los niveles dibujados.
- **Encabezado del outlook** sobre el mapa (título + validez).
- **Herramientas de pronóstico:** seleccionar/cambiar nivel de un área, borrar,
  deshacer punto/área, limpiar todo, lectura de coordenadas en vivo.
- **Importar/Exportar:** outlook como **GeoJSON**, configuración como JSON, y
  carga de un **GeoJSON de provincias/departamentos** propio.
- **Persistencia:** la configuración y las áreas dibujadas se guardan en el navegador.

---

## Uso rápido

1. Elegí el **nivel de riesgo** (TSTM…HIGH) en *Herramientas de pronóstico*.
2. Tocá **Dibujar área** y hacé clic en el mapa para marcar el contorno.
3. **Doble clic**, **Enter** o **Finalizar** para cerrar (clic cerca del primer punto también cierra).
4. El área se recorta sola a AR/PY. Repetí para otros niveles.
5. Ajustá colores/estilo en los paneles y mostrá la **leyenda**.

Atajos durante el dibujo: **Enter** finaliza, **Esc** cancela.

---

## Estructura

```
trp-meteorologia/
├── index.html            # interfaz
├── css/styles.css        # estilos
└── js/
    ├── app.js            # lógica principal (mapa, dibujo, personalización)
    ├── topojson-mini.js  # decodificador TopoJSON propio (sin dependencias)
    ├── citydata.js       # ciudades de AR y PY
    └── fallback-geo.js   # contornos aproximados de respaldo (modo offline)
```

## Notas técnicas

- Recorte geométrico con **Turf.js** (`intersect`) por cada polígono de cada país,
  compatible con países multi-polígono (p. ej. Argentina con sus islas).
- Si no hay internet en la primera carga, la app usa contornos **aproximados**
  embebidos para que la herramienta siga funcionando (precisión reducida).
- Datos de límites: Natural Earth 1:50m vía `world-atlas` (jsDelivr).

## Créditos de datos

- Límites: [Natural Earth](https://www.naturalearthdata.com/) (dominio público) vía `world-atlas`.
- Mapa y dibujo: [Leaflet](https://leafletjs.com/). Geometría: [Turf.js](https://turfjs.org/).
- Esquema de niveles y colores basado en el [SPC / NOAA](https://www.spc.noaa.gov/).


---

## Novedades

### 🔤 Texto y etiquetas
Panel **"Texto y etiquetas"**: tocá *Agregar texto*, hacé clic en el mapa y escribí.
Cada etiqueta es personalizable: **color de relleno**, **color de trazo exterior**,
**grosor del trazo**, **fuente** (varias opciones) y **tamaño** (+ negrita). Se pueden
**arrastrar** para reposicionar, **doble clic** para editar y **clic** para seleccionar
(y borrar). Los textos se guardan y se incluyen al exportar/importar el outlook.

### 🗺️ Mapa "Vectorial detallado (con municipios)"
Nuevo tipo de mapa que, además de todo lo personalizable del modo vectorial, descarga
y muestra **provincias/departamentos (ADM1)** y **municipios/distritos (ADM2)** reales de
Argentina y Paraguay desde **[geoBoundaries](https://www.geoboundaries.org/)** (licencia
CC BY 4.0). Color y grosor de las líneas de municipios y provincias son configurables.
También hay un botón **"Descargar municipios (AR/PY)"** para usarlos sobre cualquier mapa
base. Requiere internet la primera vez (luego quedan en caché en el navegador).

> Atribución requerida por la fuente: *Boundaries © geoBoundaries (CC BY 4.0)*.
