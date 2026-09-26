/* ==========================================================================
   Statuser — Premium Dashboard Client Logic
   ========================================================================== */

function getActiveUser() {
  const saved = localStorage.getItem('omniverse_auth_user');
  if (saved) {
    try {
      const u = JSON.parse(saved);
      if (u && u.id) return u;
    } catch (_) {}
  }
  return null;
}

let activeUser = getActiveUser();
let devices = [];
let activeFilter = 'all';
let searchQuery = '';
let selectedHistoryDevice = 'all';
let selectedHistoryHours = 24;
let selectedHistoryMetric = 'battery';
let batteryChart = null;
let eventSource = null;
let isSimulatorActive = false;

// Animated counter cache
const counterCache = {};

function getUserHeaders() {
  if (activeUser && activeUser.id) {
    return { 'X-User-Id': activeUser.id };
  }
  return {};
}

async function switchActiveUser(targetUserId) {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) { showToast('Failed to fetch users', 'error'); return; }
    const data = await res.json();
    if (data.status === 'success' && data.users) {
      const found = data.users.find(u => u.id === targetUserId);
      if (found) {
        activeUser = found;
        localStorage.setItem('omniverse_auth_user', JSON.stringify(found));
        showToast(`Switched account to ${found.name}`, 'success');
        initAuthStatus();
        initRealtimeEvents();
        fetchInitialData();
        populateDynamicSetupUrls();
        fetchChartHistory();
        return;
      }
    }
  } catch (err) {
    console.error('Failed to switch user:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRealtimeEvents();
  setupUIEventListeners();
  initHistoryChart();
  fetchInitialData();
  populateDynamicSetupUrls();
  initAuthStatus();
});

// Update URLs in Setup Modal
async function populateDynamicSetupUrls() {
  let origin = window.location.origin;

  try {
    const res = await fetch('/api/tunnel');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.url) {
        origin = data.url;
        const text = document.getElementById('connectionText');
        if (text) text.textContent = 'Live Cloud HTTPS';
      }
    }
  } catch (_) {}

  const uid = encodeURIComponent((activeUser && activeUser.id) || '');
  const macEl = document.getElementById('macOneLiner');
  if (macEl) {
    if (activeUser && activeUser.id) {
      macEl.textContent = `curl -X POST "${origin}/api/report" -H "Content-Type: application/json" -H "X-User-Id: ${activeUser.id}" -d '{"device_id":"macbook","platform":"macos","battery_level":88}'`;
    } else {
      macEl.textContent = `curl -X POST "${origin}/api/report" -H "Content-Type: application/json" -d '{"device_id":"macbook","platform":"macos","battery_level":88}'`;
    }
  }

  const winEl = document.getElementById('winOneLiner');
  if (winEl) {
    if (activeUser && activeUser.id) {
      winEl.textContent = `powershell.exe -ExecutionPolicy Bypass -File .\\agents\\windows\\report_battery.ps1 -DashboardUrl "${origin}" -DeviceId "windows-laptop" -UserId "${activeUser.id}"`;
    } else {
      winEl.textContent = `powershell.exe -ExecutionPolicy Bypass -File .\\agents\\windows\\report_battery.ps1 -DashboardUrl "${origin}" -DeviceId "windows-laptop"`;
    }
  }

  const iosUrl = document.getElementById('iosWebhookUrl');
  if (iosUrl) iosUrl.textContent = uid ? `${origin}/api/report?user_id=${uid}` : `${origin}/api/report`;

  const androidUrl = document.getElementById('androidWebhook');
  if (androidUrl) androidUrl.textContent = uid ? `POST ${origin}/api/report?user_id=${uid}` : `POST ${origin}/api/report`;

  const linuxEl = document.getElementById('linuxOneLiner');
  if (linuxEl) {
    if (activeUser && activeUser.id) {
      linuxEl.textContent = `./agents/linux/report_battery.sh "${origin}" linux-laptop --user-id "${activeUser.id}"`;
    } else {
      linuxEl.textContent = `./agents/linux/report_battery.sh "${origin}" linux-laptop`;
    }
  }

  const linuxInstall = document.getElementById('linuxInstallCmd');
  if (linuxInstall) {
    linuxInstall.textContent = `./agents/linux/report_battery.sh --install "${origin}"`;
  }
}

// ==========================================================================
// Server-Sent Events (SSE) — Scoped to current user
// ==========================================================================

function initRealtimeEvents() {
  const statusBadge = document.getElementById('connectionStatus');
  const statusText = document.getElementById('connectionText');

  if (eventSource) {
    eventSource.close();
  }

  const sseUrl = activeUser && activeUser.id 
    ? `/api/events?user_id=${encodeURIComponent(activeUser.id)}`
    : '/api/events';
  eventSource = new EventSource(sseUrl);

  eventSource.onopen = () => {
    if (statusText) statusText.textContent = 'Connected';
    if (statusBadge) {
      const dot = statusBadge.querySelector('.dot');
      if (dot) {
        dot.style.backgroundColor = 'var(--accent-green)';
        dot.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
      }
    }
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
      // FIX 8: Only show toast for critical low-battery alerts, not every update
      if (ping.alert === 'low_battery') {
        showToast(`⚠️ Low battery: ${ping.device_id} is at ${ping.battery}%`, 'error');
      }
    } catch (_) {}
  });

  eventSource.onerror = () => {
    if (statusText) statusText.textContent = 'Reconnecting...';
    if (statusBadge) {
      const dot = statusBadge.querySelector('.dot');
      if (dot) {
        dot.style.backgroundColor = 'var(--accent-red)';
        dot.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.5)';
        dot.style.animation = 'none';
      }
    }
  };
}

// Fetch Initial Data
async function fetchInitialData() {
  try {
    const res = await fetch('/api/devices', { headers: getUserHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        devices = data.devices;
        renderAll();
      }
    }

    const simRes = await fetch('/api/simulator/status');
    if (simRes.ok) {
      const simData = await simRes.json();
      if (simData.status === 'success') {
        isSimulatorActive = simData.running;
        const simCheckbox = document.getElementById('simCheckbox');
        if (simCheckbox) simCheckbox.checked = isSimulatorActive;
      }
    }
  } catch (err) {
    console.error('Data load error:', err);
  }
}

// ==========================================================================
// Event Listeners
// ==========================================================================

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

  // Search input
  const searchInput = document.getElementById('deviceSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderDeviceGrid();
    });
  }

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    fetchInitialData();
    fetchChartHistory();
    showToast('Data refreshed', 'success');
  });

  // Simulator Checkbox
  const simCheckbox = document.getElementById('simCheckbox');
  if (simCheckbox) {
    simCheckbox.addEventListener('change', async (e) => {
      try {
        const res = await fetch('/api/simulator/toggle', { method: 'POST' });
        if (!res.ok) { simCheckbox.checked = !simCheckbox.checked; return; }
        const data = await res.json();
        if (data.status === 'success') {
          isSimulatorActive = data.running;
          simCheckbox.checked = isSimulatorActive;
          showToast(isSimulatorActive ? 'Simulator running' : 'Simulator stopped', 'info');
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

  // Keyboard shortcut to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });

  // Modal tabs
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
          e.currentTarget.textContent = '✓ Copied!';
          e.currentTarget.style.color = 'var(--accent-green)';
          setTimeout(() => {
            e.currentTarget.textContent = orig;
            e.currentTarget.style.color = '';
          }, 1500);
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

  // Chart metric dropdown
  const metricSelect = document.getElementById('chartMetricSelect');
  if (metricSelect) {
    metricSelect.addEventListener('change', (e) => {
      selectedHistoryMetric = e.target.value;
      fetchChartHistory();
    });
  }
}

// ==========================================================================
// Render All Components
// ==========================================================================

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

// ==========================================================================
// Animated Counter
// ==========================================================================

function animateCounter(elementId, targetValue, suffix = '') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const currentValue = counterCache[elementId] || 0;
  const target = typeof targetValue === 'number' ? targetValue : parseInt(targetValue, 10);

  if (isNaN(target)) {
    el.textContent = targetValue + suffix;
    return;
  }

  if (currentValue === target) {
    el.textContent = target + suffix;
    return;
  }

  counterCache[elementId] = target;

  const duration = 400;
  const startTime = performance.now();
  const startVal = currentValue;

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startVal + (target - startVal) * eased);
    el.textContent = current + suffix;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// ==========================================================================
// Summary Stats with Animated Counters
// ==========================================================================

function updateSummaryStats() {
  const onlineBadgeEl = document.getElementById('onlineDevicesBadge');
  const avgTrendEl = document.getElementById('avgBatteryTrend');
  const lowBatteryAlertEl = document.getElementById('lowBatteryAlert');

  const total = devices.length;
  animateCounter('totalDevicesCount', total);

  const onlineCount = devices.filter(d => d.is_online).length;
  if (onlineBadgeEl) onlineBadgeEl.textContent = `${onlineCount} online`;

  const chargingCount = devices.filter(d => d.is_charging).length;
  animateCounter('chargingCount', chargingCount);

  const lowCount = devices.filter(d => d.battery_level <= 20).length;
  animateCounter('lowBatteryCount', lowCount);
  if (lowBatteryAlertEl) {
    lowBatteryAlertEl.textContent = lowCount > 0 ? `${lowCount} need charge` : 'All normal';
    lowBatteryAlertEl.style.color = lowCount > 0 ? 'var(--accent-red)' : '';
  }

  if (total > 0) {
    const sum = devices.reduce((acc, d) => acc + (d.battery_level || 0), 0);
    const avg = Math.round(sum / total);
    animateCounter('avgBatteryLevel', avg, '%');
    if (avgTrendEl) {
      avgTrendEl.textContent = avg >= 70 ? '● High' : avg >= 35 ? '● Medium' : '● Low';
      avgTrendEl.style.color = avg >= 70 ? 'var(--accent-green)' : avg >= 35 ? 'var(--accent-yellow)' : 'var(--accent-red)';
    }
  } else {
    const el = document.getElementById('avgBatteryLevel');
    if (el) el.textContent = '--%';
  }
}

// ==========================================================================
// Device Grid Render
// ==========================================================================

function renderDeviceGrid() {
  const grid = document.getElementById('devicesGrid');
  grid.innerHTML = '';

  const filtered = devices.filter(d => {
    const matchesFilter = activeFilter === 'all' || (d.platform || '').toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch = !searchQuery || 
      (d.name || '').toLowerCase().includes(searchQuery) ||
      (d.id || '').toLowerCase().includes(searchQuery) ||
      (d.platform || '').toLowerCase().includes(searchQuery) ||
      (d.model || '').toLowerCase().includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📡</div>
        <div class="empty-state-title">${searchQuery ? 'No matching devices' : 'No devices connected'}</div>
        <div class="empty-state-desc">${searchQuery ? 'Try adjusting your search query or filter' : 'Click "+ Connect Device" to add your first device and start monitoring.'}</div>
      </div>
    `;
    return;
  }

  filtered.forEach((device, index) => {
    const item = createDeviceElement(device, index);
    grid.appendChild(item);
  });
}

// ==========================================================================
// SVG Battery Ring Generator
// ==========================================================================

function createBatteryRingSVG(level, isCharging) {
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (level / 100) * circumference;

  let strokeColor;
  if (isCharging) {
    strokeColor = '#818cf8';
  } else if (level <= 20) {
    strokeColor = '#f87171';
  } else if (level <= 50) {
    strokeColor = '#facc15';
  } else {
    strokeColor = '#4ade80';
  }

  return `
    <svg class="battery-ring-svg" viewBox="0 0 72 72">
      <circle class="battery-ring-bg" cx="36" cy="36" r="${radius}"/>
      <circle class="battery-ring-fill" cx="36" cy="36" r="${radius}"
        stroke="${strokeColor}"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${offset}"
        style="color: ${strokeColor}"
      />
    </svg>
  `;
}

// ==========================================================================
// Time Ago Helper
// ==========================================================================

function timeAgo(seconds) {
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m}m ago`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return `${h}h ago`;
  }
  const d = Math.floor(seconds / 86400);
  return `${d}d ago`;
}

// ==========================================================================
// Platform Tag with Color Class
// ==========================================================================

function getPlatformTag(platform) {
  const p = (platform || 'device').toLowerCase();
  const icons = {
    macos: '🍎',
    windows: '🪟',
    ios: '📱',
    android: '🤖',
    linux: '🐧'
  };
  const icon = icons[p] || '💻';
  return `<span class="platform-tag ${p}">${icon} ${p}</span>`;
}

// ==========================================================================
// Create Device Card Element
// ==========================================================================

function createDeviceElement(device, index) {
  const card = document.createElement('div');
  card.className = 'device-item';
  card.style.animationDelay = `${0.05 + index * 0.05}s`;

  const level = Math.max(0, Math.min(100, device.battery_level || 0));
  const isCharging = Boolean(device.is_charging);
  const platform = (device.platform || 'device').toLowerCase();

  // Badge
  let badgeClass = 'badge-normal';
  let statusText = 'On Battery';

  if (isCharging) {
    badgeClass = 'badge-charging';
    statusText = '⚡ Charging';
  } else if (level <= 20) {
    badgeClass = 'badge-low';
    statusText = '⚠ Low Battery';
  } else if (level <= 50) {
    badgeClass = 'badge-medium';
    statusText = 'Moderate';
  }

  const secAgo = device.seconds_since_update || 0;
  const timeStr = timeAgo(secAgo);
  const isOnline = device.is_online;

  // Temperature display
  const temp = device.temperature;
  let tempDisplay = '--';
  let tempColor = '';
  if (temp !== null && temp !== undefined && temp > 0) {
    tempDisplay = `${temp.toFixed(1)}°C`;
    tempColor = temp > 45 ? 'color: var(--accent-red)' : temp > 38 ? 'color: var(--accent-yellow)' : '';
  }

  // CPU / RAM display — null means unavailable (mobile), 0 is a valid reading
  const cpuDisplay = (device.cpu_usage !== null && device.cpu_usage !== undefined)
    ? device.cpu_usage.toFixed(1) + '%' : '--';
  const ramDisplay = (device.ram_usage !== null && device.ram_usage !== undefined)
    ? device.ram_usage.toFixed(0) + '%' : '--';

  // Cycle count display — null means unavailable
  const cycleDisplay = device.cycle_count ? `(${device.cycle_count} cycles)` : '';

  // Disk usage display — from desktop agent
  let diskDisplay = '--';
  if (device.disk_used && device.disk_total) {
    const pct = device.disk_percent != null ? ` · ${device.disk_percent}%` : '';
    diskDisplay = `${device.disk_used} / ${device.disk_total}${pct}`;
  }

  card.innerHTML = `
    <div class="device-item-head">
      <div class="device-item-title">
        <span class="device-item-name">${escapeHtml(device.name || device.id)}</span>
        <span class="device-item-meta">${escapeHtml(device.model || platform)}</span>
      </div>
      ${getPlatformTag(platform)}
    </div>

    <div class="battery-ring-section">
      <div class="battery-ring-container">
        ${createBatteryRingSVG(level, isCharging)}
        <div class="battery-ring-text">
          <span class="battery-ring-percent">${level}%</span>
          <span class="battery-ring-label">${isCharging ? 'CHG' : 'BAT'}</span>
        </div>
      </div>
      <div class="battery-info">
        <div class="battery-status-row">
          <span class="battery-badge ${badgeClass}">${statusText}</span>
        </div>
        <span class="battery-power-source">${escapeHtml(device.power_source || 'Battery')}</span>
      </div>
    </div>

    <div class="details-table">
      <div class="details-row">
        <span class="details-key">Health</span>
        <span class="details-val">${escapeHtml(device.battery_health || '--')} ${cycleDisplay}</span>
      </div>
      <div class="details-row">
        <span class="details-key">CPU / RAM</span>
        <span class="details-val">${cpuDisplay} / ${ramDisplay}</span>
      </div>
      <div class="details-row">
        <span class="details-key">Temperature</span>
        <span class="details-val" style="${tempColor}">${tempDisplay}</span>
      </div>
      ${diskDisplay !== '--' ? `
      <div class="details-row">
        <span class="details-key">Disk</span>
        <span class="details-val">${escapeHtml(diskDisplay)}</span>
      </div>` : ''}
      <div class="details-row">
        <span class="details-key">IP Address</span>
        <span class="details-val">${escapeHtml(device.ip_address || 'Local')}</span>
      </div>
    </div>

    <div class="device-item-foot">
      <div class="status-indicator ${isOnline ? '' : 'offline'}">
        <span class="mini-dot"></span>
        <span>${isOnline ? 'Online' : 'Offline'} · ${timeStr}</span>
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
    const userId = activeUser?.id;
    const res = await fetch('/api/devices/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
      body: JSON.stringify({ device_id: deviceId, ...(userId ? { user_id: userId } : {}) })
    });
    if (!res.ok) { showToast('Failed to remove device', 'error'); return; }
    const data = await res.json();
    if (data.status === 'success') {
      devices = devices.filter(d => d.id !== deviceId);
      renderAll();
      fetchChartHistory();
      showToast(`Removed ${deviceId}`, 'success');
    }
  } catch (err) {
    showToast('Failed to remove device', 'error');
  }
};

// ==========================================================================
// Chart
// ==========================================================================

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
      animation: { duration: 600, easing: 'easeOutCubic' },
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
            boxWidth: 12,
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(148, 163, 184, 0.15)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { weight: '600' },
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(148, 163, 184, 0.06)', drawBorder: false },
          ticks: { color: '#64748b', font: { family: "'JetBrains Mono', monospace", size: 10 }, maxRotation: 0 }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(148, 163, 184, 0.06)', drawBorder: false },
          ticks: {
            color: '#64748b',
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

async function fetchChartHistory() {
  if (!batteryChart) return;

  try {
    let url = `/api/history?hours=${selectedHistoryHours}`;
    if (selectedHistoryDevice !== 'all') {
      url = `/api/devices/${selectedHistoryDevice}/history?hours=${selectedHistoryHours}`;
    }

    const res = await fetch(url, { headers: getUserHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    if (data.status !== 'success') return;

    renderChartData(data.history || []);
  } catch (err) {
    console.error('Failed to load chart history:', err);
  }
}

function renderChartData(logs) {
  if (!logs || logs.length === 0) {
    batteryChart.data.labels = [];
    batteryChart.data.datasets = [];
    batteryChart.update();
    return;
  }

  // Premium color palette with gradient fills
  const colorPool = [
    { line: '#818cf8', fill: 'rgba(129, 140, 248, 0.08)' },
    { line: '#06b6d4', fill: 'rgba(6, 182, 212, 0.08)' },
    { line: '#a855f7', fill: 'rgba(168, 85, 247, 0.08)' },
    { line: '#4ade80', fill: 'rgba(74, 222, 128, 0.08)' },
    { line: '#f97316', fill: 'rgba(249, 115, 22, 0.08)' },
    { line: '#f87171', fill: 'rgba(248, 113, 113, 0.08)' },
    { line: '#facc15', fill: 'rgba(250, 204, 21, 0.08)' },
    { line: '#2dd4bf', fill: 'rgba(45, 212, 191, 0.08)' },
  ];
  const deviceColorMap = {};
  let colorIndex = 0;
  function getDeviceColors(devId) {
    if (!deviceColorMap[devId]) {
      deviceColorMap[devId] = colorPool[colorIndex % colorPool.length];
      colorIndex++;
    }
    return deviceColorMap[devId];
  }

  const metricKeyMap = {
    'battery': 'percentage',
    'cpu': 'cpu_usage',
    'ram': 'ram_usage'
  };
  const metricLabelMap = {
    'battery': 'Battery %',
    'cpu': 'CPU %',
    'ram': 'RAM %'
  };
  const key = metricKeyMap[selectedHistoryMetric] || 'percentage';
  const labelSuffix = metricLabelMap[selectedHistoryMetric] || 'Battery %';
  const titleEl = document.getElementById('chartTitle');
  if (titleEl) {
    titleEl.textContent = `📊 ${selectedHistoryMetric === 'cpu' ? 'CPU History' : selectedHistoryMetric === 'ram' ? 'RAM History' : 'Battery History'}`;
  }

  if (selectedHistoryDevice !== 'all') {
    const labels = logs.map(l => {
      const d = new Date(l.timestamp * 1000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    const values = logs.map(l => l[key] !== null ? l[key] : 0);
    const dev = devices.find(d => d.id === selectedHistoryDevice);
    const devName = dev ? dev.name : selectedHistoryDevice;
    const colors = getDeviceColors(selectedHistoryDevice);

    batteryChart.data.labels = labels;
    batteryChart.data.datasets = [{
      label: `${devName} ${labelSuffix}`,
      data: values,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      borderWidth: 2,
      tension: 0.3,
      fill: true,
      pointRadius: 1,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: colors.line
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
      const logMap = new Map(devLogs.map(item => [item.timestamp, item[key] !== null ? item[key] : 0]));
      
      let lastVal = 0;
      const dataPoints = sortedTimestamps.map(t => {
        if (logMap.has(t)) {
          lastVal = logMap.get(t);
        }
        return lastVal;
      });

      const dev = devices.find(d => d.id === devId);
      const devName = dev ? dev.name : devId;
      const colors = getDeviceColors(devId);

      return {
        label: `${devName} ${labelSuffix}`,
        data: dataPoints,
        borderColor: colors.line,
        backgroundColor: colors.fill,
        borderWidth: 1.8,
        tension: 0.3,
        fill: true,
        pointRadius: 1,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: colors.line
      };
    });

    batteryChart.data.labels = labels;
    batteryChart.data.datasets = datasets;
  }

  batteryChart.update();
}

// ==========================================================================
// Toast — Enhanced
// ==========================================================================

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `<span style="font-weight: 700; font-size: 0.9rem">${icons[type] || 'ℹ'}</span> ${escapeHtml(msg)}`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ==========================================================================
// Utilities
// ==========================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// Auth — Clerk & Multi-User
// ==========================================================================

async function initAuthStatus() {
  const authArea = document.getElementById('authNavArea');
  if (!authArea) return;

  // Fetch all registered users for account switcher
  let availableUsers = [];
  try {
    const uRes = await fetch('/api/users');
    if (uRes.ok) {
      const uData = await uRes.json();
      if (uData.status === 'success' && uData.users) {
        availableUsers = uData.users;
      }
    }
  } catch (_) {}

  // Check if Clerk key is available
  let clerkKey = localStorage.getItem('clerk_publishable_key');
  if (!clerkKey) {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.clerk_publishable_key) {
          clerkKey = data.clerk_publishable_key;
        }
      }
    } catch (_) {}
  }

  // If live Clerk key is present, load Clerk SDK
  if (clerkKey && (clerkKey.startsWith('pk_test_') || clerkKey.startsWith('pk_live_'))) {
    try {
      let clerkScript = document.getElementById('clerk-js-sdk');
      if (!clerkScript) {
        let frontendApi = '';
        try {
          const parts = clerkKey.split('_');
          if (parts.length >= 3) {
            frontendApi = atob(parts[2]).replace(/\$$/, '') || '';
          }
        } catch (_) {}

        if (!frontendApi) {
          console.warn('Could not derive Clerk Frontend API from key.');
        } else {
          clerkScript = document.createElement('script');
          clerkScript.id = 'clerk-js-sdk';
          clerkScript.crossOrigin = 'anonymous';
          clerkScript.setAttribute('data-clerk-publishable-key', clerkKey);
          clerkScript.src = `https://${frontendApi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
          document.head.appendChild(clerkScript);
          await new Promise((resolve, reject) => {
            clerkScript.onload = resolve;
            clerkScript.onerror = reject;
          });
        }
      }

      if (window.Clerk) {
        await window.Clerk.load({
          appearance: {
            variables: {
              colorPrimary: '#6366f1',
              colorBackground: '#0f172a',
              colorText: '#f1f5f9',
              colorNeutral: '#f1f5f9',
            }
          }
        });

        if (window.Clerk.user) {
          const cUser = window.Clerk.user;
          const email = cUser.primaryEmailAddress ? cUser.primaryEmailAddress.emailAddress : '';
          const name = cUser.fullName || cUser.firstName || (email ? email.split('@')[0] : 'Clerk User');
          
          if (activeUser?.id !== cUser.id) {
            activeUser = {
              id: cUser.id,
              name: name,
              email: email,
              avatar_url: cUser.imageUrl,
              provider: 'clerk'
            };
            localStorage.setItem('omniverse_auth_user', JSON.stringify(activeUser));
          }

          // Listen for Clerk signout
          if (!window._clerkSignoutListenerAdded && window.Clerk.addListener) {
            window._clerkSignoutListenerAdded = true;
            window.Clerk.addListener(({ user }) => {
              if (!user && activeUser?.provider === 'clerk') {
                localStorage.removeItem('omniverse_auth_user');
                activeUser = null;
                initAuthStatus();
                initRealtimeEvents();
                fetchInitialData();
                fetchChartHistory();
              }
            });
          }

          authArea.innerHTML = `
            <div class="topbar-user-pill" title="Clerk User: ${escapeHtml(email)}">
              <div class="topbar-user-avatar">${(name[0] || 'C').toUpperCase()}</div>
              <span class="user-pill-name">${escapeHtml(name)}</span>
              <div id="clerk-user-button"></div>
              <button type="button" class="topbar-signout-btn" id="topbarSignOutBtn" title="Sign Out">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          `;
          const mountEl = document.getElementById('clerk-user-button');
          if (mountEl) {
            window.Clerk.mountUserButton(mountEl, {
              afterSignOutUrl: window.location.origin
            });
          }

          document.getElementById('topbarSignOutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.handleSignOut();
          });
          return;
        } else if (activeUser?.provider === 'clerk') {
          localStorage.removeItem('omniverse_auth_user');
          activeUser = null;
        }
      }
    } catch (err) {
      console.warn('Clerk load in dashboard warning:', err);
    }
  }

  // If not authenticated, display clean Sign In button
  if (!activeUser || !activeUser.id) {
    authArea.innerHTML = `
      <a href="/signin" class="topbar-signin-btn" id="navSignInBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        Sign In
      </a>
    `;
    return;
  }

  // Active user session rendering with multi-user dropdown
  const initial = (activeUser.name || activeUser.email || 'U')[0].toUpperCase();
  
  // Ensure active user is represented in options
  if (!availableUsers.some(u => u.id === activeUser.id)) {
    availableUsers.unshift({
      id: activeUser.id,
      name: activeUser.name || 'Current User',
      email: activeUser.email || ''
    });
  }

  const optionsHtml = availableUsers.map(u => {
    const isSelected = u.id === activeUser.id ? 'selected' : '';
    return `<option value="${escapeHtml(u.id)}" ${isSelected}>${escapeHtml(u.name)}</option>`;
  }).join('');

  authArea.innerHTML = `
    <div class="topbar-user-pill">
      <div class="topbar-user-avatar">${initial}</div>
      <div class="user-select-wrap">
        <select class="user-select-dropdown" id="userSelectDropdown" title="Switch User (Isolated Fleet)">
          ${optionsHtml}
        </select>
      </div>
      <button type="button" class="topbar-signout-btn" id="topbarSignOutBtn" title="Sign Out">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
    </div>
  `;

  document.getElementById('userSelectDropdown')?.addEventListener('change', (e) => {
    switchActiveUser(e.target.value);
  });

  document.getElementById('topbarSignOutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.handleSignOut();
  });
}

// Global Sign Out handler
window.handleSignOut = async function() {
  try {
    if (window.Clerk && window.Clerk.user) {
      await window.Clerk.signOut();
    }
  } catch (err) {
    console.warn('Error during Clerk sign out:', err);
  }
  localStorage.removeItem('omniverse_auth_user');
  activeUser = null;
  showToast('Signed out successfully', 'success');
  initAuthStatus();
  initRealtimeEvents();
  fetchInitialData();
  fetchChartHistory();
};
