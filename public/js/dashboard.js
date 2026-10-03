/**
 * MotorSense - Dashboard de Telemetría Industrial
 * Monitoreo en tiempo real de RPM, Temperatura y Consumo de Amperaje
 */

// Estado global de la aplicación
const AppState = {
  currentMetricFilter: 'todas',
  selectedTipo: 'todos',
  selectedEstado: 'todos',
  selectedEquipo: 'todos',
  searchQuery: '',
  limit: 50,
  autoRefreshInterval: null,
  simInterval: null,
  isSimulating: false,
  mainChart: null,
  stats: null,
  allMediciones: []
};

// Configuraciones visuales y de escala para las 3 variables
const METRIC_CONFIG = {
  rpm: {
    label: 'Velocidad de Rotación',
    shortLabel: 'RPM',
    unit: 'RPM',
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.15)',
    icon: 'fa-rotate',
    maxScale: 4000
  },
  temperatura: {
    label: 'Temperatura Térmica',
    shortLabel: 'Temperatura',
    unit: '°C',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
    icon: 'fa-temperature-half',
    maxScale: 120
  },
  amperaje: {
    label: 'Consumo de Corriente',
    shortLabel: 'Amperaje',
    unit: 'A',
    color: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.15)',
    icon: 'fa-bolt-lightning',
    maxScale: 50
  }
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initChart();
  setupEventListeners();
  loadAllData();

  // Muestreo activo cada 3.5 segundos
  AppState.autoRefreshInterval = setInterval(() => {
    loadAllData(false);
  }, 3500);
});

// Reloj en tiempo real
function initClock() {
  const clockEl = document.getElementById('currentTime');
  function update() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-ES', { hour12: false });
  }
  update();
  setInterval(update, 1000);
}

// Carga general de datos
async function loadAllData(showLoading = true) {
  try {
    await Promise.all([
      fetchStats(),
      fetchServerMetrics(),
      fetchTableData(showLoading),
      fetchChartData()
    ]);
  } catch (error) {
    console.error('Error cargando telemetría de motores:', error);
  }
}

// 1. Estadísticas y KPIs de RPM, Temperatura y Amperaje
async function fetchStats() {
  try {
    const res = await fetch('/api/mediciones/stats');
    if (!res.ok) throw new Error('Error en stats');
    const data = await res.json();
    AppState.stats = data;

    updateKpiCards(data);
    updateSideMetersAndFleet(data);
  } catch (err) {
    console.error('Error en fetchStats:', err);
  }
}

function updateKpiCards(data) {
  const st = data.statsPorTipo;
  
  // 1. KPI RPM
  if (st.rpm && st.rpm.ultima) {
    const val = st.rpm.ultima.valor;
    document.getElementById('kpiRpmVal').textContent = val.toLocaleString();
    document.getElementById('kpiRpmMin').textContent = st.rpm.min.toLocaleString();
    document.getElementById('kpiRpmMax').textContent = st.rpm.max.toLocaleString();

    const pct = Math.min(100, Math.max(0, (val / 4000) * 100));
    document.getElementById('kpiRpmBar').style.width = `${pct}%`;

    const badge = document.getElementById('rpmStatusBadge');
    badge.className = `kpi-status-badge status-${st.rpm.ultima.estado}`;
    badge.textContent = st.rpm.ultima.estado;
  }

  // 2. KPI Temperatura
  if (st.temperatura && st.temperatura.ultima) {
    const val = st.temperatura.ultima.valor;
    document.getElementById('kpiTempVal').textContent = val;
    document.getElementById('kpiTempMin').textContent = st.temperatura.min;
    document.getElementById('kpiTempMax').textContent = st.temperatura.max;

    const pct = Math.min(100, Math.max(0, (val / 120) * 100));
    document.getElementById('kpiTempBar').style.width = `${pct}%`;

    const badge = document.getElementById('tempStatusBadge');
    badge.className = `kpi-status-badge status-${st.temperatura.ultima.estado}`;
    badge.textContent = st.temperatura.ultima.estado;
  }

  // 3. KPI Amperaje
  if (st.amperaje && st.amperaje.ultima) {
    const val = st.amperaje.ultima.valor;
    document.getElementById('kpiAmpVal').textContent = val;
    document.getElementById('kpiAmpMin').textContent = st.amperaje.min;
    document.getElementById('kpiAmpMax').textContent = st.amperaje.max;

    const pct = Math.min(100, Math.max(0, (val / 50) * 100));
    document.getElementById('kpiAmpBar').style.width = `${pct}%`;

    const badge = document.getElementById('ampStatusBadge');
    badge.className = `kpi-status-badge status-${st.amperaje.ultima.estado}`;
    badge.textContent = st.amperaje.ultima.estado;

    // 4. Potencia Estimada (Trifásica 440V, FP 0.88 -> P = sqrt(3)*440*I*0.88/1000 = 0.6706 * I)
    const kwEstimada = Number((val * 0.6706).toFixed(1));
    document.getElementById('kpiPwrVal').textContent = kwEstimada;
    document.getElementById('kpiEnergiaKwh').textContent = (kwEstimada * 1.5).toFixed(1);
    const pwrPct = Math.min(100, Math.max(0, (kwEstimada / 35) * 100));
    document.getElementById('kpiPwrBar').style.width = `${pwrPct}%`;

    const pwrBadge = document.getElementById('pwrStatusBadge');
    pwrBadge.className = `kpi-status-badge status-${st.amperaje.ultima.estado}`;
    pwrBadge.textContent = st.amperaje.ultima.estado;
  }

  // 5. Alertas Globales
  const ce = data.conteoEstado;
  document.getElementById('countNormal').textContent = ce.normal || 0;
  document.getElementById('countWarning').textContent = ce.advertencia || 0;
  document.getElementById('countDanger').textContent = ce.critico || 0;
  document.getElementById('kpiTotalLecturas').textContent = `${data.totalMediciones} mediciones registradas`;
}

// Actualizar Tacómetros laterales y lista de motores
function updateSideMetersAndFleet(data) {
  const motores = data.motores || [];
  const selectedId = AppState.selectedEquipo;

  // Encontrar el motor relevante para los medidores laterales
  const motorActivo = (selectedId !== 'todos' && motores.find((m) => m.id === selectedId)) 
    ? motores.find((m) => m.id === selectedId)
    : motores[0];

  if (motorActivo) {
    // RPM
    document.getElementById('sideRpmVal').textContent = `${motorActivo.rpm} RPM`;
    const rpmPct = Math.min(100, Math.max(0, (motorActivo.rpm / 4000) * 100));
    document.getElementById('sideRpmFill').style.width = `${rpmPct}%`;

    // Temperatura
    document.getElementById('sideTempVal').textContent = `${motorActivo.temperatura} °C`;
    const tempPct = Math.min(100, Math.max(0, (motorActivo.temperatura / 120) * 100));
    document.getElementById('sideTempFill').style.width = `${tempPct}%`;

    // Amperaje
    document.getElementById('sideAmpVal').textContent = `${motorActivo.amperaje} A`;
    const ampPct = Math.min(100, Math.max(0, (motorActivo.amperaje / 50) * 100));
    document.getElementById('sideAmpFill').style.width = `${ampPct}%`;
  }

  // Renderizar Lista de Flota de Motores
  const fleetEl = document.getElementById('fleetList');
  fleetEl.innerHTML = motores.map((m) => {
    const isSelected = AppState.selectedEquipo === m.id;
    return `
      <div class="fleet-item" onclick="seleccionarMotor('${m.id}')" style="${isSelected ? 'border-color: var(--cyan); background: rgba(6, 182, 212, 0.12);' : ''}">
        <div class="fleet-item-info">
          <span class="fleet-item-name">${escapeHtml(m.nombre.split('(')[0].trim())}</span>
          <span class="fleet-item-sub">${m.rpm} RPM • ${m.temperatura}°C • ${m.amperaje}A</span>
        </div>
        <span class="fleet-item-badge status-${m.estadoGeneral}">
          ${m.estadoGeneral}
        </span>
      </div>
    `;
  }).join('');
}

window.seleccionarMotor = function(id) {
  document.getElementById('selectMotorHeader').value = id;
  document.getElementById('filterEquipo').value = id;
  AppState.selectedEquipo = id;
  loadAllData(false);
  showToast(`Filtrando telemetría para ${id}`, 'info');
};

// 2. Métricas del Servidor Host (Node.js)
async function fetchServerMetrics() {
  try {
    const res = await fetch('/api/mediciones/servidor');
    if (!res.ok) return;
    const serv = await res.json();
    document.getElementById('headerUptime').textContent = serv.uptimeFormato;
  } catch (err) {
    console.error('Error obteniendo métricas del host:', err);
  }
}

// 3. Tabla de Mediciones con Filtros y Búsqueda
async function fetchTableData(showLoading = false) {
  const tbody = document.getElementById('tableBody');
  if (showLoading) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="loading-cell">
          <div class="loading-spinner"></div>
          <span>Sincronizando telemetría de motores...</span>
        </td>
      </tr>
    `;
  }

  try {
    const url = new URL('/api/mediciones', window.location.origin);
    url.searchParams.set('tipo', AppState.selectedTipo);
    url.searchParams.set('estado', AppState.selectedEstado);
    url.searchParams.set('equipoId', AppState.selectedEquipo);
    url.searchParams.set('limit', AppState.limit);

    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al cargar mediciones');
    const { total, data } = await res.json();
    AppState.allMediciones = data;

    renderTableRows(data, total);
  } catch (err) {
    console.error('Error cargando tabla:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--rose); padding: 2rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor
        </td>
      </tr>
    `;
  }
}

function renderTableRows(mediciones, totalRegistros) {
  const tbody = document.getElementById('tableBody');
  const countBadge = document.getElementById('tableRecordCount');
  const paginationInfo = document.getElementById('paginationInfo');

  let lista = mediciones;
  const q = AppState.searchQuery.trim().toLowerCase();
  if (q) {
    lista = lista.filter((m) => 
      m.nombre.toLowerCase().includes(q) ||
      m.sensorId.toLowerCase().includes(q) ||
      m.tipo.toLowerCase().includes(q) ||
      m.ubicacion.toLowerCase().includes(q)
    );
  }

  countBadge.textContent = `${lista.length} registros`;
  paginationInfo.textContent = `Mostrando ${lista.length} de ${totalRegistros} registros`;

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-dim); padding: 3rem;">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 1.8rem; margin-bottom: 0.5rem; display: block;"></i>
          No hay lecturas que coincidan con los filtros aplicados.
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = lista.map((m) => {
    const cfg = METRIC_CONFIG[m.tipo] || { icon: 'fa-gauge', color: '#cbd5e1' };
    const dateFormatted = new Date(m.timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const fullDate = new Date(m.timestamp).toLocaleString('es-ES');

    return `
      <tr data-id="${m.id}">
        <td><span class="sensor-id-tag">#${m.id}</span></td>
        <td>
          <div class="sensor-name-label">${escapeHtml(m.nombre)}</div>
          <span class="sensor-id-tag">${escapeHtml(m.sensorId)}</span>
        </td>
        <td>
          <span class="metric-type-pill" style="border-left: 3px solid ${cfg.color}">
            <i class="fa-solid ${cfg.icon}" style="color: ${cfg.color}"></i>
            ${escapeHtml(cfg.shortLabel || m.tipo)}
          </span>
        </td>
        <td>
          <span class="metric-value-strong">${m.tipo === 'rpm' ? m.valor.toLocaleString() : m.valor}</span>
          <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">${escapeHtml(m.unidad)}</span>
        </td>
        <td>
          <span class="kpi-status-badge status-${m.estado}">
            ${m.estado}
          </span>
        </td>
        <td><span style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(m.ubicacion)}</span></td>
        <td><span class="time-cell" title="${fullDate}">${dateFormatted}</span></td>
        <td style="text-align: center;">
          <button class="btn-delete-row" onclick="deleteMedicion(${m.id})" title="Eliminar registro">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}

// 4. Datos y Gráfico Temporal
async function fetchChartData() {
  try {
    const url = new URL('/api/mediciones', window.location.origin);
    url.searchParams.set('limit', 90);
    if (AppState.selectedEquipo !== 'todos') {
      url.searchParams.set('equipoId', AppState.selectedEquipo);
    }

    const res = await fetch(url);
    if (!res.ok) return;
    const { data } = await res.json();
    
    // Invertir para orden cronológico
    const cronologicos = [...data].reverse();
    updateMainChart(cronologicos);
  } catch (err) {
    console.error('Error al actualizar gráfico:', err);
  }
}

// Configuración de Chart.js
function initChart() {
  const ctx = document.getElementById('mainChart').getContext('2d');
  AppState.mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 12, weight: 600 },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          usePointStyle: true
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        },
        yRpm: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#38bdf8', font: { family: 'JetBrains Mono', size: 10 } },
          title: { display: true, text: 'Velocidad (RPM)', color: '#38bdf8' }
        },
        ySecundario: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#fb7185', font: { family: 'JetBrains Mono', size: 10 } },
          title: { display: true, text: 'Temp (°C) / Corriente (A)', color: '#fb7185' }
        }
      },
      elements: {
        point: { radius: 2, hoverRadius: 6 },
        line: { tension: 0.35, borderWidth: 2 }
      },
      animation: { duration: 350 }
    }
  });
}

function updateMainChart(mediciones) {
  if (!AppState.mainChart) return;

  const currentTab = AppState.currentMetricFilter;
  
  // Extraer marcas de tiempo únicas
  const timeLabels = [...new Set(mediciones.map((m) => 
    new Date(m.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  ))].slice(-25);

  const datasets = [];

  // 1. Dataset RPM
  if (currentTab === 'todas' || currentTab === 'rpm') {
    const dataRpm = timeLabels.map((t) => {
      const match = mediciones.find((m) => 
        m.tipo === 'rpm' && 
        new Date(m.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) === t
      );
      return match ? match.valor : null;
    });

    datasets.push({
      label: 'Velocidad (RPM)',
      data: dataRpm,
      borderColor: METRIC_CONFIG.rpm.color,
      backgroundColor: METRIC_CONFIG.rpm.color,
      yAxisID: 'yRpm',
      spanGaps: true
    });
  }

  // 2. Dataset Temperatura
  if (currentTab === 'todas' || currentTab === 'temperatura') {
    const dataTemp = timeLabels.map((t) => {
      const match = mediciones.find((m) => 
        m.tipo === 'temperatura' && 
        new Date(m.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) === t
      );
      return match ? match.valor : null;
    });

    datasets.push({
      label: 'Temperatura (°C)',
      data: dataTemp,
      borderColor: METRIC_CONFIG.temperatura.color,
      backgroundColor: METRIC_CONFIG.temperatura.color,
      yAxisID: currentTab === 'temperatura' ? 'yRpm' : 'ySecundario',
      spanGaps: true
    });
  }

  // 3. Dataset Amperaje
  if (currentTab === 'todas' || currentTab === 'amperaje') {
    const dataAmp = timeLabels.map((t) => {
      const match = mediciones.find((m) => 
        m.tipo === 'amperaje' && 
        new Date(m.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) === t
      );
      return match ? match.valor : null;
    });

    datasets.push({
      label: 'Amperaje (A)',
      data: dataAmp,
      borderColor: METRIC_CONFIG.amperaje.color,
      backgroundColor: METRIC_CONFIG.amperaje.color,
      yAxisID: currentTab === 'amperaje' ? 'yRpm' : 'ySecundario',
      spanGaps: true
    });
  }

  // Ajustar títulos y escalas si estamos en vista individual
  if (currentTab === 'rpm') {
    AppState.mainChart.options.scales.yRpm.title.text = 'Velocidad (RPM)';
    AppState.mainChart.options.scales.ySecundario.display = false;
  } else if (currentTab === 'temperatura') {
    AppState.mainChart.options.scales.yRpm.title.text = 'Temperatura (°C)';
    AppState.mainChart.options.scales.ySecundario.display = false;
  } else if (currentTab === 'amperaje') {
    AppState.mainChart.options.scales.yRpm.title.text = 'Consumo de Amperaje (A)';
    AppState.mainChart.options.scales.ySecundario.display = false;
  } else {
    AppState.mainChart.options.scales.yRpm.title.text = 'Velocidad (RPM)';
    AppState.mainChart.options.scales.ySecundario.display = true;
  }

  AppState.mainChart.data.labels = timeLabels;
  AppState.mainChart.data.datasets = datasets;
  AppState.mainChart.update('none');
}

// Configuración de Event Listeners
function setupEventListeners() {
  // Tabs de Gráficos
  const tabs = document.querySelectorAll('#metricTabs .pill-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      AppState.currentMetricFilter = tab.getAttribute('data-metric');
      fetchChartData();
    });
  });

  // Botón refrescar gráfico
  document.getElementById('btnRefreshChart').addEventListener('click', () => {
    fetchChartData();
    showToast('Gráfico de motores actualizado', 'info');
  });

  // Selector de motor en header
  document.getElementById('selectMotorHeader').addEventListener('change', (e) => {
    AppState.selectedEquipo = e.target.value;
    document.getElementById('filterEquipo').value = e.target.value;
    loadAllData(true);
  });

  // Filtros de tabla
  document.getElementById('filterTipo').addEventListener('change', (e) => {
    AppState.selectedTipo = e.target.value;
    fetchTableData(true);
  });

  document.getElementById('filterEquipo').addEventListener('change', (e) => {
    AppState.selectedEquipo = e.target.value;
    document.getElementById('selectMotorHeader').value = e.target.value;
    loadAllData(true);
  });

  document.getElementById('filterEstado').addEventListener('change', (e) => {
    AppState.selectedEstado = e.target.value;
    fetchTableData(true);
  });

  document.getElementById('filterLimit').addEventListener('change', (e) => {
    AppState.limit = parseInt(e.target.value, 10);
    fetchTableData(true);
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value;
    renderTableRows(AppState.allMediciones, AppState.allMediciones.length);
  });

  // Toggle Simulador
  document.getElementById('btnToggleSim').addEventListener('click', toggleSimulator);

  // Pulso Rápido Manual
  document.getElementById('btnTriggerPulse').addEventListener('click', triggerSinglePulse);

  // Reset de Datos
  document.getElementById('btnResetData').addEventListener('click', resetData);

  // Modal
  setupModal();
}

// Simulador Dinámico de Carga
function toggleSimulator() {
  const btn = document.getElementById('btnToggleSim');
  const icon = document.getElementById('simIcon');
  const text = document.getElementById('simText');
  const pulse = document.getElementById('simPulse');

  if (AppState.isSimulating) {
    clearInterval(AppState.simInterval);
    AppState.simInterval = null;
    AppState.isSimulating = false;

    btn.classList.remove('active');
    icon.className = 'fa-solid fa-play';
    text.textContent = 'Simular Operación';
    pulse.classList.remove('active');
    showToast('Simulación de motores pausada', 'info');
  } else {
    AppState.isSimulating = true;
    btn.classList.add('active');
    icon.className = 'fa-solid fa-pause';
    text.textContent = 'Pausar Simulación';
    pulse.classList.add('active');
    showToast('Simulador activo: inyectando pulsos dinámicos de carga', 'success');

    triggerSinglePulse(false);
    AppState.simInterval = setInterval(() => {
      triggerSinglePulse(false);
    }, 2500);
  }
}

async function triggerSinglePulse(showNotification = true) {
  try {
    const res = await fetch('/api/mediciones/simular-pulso', { method: 'POST' });
    if (!res.ok) throw new Error('Error al generar pulso');
    
    await loadAllData(false);
    
    if (showNotification) {
      showToast('Pulso de telemetría inyectado a los 4 motores', 'success');
    }
  } catch (err) {
    console.error('Error al simular pulso:', err);
    showToast('Error al disparar pulso de telemetría', 'error');
  }
}

// Modal y Registro de Mediciones Manuales
function setupModal() {
  const modal = document.getElementById('modalMedicion');
  const btnOpen = document.getElementById('btnOpenModal');
  const btnClose = document.getElementById('btnCloseModal');
  const btnCancel = document.getElementById('btnCancelModal');
  const form = document.getElementById('formNuevaMedicion');
  const selectEquipo = document.getElementById('inputEquipo');
  const selectTipo = document.getElementById('inputTipo');
  const inputUnidad = document.getElementById('inputUnidadBadge');
  const groupNombreCustom = document.getElementById('groupNombreCustom');

  function openModal() {
    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
    form.reset();
    groupNombreCustom.style.display = 'none';
  }

  btnOpen.addEventListener('click', openModal);
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Cambio de Tipo de Métrica -> auto actualizar unidad
  selectTipo.addEventListener('change', () => {
    const tipo = selectTipo.value;
    const cfg = METRIC_CONFIG[tipo];
    inputUnidad.textContent = cfg ? cfg.unit : '';
  });

  selectEquipo.addEventListener('change', () => {
    if (selectEquipo.value === 'custom') {
      groupNombreCustom.style.display = 'flex';
      document.getElementById('inputNombre').required = true;
    } else {
      groupNombreCustom.style.display = 'none';
      document.getElementById('inputNombre').required = false;
    }
  });

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmitMedicion');
    btnSubmit.disabled = true;

    try {
      const equipoVal = selectEquipo.value;
      const nombreCustom = document.getElementById('inputNombre').value;
      const tipo = selectTipo.value;
      const valor = parseFloat(document.getElementById('inputValor').value);
      const ubicacion = document.getElementById('inputUbicacion').value;
      const estado = document.getElementById('inputEstado').value;

      const payload = {
        equipoId: equipoVal !== 'custom' ? equipoVal : undefined,
        nombre: nombreCustom || undefined,
        tipo,
        valor,
        unidad: METRIC_CONFIG[tipo] ? METRIC_CONFIG[tipo].unit : '',
        ubicacion: ubicacion || undefined,
        estado: estado || undefined
      };

      const res = await fetch('/api/mediciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Error al guardar');
      }

      showToast('¡Medición de motor registrada con éxito!', 'success');
      closeModal();
      await loadAllData(false);
    } catch (err) {
      console.error('Error registrando medición:', err);
      showToast(err.message, 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  });
}

// Eliminar Medición
async function deleteMedicion(id) {
  if (!confirm(`¿Deseas eliminar el registro #${id}?`)) return;

  try {
    const res = await fetch(`/api/mediciones/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar');

    showToast(`Medición #${id} eliminada`, 'info');
    await loadAllData(false);
  } catch (err) {
    console.error('Error al borrar medición:', err);
    showToast('No se pudo eliminar la medición', 'error');
  }
}

// Resetear Datos
async function resetData() {
  if (!confirm('¿Restablecer el dataset con las lecturas iniciales de telemetría?')) return;

  try {
    const res = await fetch('/api/mediciones/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Error al reiniciar');

    showToast('Dataset de motores restablecido', 'success');
    await loadAllData(true);
  } catch (err) {
    console.error('Error al reiniciar dataset:', err);
    showToast('Error al reiniciar dataset', 'error');
  }
}

// Notificaciones Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    info: 'fa-circle-info',
    success: 'fa-circle-check',
    warning: 'fa-triangle-exclamation',
    error: 'fa-circle-exclamation'
  };

  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type] || 'fa-info'} toast-icon"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Función auxiliar de escape XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}
