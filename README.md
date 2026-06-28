# Editor de Discusiones de Mesoescala (MCD)

Aplicación web **100% local** (sin dependencias externas, sin internet, sin costos) para crear
discusiones de mesoescala al estilo de las **MCD del SPC** (Storm Prediction Center).

Cargas una imagen de radar o satélite y la anotas con frentes meteorológicos, flechas,
poli-líneas, cajas de texto con borde rojo, áreas resaltadas y más.

---

## Cómo ejecutarlo

### Opción A — Servidor local (recomendado)
```bash
cd mcd-editor
./start.sh            # usa el puerto 8000
# o un puerto distinto:
./start.sh 9000
```
Luego abre **http://localhost:8000** en tu navegador.

> El script usa `python3 -m http.server`. Si no tienes Python, intenta con Node
> (`npx serve`) automáticamente.

### Opción B — Abrir directamente
Como no usa módulos ES ni recursos externos, también puedes **abrir `index.html`
directamente** en el navegador (doble clic). Funciona igual.

---

## Funciones

**Archivo (barra superior)**
- 📷 **Cargar imagen**: radar/satélite como fondo (el lienzo toma el tamaño de la imagen).
- 📄 **Lienzo en blanco**: empieza sin imagen.
- ⬇️ **Exportar PNG**: descarga la discusión final como imagen.
- 💾 **Guardar / 📂 Abrir**: proyecto editable en `.json` (puedes retomar el trabajo después).
- ↶ / ↷ **Deshacer / Rehacer**.

**Herramientas (barra izquierda)**
- **Seleccionar**: mover, redimensionar (tiradores) y editar vértices.
- **Texto** libre con halo blanco opcional para legibilidad.
- **Caja de texto**: rectángulo blanco con borde rojo y texto dentro (estilo número MCD).
- **Flecha** (simple o doble punta).
- **Poli-línea** (multipunto) y **Trazo libre**.
- **Área**: polígono resaltado semitransparente (como el contorno de área del SPC).
- **Rectángulo** y **Elipse**.
- **Frentes**: frío (triángulos azules), cálido (semicírculos rojos), ocluido (morado),
  estacionario, *dryline*, *outflow* y vaguada (*trough*).

**Panel de propiedades (barra derecha)**
- Cambia colores, grosores, relleno y opacidad.
- **Selector de fuente** (Arial por defecto, más Helvetica, Verdana, Times New Roman, etc.),
  tamaño, negrita, cursiva y alineación.
- Para frentes: tipo, voltear el lado de los símbolos, grosor y tamaño de símbolos.
- Orden de capas, duplicar y eliminar.

---

## Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `V` | Seleccionar | 
| `T` | Texto |
| `B` | Caja de texto |
| `A` | Flecha |
| `L` | Poli-línea |
| `P` | Trazo libre |
| `G` | Área (polígono) |
| `R` / `E` | Rectángulo / Elipse |
| `Enter` | Terminar poli-línea / polígono / frente |
| `Esc` | Cancelar dibujo o volver a Seleccionar |
| `Supr` / `Backspace` | Eliminar selección |
| `Ctrl/Cmd + Z` / `Ctrl/Cmd + Y` | Deshacer / Rehacer |
| `Ctrl/Cmd + D` | Duplicar |
| Flechas (con `Shift` = 10px) | Mover selección |

---

## Consejos de uso (flujo típico de una MCD)

1. **Cargar imagen** de radar/satélite.
2. Dibuja el **área de interés** con la herramienta *Área*.
3. Traza los **frentes** y **líneas** (dryline, outflow) relevantes.
4. Añade **flechas** de movimiento del sistema.
5. Coloca una **caja de texto** con el número/título de la discusión.
6. Añade **texto** con el análisis.
7. **Exportar PNG** para compartir.

---

## Estructura del proyecto
```
mcd-editor/
├── index.html        # interfaz
├── css/styles.css    # estilos
├── js/
│   ├── geometry.js   # utilidades geométricas (curvas, muestreo, hit-testing)
│   ├── fronts.js     # dibujo de frentes meteorológicos
│   ├── shapes.js     # modelo y render de todas las figuras
│   ├── editor.js     # núcleo del editor (herramientas, selección, historial)
│   └── main.js       # interfaz de usuario
├── start.sh          # servidor local
└── README.md
```

Sin frameworks, sin `npm install`, sin servicios en la nube.
