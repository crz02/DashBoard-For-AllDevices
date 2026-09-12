/* ==========================================================================
   Clean & Usable Device Dashboard — Client Logic
   ========================================================================== */

let devices = [];
let activeFilter = 'all';
let selectedHistoryDevice = 'all';
let selectedHistoryHours = 24;
let batteryChart = null;
let eventSource = null;
let isSimulatorActive = false;

document.addEventListener('DOMContentLoaded', () => {
  initRealtimeEvents();
  setupUIEventListeners();
  initHistoryChart();
  fetchInitialData();
  populateDynamicSetupUrls();
});

// Update URLs in Setup Modal
function populateDynamicSetupUrls() {
  const origin = window.location.origin;

  const macEl = document.getElementById('macOneLiner');
  if (macEl) macEl.textContent = `./agents/macos/report_battery.sh ${origin} macbook`;

  const winEl = document.getElementById('winOneLiner');
  if (winEl) winEl.textContent = `powershell.exe -ExecutionPolicy Bypass -File .\\agents\\windows\\report_battery.ps1 -DashboardUrl "${origin}" -DeviceId "windows-laptop"`;

  const iosUrl = document.getElementById('iosWebhookUrl');
  if (iosUrl) iosUrl.textContent = `POST ${origin}/api/report`;

  const androidUrl = document.getElementById('androidWebhook');
  if (androidUrl) androidUrl.textContent = `POST ${origin}/api/report`;
}

// Server-Sent Events (SSE) for Real-Time Updates
function initRealtimeEvents() {
  const statusBadge = document.getElementById('connectionStatus');
  const statusText = document.getElementById('connectionText');

  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/events');

  eventSource.onopen = () => {
    statusText.textContent = 'Connected';
    statusBadge.querySelector('.dot').style.backgroundColor = 'var(--color-green)';
  };

  eventSource.addEventListener('devices_updated', (e) => {
    try {
      devices = JSON.parse(e.data);
      renderAll();
    } catch (err) {
      console.error('Failed to parse devices SSE:', err);
    }
  });

  eventSource.addEventListener('device_ping', (e) => {
    try {
      const ping = JSON.parse(e.data);
      showToast(`Update from ${ping.device_id}: ${ping.battery}%`);
    } catch (_) {}
  });

  eventSource.onerror = () => {
    statusText.textContent = 'Reconnecting...';
    statusBadge.querySelector('.dot').style.backgroundColor = 'var(--color-red)';
  };
}

// Fetch Initial Devices and Simulator State
async function fetchInitialData() {
  try {
    const res = await fetch('/api/devices');
    const data = await res.json();
    if (data.status === 'success') {
      devices = data.devices;
      renderAll();
    }

    const simRes = await fetch('/api/simulator/status');
    const simData = await simRes.json();
    if (simData.status === 'success') {
      isSimulatorActive = simData.running;
      const simCheckbox = document.getElementById('simCheckbox');
      if (simCheckbox) simCheckbox.checked = isSimulatorActive;
    }
  } catch (err) {
    console.error('Data load error:', err);
  }
}

// Setup Event Listeners
function setupUIEventListeners() {
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      activeFilter = target.getAttribute('data-filter');
      renderDeviceGrid();
    });
  });

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    fetchInitialData();
    fetchChartHistory();
    showToast('Data refreshed');
  });

  // Simulator Checkbox
  const simCheckbox = document.getElementById('simCheckbox');
  if (simCheckbox) {
    simCheckbox.addEventListener('change', async (e) => {
      try {
        const res = await fetch('/api/simulator/toggle', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
          isSimulatorActive = data.running;
          simCheckbox.checked = isSimulatorActive;
          showToast(isSimulatorActive ? 'Simulator running' : 'Simulator stopped');
        }
      } catch (err) {
        simCheckbox.checked = !simCheckbox.checked;
      }
    });
  }

  // Modal handlers
  const modal = document.getElementById('setupModal');
  const openBtn = document.getElementById('openAddModalBtn');
  const closeBtn = document.getElementById('closeModalBtn');
  const doneBtn = document.getElementById('doneModalBtn');
  const footerLink = document.getElementById('footerSetupLink');

  const open = (e) => {
    if (e) e.preventDefault();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  };

  const close = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  };

  openBtn.addEventListener('click', open);
  if (footerLink) footerLink.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  doneBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // Modal navigation tabs
  document.querySelectorAll('.modal-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.modal-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      const target = e.currentTarget;
      target.classList.add('active');
      const tabId = target.getAttribute('data-tab');
      const pane = document.getElementById(`tab-${tabId}`);
      if (pane) pane.classList.add('active');
    });
  });

  // Copy code buttons
  document.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      const el = document.getElementById(targetId);
      if (el) {
        navigator.clipboard.writeText(el.textContent.trim()).then(() => {
          const orig = e.currentTarget.textContent;
          e.currentTarget.textContent = 'Copied!';
          setTimeout(() => { e.currentTarget.textContent = orig; }, 1500);
        });
      }
    });
  });

  // Chart time range
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      selectedHistoryHours = parseInt(target.getAttribute('data-hours'), 10);
      fetchChartHistory();
    });
  });

  // Chart device dropdown
  document.getElementById('chartDeviceSelect').addEventListener('change', (e) => {
    selectedHistoryDevice = e.target.value;
    fetchChartHistory();
  });
}

// Render All Components
function renderAll() {
  updateSummaryStats();
  renderDeviceGrid();
  updateChartDropdown();
  updateLastSyncTime();
}

function updateLastSyncTime() {
  const syncEl = document.getElementById('lastSyncTime');
  if (syncEl) {
    const now = new Date();
    syncEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;
  }
}

// Summary Metrics
function updateSummaryStats() {
  const totalCountEl = document.getElementById('totalDevicesCount');
  const onlineBadgeEl = document.getElementById('onlineDevicesBadge');
  const avgBatteryEl = document.getElementById('avgBatteryLevel');
  const avgTrendEl = document.getElementById('avgBatteryTrend');
  const chargingCountEl = document.getElementById('chargingCount');
  const lowBatteryCountEl = document.getElementById('lowBatteryCount');
  const lowBatteryAlertEl = document.getElementById('lowBatteryAlert');

  const total = devices.length;
  totalCountEl.textContent = total;

  const onlineCount = devices.filter(d => d.is_online).length;
  onlineBadgeEl.textContent = `${onlineCount} online`;

  const chargingCount = devices.filter(d => d.is_charging).length;
  chargingCountEl.textContent = chargingCount;

  const lowCount = devices.filter(d => d.battery_level <= 20).length;
  lowBatteryCountEl.textContent = lowCount;
  lowBatteryAlertEl.textContent = lowCount > 0 ? `${lowCount} need charge` : 'All normal';

  if (total > 0) {
    const sum = devices.reduce((acc, d) => acc + (d.battery_level || 0), 0);
    const avg = Math.round(sum / total);
    avgBatteryEl.textContent = `${avg}%`;
    avgTrendEl.textContent = avg >= 70 ? 'High' : avg >= 35 ? 'Medium' : 'Low';
  } else {
    avgBatteryEl.textContent = '--%';
  }
}

// Render Device Grid
function renderDeviceGrid() {
  const grid = document.getElementById('devicesGrid');
  grid.innerHTML = '';

  const filtered = devices.filter(d => {
    if (activeFilter === 'all') return true;
    return (d.platform || '').toLowerCase() === activeFilter.toLowerCase();
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border); border-radius: var(--radius);">
        No devices in this category. Click "+ Connect Device" to add one.
      </div>
    `;
    return;
  }

  filtered.forEach(device => {
    const item = createDeviceElement(device);
    grid.appendChild(item);
  });
}

// Create Device Card Element
function createDeviceElement(device) {
  const card = document.createElement('div');
  card.className = 'device-item';

  const level = Math.max(0, Math.min(100, device.battery_level || 0));
  const isCharging = Boolean(device.is_charging);
  const platform = (device.platform || 'device').toLowerCase();

  // Progress color class & badge
  let fillClass = 'fill-high';
  let badgeClass = 'badge-normal';
  let statusText = 'On Battery';

  if (isCharging) {
    fillClass = 'fill-charging';
    badgeClass = 'badge-charging';
    statusText = '⚡ Charging';
  } else if (level <= 20) {
    fillClass = 'fill-low';
    badgeClass = 'badge-low';
    statusText = 'Low Battery';
  } else if (level <= 50) {
    fillClass = 'fill-med';
    badgeClass = 'badge-medium';
    statusText = 'Moderate';
  }

  // Time ago
  const secAgo = device.seconds_since_update || 0;
  let timeStr = 'Just now';
  if (secAgo > 3600) {
    timeStr = `${Math.floor(secAgo / 3600)}h ago`;
  } else if (secAgo > 60) {
    timeStr = `${Math.floor(secAgo / 60)}m ago`;
  }

  const isOnline = device.is_online;
  const onlineStatusClass = isOnline ? '' : 'offline';
  const onlineLabel = isOnline ? 'Online' : 'Offline';

  card.innerHTML = `
    <div class="device-item-head">
      <div class="device-item-title">
        <span class="device-item-name">${escapeHtml(device.name || device.id)}</span>
        <span class="device-item-meta">${escapeHtml(device.model || platform)}</span>
      </div>
      <span class="platform-tag">${platform}</span>
    </div>

    <div class="battery-block">
      <div class="battery-header">
        <span class="battery-number">${level}%</span>
        <span class="battery-badge ${badgeClass}">${statusText}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${fillClass}" style="width: ${level}%;"></div>
      </div>
    </div>

    <div class="details-table">
      <div class="details-row">
        <span class="details-key">Power Source</span>
        <span class="details-val">${escapeHtml(device.power_source || 'Battery')}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Battery Health</span>
        <span class="details-val">${escapeHtml(device.battery_health || 'Good')} ${device.cycle_count ? `(${device.cycle_count}c)` : ''}</span>
      </div>
      <div class="details-row">
        <span class="details-key">CPU / RAM</span>
        <span class="details-val">${device.cpu_usage ? device.cpu_usage.toFixed(1) + '%' : '0%'} / ${device.ram_usage ? device.ram_usage.toFixed(0) + '%' : '0%'}</span>
      </div>
      <div class="details-row">
        <span class="details-key">IP Address</span>
        <span class="details-val">${escapeHtml(device.ip_address || 'Local')}</span>
      </div>
    </div>

    <div class="device-item-foot">
      <div class="status-indicator ${onlineStatusClass}">
        <span class="mini-dot"></span>
        <span>${onlineLabel} &bull; ${timeStr}</span>
      </div>
      <button class="btn-remove" title="Remove device" onclick="handleDeleteDevice('${escapeHtml(device.id)}')">Remove</button>
    </div>
  `;

  return card;
}

// Remove Device
window.handleDeleteDevice = async function(deviceId) {
  if (!confirm(`Remove ${deviceId}?`)) return;

  try {
    const res = await fetch('/api/devices/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId })
    });
    const data = await res.json();
    if (data.status === 'success') {
      devices = devices.filter(d => d.id !== deviceId);
      renderAll();
      fetchChartHistory();
      showToast(`Removed ${deviceId}`);
    }
  } catch (err) {
    showToast('Failed to remove device');
  }
};

// Update Chart Dropdown
function updateChartDropdown() {
  const select = document.getElementById('chartDeviceSelect');
  const current = select.value;
  select.innerHTML = '<option value="all">All Devices Combined</option>';

  devices.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name} (${d.platform})`;
    if (d.id === current) opt.selected = true;
    select.appendChild(opt);
  });
}

// Initialize Chart
function initHistoryChart() {
  const ctx = document.getElementById('batteryHistoryChart').getContext('2d');

  batteryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: {
            color: '#8b949e',
            font: { family: "'Inter', sans-serif", size: 12 },
            boxWidth: 12
          }
        },
        tooltip: {
          backgroundColor: '#161b22',
          titleColor: '#f0f6fc',
          bodyColor: '#8b949e',
          borderColor: '#30363d',
          borderWidth: 1,
          padding: 8,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#21262d' },
          ticks: { color: '#6e7681', font: { family: "'JetBrains Mono', monospace", size: 10 } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: '#21262d' },
          ticks: {
            color: '#6e7681',
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            stepSize: 25,
            callback: (v) => `${v}%`
          }
        }
      }
    }
  });

  fetchChartHistory();
}

// Fetch Chart Data
async function fetchChartHistory() {
  if (!batteryChart) return;

  try {
    let url = `/api/history?hours=${selectedHistoryHours}`;
    if (selectedHistoryDevice !== 'all') {
      url = `/api/devices/${selectedHistoryDevice}/history?hours=${selectedHistoryHours}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'success') return;

    renderChartData(data.history || []);
  } catch (err) {
    console.error('Failed to load chart history:', err);
  }
}

// Render Data on Chart
function renderChartData(logs) {
  if (!logs || logs.length === 0) {
    batteryChart.data.labels = [];
    batteryChart.data.datasets = [];
    batteryChart.update();
    return;
  }

  const palette = {
    'macbook-pro': '#f0f6fc',
    'windows-pc': '#58a6ff',
    'iphone-16': '#a371f7',
    'galaxy-s24': '#3fb950',
    default: '#1f6feb'
  };

  if (selectedHistoryDevice !== 'all') {
    const labels = logs.map(l => {
      const d = new Date(l.timestamp * 1000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    const values = logs.map(l => l.percentage);
    const dev = devices.find(d => d.id === selectedHistoryDevice);
    const devName = dev ? dev.name : selectedHistoryDevice;
    const color = palette[selectedHistoryDevice] || palette.default;

    batteryChart.data.labels = labels;
    batteryChart.data.datasets = [{
      label: `${devName} Battery %`,
      data: values,
      borderColor: color,
      borderWidth: 2,
      tension: 0.1,
      fill: false,
      pointRadius: 2
    }];
  } else {
    const deviceGroups = {};
    const timestampSet = new Set();

    logs.forEach(l => {
      if (!deviceGroups[l.device_id]) deviceGroups[l.device_id] = [];
      deviceGroups[l.device_id].push(l);
      timestampSet.add(l.timestamp);
    });

    const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
    const labels = sortedTimestamps.map(t => {
      const d = new Date(t * 1000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const datasets = Object.keys(deviceGroups).map(devId => {
      const devLogs = deviceGroups[devId];
      const logMap = new Map(devLogs.map(item => [item.timestamp, item.percentage]));
      
      let lastVal = 50;
      const dataPoints = sortedTimestamps.map(t => {
        if (logMap.has(t)) {
          lastVal = logMap.get(t);
        }
        return lastVal;
      });

      const dev = devices.find(d => d.id === devId);
      const devName = dev ? dev.name : devId;
      const color = palette[devId] || palette.default;

      return {
        label: devName,
        data: dataPoints,
        borderColor: color,
        borderWidth: 1.8,
        tension: 0.1,
        fill: false,
        pointRadius: 2
      };
    });

    batteryChart.data.labels = labels;
    batteryChart.data.datasets = datasets;
  }

  batteryChart.update();
}

// Toast
function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.textContent = msg;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
