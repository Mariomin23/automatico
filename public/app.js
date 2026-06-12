let selectedDate = null;
let runSource = null;
const runData = {};

// En producción no hay LLM: generar cartas solo funciona en local
let cartasDisponibles = true;

// CRM: estados por slug ({ slug: 'aplicado' | 'descartado' }); 'pendiente' = sin entrada
let estados = {};

// Filtros activos del run visible
const filtros = { soloNuevas: false, modalidad: '', texto: '' };

// Contexto de la carta abierta en el panel lateral
let cartaCtx = null; // { idx, date, controller }

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  checkStatus();
  try {
    estados = await api('/api/estados');
  } catch {
    estados = {};
  }
  await loadRuns();
}

// ── Token de administración ───────────────────────────────────────────────────
// En producción las acciones que escriben (búsquedas, cartas, CRM) piden un
// token que solo tiene el dueño. En local el servidor no lo exige.

function adminToken() {
  return localStorage.getItem('adminToken') || '';
}

function adminHeaders() {
  const t = adminToken();
  return t ? { 'X-Admin-Token': t } : {};
}

async function tokenValido() {
  const res = await fetch('/api/admin/check', { headers: adminHeaders() });
  return res.ok;
}

// Devuelve true si hay permiso (pidiendo el token al usuario si hace falta)
async function asegurarAdmin() {
  if (await tokenValido()) return true;
  const t = window.prompt('Acción reservada al dueño del dashboard.\nToken de administración:');
  if (!t) return false;
  localStorage.setItem('adminToken', t.trim());
  if (await tokenValido()) return true;
  alert('Token incorrecto');
  localStorage.removeItem('adminToken');
  return false;
}

// ── Ollama status ─────────────────────────────────────────────────────────────

async function checkStatus() {
  try {
    const data = await api('/api/status');
    cartasDisponibles = data.cartas !== false;
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('statusLabel');
    if (!cartasDisponibles) {
      dot.className = 'status-dot offline';
      label.textContent = 'Cartas: solo en entorno local';
      return;
    }
    const nombre = data.proveedor === 'groq' ? 'Groq' : 'Ollama';
    if (data.ollama) {
      dot.className = 'status-dot online';
      label.textContent = `${nombre} OK · ${data.modelo}`;
    } else {
      dot.className = 'status-dot offline';
      label.textContent = data.proveedor === 'groq'
        ? 'Groq offline — revisa GROQ_API_KEY'
        : 'Ollama offline — ejecuta: ollama serve';
    }
  } catch {
    document.getElementById('statusLabel').textContent = 'Error conectando';
  }
}

// ── Historial de runs ─────────────────────────────────────────────────────────

async function loadRuns() {
  const runs = await api('/api/runs'); // [{ date, total }]
  const list = document.getElementById('dateList');

  if (!runs.length) {
    list.innerHTML = '<div style="padding: 8px 8px; font-size: 12px; color: #4b5563;">Sin runs todavía</div>';
    return;
  }

  list.innerHTML = runs.map(({ date, total }) => `
    <div class="date-item" id="date-${date}" onclick="selectDate('${date}')">
      <span>${formatDate(date)}</span>
      <span class="date-badge">${total}</span>
    </div>
  `).join('');

  // Selecciona el más reciente por defecto
  selectDate(runs[0].date);
}

async function selectDate(date) {
  selectedDate = date;

  document.querySelectorAll('.date-item').forEach((el) => el.classList.remove('active'));
  const item = document.getElementById(`date-${date}`);
  if (item) item.classList.add('active');

  await loadRun(date);
}

// ── Datos de un run ───────────────────────────────────────────────────────────

async function loadRun(date) {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';

  let data;
  try {
    data = await api(`/api/runs/${date}`);
  } catch {
    main.innerHTML = '<div class="empty-state"><p>Error cargando datos</p></div>';
    return;
  }

  // Nuevas primero; dentro de cada grupo, por experiencia requerida
  const ofertasOrdenadas = data.ofertas
    .map((o) => ({ ...o, _exp: extraerExperiencia(o) }))
    .sort((a, b) => (b.nueva ? 1 : 0) - (a.nueva ? 1 : 0) || a._exp - b._exp);

  runData[date] = { ...data, ofertas: ofertasOrdenadas, cartas: data.cartas || [] };

  // Cada run empieza con los filtros limpios
  filtros.soloNuevas = false;
  filtros.modalidad = '';
  filtros.texto = '';

  const numNuevas = ofertasOrdenadas.filter((o) => o.nueva).length;

  main.innerHTML = `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-value">${data.total}</div>
        <div class="stat-label">Ofertas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${numNuevas}</div>
        <div class="stat-label">Nuevas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatDate(date)}</div>
        <div class="stat-label">Fecha</div>
      </div>
    </div>
    <div class="filters-bar">
      <input type="search" class="filter-input" id="fTexto" placeholder="🔍 Buscar tecnología, empresa, puesto..."
             oninput="setFiltro('texto', this.value)">
      <select class="filter-select" id="fModalidad" onchange="setFiltro('modalidad', this.value)">
        <option value="">Modalidad: todas</option>
        <option value="remoto">Remoto</option>
        <option value="híbrido">Híbrido</option>
        <option value="presencial">Presencial</option>
      </select>
      <label class="filter-check">
        <input type="checkbox" id="fNuevas" onchange="setFiltro('soloNuevas', this.checked)">
        Solo nuevas
      </label>
      <span class="filter-count" id="filterCount"></span>
    </div>
    <div class="jobs-grid" id="jobsGrid"></div>
  `;

  const grid = document.getElementById('jobsGrid');
  ofertasOrdenadas.forEach((oferta, i) => {
    grid.appendChild(buildJobCard(oferta, date, i));
  });

  aplicarFiltros();
}

// ── Filtros en tiempo real ────────────────────────────────────────────────────

function setFiltro(clave, valor) {
  filtros[clave] = typeof valor === 'string' ? valor.trim().toLowerCase() : valor;
  aplicarFiltros();
}

function aplicarFiltros() {
  const data = runData[selectedDate];
  if (!data) return;

  let visibles = 0;

  data.ofertas.forEach((oferta, idx) => {
    const card = document.getElementById(`card-${idx}`);
    if (!card) return;

    let visible = true;

    if (filtros.soloNuevas && !oferta.nueva) visible = false;

    if (visible && filtros.modalidad) {
      visible = (oferta.modalidad || '').toLowerCase().includes(filtros.modalidad);
    }

    if (visible && filtros.texto) {
      const texto = `${oferta.titulo} ${oferta.empresa} ${oferta.descripcion || ''}`.toLowerCase();
      visible = texto.includes(filtros.texto);
    }

    card.classList.toggle('hidden', !visible);
    if (visible) visibles++;
  });

  const count = document.getElementById('filterCount');
  if (count) {
    const hayFiltros = filtros.soloNuevas || filtros.modalidad || filtros.texto;
    count.textContent = hayFiltros ? `${visibles} de ${data.ofertas.length} ofertas` : '';
  }
}

// ── Job card ──────────────────────────────────────────────────────────────────

function buildJobCard(oferta, date, idx) {
  const card = document.createElement('div');
  card.className = 'job-card';
  card.id = `card-${idx}`;

  const estado = estados[oferta.slug] || 'pendiente';
  if (estado !== 'pendiente') card.classList.add(`estado-${estado}`);

  const expLabel = expTexto(oferta._exp);
  const expClass = oferta._exp === 0 ? 'exp-none' : oferta._exp <= 1 ? 'exp-low' : oferta._exp <= 3 ? 'exp-mid' : 'exp-high';

  // Badges agrupados bajo el título: icono + color pastel con propósito
  const badges = [
    oferta.nueva ? '<span class="badge badge-nueva">🆕 Nueva</span>' : '',
    oferta.salario ? `<span class="badge badge-salario">💶 ${escapeHtml(oferta.salario)}</span>` : '',
    oferta.modalidad ? `<span class="badge badge-modalidad">🏠 ${escapeHtml(oferta.modalidad)}</span>` : '',
    `<span class="badge badge-exp ${expClass}">🧭 ${expLabel}</span>`,
    oferta.fuente ? `<span class="badge badge-fuente">📌 ${escapeHtml(oferta.fuente)}</span>` : '',
  ].filter(Boolean).join('');

  // Descripción completa con stack resaltado, limitada a 3 líneas con fade
  const descHtml = oferta.descripcion ? resaltarStack(escapeHtml(oferta.descripcion)) : '';
  const necesitaLeerMas = (oferta.descripcion || '').length > 180;

  const tieneCarta = (runData[date]?.cartas || []).includes(oferta.slug);

  card.innerHTML = `
    <div class="job-head">
      <div class="job-title">${escapeHtml(oferta.titulo)}</div>
      <div class="job-company">${escapeHtml(oferta.empresa)}</div>
      <div class="job-badges">${badges}</div>
    </div>
    ${descHtml ? `
    <div class="job-desc-wrap">
      <div class="job-desc clamp" id="desc-${idx}">${descHtml}</div>
      ${necesitaLeerMas ? `<button class="leer-mas" id="leermas-${idx}" onclick="toggleDesc(${idx})">Leer más…</button>` : ''}
    </div>` : ''}
    <div class="job-foot">
      <div class="estado-control" id="estado-${idx}">
        ${botonesEstado(oferta.slug, idx, estado)}
      </div>
      <div class="job-actions">
        <a class="btn" href="${escapeHtml(oferta.url)}" target="_blank" rel="noopener">🔗 Ver oferta</a>
        <button class="btn ${tieneCarta ? 'secondary' : 'primary'}" id="btn-carta-${idx}"
                onclick="abrirCarta(${idx}, '${date}')">${labelBotonCarta(date, oferta.slug)}</button>
      </div>
    </div>
  `;

  return card;
}

function toggleDesc(idx) {
  const desc = document.getElementById(`desc-${idx}`);
  const btn = document.getElementById(`leermas-${idx}`);
  const clamped = desc.classList.toggle('clamp');
  btn.textContent = clamped ? 'Leer más…' : 'Leer menos';
}

// Resalta el stack principal de Mario en la descripción (ya escapada)
function resaltarStack(textoEscapado) {
  const re = /\b(node\.?js|node|react|angular|typescript|javascript|mongodb|express)\b/gi;
  return textoEscapado.replace(re, '<mark class="stack-hl">$1</mark>');
}

// ── CRM de candidaturas ───────────────────────────────────────────────────────

const ESTADOS_UI = [
  { id: 'pendiente', label: '⏳ Pendiente' },
  { id: 'aplicado', label: '✅ Aplicado' },
  { id: 'descartado', label: '❌ Descartado' },
];

function botonesEstado(slug, idx, actual) {
  return ESTADOS_UI.map(({ id, label }) => `
    <button class="estado-btn ${id} ${actual === id ? 'active' : ''}"
            onclick="setEstado('${slug}', '${id}', ${idx})">${label}</button>
  `).join('');
}

async function setEstado(slug, estado, idx) {
  try {
    let res = await fetch(`/api/estados/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({ estado }),
    });
    if (res.status === 401) {
      if (!(await asegurarAdmin())) return;
      res = await fetch(`/api/estados/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ estado }),
      });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    return; // si falla el guardado, no cambia la UI
  }

  if (estado === 'pendiente') delete estados[slug];
  else estados[slug] = estado;

  const card = document.getElementById(`card-${idx}`);
  card.classList.remove('estado-aplicado', 'estado-descartado');
  if (estado !== 'pendiente') card.classList.add(`estado-${estado}`);
  document.getElementById(`estado-${idx}`).innerHTML = botonesEstado(slug, idx, estado);
}

// ── Cartas: panel lateral ─────────────────────────────────────────────────────

function labelBotonCarta(date, slug) {
  const tieneCarta = (runData[date]?.cartas || []).includes(slug);
  return tieneCarta ? '📄 Ver carta guardada' : '✉️ Generar carta';
}

function abrePanel(oferta) {
  document.getElementById('panelTitle').textContent = oferta.titulo;
  document.getElementById('panelSubtitle').textContent = oferta.empresa;
  document.getElementById('panelCarta').textContent = '';
  document.getElementById('panelMsg').textContent = '';
  document.getElementById('panelFooter').innerHTML = '';
  document.getElementById('panelOverlay').classList.add('open');
  const panel = document.getElementById('cartaPanel');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
}

function cerrarPanel() {
  if (cartaCtx?.controller) cartaCtx.controller.abort();
  cartaCtx = null;
  document.getElementById('panelOverlay').classList.remove('open');
  const panel = document.getElementById('cartaPanel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function accionesCarta(idx, date, nombreFichero) {
  return `
    <button class="btn primary" onclick="copyCarta()">📋 Copiar al portapapeles</button>
    <button class="btn" onclick="descargarCarta('${nombreFichero}')">⬇️ Descargar .txt</button>
    <button class="btn" onclick="abrirCarta(${idx}, '${date}', true)">🔄 Regenerar</button>
  `;
}

async function abrirCarta(idx, date, regenerar = false) {
  const oferta = runData[date]?.ofertas[idx];
  if (!oferta) return;

  abrePanel(oferta);
  cartaCtx = { idx, date, controller: null };

  const cartaEl = document.getElementById('panelCarta');
  const msgEl = document.getElementById('panelMsg');
  const footer = document.getElementById('panelFooter');
  const nombreFichero = `carta_${oferta.slug}.txt`;

  // Carta guardada en disco: se muestra al instante, sin llamar a Ollama
  if (!regenerar && (runData[date].cartas || []).includes(oferta.slug)) {
    try {
      const data = await api(`/api/runs/${date}/carta/${oferta.slug}`);
      cartaEl.textContent = data.carta;
      footer.innerHTML = accionesCarta(idx, date, nombreFichero);
      return;
    } catch {
      // Si falla la lectura, cae al flujo de generación
    }
  }

  // En producción no hay LLM: la generación queda deshabilitada
  if (!cartasDisponibles) {
    msgEl.textContent = '⚠️ Esta función solo está disponible en entorno local.';
    footer.innerHTML = '';
    return;
  }

  // Generar cuesta recursos: requiere token de administración en producción
  if (!(await asegurarAdmin())) {
    msgEl.textContent = 'Generación cancelada: hace falta el token de administración.';
    return;
  }

  msgEl.textContent = '⏳ Generando...';
  const controller = new AbortController();
  cartaCtx.controller = controller;
  footer.innerHTML = `<button class="btn" onclick="detenerCarta()" style="color:var(--red);border-color:var(--red)">⏹ Detener</button>`;

  try {
    const res = await fetch('/api/carta/generar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      signal: controller.signal,
      body: JSON.stringify({
        titulo: oferta.titulo,
        empresa: oferta.empresa,
        descripcion: oferta.descripcion,
        url: oferta.url,
        date,
        slug: oferta.slug,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lineas = buffer.split('\n');
      buffer = lineas.pop();

      for (const linea of lineas) {
        if (!linea.startsWith('data: ')) continue;
        const msg = JSON.parse(linea.slice(6));

        if (msg.error) throw new Error(msg.error);

        if (msg.token) {
          cartaEl.textContent += msg.token;
          cartaEl.scrollTop = cartaEl.scrollHeight;
        }

        if (msg.done) {
          msgEl.textContent = '';
          footer.innerHTML = accionesCarta(idx, date, nombreFichero);
          // La carta queda guardada en disco — el botón de la tarjeta pasa a "Ver carta"
          if (!runData[date].cartas.includes(oferta.slug)) runData[date].cartas.push(oferta.slug);
          const btn = document.getElementById(`btn-carta-${idx}`);
          if (btn) {
            btn.textContent = labelBotonCarta(date, oferta.slug);
            btn.classList.remove('primary');
            btn.classList.add('secondary');
          }
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      // Generación detenida por el usuario — deja el texto parcial visible
      if (cartaEl.textContent.trim()) {
        msgEl.textContent = 'Detenido. Texto parcial visible.';
        footer.innerHTML = `
          <button class="btn" onclick="copyCarta()">📋 Copiar parcial</button>
          <button class="btn" onclick="descargarCarta('${nombreFichero}')">⬇️ Descargar .txt</button>
        `;
      }
    } else {
      msgEl.textContent = `Error: ${err.message}`;
      msgEl.style.color = 'var(--red)';
    }
  }
}

function detenerCarta() {
  if (cartaCtx?.controller) cartaCtx.controller.abort();
}

function copyCarta() {
  const box = document.getElementById('panelCarta');
  if (!box || !box.textContent) return;
  navigator.clipboard.writeText(box.textContent).then(() => {
    const btn = document.querySelector('#panelFooter .btn');
    const original = btn.textContent;
    btn.textContent = '✅ Copiado';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
}

function descargarCarta(nombre) {
  const box = document.getElementById('panelCarta');
  if (!box) return;
  const blob = new Blob([box.textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Nueva búsqueda con logs en vivo ───────────────────────────────────────────

async function startRun() {
  // Lanzar búsquedas queda reservado al dueño en producción
  if (!(await asegurarAdmin())) return;

  const overlay = document.getElementById('modalOverlay');
  const logArea = document.getElementById('logArea');
  const title = document.getElementById('modalTitle');
  const runBtn = document.getElementById('runBtn');

  logArea.innerHTML = '';
  title.textContent = '⚙️ Ejecutando búsqueda...';
  overlay.classList.add('open');
  runBtn.disabled = true;

  if (runSource) runSource.close();

  // EventSource no permite headers: el token va en la query
  const qs = adminToken() ? `?token=${encodeURIComponent(adminToken())}` : '';
  runSource = new EventSource(`/api/run/start${qs}`);

  runSource.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    const line = document.createElement('div');

    if (msg.type === 'done') {
      line.className = 'log-line done';
      line.textContent = msg.code === 0 ? '✅ Completado' : `❌ Error (código ${msg.code})`;
      title.textContent = msg.code === 0 ? '✅ Búsqueda completada' : '❌ Error en la búsqueda';
      runBtn.disabled = false;
      runSource.close();
      // Recarga el historial para mostrar el nuevo run
      setTimeout(() => loadRuns(), 500);
    } else {
      line.className = msg.type === 'error' ? 'log-line error' : 'log-line';
      line.textContent = msg.msg;
    }

    logArea.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
  };

  runSource.onerror = () => {
    const line = document.createElement('div');
    line.className = 'log-line error';
    line.textContent = 'Conexión perdida con el servidor';
    logArea.appendChild(line);
    runBtn.disabled = false;
  };
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  if (runSource) {
    runSource.close();
    runSource = null;
  }
}

// ── Experiencia ───────────────────────────────────────────────────────────────

function extraerExperiencia(oferta) {
  const texto = `${oferta.titulo} ${oferta.descripcion || ''}`.toLowerCase();

  // Sin experiencia explícita
  if (/sin experiencia|no.*experiencia|sin exp\b|recién graduado|recien graduado|no experience|entry.?level/.test(texto)) return 0;

  // Rango "X-Y años" — toma el mínimo
  const rango = texto.match(/(\d+)\s*[-a]\s*(\d+)\s*a[ñn]/);
  if (rango) return parseInt(rango[1], 10);

  // "al menos X años", "mínimo X años", "X+ años"
  const minimo = texto.match(/(?:al menos|m[íi]nimo|m[íi]n\.?|al menos|at least)\s*(\d+)\s*a[ñn]/);
  if (minimo) return parseInt(minimo[1], 10);

  // "X años de experiencia"
  const exacto = texto.match(/(\d+)\s*a[ñn]o[s]?\s*(?:de\s*)?(?:experiencia|exp\b)/);
  if (exacto) return parseInt(exacto[1], 10);

  // Número de años suelto cerca de "experiencia"
  const suelto = texto.match(/(\d+)\s*a[ñn]/);
  if (suelto) return parseInt(suelto[1], 10);

  // Keywords de nivel sin número
  if (/\bjunior\b|\bjr\.?\b/.test(texto)) return 0;
  if (/\bmid[\s-]?level\b|\bsemi[\s-]?senior\b/.test(texto)) return 2;
  if (/\bsenior\b|\bsr\.?\b/.test(texto)) return 4;
  if (/\blead\b|\bstaff\b|\bprincipal\b|\barchitect/.test(texto)) return 6;

  // Sin pistas — va al final del grupo "sin datos"
  return 99;
}

function expTexto(años) {
  if (años === 0) return 'Sin exp.';
  if (años === 99) return 'Sin datos';
  if (años === 1) return '1 año';
  return `${años} años`;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

async function api(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// La carpeta en disco es YYYY-MM-DD (ordena bien); aquí se muestra DD-MM-YYYY
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Arranca ───────────────────────────────────────────────────────────────────
init();
