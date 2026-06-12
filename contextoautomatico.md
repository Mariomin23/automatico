# Contexto del proyecto — job-hunter-ai

## Quién soy

Me llamo Mario. Soy desarrollador fullstack junior recién salido de un bootcamp en Neoland (Madrid, 2026). Mi proyecto final fue elegido el mejor de la promoción. Antes de programar, fui autónomo durante 5 años gestionando mi propio gimnasio (franquicia TRIB3 Goya): P&L completo, equipo, KPIs, retención de socios. Eso es mi diferenciador frente a otros juniors.

Nivel técnico actual: sé lo que hago en JavaScript/Node/React pero soy junior. Explícame las decisiones que tomes. No asumas que sé cosas avanzadas sin avisarme.

---

## Qué estamos construyendo

Una herramienta con dos modos de uso:

### `npm start` — scraping CLI
1. Scraping de ofertas en Tecnoempleo e InfoJobs (portales públicos, sin login)
2. Marca de ofertas nuevas con `data/seen_jobs.json` — el resumen incluye todas las encontradas, con campo `nueva` y las nuevas primero (el tope `MAX_OFFERS_PER_RUN` nunca deja fuera una nueva)
3. Output diario en Markdown + JSON: resumen de ofertas
4. Envío del resumen por email (opcional, con nodemailer)

> **No hay puntuación automática.** Ollama consume demasiados recursos para puntuar 20 ofertas seguidas. La puntuación y cartas son bajo demanda desde el dashboard.

### `npm run serve` — dashboard web
1. Servidor Express en `http://localhost:3000`
2. Historial de runs por fecha en sidebar
3. Ofertas con nuevas primero y, dentro de cada grupo, ordenadas por experiencia requerida (sin exp → junior → mid → senior)
4. Botón **"Generar carta de presentación"** por oferta — si ya hay carta guardada en disco la muestra al instante ("Ver carta guardada" + "Regenerar"); solo llama a Ollama si no existe o se regenera
5. Botón **"Nueva búsqueda"** con logs en tiempo real (SSE)

---

## Mi perfil técnico (para los prompts de IA)

```javascript
{
  nombre: "Mario Minuesa",
  email: "mario@minuesa.es",
  ubicacion: "Madrid",
  stack: {
    principales: ["Node.js", "React", "Angular", "MongoDB", "JavaScript", "TypeScript"],
    secundarios: ["HTML5", "CSS3", "REST APIs", "JWT", "Express", "Git"],
    aprendiendo: ["Ollama", "MCP", "automatizaciones con IA"]
  },
  formacion: "Bootcamp Fullstack Neoland 2026 — mejor proyecto de la promoción",
  experiencia_previa: "5 años autónomo. Manager & Franchisee en TRIB3 Goya (fitness). P&L, equipo, KPIs.",
  diferenciador: "Entiendo el negocio desde dentro. He estado al otro lado contratando y gestionando. Sé lo que vale un empleado comprometido.",
  busqueda: {
    modalidad: ["presencial", "hibrido", "remoto"],
    ciudad: "Madrid",
    keywords: ["javascript junior", "react junior", "node junior", "angular junior", "fullstack junior"],
    excluir: ["java", "php", "senior", "lead"]
  }
}
```

---

## Stack del proyecto

- **Runtime:** Node.js 18+
- **Scraping:** axios + cheerio (Tecnoempleo, HTML estático) y axios + JSON embebido (InfoJobs, página React)
- **IA:** Ollama corriendo en local — modelo `llama3` (el disponible; configurable via `OLLAMA_MODEL`)
- **Cliente HTTP para Ollama:** axios
- **Servidor web:** Express (solo para el dashboard, no para el scraping CLI)
- **Config:** dotenv para variables de entorno
- **Email:** nodemailer (opcional)
- **Dev:** nodemon

CommonJS en todo el proyecto. Sin ESModules.

> **Google Jobs (Playwright) está deshabilitado por defecto.** Requiere `npx playwright install chromium` (~400MB). Si no está instalado, el scraper devuelve array vacío sin romper el flujo.

> **Por qué Ollama:** Es gratuito, corre en tu máquina, no necesita API key ni tarjeta de crédito.
> Modelo actual en uso: `llama3` (no `llama3.2` — verificar con `ollama list` qué modelos tienes).

---

## Estructura de archivos

```
job-hunter-ai/
├── src/
│   ├── scraper/
│   │   ├── tecnoempleo.js      ← axios + cheerio, selectores actualizados, 2 páginas por keyword
│   │   ├── infojobs.js         ← axios, parsea el JSON embebido __INITIAL_PROPS__ (la página es React)
│   │   ├── googlejobs.js       ← deshabilitado por defecto (necesita playwright install)
│   │   └── index.js
│   ├── ai/
│   │   ├── scorer.js           ← NO se usa en el flujo principal; disponible para uso futuro
│   │   ├── letterWriter.js     ← generarCarta() y generarCartas() exportadas
│   │   └── prompts.js
│   ├── utils/
│   │   ├── storage.js
│   │   ├── output.js           ← genera resumen.md + resumen.json (sin campos de puntuación)
│   │   └── mailer.js
│   ├── config/
│   │   └── profile.js
│   ├── index.js                ← CLI: solo scraping + output, sin Ollama
│   └── server.js               ← dashboard Express en puerto 3000
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js                  ← SPA vanilla JS, sin framework, sin build step
├── data/
│   └── seen_jobs.json          ← URLs ya procesadas
├── output/
│   └── YYYY-MM-DD/
│       ├── resumen.md
│       ├── resumen.json        ← datos estructurados para el dashboard
│       └── {slug}_carta.md     ← generadas bajo demanda (slug = empresa + hash de URL)
├── docs/
│   └── superpowers/specs/      ← documentos de diseño de cada cambio grande
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Scripts disponibles

```bash
npm start          # scraping CLI — genera output, sin Ollama
npm run dev        # scraping CLI con nodemon
npm run serve      # dashboard web en http://localhost:3000
npm run serve:dev  # dashboard con nodemon
```

---

## Reglas que debes seguir siempre

### Credenciales
- Las credenciales SIEMPRE van en `.env`, nunca hardcodeadas
- `.env` va en `.gitignore` siempre
- Usa `dotenv` con `require('dotenv').config()` al inicio de cada entry point
- No se necesita API key para Ollama — corre en local en `http://localhost:11434`

### Llamadas a Ollama
- URL base: `http://localhost:11434/api/generate`
- Modelo por defecto: `llama3` (configurable via `.env` como `OLLAMA_MODEL`)
- SIEMPRE envuelve las llamadas en try/catch
- Si Ollama devuelve JSON, usa JSON.parse dentro de try/catch con fallback regex
- No hagas más de 1 llamada por segundo (sleep 1100ms entre llamadas en bucles)
- Usa `stream: false` en scripts y bucles; excepción: `POST /api/carta/generar` del dashboard usa `stream: true` para reenviar tokens por SSE en tiempo real

```javascript
const response = await axios.post(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/generate`, {
  model: process.env.OLLAMA_MODEL || 'llama3',
  prompt: tuPrompt,
  stream: false,
});
const texto = response.data.response;
```

### Scraping — Tecnoempleo
- Selector de contenedor de oferta: `.p-3.border.rounded.mb-3.bg-white`
- Título: `h3 a` dentro del contenedor
- Empresa: `a.text-primary` (primer match)
- Descripción: `span.hidden-md-down`
- URL de búsqueda: `https://www.tecnoempleo.com/busqueda-empleo.php?te={keyword}&provincia=28&pagina={n}`
- Busca 3 keywords × 2 páginas = hasta ~180 ofertas por run
- 1200ms de pausa entre peticiones
- Deduplica por URL antes de devolver resultados

### Scraping — InfoJobs
- Las ofertas NO están en el HTML: la página es React y van embebidas en `window.__INITIAL_PROPS__ = JSON.parse("...")`. Se extrae ese JSON con doble `JSON.parse` (primero des-escapa el string JS).
- URL de búsqueda: `https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword={kw}&cityId=28079&page={n}&sortBy=RELEVANCE`
- `props.offers` trae ~22 ofertas/página con `title`, `companyName`, `description` completa, `link`, `salary`, `teleworking`, `city`
- Filtro: solo ofertas de Madrid o 100% en remoto (InfoJobs cuela otras ciudades)
- Campos extra que aporta: `salario` (formateado, ej. `22.000–25.000 €/año`) y `modalidad` (Híbrido / Presencial / remoto)
- 3 keywords × 2 páginas, 1200ms de pausa, deduplica por URL

### Filtro de excluidas
- Por palabra completa (`\b{palabra}\b`, case-insensitive): "java" NO descarta "javascript"

### Storage
- `data/seen_jobs.json` guarda un array de URLs ya procesadas
- Si el archivo no existe, créalo vacío: `[]`
- Actualiza el archivo al final de cada ejecución, no durante
- Se marcan como vistas TODAS las URLs encontradas en el run, también las que no entraron en el resumen por el tope

### Output (sin puntuación)
- Carpeta `/output/YYYY-MM-DD/` con la fecha de hoy
- `resumen.md` — Markdown legible
- `resumen.json` — datos estructurados para el dashboard con esta forma:
```json
{
  "fecha": "2026-05-31",
  "total": 20,
  "ofertas": [
    {
      "titulo": "...",
      "empresa": "...",
      "url": "...",
      "fuente": "Tecnoempleo",
      "descripcion": "...",
      "slug": "empresa_slug_a1b2c3",
      "nueva": true,
      "salario": "22.000–25.000 €/año",
      "modalidad": "Híbrido"
    }
  ]
}
```
- `slug` = empresa + hash corto de la URL (md5, 6 chars): dos ofertas de la misma empresa no colisionan
- `nueva` = la URL no estaba en `seen_jobs.json` al hacer el run
- `salario`/`modalidad` = solo InfoJobs los aporta; vacíos en otras fuentes
- La fecha de la carpeta es LOCAL (no `toISOString`, que en madrugada caería en el día anterior por UTC)
- Cartas: `{slug}_carta.md` — generadas bajo demanda desde el dashboard y reutilizadas en visitas posteriores

### Dashboard (server.js + public/)
- Express sirve `public/` como estático
- API endpoints:
  - `GET /api/runs` — lista de runs con total: `[{ "date": "2026-06-11", "total": 20 }]`
  - `GET /api/runs/:date` — datos del run (resumen.json) + `cartas: [slugs con carta guardada]`
  - `GET /api/runs/:date/carta/:slug` — carta guardada
  - `POST /api/carta/generar` — genera carta con Ollama bajo demanda (SSE) y la guarda en disco
  - `GET /api/run/start` — SSE: lanza `npm start` y streama logs
  - `GET /api/status` — estado de Ollama
- `:date` y `:slug` se validan con regex estricta (no rutas fuera de `output/`)
- Frontend: vanilla JS, sin framework, sin build step (`public/app.js`)
- Orden: nuevas primero; dentro de cada grupo, por experiencia requerida extraída con regex del título+descripción
- Badges: 🆕 Nueva (verde) · salario · modalidad · experiencia: Sin exp. (verde) · 1 año (azul) · 2-3 años (amarillo) · 4+ años (rojo)
- Si una oferta ya tiene carta guardada, el botón dice "Ver carta guardada" y la carga del disco sin llamar a Ollama; "Regenerar" fuerza una nueva

### Código
- CommonJS (`require`, `module.exports`) — no ESModules
- Async/await siempre — no callbacks ni .then() encadenados
- Funciones pequeñas con un solo propósito
- Comenta las secciones importantes en español
- Si una función tiene más de 40 líneas, divídela

---

## Prompt de carta (letterWriter.js)

```
Eres un asistente que escribe cartas de presentación para Mario Minuesa, desarrollador fullstack junior.

PERFIL DE MARIO:
- Stack: Node.js, React, Angular, MongoDB, JavaScript, TypeScript
- Formación: Bootcamp Fullstack Neoland 2026, mejor proyecto de la promoción
- Antes fue autónomo 5 años: Manager en TRIB3 Goya (fitness), gestión P&L, equipo, KPIs
- Email: mario@minuesa.es
- Ubicación: Madrid

OFERTA:
{oferta_completa}

INSTRUCCIONES PARA LA CARTA:
- Tono: directo, humano, sin sonar a IA ni a plantilla corporativa
- Longitud: 3-4 párrafos, no más
- Menciona siempre 2-3 tecnologías concretas de la oferta que Mario domina
- Incluye el diferenciador del background empresarial de forma natural, no forzada
- No uses frases hechas como "me dirijo a ustedes", "adjunto mi CV", "quedo a su disposición"
- Empieza directamente con algo concreto sobre la empresa o la oferta
- Termina con algo directo y sin florituras

Escribe SOLO la carta, sin asunto, sin fecha, sin "Estimado/a". Solo el cuerpo del texto.
```

---

## Variables de entorno necesarias

```
# .env

# Ollama (sin coste, corre en local)
OLLAMA_MODEL=llama3
OLLAMA_BASE_URL=http://localhost:11434

# Email (opcional)
EMAIL_FROM=mario@minuesa.es
EMAIL_TO=mario@minuesa.es
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=mario@minuesa.es
EMAIL_SMTP_PASS=xxxx_xxxx_xxxx_xxxx

# Configuración
MAX_OFFERS_PER_RUN=20
```

---

## Prerequisitos

Antes de ejecutar el proyecto, Mario debe:

1. Instalar Ollama: https://ollama.com/download
2. Descargar el modelo disponible: `ollama pull llama3` (verificar con `ollama list`)
3. Asegurarse de que Ollama está corriendo: `ollama serve`

Ollama solo se necesita para generar cartas desde el dashboard. `npm start` (scraping) no lo requiere.

---

## Comportamiento esperado

### `npm start`
```
[07:00] Iniciando job-hunter-ai...
[07:00] Cargando ofertas ya vistas: 83 registros
[07:00] Scraping Tecnoempleo...
[07:01] Tecnoempleo: 29 ofertas encontradas
[07:01] Scraping InfoJobs...
[07:01] InfoJobs: 57 ofertas encontradas
[07:01] Scraping Google Jobs...
[07:01] Google Jobs: 0 ofertas encontradas
[07:01] Filtradas por excluir (java, php, senior, lead): 24 ofertas
[07:01] Total: 20 ofertas (12 nuevas)
[07:01] Resumen guardado en: output/2026-06-11/resumen.md
[07:01] seen_jobs.json actualizado: 156 registros
[07:01] ✅ Completado. 20 ofertas guardadas.
```

### `npm run serve`
```
Dashboard en http://localhost:3000
```
Abre el navegador en esa URL. El dashboard carga las ofertas del run más reciente: nuevas primero y, dentro de cada grupo, ordenadas por experiencia.

---

## Lo que NO debes hacer

- No uses ESModules (`import/export`) — solo CommonJS
- No instales paquetes nuevos sin explicármelo primero
- No hagas llamadas a Ollama sin rate limiting en bucles
- No hardcodees credenciales ni URLs bajo ningún concepto
- No uses `console.log` para todo — usa logger con prefijo `[HH:MM]`
- No uses la Anthropic API ni ninguna API de pago
- No añadas puntuación automática al flujo de `npm start` — consume demasiados recursos
- No rompas el flujo de scraping si Google Jobs falla — devuelve array vacío y continúa

---

## Historial de cambios

### 2026-06-11 — commit `4dcf4bd` (revisión "va fatal")

Diseño completo en `docs/superpowers/specs/2026-06-11-dashboard-scraper-mejoras-design.md`. Qué se arregló y por qué:

1. **Filtro `excluir` por palabra completa.** Antes usaba `titulo.includes('java')`, y "java" está dentro de "javascript" → se descartaban las ofertas de JavaScript, las más relevantes para mi perfil. Ahora usa regex con límites de palabra (`\bjava\b`), que no coincide dentro de otra palabra.

2. **Scraper de InfoJobs nuevo (`src/scraper/infojobs.js`).** Había un intento con selectores CSS que solo capturaba 5 de ~22 ofertas: InfoJobs es una app React y las ofertas no están en el HTML, viajan dentro de `window.__INITIAL_PROPS__` como JSON escapado. El scraper extrae ese JSON (doble `JSON.parse`) y consigue las 22 por página con descripción completa, salario y modalidad. Filtra a Madrid o 100% remoto. `googlejobs.js` se restauró a su versión original (deshabilitado sin Playwright).

3. **Filtro de "ya vistas" restaurado sin vaciar el dashboard.** El filtro estricto original tenía un problema: tras varios runs todo estaba "visto" → no se generaba resumen → dashboard vacío (por eso se había quitado el filtro, lo que causaba que cada run repitiera todo). Solución intermedia: el resumen incluye TODAS las ofertas encontradas con campo `nueva: true/false`; las nuevas van primero antes del tope, y `seen_jobs.json` registra todas las URLs encontradas.

4. **Cartas persistentes en el dashboard.** El servidor ya guardaba cada carta en disco y tenía endpoint para leerla, pero el frontend nunca lo usaba: cada clic regeneraba la carta con Ollama (minutos de espera). Ahora `GET /api/runs/:date` devuelve qué slugs tienen carta; el botón pasa a "Ver carta guardada" y la carga al instante; "Regenerar" fuerza una nueva.

5. **Slug único por oferta.** Antes slug = solo empresa: dos ofertas de la misma empresa compartían fichero de carta y se sobrescribían. Ahora slug = `empresa + hash md5 corto de la URL` (6 chars).

6. **Bug de fecha por UTC.** `toISOString()` devuelve fecha UTC: un run a la 01:42 hora de Madrid (verano = UTC+2) escribía en la carpeta del día ANTERIOR. Ahora la fecha de carpeta es local (`toLocaleDateString('sv-SE')`, que da formato YYYY-MM-DD). Pero tiene que enseñar eñ formato DD-MM-YYYY

7. **Menores.** `GET /api/runs` devuelve `[{date, total}]` para que el sidebar no haga una petición por fecha (antes N+1); default de modelo unificado a `llama3` en `/api/status`; validación estricta de `:date` y `:slug` en rutas (evita leer/escribir fuera de `output/`); `escapeHtml` escapa también comillas; badges nuevos en tarjeta: 🆕 Nueva, salario y modalidad.
### 2026-06-12 — Fase 2 ejecutada (diseño + utilidad del dashboard)

Los 9 puntos del roadmap Fase 2 implementados. Archivos tocados: `src/server.js`, `public/app.js`, `public/index.html`, `public/style.css`. Sin paquetes nuevos.

1. **Tarjetas rediseñadas:** cabecera (puesto + empresa + badges), descripción y pie de acciones separados por grid; ya no hay acordeón de tarjeta entera ni chevron.
2. **Descripción colapsable:** 3 líneas con `-webkit-line-clamp` + degradado fade-out y botón "Leer más…" / "Leer menos" (solo si la descripción supera 180 chars).
3. **Badges unificados:** píldoras pastel bajo el título con iconos — 🆕 Nueva (verde), 💶 salario (ámbar), 🏠 modalidad (violeta), 🧭 experiencia (color por nivel), 📌 fuente (gris).
4. **Botón de carta diferenciado:** "Ver carta guardada" usa estilo `.btn.secondary` (gris); "Generar carta" mantiene el azul primario. Cambia solo al terminar una generación.
5. **Filtros en tiempo real:** barra sobre el grid con buscador de texto (título+empresa+descripción), select de modalidad y checkbox "Solo nuevas"; contador "X de Y ofertas". Filtra ocultando tarjetas con clase `.hidden`, sin re-render.
6. **Visor de cartas en panel lateral (slide-over):** las cartas (guardadas y generación SSE en streaming) se muestran en panel deslizable derecho con "Copiar al portapapeles", "Descargar .txt", "Regenerar" y "Detener" durante la generación. Cerrar el panel aborta la generación en curso.
7. **Fechas DD-MM-YYYY:** sidebar y stat de fecha muestran `12-06-2026`; las carpetas en disco siguen siendo `YYYY-MM-DD`.
8. **CRM de candidaturas:** control segmentado `⏳ Pendiente | ✅ Aplicado | ❌ Descartado` en el pie de cada tarjeta. Persistencia en `data/applications_status.json` (`{ slug: estado }`; "pendiente" no se guarda). Endpoints nuevos: `GET /api/estados` y `POST /api/estados/:slug` (valida slug y estado). Aplicado = borde verde; Descartado = borde rojo + tarjeta atenuada.
9. **Resaltado de stack:** regex con límites de palabra ilumina React, Node/Node.js, Angular, TypeScript, JavaScript, MongoDB y Express en las descripciones (`<mark class="stack-hl">`), aplicado tras `escapeHtml`.

Verificado con Playwright headless: 20 tarjetas, filtros, CRM (persistencia ida/vuelta), leer más, panel de carta guardada (1230 chars) y cierre — sin errores JS en consola.

---

## Próximos Cambios y Roadmap (Fase 2)

### 🎨 Cambios de Diseño y Estéticos
1. **Jerarquía Visual de Tarjetas (Cards):** Rediseñar las tarjetas de las ofertas mediante Grid/Flexbox, dividiendo claramente la cabecera (Puesto, Empresa y Badges), el extracto de la descripción y un pie de tarjeta para acciones.
2. **Acordeón Colapsable:** Limitar la descripción inicial a 3 líneas con un efecto de degradado (*fade-out*) y un botón de "Leer más..." para evitar el scroll infinito en el dashboard.
3. **Unificación de Badges:** Agrupar todas las etiquetas (Nueva, Salario, Modalidad, Experiencia) en una cuadrícula limpia justo debajo del título del puesto, asignando un sistema de iconos visuales y colores pastel con propósito.
4. **Estados de Botón Diferenciados:** Modificar visualmente el botón de "Ver carta guardada" con un estilo secundario (outline o grisáceo) para diferenciar de un vistazo las ofertas ya gestionadas de las pendientes.

### ⚙️ Cambios de Funcionamiento y Utilidad
1. **Filtros en Tiempo Real (Frontend):** Implementar una barra superior en `public/app.js` para filtrar el JSON cargado dinámicamente por: "Solo nuevas", "Modalidad (Remoto/Híbrido/Presencial)" y un buscador por texto para tecnologías.
2. **Visor de Cartas Integrado:** Sustituir la carga en bloque de la carta por un panel lateral deslizable (*slide-over*) o una ventana modal nativa (`<dialog>`), incluyendo un botón funcional de **"Copiar al portapapeles"**.
3. **Formateador de Fechas en Sidebar:** Corregir la vista del menú lateral. Aunque la carpeta en disco se mantenga como `YYYY-MM-DD` por ordenación del sistema, el frontend mapeará y formateará la string a `DD-MM-YYYY` para la lectura de Mario.
4. **CRM de Candidaturas (Pipeline de Estados):** Crear un sistema local de estados para cada oferta `[ Pendiente ⏳ | Aplicado ✅ | Descartado ❌ ]`. Se guardará en `data/applications_status.json` mapeado por el `slug` único de la oferta.
5. **Resaltado de Stack Técnico:** Iluminar de forma automatizada en las descripciones las palabras clave del stack principal de Mario (React, Node, Angular, TypeScript) para identificar el porcentaje de *match* al instante.