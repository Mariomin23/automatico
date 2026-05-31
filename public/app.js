let selectedDate = null;
let runSource = null;

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
      if (badge) badge.textContent = data.aptas;
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
  } catch {
    main.innerHTML = '<div class="empty-state"><p>Error cargando datos</p></div>';
    return;
  }

  const aptas = data.ofertas.filter((o) => o.apto).length;

  main.innerHTML = `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-value">${data.total}</div>
        <div class="stat-label">Evaluadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--green)">${aptas}</div>
        <div class="stat-label">Aptas ≥7</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.total - aptas}</div>
        <div class="stat-label">Descartadas</div>
      </div>
    </div>
    <div class="jobs-grid" id="jobsGrid"></div>
  `;

  const grid = document.getElementById('jobsGrid');
  data.ofertas.forEach((oferta, i) => {
    grid.appendChild(buildJobCard(oferta, date, i));
  });
}

// ── Job card ──────────────────────────────────────────────────────────────────

function buildJobCard(oferta, date, idx) {
  const card = document.createElement('div');
  card.className = 'job-card';
  card.id = `card-${idx}`;

  const scoreClass = oferta.puntuacion >= 7 ? 'green' : oferta.puntuacion >= 5 ? 'orange' : 'red';
  const tags = (oferta.keywords_match || [])
    .slice(0, 4)
    .map((t) => `<span class="tag">${t}</span>`)
    .join('');

  const alertHtml = oferta.alerta
    ? `<div class="alert-box">⚠️ ${oferta.alerta}</div>`
    : '';

  const cartaBtn = oferta.apto
    ? `<button class="btn primary" onclick="toggleCarta('${date}','${oferta.slug}',${idx})">📄 Ver carta</button>`
    : '';

  card.innerHTML = `
    <div class="job-header" onclick="toggleCard(${idx})">
      <div class="score-badge ${scoreClass}">${oferta.puntuacion}/10</div>
      <div class="job-info">
        <div class="job-title">${oferta.titulo}</div>
        <div class="job-company">${oferta.empresa}</div>
        ${tags ? `<div class="job-tags">${tags}</div>` : ''}
      </div>
      <div class="job-meta">
        <span class="fuente-badge">${oferta.fuente || ''}</span>
        <span class="chevron">▶</span>
      </div>
    </div>
    <div class="job-body">
      ${alertHtml}
      <p class="job-motivo">${oferta.motivo}</p>
      <div class="job-actions">
        <a class="btn" href="${oferta.url}" target="_blank" rel="noopener">🔗 Ver oferta</a>
        ${cartaBtn}
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

async function toggleCarta(date, slug, idx) {
  const container = document.getElementById(`carta-${idx}`);

  if (container.innerHTML) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<p class="carta-loading">Cargando carta...</p>';

  try {
    const data = await api(`/api/runs/${date}/carta/${slug}`);
    container.innerHTML = `<div class="carta-box">${escapeHtml(data.carta)}</div>
      <button class="btn" style="margin-top:8px" onclick="copyCarta(${idx})">📋 Copiar</button>`;
  } catch {
    container.innerHTML = '<p class="carta-loading">Carta no disponible</p>';
  }
}

function copyCarta(idx) {
  const box = document.querySelector(`#carta-${idx} .carta-box`);
  if (!box) return;
  navigator.clipboard.writeText(box.textContent).then(() => {
    const btn = document.querySelector(`#carta-${idx} .btn`);
    btn.textContent = '✅ Copiado';
    setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
  });
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
