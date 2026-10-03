/**
 * Smart Home Automation System
 * Frontend Application Controller
 * Developed by: Falguni and Team (Dept. of ETC, SB Jain, Nagpur)
 */

// Application State
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  currentTab: 'tab-monitoring',
  device: {
    relay: 'OFF',
    line1: 'SmartHome System',
    line2: 'WELCOME',
    currentTemp: 28,
    currentHumidity: 45,
    isOnline: false,
    lastPingAgoSeconds: null
  },
  records: [],
  pagination: {
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1
  },
  charts: {
    tempHumChart: null
  },
  pollInterval: null
};

// DOM Content Loaded Entrypoint
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  checkAuthAndRender();
});

// -------------------------------------------------------------
// THEME MANAGEMENT (Light / Dark)
// -------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  const theme = isDark ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  updateThemeIcon(theme);
  if (state.charts.tempHumChart) {
    updateChartTheme();
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (theme === 'dark') {
    // Show Sun icon to switch to light
    icon.innerHTML = `<svg class="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
  } else {
    // Show Moon icon to switch to dark
    icon.innerHTML = `<svg class="w-5 h-5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
  }
}

// -------------------------------------------------------------
// AUTHENTICATION & VIEW MANAGEMENT
// -------------------------------------------------------------
function checkAuthAndRender() {
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');

  if (state.token && state.user) {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    renderUserHeader();
    initDashboard();
  } else {
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    stopPolling();
  }
}

function renderUserHeader() {
  const greetingEl = document.getElementById('user-greeting');
  if (greetingEl && state.user) {
    greetingEl.textContent = `Welcome ${state.user.name || 'User'}`;
  }
}

function handleLogin(email, password) {
  showButtonLoading('login-btn', true);
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
    .then(res => res.json())
    .then(data => {
      showButtonLoading('login-btn', false);
      if (data.success) {
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showToast('Login successful! Welcome back.', 'success');
        checkAuthAndRender();
      } else {
        showToast(data.error || 'Login failed', 'error');
      }
    })
    .catch(err => {
      showButtonLoading('login-btn', false);
      showToast('Network error during login', 'error');
    });
}

function handleRegister(name, email, password) {
  showButtonLoading('register-btn', true);
  fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  })
    .then(res => res.json())
    .then(data => {
      showButtonLoading('register-btn', false);
      if (data.success) {
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showToast('Account created successfully!', 'success');
        checkAuthAndRender();
      } else {
        showToast(data.error || 'Registration failed', 'error');
      }
    })
    .catch(err => {
      showButtonLoading('register-btn', false);
      showToast('Network error during registration', 'error');
    });
}

function handleLogout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showToast('Logged out successfully', 'info');
  checkAuthAndRender();
}

// -------------------------------------------------------------
// DASHBOARD INITIALIZATION & DATA POLLING
// -------------------------------------------------------------
function initDashboard() {
  fetchDashboardStats();
  fetchRecords(state.pagination.page);
  startPolling();
}

function startPolling() {
  stopPolling();
  // Poll every 3.5 seconds for real-time ESP8266 responsiveness
  state.pollInterval = setInterval(() => {
    fetchDashboardStats(true);
  }, 3500);
}

function stopPolling() {
  if (state.pollInterval) {
    clearInterval(state.pollInterval);
    state.pollInterval = null;
  }
}

function fetchDashboardStats(silent = false) {
  fetch('/api/dashboard/stats')
    .then(res => res.json())
    .then(data => {
      state.device = data.device;
      updateHeaderStatus(data.device);
      updateGauges(data.device.currentTemp, data.device.currentHumidity);
      updateRelayUI(data.device.relay);
      updateLcdUI(data.device.line1, data.device.line2);

      if (data.graphData && data.graphData.length > 0) {
        renderCharts(data.graphData);
      }
    })
    .catch(err => {
      if (!silent) console.error('Error fetching dashboard stats:', err);
    });
}

// -------------------------------------------------------------
// HEADER ESP8266 ONLINE / OFFLINE STATUS
// -------------------------------------------------------------
function updateHeaderStatus(device) {
  const statusContainer = document.getElementById('esp-status-badge');
  if (!statusContainer) return;

  if (device.isOnline) {
    statusContainer.innerHTML = `
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 online-pulse"></span>
        <span>ESP8266: ONLINE</span>
        <span class="text-[10px] opacity-75 hidden sm:inline">(${device.lastPingFormatted || 'Live'})</span>
      </div>
    `;
  } else {
    const ago = device.lastPingAgoSeconds ? `${device.lastPingAgoSeconds}s ago` : 'Offline';
    statusContainer.innerHTML = `
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
        <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
        <span>ESP8266: OFFLINE</span>
        <span class="text-[10px] opacity-75 hidden sm:inline">(${ago})</span>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// GAUGES & METRICS (Tab 1, Section 1)
// -------------------------------------------------------------
function updateGauges(temp, humidity) {
  const tempVal = typeof temp === 'number' ? temp : 28;
  const humVal = typeof humidity === 'number' ? humidity : 45;

  // Temperature Arc (0°C to 50°C)
  // Perimeter of semi-circle arc (radius 80) = PI * 80 ≈ 251.3
  const arcLength = 251.3;
  const tempClamped = Math.min(Math.max(tempVal, 0), 50);
  const tempOffset = arcLength - (tempClamped / 50) * arcLength;

  const tempPath = document.getElementById('temp-gauge-path');
  const tempText = document.getElementById('temp-gauge-value');
  const tempBar = document.getElementById('temp-seek-bar');
  const tempComfort = document.getElementById('temp-comfort-badge');

  if (tempPath) tempPath.style.strokeDashoffset = tempOffset;
  if (tempText) tempText.textContent = `${tempVal} 'C`;
  if (tempBar) tempBar.style.width = `${(tempClamped / 50) * 100}%`;

  if (tempComfort) {
    if (tempVal < 20) {
      tempComfort.textContent = 'Cool Environment';
      tempComfort.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20';
    } else if (tempVal <= 29) {
      tempComfort.textContent = 'Optimal Comfort';
      tempComfort.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
    } else {
      tempComfort.textContent = 'High Temperature';
      tempComfort.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20';
    }
  }

  // Humidity Arc (0% to 100%)
  const humClamped = Math.min(Math.max(humVal, 0), 100);
  const humOffset = arcLength - (humClamped / 100) * arcLength;

  const humPath = document.getElementById('hum-gauge-path');
  const humText = document.getElementById('hum-gauge-value');
  const humBar = document.getElementById('hum-seek-bar');
  const humComfort = document.getElementById('hum-comfort-badge');

  if (humPath) humPath.style.strokeDashoffset = humOffset;
  if (humText) humText.textContent = `${humVal} %`;
  if (humBar) humBar.style.width = `${humClamped}%`;

  if (humComfort) {
    if (humVal < 30) {
      humComfort.textContent = 'Dry Air';
      humComfort.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20';
    } else if (humVal <= 60) {
      humComfort.textContent = 'Ideal Range';
      humComfort.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-teal-500/10 text-teal-500 border border-teal-500/20';
    } else {
      humComfort.textContent = 'High Humidity';
      humComfort.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/20';
    }
  }
}

// -------------------------------------------------------------
// CHARTS (Chart.js)
// -------------------------------------------------------------
function renderCharts(graphData) {
  const ctx = document.getElementById('tempHumChart');
  if (!ctx) return;

  const labels = graphData.map(d => d.time || '');
  const tempData = graphData.map(d => d.temperature);
  const humData = graphData.map(d => d.humidity);

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

  if (state.charts.tempHumChart) {
    state.charts.tempHumChart.data.labels = labels;
    state.charts.tempHumChart.data.datasets[0].data = tempData;
    state.charts.tempHumChart.data.datasets[1].data = humData;
    state.charts.tempHumChart.update();
    return;
  }

  // Create Chart
  state.charts.tempHumChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: tempData,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.15)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ea580c',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
          yAxisID: 'y'
        },
        {
          label: 'Humidity (%)',
          data: humData,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#0891b2',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
          yAxisID: 'y1'
        }
      ]
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
          labels: {
            color: textColor,
            font: { family: "'Outfit', sans-serif", size: 12 }
          }
        },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: "'Outfit', sans-serif", size: 11 } }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Temperature (°C)', color: '#f97316' },
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Humidity (%)', color: '#06b6d4' },
          grid: { drawOnChartArea: false },
          ticks: { color: textColor }
        }
      }
    }
  });
}

function updateChartTheme() {
  if (!state.charts.tempHumChart) return;
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

  const chart = state.charts.tempHumChart;
  chart.options.plugins.legend.labels.color = textColor;
  chart.options.scales.x.ticks.color = textColor;
  chart.options.scales.x.grid.color = gridColor;
  chart.options.scales.y.ticks.color = textColor;
  chart.options.scales.y.grid.color = gridColor;
  chart.options.scales.y1.ticks.color = textColor;
  chart.update();
}

// -------------------------------------------------------------
// RECORDS TABLE & PAGINATION (Tab 1, Section 2)
// -------------------------------------------------------------
function fetchRecords(page = 1) {
  fetch(`/api/records?page=${page}&limit=${state.pagination.limit}`)
    .then(res => res.json())
    .then(data => {
      state.records = data.records;
      state.pagination = data.pagination;
      renderRecordsTable();
      renderPaginationControls();
    })
    .catch(err => {
      console.error('Error fetching records:', err);
    });
}

function renderRecordsTable() {
  const tbody = document.getElementById('records-table-body');
  if (!tbody) return;

  if (state.records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-slate-400">
          No records saved yet. Transmit from NodeMCU ESP8266 or click "Simulate Reading".
        </td>
      </tr>
    `;
    return;
  }

  // Row number based on page
  const startNum = (state.pagination.page - 1) * state.pagination.limit + 1;

  tbody.innerHTML = state.records
    .map((rec, index) => {
      const rowNum = startNum + index;
      return `
        <tr class="border-b border-indigo-100/50 dark:border-slate-800/80 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
          <td class="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400">${rowNum}</td>
          <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              ${rec.temperature} 'C
            </span>
          </td>
          <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-sm">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
              ${rec.humidity}%
            </span>
          </td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">${rec.time}</td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">${rec.date}</td>
          <td class="px-4 py-3">
            <button 
              onclick="deleteRecord('${rec.id}')" 
              class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 rounded-lg transition-all duration-200"
              title="Delete Record"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              Delete
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderPaginationControls() {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  const { page, totalPages, total, limit } = state.pagination;
  const startNum = total === 0 ? 0 : (page - 1) * limit + 1;
  const endNum = Math.min(page * limit, total);

  container.innerHTML = `
    <div class="text-xs text-slate-500 dark:text-slate-400">
      Showing <span class="font-semibold text-slate-700 dark:text-slate-200">${startNum}</span> to <span class="font-semibold text-slate-700 dark:text-slate-200">${endNum}</span> of <span class="font-semibold text-slate-700 dark:text-slate-200">${total}</span> records
    </div>
    <div class="flex items-center gap-1">
      <button 
        onclick="changePage(${page - 1})" 
        ${page <= 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-indigo-50 dark:hover:bg-slate-800"'}
        class="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition"
      >
        Previous
      </button>

      <span class="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 text-white shadow-sm">
        ${page} / ${totalPages || 1}
      </span>

      <button 
        onclick="changePage(${page + 1})" 
        ${page >= totalPages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-indigo-50 dark:hover:bg-slate-800"'}
        class="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition"
      >
        Next
      </button>
    </div>
  `;
}

function changePage(newPage) {
  if (newPage < 1 || newPage > state.pagination.totalPages) return;
  fetchRecords(newPage);
}

function deleteRecord(id) {
  if (!confirm('Are you sure you want to delete this sensor reading record?')) return;
  fetch(`/api/records/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Record deleted successfully', 'success');
        fetchRecords(state.pagination.page);
        fetchDashboardStats(true);
      } else {
        showToast(data.error || 'Failed to delete record', 'error');
      }
    })
    .catch(() => showToast('Failed to delete record', 'error'));
}

function simulateSensorReading() {
  fetch('/api/records/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(`Simulated DHT11: ${data.record.temperature}'C, ${data.record.humidity}%`, 'success');
        fetchRecords(1);
        fetchDashboardStats(true);
      }
    })
    .catch(() => showToast('Simulation request failed', 'error'));
}

// -------------------------------------------------------------
// TAB 2: SMART LCD DISPLAY CONTROLLER
// -------------------------------------------------------------
function setupLcdInputs() {
  const line1Input = document.getElementById('lcd-field-1');
  const line2Input = document.getElementById('lcd-field-2');
  const line1Count = document.getElementById('field-1-counter');
  const line2Count = document.getElementById('field-2-counter');
  const screenLine1 = document.getElementById('screen-line-1');
  const screenLine2 = document.getElementById('screen-line-2');

  if (line1Input) {
    line1Input.addEventListener('input', (e) => {
      let val = e.target.value.substring(0, 16);
      if (e.target.value.length > 16) e.target.value = val;
      if (line1Count) line1Count.textContent = `${val.length}/16`;
      if (screenLine1) screenLine1.textContent = val.padEnd(16, ' ');
    });
  }

  if (line2Input) {
    line2Input.addEventListener('input', (e) => {
      let val = e.target.value.substring(0, 16);
      if (e.target.value.length > 16) e.target.value = val;
      if (line2Count) line2Count.textContent = `${val.length}/16`;
      if (screenLine2) screenLine2.textContent = val.padEnd(16, ' ');
    });
  }
}

function updateLcdUI(line1, line2) {
  const screenLine1 = document.getElementById('screen-line-1');
  const screenLine2 = document.getElementById('screen-line-2');
  const currentLine1 = document.getElementById('current-lcd-1');
  const currentLine2 = document.getElementById('current-lcd-2');

  const l1 = (line1 || 'SmartHome System').substring(0, 16);
  const l2 = (line2 || 'WELCOME').substring(0, 16);

  if (screenLine1) screenLine1.textContent = l1.padEnd(16, ' ');
  if (screenLine2) screenLine2.textContent = l2.padEnd(16, ' ');
  if (currentLine1) currentLine1.textContent = `"${l1}"`;
  if (currentLine2) currentLine2.textContent = `"${l2}"`;
}

function saveLcdSettings() {
  const line1 = document.getElementById('lcd-field-1')?.value || '';
  const line2 = document.getElementById('lcd-field-2')?.value || '';

  showButtonLoading('save-lcd-btn', true);
  fetch('/api/lcd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line1, line2 })
  })
    .then(res => res.json())
    .then(data => {
      showButtonLoading('save-lcd-btn', false);
      if (data.success) {
        showToast('LCD text saved! Synced with ESP8266.', 'success');
        updateLcdUI(data.data.line1, data.data.line2);
      } else {
        showToast(data.message || 'Failed to update LCD', 'error');
      }
    })
    .catch(() => {
      showButtonLoading('save-lcd-btn', false);
      showToast('Network error updating LCD', 'error');
    });
}

// -------------------------------------------------------------
// TAB 3: INNOVATIVE RELAY / APPLIANCE POWER BUTTON
// -------------------------------------------------------------
function toggleRelayState() {
  const nextState = state.device.relay === 'ON' ? 'OFF' : 'ON';
  
  // Haptic audio click effect using Web Audio API synthesis
  playHapticTone(nextState === 'ON' ? 600 : 350);

  fetch('/api/relay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: nextState })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        state.device.relay = data.relay;
        updateRelayUI(data.relay);
        showToast(`Appliance is now turned ${data.relay}!`, data.relay === 'ON' ? 'success' : 'info');
      }
    })
    .catch(() => showToast('Failed to toggle relay', 'error'));
}

function updateRelayUI(relayState) {
  const isTurnedOn = relayState === 'ON';
  const powerBtn = document.getElementById('power-toggle-btn');
  const relayStatusText = document.getElementById('relay-status-text');
  const relayBadge = document.getElementById('relay-badge');
  const applianceLamp = document.getElementById('appliance-lamp-icon');

  if (powerBtn) {
    if (isTurnedOn) {
      powerBtn.classList.add('power-on');
    } else {
      powerBtn.classList.remove('power-on');
    }
  }

  if (relayStatusText) {
    relayStatusText.textContent = isTurnedOn ? 'POWERED ON' : 'POWERED OFF';
    relayStatusText.className = isTurnedOn
      ? 'text-2xl font-bold tracking-wider text-emerald-500'
      : 'text-2xl font-bold tracking-wider text-slate-400';
  }

  if (relayBadge) {
    relayBadge.innerHTML = isTurnedOn
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-semibold">
           <span class="w-2 h-2 rounded-full bg-emerald-500 online-pulse"></span>
           RELAY: ACTIVE (ON)
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs font-semibold">
           <span class="w-2 h-2 rounded-full bg-slate-400"></span>
           RELAY: INACTIVE (OFF)
         </span>`;
  }

  if (applianceLamp) {
    if (isTurnedOn) {
      applianceLamp.className = 'w-16 h-16 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)] transition-all duration-300';
    } else {
      applianceLamp.className = 'w-16 h-16 text-slate-400 transition-all duration-300';
    }
  }
}

// Subtle Web Audio synthesizer for tactile haptic feedback
function playHapticTone(freq) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    // Ignore audio errors in restricted browser policies
  }
}

// -------------------------------------------------------------
// TAB SWITCHING LOGIC
// -------------------------------------------------------------
function switchTab(tabId) {
  state.currentTab = tabId;

  // Tab Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.className = 'tab-btn flex-1 py-3 px-4 text-center rounded-xl font-semibold text-sm transition-all bg-indigo-600 text-white shadow-md shadow-indigo-500/20';
    } else {
      btn.className = 'tab-btn flex-1 py-3 px-4 text-center rounded-xl font-medium text-sm transition-all text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-slate-800/50';
    }
  });

  // Tab Content Panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (pane.id === tabId) {
      pane.classList.remove('hidden');
    } else {
      pane.classList.add('hidden');
    }
  });

  // Refresh charts if switching to Tab 1
  if (tabId === 'tab-monitoring' && state.charts.tempHumChart) {
    setTimeout(() => {
      state.charts.tempHumChart.resize();
    }, 50);
  }
}

// -------------------------------------------------------------
// EVENT LISTENERS & UI HELPERS
// -------------------------------------------------------------
function setupEventListeners() {
  // Theme toggle
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Tab Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Auth toggle (Login vs Register)
  document.getElementById('show-register-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form-container').classList.add('hidden');
    document.getElementById('register-form-container').classList.remove('hidden');
  });

  document.getElementById('show-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form-container').classList.add('hidden');
    document.getElementById('login-form-container').classList.remove('hidden');
  });

  // Demo auto-fill button
  document.getElementById('demo-fill-btn')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'falguni@sbjain.edu.in';
    document.getElementById('login-password').value = 'password123';
    showToast('Demo credentials filled: falguni@sbjain.edu.in', 'info');
  });

  // Login form submit
  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    handleLogin(email, password);
  });

  // Register form submit
  document.getElementById('register-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    handleRegister(name, email, password);
  });

  // Tab 1: Simulate Button
  document.getElementById('simulate-reading-btn')?.addEventListener('click', simulateSensorReading);

  // Tab 2: LCD Inputs
  setupLcdInputs();
  document.getElementById('save-lcd-btn')?.addEventListener('click', saveLcdSettings);

  // Tab 3: Relay Power Button
  document.getElementById('power-toggle-btn')?.addEventListener('click', toggleRelayState);
}

// Button loading state helper
function showButtonLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }
}

// Toast notification helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const typeClass = type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info';
  toast.className = `toast ${typeClass}`;
  
  const iconSvg = type === 'success'
    ? `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
    : type === 'error'
    ? `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`
    : `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
