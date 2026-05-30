# Contexto del proyecto — job-hunter-ai

## Quién soy

Me llamo Mario. Soy desarrollador fullstack junior recién salido de un bootcamp en Neoland (Madrid, 2026). Mi proyecto final fue elegido el mejor de la promoción. Antes de programar, fui autónomo durante 5 años gestionando mi propio gimnasio (franquicia TRIB3 Goya): P&L completo, equipo, KPIs, retención de socios. Eso es mi diferenciador frente a otros juniors.

Nivel técnico actual: sé lo que hago en JavaScript/Node/React pero soy junior. Explícame las decisiones que tomes. No asumas que sé cosas avanzadas sin avisarme.

---

## Qué estamos construyendo

Una herramienta CLI en Node.js que automatiza mi búsqueda de trabajo:

1. Scraping de ofertas en Tecnoempleo y Google Jobs (portales públicos, sin login)
2. Puntuación de cada oferta con Claude API según mi perfil técnico
3. Generación de carta de presentación personalizada para las ofertas con puntuación >= 7
4. Output diario en Markdown: resumen de ofertas + cartas listas para copiar y pegar
5. Envío del resumen por email (opcional, con nodemailer)

---

## Mi perfil técnico (para los prompts de Claude API)

```javascript
{
  nombre: "Mario Minuesa",
  email: "mario@minuesa.es",
  ubicacion: "Madrid",
  stack: {
    principales: ["Node.js", "React", "Angular", "MongoDB", "JavaScript", "TypeScript"],
    secundarios: ["HTML5", "CSS3", "REST APIs", "JWT", "Express", "Git"],
    aprendiendo: ["Claude API", "MCP", "automatizaciones con IA"]
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
- **Scraping:** axios + cheerio (páginas estáticas), playwright (páginas con JS dinámico)
- **IA:** @anthropic-ai/sdk — modelo `claude-sonnet-4-20250514`
- **Config:** dotenv para variables de entorno
- **Email:** nodemailer (opcional)
- **Dev:** nodemon

Sin frameworks de servidor. Solo scripts CLI que puedo leer y entender.

---

## Estructura de archivos que debes crear

```
job-hunter-ai/
├── src/
│   ├── scraper/
│   │   ├── tecnoempleo.js
│   │   ├── googlejobs.js
│   │   └── index.js
│   ├── ai/
│   │   ├── scorer.js
│   │   ├── letterWriter.js
│   │   └── prompts.js
│   ├── utils/
│   │   ├── storage.js
│   │   ├── output.js
│   │   └── mailer.js
│   ├── config/
│   │   └── profile.js
│   └── index.js
├── data/
│   └── .gitkeep
├── output/
│   └── .gitkeep
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Reglas que debes seguir siempre

### Credenciales
- Las credenciales SIEMPRE van en `.env`, nunca hardcodeadas
- `.env` va en `.gitignore` siempre
- Usa `dotenv` con `require('dotenv').config()` al inicio de `src/index.js`

### Llamadas a Claude API
- Modelo siempre: `claude-sonnet-4-20250514`
- `max_tokens: 1024` para puntuaciones, `max_tokens: 2048` para cartas
- SIEMPRE envuelve las llamadas en try/catch
- Si Claude devuelve JSON, usa JSON.parse dentro de try/catch con fallback
- No hagas más de 1 llamada a la API por segundo (añade un sleep entre llamadas)

### Scraping
- No más de 1 petición por segundo a cada portal (setTimeout entre requests)
- Usa User-Agent realista: `'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'`
- Si el scraping falla, loga el error y continúa con el siguiente portal — no rompas el flujo completo
- Antes de scrapear, comprueba que la oferta no está ya en `data/seen_jobs.json`

### Storage
- `data/seen_jobs.json` guarda un array de IDs/URLs ya procesadas
- Si el archivo no existe, créalo vacío: `[]`
- Actualiza el archivo al final de cada ejecución, no durante

### Output
- Carpeta `/output/YYYY-MM-DD/` con la fecha de hoy
- Un archivo `resumen.md` con todas las ofertas y puntuaciones
- Un archivo por carta: `{empresa_slug}_carta.md`
- Los slugs en minúsculas sin espacios ni caracteres especiales

### Código
- CommonJS (`require`, `module.exports`) — no ESModules
- Async/await siempre — no callbacks ni .then() encadenados
- Funciones pequeñas con un solo propósito
- Comenta las secciones importantes en español
- Si una función tiene más de 40 líneas, divídela

---

## Prompts para Claude API

### Prompt de puntuación (scorer.js)

```
Eres un asistente que evalúa ofertas de trabajo para un desarrollador fullstack junior.

PERFIL DEL CANDIDATO:
- Stack principal: Node.js, React, Angular, MongoDB, JavaScript, TypeScript
- Formación: Bootcamp Fullstack Neoland 2026, mejor proyecto de la promoción
- Diferenciador: 5 años como autónomo gestionando negocio (P&L, KPIs, equipo)
- Ubicación: Madrid. Acepta presencial, híbrido y remoto.
- Excluir: ofertas que pidan Java, PHP, perfil senior o más de 3 años de experiencia

OFERTA A EVALUAR:
{oferta_completa}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON:
{
  "puntuacion": <número del 1 al 10>,
  "apto": <true si puntuacion >= 7, false si no>,
  "motivo": "<explicación en 2-3 frases de por qué encaja o no>",
  "keywords_match": ["<tecnologías de la oferta que coinciden con el perfil>"],
  "alerta": "<si hay algo raro en la oferta como salario muy bajo o requisitos contradictorios, ponlo aquí. Si no hay nada, pon null>"
}
```

### Prompt de carta (letterWriter.js)

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
ANTHROPIC_API_KEY=sk-ant-...

# Email (opcional)
EMAIL_FROM=mario@minuesa.es
EMAIL_TO=mario@minuesa.es
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=mario@minuesa.es
EMAIL_SMTP_PASS=xxxx_xxxx_xxxx_xxxx

# Configuración
MAX_OFFERS_PER_RUN=20
MIN_SCORE_FOR_LETTER=7
```

---

## Comportamiento esperado al ejecutar `npm start`

```
[07:00] Iniciando job-hunter-ai...
[07:00] Cargando ofertas ya vistas: 34 registros
[07:00] Scraping Tecnoempleo...
[07:01] Tecnoempleo: 12 ofertas encontradas, 4 nuevas
[07:01] Scraping Google Jobs...
[07:02] Google Jobs: 8 ofertas encontradas, 3 nuevas
[07:02] Total ofertas nuevas: 7
[07:02] Puntuando ofertas con Claude API...
[07:02] → Empresa ABC: 9/10 ✅
[07:03] → Empresa DEF: 8/10 ✅
[07:03] → Empresa GHI: 4/10 ❌
[07:03] → Empresa JKL: 7/10 ✅
[07:04] → Empresa MNO: 2/10 ❌
[07:04] → Empresa PQR: 6/10 ❌
[07:04] → Empresa STU: 8/10 ✅
[07:04] Generando cartas para 4 ofertas...
[07:05] Cartas generadas: 4
[07:05] Resumen guardado en: output/2026-05-31/resumen.md
[07:06] Email enviado a mario@minuesa.es
[07:06] seen_jobs.json actualizado: 41 registros
[07:06] ✅ Completado. 4 candidaturas listas.
```

---

## Lo que NO debes hacer

- No uses ESModules (`import/export`) — solo CommonJS
- No instales paquetes que no estén en la lista del stack salvo que me lo expliques primero
- No hagas llamadas a la API sin rate limiting
- No hardcodees credenciales bajo ningún concepto
- No crees archivos de configuración adicionales sin decirme para qué sirven
- No uses `console.log` para todo — usa un logger simple con prefijo de hora `[HH:MM]`
- No continues si `ANTHROPIC_API_KEY` no está definida — lanza un error claro al arrancar

---

## Cómo empezar

Construye el proyecto en este orden:

1. `package.json` con todas las dependencias y scripts
2. `.gitignore` y `.env.example`
3. `src/config/profile.js` con mi perfil
4. `src/utils/storage.js` — lectura/escritura de seen_jobs.json
5. `src/scraper/tecnoempleo.js` — scraper básico
6. `src/scraper/googlejobs.js` — scraper básico
7. `src/scraper/index.js` — orquesta ambos scrapers
8. `src/ai/prompts.js` — todos los prompts centralizados
9. `src/ai/scorer.js` — puntuación con Claude API
10. `src/ai/letterWriter.js` — generación de cartas
11. `src/utils/output.js` — genera el resumen Markdown
12. `src/utils/mailer.js` — envío por email (opcional)
13. `src/index.js` — punto de entrada, orquesta todo

Crea un archivo cada vez. Antes de pasar al siguiente, asegúrate de que el anterior no tiene errores de sintaxis.
