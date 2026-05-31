let selectedDate = null;
let runSource = null;
const runData = {};

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  checkStatus();
  await loadRuns();
}

// ── Ollama status ─────────────────────────────────────────────────────────────

async function checkStatus() {
  try {
    const data = await api('/api/status');
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('statusLabel');
    if (data.ollama) {
      dot.className = 'status-dot online';
      label.textContent = `Ollama OK · ${data.modelo}`;
    } else {
      dot.className = 'status-dot offline';
      label.textContent = 'Ollama offline — ejecuta: ollama serve';
    }
  } catch {
    document.getElementById('statusLabel').textContent = 'Error conectando';
  }
}

// ── Historial de runs ─────────────────────────────────────────────────────────

async function loadRuns() {
  const runs = await api('/api/runs');
  const list = document.getElementById('dateList');

  if (!runs.length) {
    list.innerHTML = '<div style="padding: 8px 8px; font-size: 12px; color: #4b5563;">Sin runs todavía</div>';
    return;
  }

  list.innerHTML = runs.map((date) => `
    <div class="date-item" id="date-${date}" onclick="selectDate('${date}')">
      <span>${formatDate(date)}</span>
      <span class="date-badge" id="badge-${date}">—</span>
    </div>
  `).join('');

  // Carga badges de conteo en paralelo
  runs.forEach(async (date) => {
    try {
      const data = await api(`/api/runs/${date}`);
      const badge = document.getElementById(`badge-${date}`);
      if (badge) badge.textContent = data.total;
    } catch {}
  });

  // Selecciona el más reciente por defecto
  selectDate(runs[0]);
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
    runData[date] = data;
  } catch {
    main.innerHTML = '<div class="empty-state"><p>Error cargando datos</p></div>';
    return;
  }

  // Añade campo experiencia y ordena
  const ofertasOrdenadas = data.ofertas
    .map((o) => ({ ...o, _exp: extraerExperiencia(o) }))
    .sort((a, b) => a._exp - b._exp);

  runData[date] = { ...data, ofertas: ofertasOrdenadas };

  main.innerHTML = `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-value">${data.total}</div>
        <div class="stat-label">Ofertas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.fecha}</div>
        <div class="stat-label">Fecha</div>
      </div>
    </div>
    <div class="jobs-grid" id="jobsGrid"></div>
  `;

  const grid = document.getElementById('jobsGrid');
  ofertasOrdenadas.forEach((oferta, i) => {
    grid.appendChild(buildJobCard(oferta, date, i));
  });
}

// ── Job card ──────────────────────────────────────────────────────────────────

function buildJobCard(oferta, date, idx) {
  const card = document.createElement('div');
  card.className = 'job-card';
  card.id = `card-${idx}`;

  const desc = oferta.descripcion
    ? `<p class="job-motivo">${escapeHtml(oferta.descripcion.slice(0, 300))}${oferta.descripcion.length > 300 ? '…' : ''}</p>`
    : '';

  const expLabel = expTexto(oferta._exp);
  const expClass = oferta._exp === 0 ? 'exp-none' : oferta._exp <= 1 ? 'exp-low' : oferta._exp <= 3 ? 'exp-mid' : 'exp-high';

  card.innerHTML = `
    <div class="job-header" onclick="toggleCard(${idx})">
      <div class="job-info">
        <div class="job-title">${escapeHtml(oferta.titulo)}</div>
        <div class="job-company">${escapeHtml(oferta.empresa)}</div>
      </div>
      <div class="job-meta">
        <span class="exp-badge ${expClass}">${expLabel}</span>
        <span class="fuente-badge">${oferta.fuente || ''}</span>
        <span class="chevron">▶</span>
      </div>
    </div>
    <div class="job-body">
      ${desc}
      <div class="job-actions">
        <a class="btn" href="${oferta.url}" target="_blank" rel="noopener">🔗 Ver oferta</a>
        <button class="btn primary" id="btn-carta-${idx}" onclick="generarCarta(${idx}, '${date}')">✉️ Generar carta de presentación</button>
      </div>
      <div id="carta-${idx}"></div>
    </div>
  `;

  return card;
}

function toggleCard(idx) {
  const card = document.getElementById(`card-${idx}`);
  card.classList.toggle('open');
}


async function generarCarta(idx, date) {
  const card = document.getElementById(`card-${idx}`);
  const container = document.getElementById(`carta-${idx}`);
  const btn = document.getElementById(`btn-carta-${idx}`);

  // Si ya hay carta visible, la oculta
  if (container.innerHTML) {
    container.innerHTML = '';
    btn.textContent = '✉️ Generar carta de presentación';
    btn.disabled = false;
    return;
  }

  btn.textContent = '⏳ Generando...';
  btn.disabled = true;

  const oferta = runData[date]?.ofertas[idx];
  if (!oferta) {
    container.innerHTML = '<p class="carta-loading">Error: oferta no encontrada</p>';
    btn.textContent = '✉️ Generar carta de presentación';
    btn.disabled = false;
    return;
  }

  const nombreFichero = `carta_${oferta.slug}.txt`;
  const controller = new AbortController();

  container.innerHTML = `
    <div class="carta-box" id="carta-text-${idx}"></div>
    <div style="margin-top:8px">
      <button class="btn" id="btn-detener-${idx}" onclick="detenerCarta(${idx})" style="color:var(--red);border-color:var(--red)">⏹ Detener</button>
    </div>
  `;
  const cartaEl = document.getElementById(`carta-text-${idx}`);

  // Guarda el controller para poder abortar desde el botón
  cartaEl._controller = controller;

  try {
    const res = await fetch('/api/carta/generar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          // Reemplaza botón Detener por Copiar + Descargar
          document.getElementById(`btn-detener-${idx}`)?.parentElement.remove();
          container.insertAdjacentHTML('beforeend', `
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn" onclick="copyCarta(${idx})">📋 Copiar</button>
              <button class="btn" onclick="descargarCarta(${idx}, '${nombreFichero}')">⬇️ Descargar .txt</button>
            </div>
          `);
          btn.textContent = '✉️ Ocultar carta';
          btn.disabled = false;
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      // Generación detenida por el usuario — deja el texto parcial visible
      document.getElementById(`btn-detener-${idx}`)?.parentElement.remove();
      if (cartaEl.textContent.trim()) {
        container.insertAdjacentHTML('beforeend', `
          <p class="carta-loading" style="color:var(--orange)">Detenido. Texto parcial guardado.</p>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn" onclick="copyCarta(${idx})">📋 Copiar parcial</button>
            <button class="btn" onclick="descargarCarta(${idx}, '${nombreFichero}')">⬇️ Descargar .txt</button>
          </div>
        `);
      }
    } else {
      container.innerHTML = `<p class="carta-loading" style="color:var(--red)">Error: ${escapeHtml(err.message)}</p>`;
    }
    btn.textContent = '✉️ Generar carta de presentación';
    btn.disabled = false;
  }
}

function detenerCarta(idx) {
  const cartaEl = document.getElementById(`carta-text-${idx}`);
  if (cartaEl?._controller) cartaEl._controller.abort();
}

function copyCarta(idx) {
  const box = document.getElementById(`carta-text-${idx}`);
  if (!box) return;
  navigator.clipboard.writeText(box.textContent).then(() => {
    const btn = document.querySelector(`#carta-${idx} .btn`);
    btn.textContent = '✅ Copiado';
    setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
  });
}

function descargarCarta(idx, nombre) {
  const box = document.getElementById(`carta-text-${idx}`);
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

function startRun() {
  const overlay = document.getElementById('modalOverlay');
  const logArea = document.getElementById('logArea');
  const title = document.getElementById('modalTitle');
  const runBtn = document.getElementById('runBtn');

  logArea.innerHTML = '';
  title.textContent = '⚙️ Ejecutando búsqueda...';
  overlay.classList.add('open');
  runBtn.disabled = true;

  if (runSource) runSource.close();

  runSource = new EventSource('/api/run/start');

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

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(d)} ${meses[parseInt(m)]} ${y}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Arranca ───────────────────────────────────────────────────────────────────
init();
