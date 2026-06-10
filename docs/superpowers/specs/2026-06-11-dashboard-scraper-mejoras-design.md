# Mejoras dashboard + scraper — diseño aprobado (2026-06-11)

## Problemas detectados

1. Filtro de ofertas vistas eliminado (cambios sin commitear): runs repetían todo y, en la versión anterior, días sin novedades no generaban resumen → dashboard vacío.
2. `googlejobs.js` reescrito a scraper InfoJobs por CSS: los selectores solo capturan 5 de ~22 ofertas (la página renderiza con React).
3. Las cartas se regeneraban siempre: el endpoint `GET /api/runs/:date/carta/:slug` existía pero el frontend no lo usaba.
4. Colisión de slugs: slug = solo empresa → dos ofertas de la misma empresa sobrescribían la misma carta.
5. Filtro `excluir` con `includes`: "java" descartaba también "JavaScript".
6. Menores: `/api/status` con default `llama3.2` (spec: `llama3`), N+1 requests para badges del sidebar, `escapeHtml` sin comillas.

## Diseño

### 1. Scraper InfoJobs (`src/scraper/infojobs.js`, nuevo)
- Parsea el JSON embebido `window.__INITIAL_PROPS__` → 22 ofertas/página con descripción completa, salario y modalidad.
- `googlejobs.js` vuelve a su versión de spec (deshabilitado sin Playwright).
- Campos extra por oferta: `salario`, `modalidad` (vacíos si la fuente no los da).

### 2. Filtro de vistas: resumen siempre, marcar nuevas
- Cada run genera resumen con todas las ofertas encontradas; campo `nueva` según `data/seen_jobs.json`.
- Las nuevas se ordenan primero antes del corte `MAX_OFFERS_PER_RUN`.
- `seen_jobs.json` se actualiza con todas las URLs scrapeadas, no solo las mostradas.
- Filtro `excluir` por palabra completa (regex `\b`).

### 3. Cartas persistentes
- Slug único: `slug(empresa)_hash6(url)`.
- `GET /api/runs/:date` devuelve además `cartas: [slugs con carta guardada]`.
- Frontend: si hay carta guardada la carga del disco (botón "Ver carta"); botón "Regenerar" para forzar nueva generación con Ollama.

### 4. Menores
- `/api/runs` devuelve `[{date, total}]` → sidebar sin N+1.
- `/api/status` default `llama3`.
- `escapeHtml` escapa comillas; URLs escapadas en atributos.
- Validación de `:date` y `:slug` en rutas (formato estricto).

## Verificación
- Run real de scraping (`npm start`) genera resumen con `nueva`, `salario`, `modalidad`.
- Dashboard carga, ordena nuevas primero y muestra cartas guardadas sin llamar a Ollama.
