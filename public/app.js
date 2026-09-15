/* ==========================================================================
   Clean & Usable Device Dashboard — Client Logic
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
let selectedHistoryDevice = 'all';
let selectedHistoryHours = 24;
let batteryChart = null;
let eventSource = null;
let isSimulatorActive = false;

function getUserHeaders() {
  if (activeUser && activeUser.id) {
    return { 'X-User-Id': activeUser.id };
  }
  return {};
}

async function switchActiveUser(targetUserId) {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) { showToast('Failed to fetch users'); return; }
    const data = await res.json();
    if (data.status === 'success' && data.users) {
      const found = data.users.find(u => u.id === targetUserId);
      if (found) {
        activeUser = found;
        localStorage.setItem('omniverse_auth_user', JSON.stringify(found));
        showToast(`Switched account to ${found.name}`);
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
        const syncEl = document.getElementById('connectionStatus');
        if (syncEl) {
          const text = document.getElementById('connectionText');
          if (text) text.textContent = 'Live Cloud HTTPS';
        }
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

// Server-Sent Events (SSE) for Real-Time Updates (Scoped to current user)
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

// Fetch Initial Devices and Simulator State for Current User
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
        if (!res.ok) { simCheckbox.checked = !simCheckbox.checked; return; }
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
    const userId = activeUser?.id;
    const res = await fetch('/api/devices/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
      body: JSON.stringify({ device_id: deviceId, ...(userId ? { user_id: userId } : {}) })
    });
    if (!res.ok) { showToast('Failed to remove device'); return; }
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

    const res = await fetch(url, { headers: getUserHeaders() });
    if (!res.ok) return;
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

  // Dynamic color palette — generates unique colors for any device ID
  const colorPool = [
    '#f0f6fc', '#58a6ff', '#a371f7', '#3fb950', '#f97583',
    '#d2a8ff', '#79c0ff', '#56d364', '#ffa657', '#ff7b72',
    '#7ee787', '#d29922', '#bc8cff', '#39d353', '#e3b341'
  ];
  const deviceColorMap = {};
  let colorIndex = 0;
  function getDeviceColor(devId) {
    if (!deviceColorMap[devId]) {
      deviceColorMap[devId] = colorPool[colorIndex % colorPool.length];
      colorIndex++;
    }
    return deviceColorMap[devId];
  }

  if (selectedHistoryDevice !== 'all') {
    const labels = logs.map(l => {
      const d = new Date(l.timestamp * 1000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    const values = logs.map(l => l.percentage);
    const dev = devices.find(d => d.id === selectedHistoryDevice);
    const devName = dev ? dev.name : selectedHistoryDevice;
    const color = getDeviceColor(selectedHistoryDevice);

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
      const color = getDeviceColor(devId);

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

// Clerk & Multi-User Auth Status Handler
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
          // Skip Clerk loading — show sign-in link instead
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

      if (window.Clerk) {
        await window.Clerk.load({
          appearance: {
            variables: {
              colorPrimary: '#1f6feb',
              colorBackground: '#161b22',
              colorText: '#f0f6fc',
              colorNeutral: '#f0f6fc',
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
          // Clerk session has ended; clear stale local session
          localStorage.removeItem('omniverse_auth_user');
          activeUser = null;
        }
      }
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
  showToast('Signed out successfully');
  initAuthStatus();
  initRealtimeEvents();
  fetchInitialData();
  fetchChartHistory();
};

