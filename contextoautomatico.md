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
    keywords: ["fullstack", "node", "react", "angular", "javascript", "junior"],
    excluir: ["java", "php", "senior", "lead"]
  }
}
```

---

## Stack del proyecto

- **Runtime:** Node.js 18+
- **Scraping:** axios + cheerio (páginas estáticas)
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
│       └── {empresa_slug}_carta.md   ← generadas bajo demanda
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
- Usa `stream: false` en todas las llamadas

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
Abre el navegador en esa URL. El dashboard carga las ofertas del run más reciente, ordenadas por experiencia.

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
