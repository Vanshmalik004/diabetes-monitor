// DiaBeat Diabetes Monitoring & Analytics System

// State Object
let state = {
  readings: [],
  medications: [],
  settings: {
    targetMin: 70,
    targetMax: 180,
    unit: 'mg/dL'
  }
};

// SVG Chart Configuration
const CHART_CONFIG = {
  width: 800,
  height: 320,
  paddingLeft: 60,
  paddingRight: 30,
  paddingTop: 30,
  paddingBottom: 40,
  yMin: 40,
  yMax: 250
};

// ----------------------------------------------------
// SEED DATA GENERATOR
// ----------------------------------------------------
function getSeedData() {
  const readings = [];
  const medications = [];
  const now = new Date();
  
  // Helper to subtract days/hours
  const getDateAgo = (days, hours = 0, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  // Generate 15 days of historical data
  for (let i = 14; i >= 0; i--) {
    // 1. Fasting (8:00 AM)
    let fastingVal = Math.floor(80 + Math.random() * 45); // 80 - 125
    // Add one hypo morning
    if (i === 6) fastingVal = 64; 
    
    readings.push({
      id: `r-fasting-${i}`,
      value: fastingVal,
      type: 'Fasting',
      time: getDateAgo(i, 8, 0),
      notes: i === 6 ? 'Woke up sweaty and shaky. Took glucose tab.' : 'Woke up feeling good.'
    });

    medications.push({
      id: `m-lantus-${i}`,
      name: 'Lantus (Long-acting Insulin)',
      dose: '14 units',
      time: getDateAgo(i, 8, 5),
      notes: 'Morning basal dose'
    });

    // 2. Pre-Meal Lunch (12:30 PM)
    let preLunchVal = Math.floor(85 + Math.random() * 40); // 85 - 125
    if (i === 11) preLunchVal = 58; // another hypo

    readings.push({
      id: `r-prelunch-${i}`,
      value: preLunchVal,
      time: getDateAgo(i, 12, 30),
      type: 'Pre-Meal',
      notes: i === 11 ? 'Late lunch due to meetings, felt mild hypo symptoms.' : ''
    });

    if (preLunchVal > 70) {
      medications.push({
        id: `m-humalog-lunch-${i}`,
        name: 'Humalog (Rapid Insulin)',
        dose: '5 units',
        time: getDateAgo(i, 12, 25),
        notes: 'Pre-lunch bolus'
      });
    } else {
      medications.push({
        id: `m-humalog-lunch-${i}`,
        name: 'Humalog (Rapid Insulin)',
        dose: '3 units',
        time: getDateAgo(i, 12, 45),
        notes: 'Delayed bolus, reduced dose due to low reading.'
      });
    }

    // 3. Post-Meal Dinner (9:00 PM)
    let postDinnerVal = Math.floor(110 + Math.random() * 60); // 110 - 170
    // Add one hyper dinner
    if (i === 3) postDinnerVal = 245;

    readings.push({
      id: `r-postdinner-${i}`,
      value: postDinnerVal,
      time: getDateAgo(i, 21, 0),
      type: 'Post-Meal',
      notes: i === 3 ? 'Ate pizza and had a soft drink. Correction dose active.' : 'Standard home-cooked meal.'
    });

    medications.push({
      id: `m-humalog-dinner-${i}`,
      name: 'Humalog (Rapid Insulin)',
      dose: i === 3 ? '8 units' : '6 units',
      time: getDateAgo(i, 18, 55),
      notes: i === 3 ? 'Pre-dinner bolus + correction factor' : 'Pre-dinner bolus'
    });
  }

  return { readings, medications };
}

// ----------------------------------------------------
// STATE PERSISTENCE
// ----------------------------------------------------
function initLocalStorage() {
  const storedReadings = localStorage.getItem('diabeat_readings');
  const storedMeds = localStorage.getItem('diabeat_medications');

  if (storedReadings && storedMeds) {
    state.readings = JSON.parse(storedReadings);
    state.medications = JSON.parse(storedMeds);
  } else {
    // Inject seed data
    const seeds = getSeedData();
    state.readings = seeds.readings;
    state.medications = seeds.medications;
    saveState();
  }
}

function saveState() {
  localStorage.setItem('diabeat_readings', JSON.stringify(state.readings));
  localStorage.setItem('diabeat_medications', JSON.stringify(state.medications));
}

// ----------------------------------------------------
// CLINICAL STATS ENGINE
// ----------------------------------------------------
function calculateStats(timeframeDays) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);
  
  const filteredReadings = state.readings.filter(r => new Date(r.time) >= cutoffDate);
  
  if (filteredReadings.length === 0) {
    return {
      avg: 0,
      hba1c: 0,
      inRangePercent: 0,
      hypos: 0,
      hypers: 0
    };
  }

  let totalValue = 0;
  let inRangeCount = 0;
  let hypoCount = 0;
  let hyperCount = 0;

  filteredReadings.forEach(r => {
    totalValue += r.value;
    if (r.value < state.settings.targetMin) {
      hypoCount++;
    } else if (r.value > state.settings.targetMax) {
      hyperCount++;
    } else {
      inRangeCount++;
    }
  });

  const avg = Math.round(totalValue / filteredReadings.length);
  // Estimated HbA1c formula: (Average Glucose + 46.7) / 28.7
  const hba1c = parseFloat(((avg + 46.7) / 28.7).toFixed(1));
  const inRangePercent = Math.round((inRangeCount / filteredReadings.length) * 100);

  return {
    avg,
    hba1c,
    inRangePercent,
    hypos: hypoCount,
    hypers: hyperCount,
    count: filteredReadings.length
  };
}

// Update Dashboard Stats UI
function updateStatsUI(stats) {
  const avgEl = document.getElementById('metric-avg-glucose');
  const avgStatusEl = document.getElementById('metric-avg-status');
  const hba1cEl = document.getElementById('metric-hba1c');
  const tirEl = document.getElementById('metric-time-in-range');
  const hypoEl = document.getElementById('metric-hypo-count');
  const hyperEl = document.getElementById('metric-hyper-count');

  if (stats.count === 0) {
    avgEl.textContent = '--';
    avgStatusEl.textContent = 'No Data';
    avgStatusEl.className = 'badge';
    hba1cEl.textContent = '--';
    tirEl.textContent = '--';
    hypoEl.textContent = '--';
    hyperEl.textContent = '--';
    return;
  }

  avgEl.textContent = stats.avg;
  hba1cEl.textContent = stats.hba1c;
  tirEl.textContent = stats.inRangePercent;
  hypoEl.textContent = stats.hypos;
  hyperEl.textContent = stats.hypers;

  // Average status color-coding
  if (stats.avg < state.settings.targetMin) {
    avgStatusEl.textContent = 'Low Average';
    avgStatusEl.className = 'badge badge-error';
  } else if (stats.avg > 150) {
    avgStatusEl.textContent = 'Elevated';
    avgStatusEl.className = 'badge badge-warning';
  } else {
    avgStatusEl.textContent = 'Excellent';
    avgStatusEl.className = 'badge badge-success';
  }
}

// ----------------------------------------------------
// SVG trend-chart GENERATOR
// ----------------------------------------------------
function drawTrendChart(timeframeDays, targetSvgId = 'trend-chart') {
  const svg = document.getElementById(targetSvgId);
  if (!svg) return;

  // Clear previous dynamic layers (keeping defs)
  const elementsToRemove = svg.querySelectorAll('rect:not(defs rect), path, circle, g, text');
  elementsToRemove.forEach(el => el.remove());

  // Filter and sort readings chronologically
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);
  
  const readings = state.readings
    .filter(r => new Date(r.time) >= cutoffDate)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  if (readings.length === 0) {
    // Show Empty message
    const emptyText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    emptyText.setAttribute("x", CHART_CONFIG.width / 2);
    emptyText.setAttribute("y", CHART_CONFIG.height / 2);
    emptyText.setAttribute("text-anchor", "middle");
    emptyText.setAttribute("fill", "var(--color-text-muted)");
    emptyText.setAttribute("font-size", "14");
    emptyText.textContent = "No glucose readings logged for this period.";
    svg.appendChild(emptyText);
    return;
  }

  // Coordinate Conversion Helper Functions
  const getX = (timestamp, minTime, maxTime) => {
    const availableWidth = CHART_CONFIG.width - CHART_CONFIG.paddingLeft - CHART_CONFIG.paddingRight;
    if (minTime === maxTime) {
      return CHART_CONFIG.paddingLeft + availableWidth / 2;
    }
    const ratio = (timestamp - minTime) / (maxTime - minTime);
    return CHART_CONFIG.paddingLeft + ratio * availableWidth;
  };

  const getY = (value) => {
    const availableHeight = CHART_CONFIG.height - CHART_CONFIG.paddingTop - CHART_CONFIG.paddingBottom;
    const clampedValue = Math.max(CHART_CONFIG.yMin, Math.min(CHART_CONFIG.yMax, value));
    const ratio = (clampedValue - CHART_CONFIG.yMin) / (CHART_CONFIG.yMax - CHART_CONFIG.yMin);
    // SVG coordinates increase downwards, so invert y coordinates
    return CHART_CONFIG.height - CHART_CONFIG.paddingBottom - ratio * availableHeight;
  };

  const timestamps = readings.map(r => new Date(r.time).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  // 1. Draw Target Range Band
  const targetMinY = getY(state.settings.targetMin);
  const targetMaxY = getY(state.settings.targetMax);
  const bandHeight = targetMinY - targetMaxY;

  const band = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  band.setAttribute("x", CHART_CONFIG.paddingLeft);
  band.setAttribute("y", targetMaxY);
  band.setAttribute("width", CHART_CONFIG.width - CHART_CONFIG.paddingLeft - CHART_CONFIG.paddingRight);
  band.setAttribute("height", bandHeight);
  band.setAttribute("class", "chart-target-range-band");
  svg.appendChild(band);

  // 2. Draw Target Limit Lines (Dotted guides)
  const limits = [state.settings.targetMin, state.settings.targetMax];
  limits.forEach(limitVal => {
    const yVal = getY(limitVal);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", CHART_CONFIG.paddingLeft);
    line.setAttribute("y1", yVal);
    line.setAttribute("x2", CHART_CONFIG.width - CHART_CONFIG.paddingRight);
    line.setAttribute("y2", yVal);
    line.setAttribute("class", "chart-target-limit-line");
    svg.appendChild(line);
  });

  // 3. Draw Grid Lines & Value Labels (Y-axis grid)
  const gridValues = [70, 130, 180, 240];
  gridValues.forEach(val => {
    const yVal = getY(val);
    
    // Grid Line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", CHART_CONFIG.paddingLeft);
    line.setAttribute("y1", yVal);
    line.setAttribute("x2", CHART_CONFIG.width - CHART_CONFIG.paddingRight);
    line.setAttribute("y2", yVal);
    line.setAttribute("class", "chart-grid-line");
    svg.appendChild(line);

    // Label Text
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", CHART_CONFIG.paddingLeft - 10);
    text.setAttribute("y", yVal + 4);
    text.setAttribute("class", "chart-axis-text");
    text.textContent = val;
    svg.appendChild(text);
  });

  // 4. Draw Time Labels (X-axis grid)
  const labelCount = Math.min(5, readings.length);
  const timeStep = (maxTime - minTime) / (labelCount - 1 || 1);
  for (let i = 0; i < labelCount; i++) {
    const currentTimestamp = minTime + i * timeStep;
    const xVal = getX(currentTimestamp, minTime, maxTime);
    const dateObj = new Date(currentTimestamp);
    
    // Format: e.g. "Jun 12 18:00"
    const labelString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    // Grid Line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", xVal);
    line.setAttribute("y1", CHART_CONFIG.paddingTop);
    line.setAttribute("x2", xVal);
    line.setAttribute("y2", CHART_CONFIG.height - CHART_CONFIG.paddingBottom);
    line.setAttribute("class", "chart-grid-line");
    svg.appendChild(line);

    // Label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", xVal);
    text.setAttribute("y", CHART_CONFIG.height - CHART_CONFIG.paddingBottom + 20);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "var(--color-text-muted)");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-family", "var(--font-sans)");
    text.textContent = labelString;
    svg.appendChild(text);
  }

  // 5. Draw Axis Lines
  // Bottom horizontal axis
  const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  xAxis.setAttribute("x1", CHART_CONFIG.paddingLeft);
  xAxis.setAttribute("y1", CHART_CONFIG.height - CHART_CONFIG.paddingBottom);
  xAxis.setAttribute("x2", CHART_CONFIG.width - CHART_CONFIG.paddingRight);
  xAxis.setAttribute("y2", CHART_CONFIG.height - CHART_CONFIG.paddingBottom);
  xAxis.setAttribute("class", "chart-axis-line");
  svg.appendChild(xAxis);

  // Left vertical axis
  const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  yAxis.setAttribute("x1", CHART_CONFIG.paddingLeft);
  yAxis.setAttribute("y1", CHART_CONFIG.paddingTop);
  yAxis.setAttribute("x2", CHART_CONFIG.paddingLeft);
  yAxis.setAttribute("y2", CHART_CONFIG.height - CHART_CONFIG.paddingBottom);
  yAxis.setAttribute("class", "chart-axis-line");
  svg.appendChild(yAxis);

  // 6. Draw Trend Line and Under-Line Shaded Area
  let linePathPoints = "";
  let areaPathPoints = `M ${getX(timestamps[0], minTime, maxTime)} ${CHART_CONFIG.height - CHART_CONFIG.paddingBottom} `;

  readings.forEach((r, idx) => {
    const t = new Date(r.time).getTime();
    const x = getX(t, minTime, maxTime);
    const y = getY(r.value);

    if (idx === 0) {
      linePathPoints += `M ${x} ${y} `;
    } else {
      linePathPoints += `L ${x} ${y} `;
    }
    areaPathPoints += `L ${x} ${y} `;
    
    if (idx === readings.length - 1) {
      areaPathPoints += `L ${x} ${CHART_CONFIG.height - CHART_CONFIG.paddingBottom} Z`;
    }
  });

  // Area under line
  if (targetSvgId === 'trend-chart') { // Only shade area on screen view for premium aesthetics
    const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    areaPath.setAttribute("d", areaPathPoints);
    areaPath.setAttribute("class", "chart-line-area");
    svg.appendChild(areaPath);
  }

  // Trend path line
  const trendPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  trendPath.setAttribute("d", linePathPoints);
  trendPath.setAttribute("class", "chart-line");
  svg.appendChild(trendPath);

  // 7. Draw Dots (Reading markers)
  const tooltip = document.getElementById('chart-tooltip');
  
  readings.forEach(r => {
    const t = new Date(r.time).getTime();
    const x = getX(t, minTime, maxTime);
    const y = getY(r.value);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "5");

    // Color code class based on status
    let statusClass = "dot-target";
    if (r.value < state.settings.targetMin) {
      statusClass = "dot-hypo";
    } else if (r.value > state.settings.targetMax) {
      statusClass = "dot-hyper";
    }
    circle.setAttribute("class", `chart-dot ${statusClass}`);

    // Tooltip bindings (only for screen chart)
    if (targetSvgId === 'trend-chart' && tooltip) {
      circle.addEventListener('mouseenter', (e) => {
        const dateStr = new Date(r.time).toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        let evalText = "Target Range";
        let evalClass = "text-success";
        if (r.value < state.settings.targetMin) {
          evalText = "Hypoglycemia (Low)";
          evalClass = "text-error";
        } else if (r.value > state.settings.targetMax) {
          evalText = "Hyperglycemia (High)";
          evalClass = "text-warning";
        }

        tooltip.innerHTML = `
          <div class="tooltip-title">${dateStr}</div>
          <div class="tooltip-row">
            <span>Reading:</span>
            <span class="tooltip-value ${evalClass}">${r.value} mg/dL</span>
          </div>
          <div class="tooltip-row">
            <span>Context:</span>
            <span>${r.type}</span>
          </div>
          <div class="tooltip-row">
            <span>Evaluation:</span>
            <span class="${evalClass}">${evalText}</span>
          </div>
          ${r.notes ? `<div class="tooltip-row" style="margin-top:0.4rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.4rem; font-style:italic;">"${r.notes}"</div>` : ''}
        `;
        tooltip.style.opacity = '1';
      });

      circle.addEventListener('mousemove', (e) => {
        // Calculate offset positioning relative to the trend chart container
        const rect = svg.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;
        
        // Offset slightly above and to the right of cursor
        tooltip.style.left = `${relativeX + 15}px`;
        y < 120 ? tooltip.style.top = `${relativeY + 15}px` : tooltip.style.top = `${relativeY - 110}px`;
      });

      circle.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    }

    svg.appendChild(circle);
  });
}

// ----------------------------------------------------
// UI RENDERERS (LOGBOOKS)
// ----------------------------------------------------
function renderDashboardLogs() {
  const glucoseBody = document.getElementById('glucose-table-body');
  const medicationBody = document.getElementById('medication-table-body');

  if (!glucoseBody || !medicationBody) return;

  // 1. Glucose Logs (limit to 5 on dashboard)
  glucoseBody.innerHTML = '';
  const recentReadings = [...state.readings]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5);

  if (recentReadings.length === 0) {
    glucoseBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted)">No readings recorded yet.</td></tr>`;
  } else {
    recentReadings.forEach(r => {
      let valClass = "text-success";
      if (r.value < state.settings.targetMin) valClass = "text-error";
      else if (r.value > state.settings.targetMax) valClass = "text-warning";

      const tr = document.createElement('tr');
      const timeStr = new Date(r.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td><span class="badge ${r.type === 'Fasting' ? 'badge-info' : 'badge-secondary'}">${r.type}</span></td>
        <td><span class="table-val-bold ${valClass}">${r.value}</span> <span class="metric-unit">mg/dL</span></td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.notes || ''}">${r.notes || '-'}</td>
        <td>
          <button class="btn-delete" data-id="${r.id}" title="Delete Log">🗑️</button>
        </td>
      `;
      glucoseBody.appendChild(tr);
    });
  }

  // 2. Medication Logs (limit to 5 on dashboard)
  medicationBody.innerHTML = '';
  const recentMeds = [...state.medications]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5);

  if (recentMeds.length === 0) {
    medicationBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted)">No medications logged yet.</td></tr>`;
  } else {
    recentMeds.forEach(m => {
      const tr = document.createElement('tr');
      const timeStr = new Date(m.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td style="font-weight: 500">${m.name}</td>
        <td class="table-val-bold text-success">${m.dose}</td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${m.notes || ''}">${m.notes || '-'}</td>
        <td>
          <button class="btn-delete" data-id="${m.id}" title="Delete Log">🗑️</button>
        </td>
      `;
      medicationBody.appendChild(tr);
    });
  }

  // Attach delete listeners
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      deleteLog(id);
    });
  });
}

function renderAllRecordsModal() {
  const modalGlucoseBody = document.getElementById('modal-glucose-table-body');
  const modalMedsBody = document.getElementById('modal-meds-table-body');

  if (!modalGlucoseBody || !modalMedsBody) return;

  // 1. Glucose Logs (Complete)
  modalGlucoseBody.innerHTML = '';
  const sortedReadings = [...state.readings].sort((a, b) => new Date(b.time) - new Date(a.time));

  if (sortedReadings.length === 0) {
    modalGlucoseBody.innerHTML = `<tr><td colspan="6" style="text-align:center">No records.</td></tr>`;
  } else {
    sortedReadings.forEach(r => {
      let valClass = "text-success";
      let evalText = "Target Range";
      if (r.value < state.settings.targetMin) {
        valClass = "text-error";
        evalText = "Hypo";
      } else if (r.value > state.settings.targetMax) {
        valClass = "text-warning";
        evalText = "Hyper";
      }

      const tr = document.createElement('tr');
      const timeStr = new Date(r.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td><span class="badge badge-info">${r.type}</span></td>
        <td><span class="table-val-bold ${valClass}">${r.value}</span> mg/dL</td>
        <td><span class="${valClass}">${evalText}</span></td>
        <td>${r.notes || '-'}</td>
        <td>
          <button class="btn-delete" data-id="${r.id}">🗑️</button>
        </td>
      `;
      modalGlucoseBody.appendChild(tr);
    });
  }

  // 2. Medication Logs (Complete)
  modalMedsBody.innerHTML = '';
  const sortedMeds = [...state.medications].sort((a, b) => new Date(b.time) - new Date(a.time));

  if (sortedMeds.length === 0) {
    modalMedsBody.innerHTML = `<tr><td colspan="5" style="text-align:center">No records.</td></tr>`;
  } else {
    sortedMeds.forEach(m => {
      const tr = document.createElement('tr');
      const timeStr = new Date(m.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td style="font-weight: 500">${m.name}</td>
        <td class="table-val-bold">${m.dose}</td>
        <td>${m.notes || '-'}</td>
        <td>
          <button class="btn-delete" data-id="${m.id}">🗑️</button>
        </td>
      `;
      modalMedsBody.appendChild(tr);
    });
  }

  // Re-attach delete listeners inside modal
  modalGlucoseBody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      deleteLog(id);
      renderAllRecordsModal();
    });
  });

  modalMedsBody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      deleteLog(id);
      renderAllRecordsModal();
    });
  });
}

function deleteLog(id) {
  if (!confirm('Are you sure you want to delete this log?')) return;
  
  if (id.startsWith('r-')) {
    state.readings = state.readings.filter(r => r.id !== id);
  } else if (id.startsWith('m-')) {
    state.medications = state.medications.filter(m => m.id !== id);
  }
  
  saveState();
  refreshDashboard();
}

function refreshDashboard() {
  const timeframe = parseInt(document.getElementById('time-filter').value) || 30;
  const stats = calculateStats(timeframe);
  updateStatsUI(stats);
  drawTrendChart(timeframe);
  renderDashboardLogs();
}

// ----------------------------------------------------
// CLINICAL CLINIC REPORT (PRINTING ENGINE)
// ----------------------------------------------------
function compileAndPrintReport(doctorName, timeframeDays, customNotes) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

  const reportPeriodText = `${cutoffDate.toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})} - ${new Date().toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})}`;
  
  // 1. Populate Report Header Info
  document.getElementById('print-generation-date').textContent = `Generated: ${new Date().toLocaleString()}`;
  document.getElementById('print-physician-name').textContent = doctorName;
  document.getElementById('print-physician-sig-name').textContent = doctorName;
  document.getElementById('print-report-period').textContent = reportPeriodText;

  // Personal Note
  const noteSection = document.getElementById('print-notes-section');
  if (customNotes && customNotes.trim() !== '') {
    document.getElementById('print-custom-notes-val').textContent = customNotes;
    noteSection.style.display = 'block';
  } else {
    noteSection.style.display = 'none';
  }

  // 2. Fetch and Fill Stats
  const stats = calculateStats(timeframeDays);
  document.getElementById('print-avg-glucose').textContent = stats.count > 0 ? stats.avg : '--';
  document.getElementById('print-hba1c-val').textContent = stats.count > 0 ? stats.hba1c : '--';
  document.getElementById('print-tir').textContent = stats.count > 0 ? stats.inRangePercent : '--';
  document.getElementById('print-hypo-count').textContent = stats.hypos;
  document.getElementById('print-hyper-count').textContent = stats.hypers;

  // Evaluation text under print average
  let printEval = "Normal / Controlled";
  if (stats.avg < state.settings.targetMin) printEval = "Persistent Lows";
  else if (stats.avg > 150) printEval = "Elevated average glycaemia";
  document.getElementById('print-avg-eval').textContent = stats.count > 0 ? printEval : '--';

  // 3. Render Trend Chart into Report Placeholder
  const chartPlaceholder = document.getElementById('print-chart-placeholder');
  chartPlaceholder.innerHTML = '';
  
  // Create a separate SVG element for the print report to prevent interference
  const printSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  printSvg.setAttribute("width", "100%");
  printSvg.setAttribute("height", "220");
  printSvg.setAttribute("viewBox", "0 0 800 320");
  printSvg.setAttribute("preserveAspectRatio", "none");
  printSvg.innerHTML = document.getElementById('trend-chart').innerHTML;
  
  // Clean up any dynamic cursor events / hover dots from cloned SVG
  const dots = printSvg.querySelectorAll('.chart-dot');
  dots.forEach(dot => {
    dot.removeAttribute('style'); // Remove scaling transitions
  });
  
  chartPlaceholder.appendChild(printSvg);

  // Redraw SVG coordinates specifically for report period
  drawTrendChart(timeframeDays, 'trend-chart'); // Make sure screen is synced too
  
  // 4. Compile Unified Chronological Table (Readings & Meds)
  const logsBody = document.getElementById('print-logs-body');
  logsBody.innerHTML = '';

  const reportReadings = state.readings.filter(r => new Date(r.time) >= cutoffDate);
  const reportMeds = state.medications.filter(m => new Date(m.time) >= cutoffDate);

  // Merge records with typed identifiers
  const mergedLogs = [];
  reportReadings.forEach(r => {
    mergedLogs.push({
      time: new Date(r.time),
      recordType: 'reading',
      title: 'Glucose Reading',
      value: `${r.value} mg/dL`,
      context: r.type,
      notes: r.notes,
      val: r.value
    });
  });

  reportMeds.forEach(m => {
    mergedLogs.push({
      time: new Date(m.time),
      recordType: 'medication',
      title: m.name,
      value: m.dose,
      context: 'Therapy Administered',
      notes: m.notes,
      val: 0
    });
  });

  // Sort Chronologically descending
  mergedLogs.sort((a, b) => b.time - a.time);

  if (mergedLogs.length === 0) {
    logsBody.innerHTML = `<tr><td colspan="5" style="text-align:center">No records logged in the specified reporting period.</td></tr>`;
  } else {
    mergedLogs.forEach(log => {
      const tr = document.createElement('tr');
      const timeStr = log.time.toLocaleString([], {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      
      let statusEval = log.context;
      let printClass = "";
      if (log.recordType === 'reading') {
        if (log.val < state.settings.targetMin) {
          statusEval = `${log.context} - LOW (Hypo)`;
          printClass = "text-error";
        } else if (log.val > state.settings.targetMax) {
          statusEval = `${log.context} - HIGH (Hyper)`;
          printClass = "text-warning";
        } else {
          statusEval = `${log.context} - In Range`;
          printClass = "text-success";
        }
      }

      tr.innerHTML = `
        <td style="white-space: nowrap;">${timeStr}</td>
        <td><strong>${log.recordType === 'reading' ? '🩸 Blood Sugar' : '💊 Medication'}</strong></td>
        <td><span class="${printClass}" style="font-weight:700">${log.value}</span></td>
        <td><span class="${printClass}">${statusEval}</span></td>
        <td>${log.notes || '-'}</td>
      `;
      logsBody.appendChild(tr);
    });
  }

  // 5. Fire Print Dialog!
  setTimeout(() => {
    window.print();
  }, 300);
}

// ----------------------------------------------------
// EVENT BINDINGS & EVENT DELEGATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Check Authentication Session State
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-screen-form');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const logoutBtn = document.getElementById('logout-btn');

  const showDashboard = () => {
    if (loginContainer) {
      loginContainer.style.opacity = '0';
      loginContainer.style.transform = 'scale(1.05)';
      setTimeout(() => {
        loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'grid';
        refreshDashboard(); // Redraw chart for new dimensions
      }, 400);
    }
  };

  const showLogin = () => {
    if (loginContainer) loginContainer.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
  };

  if (sessionStorage.getItem('diabeat_logged_in') === 'true') {
    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'grid';
  } else {
    showLogin();
  }

  // Handle Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const pin = document.getElementById('login-pin').value;

      if (username.toLowerCase() === 'dooper' && pin === '1234') {
        sessionStorage.setItem('diabeat_logged_in', 'true');
        if (loginErrorMsg) loginErrorMsg.style.display = 'none';
        showDashboard();
      } else {
        if (loginErrorMsg) loginErrorMsg.style.display = 'block';
        document.getElementById('login-pin').value = '';
      }
    });
  }

  // Handle Logout Button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('diabeat_logged_in');
      window.location.reload();
    });
  }

  // Initialize State & Seed Data
  initLocalStorage();
  
  // Set default values for modal datetimes on open
  const setFormDefaults = () => {
    const localNow = new Date();
    // format to YYYY-MM-DDThh:mm offset to local timezone
    const offset = localNow.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(localNow - offset)).toISOString().slice(0, 16);
    
    document.getElementById('glucose-time').value = localISOTime;
    document.getElementById('med-time').value = localISOTime;
  };

  // Bind Screen elements
  const timeFilter = document.getElementById('time-filter');
  timeFilter.addEventListener('change', () => {
    refreshDashboard();
  });

  // Modal open triggers
  document.getElementById('open-glucose-modal-btn').addEventListener('click', () => {
    setFormDefaults();
    document.getElementById('glucose-modal').showModal();
  });

  document.getElementById('open-medication-modal-btn').addEventListener('click', () => {
    setFormDefaults();
    document.getElementById('medication-modal').showModal();
  });

  document.getElementById('view-all-glucose-btn').addEventListener('click', () => {
    renderAllRecordsModal();
    // Activate Glucose tab by default
    document.getElementById('tab-glucose-btn').click();
    document.getElementById('all-records-modal').showModal();
  });

  document.getElementById('view-all-meds-btn').addEventListener('click', () => {
    renderAllRecordsModal();
    // Activate Meds tab by default
    document.getElementById('tab-meds-btn').click();
    document.getElementById('all-records-modal').showModal();
  });

  document.getElementById('trigger-report-btn').addEventListener('click', () => {
    document.getElementById('report-config-modal').showModal();
  });

  // Tabs switching inside Complete Records Modal
  const tabGlucose = document.getElementById('tab-glucose-btn');
  const tabMeds = document.getElementById('tab-meds-btn');
  const paneGlucose = document.getElementById('tab-content-glucose');
  const paneMeds = document.getElementById('tab-content-meds');

  tabGlucose.addEventListener('click', () => {
    tabGlucose.classList.add('active');
    tabMeds.classList.remove('active');
    paneGlucose.classList.add('active');
    paneMeds.classList.remove('active');
  });

  tabMeds.addEventListener('click', () => {
    tabMeds.classList.add('active');
    tabGlucose.classList.remove('active');
    paneMeds.classList.add('active');
    paneGlucose.classList.remove('active');
  });

  // Quick Log Tab Switchers
  const quickTabGlucose = document.getElementById('quick-tab-glucose-btn');
  const quickTabMeds = document.getElementById('quick-tab-meds-btn');
  const quickFormGlucose = document.getElementById('quick-glucose-form');
  const quickFormMeds = document.getElementById('quick-medication-form');

  if (quickTabGlucose && quickTabMeds && quickFormGlucose && quickFormMeds) {
    quickTabGlucose.addEventListener('click', () => {
      quickTabGlucose.classList.add('active');
      quickTabMeds.classList.remove('active');
      quickFormGlucose.classList.add('active');
      quickFormMeds.classList.remove('active');
    });

    quickTabMeds.addEventListener('click', () => {
      quickTabMeds.classList.add('active');
      quickTabGlucose.classList.remove('active');
      quickFormMeds.classList.add('active');
      quickFormGlucose.classList.remove('active');
    });
  }

  // Form Submit Listeners
  document.getElementById('glucose-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = parseInt(document.getElementById('glucose-val').value);
    const type = document.getElementById('glucose-type').value;
    const time = document.getElementById('glucose-time').value;
    const notes = document.getElementById('glucose-notes').value;

    if (!value || isNaN(value)) return;

    state.readings.push({
      id: `r-${Date.now()}`,
      value,
      type,
      time: new Date(time).toISOString(),
      notes
    });

    saveState();
    refreshDashboard();
    
    // Reset form
    document.getElementById('glucose-form').reset();
    document.getElementById('glucose-modal').close();
  });

  document.getElementById('medication-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('med-name').value;
    const dose = document.getElementById('med-dose').value;
    const time = document.getElementById('med-time').value;
    const notes = document.getElementById('med-notes').value;

    if (!name || !dose) return;

    state.medications.push({
      id: `m-${Date.now()}`,
      name,
      dose,
      time: new Date(time).toISOString(),
      notes
    });

    saveState();
    refreshDashboard();

    // Reset form
    document.getElementById('medication-form').reset();
    document.getElementById('medication-modal').close();
  });

  // Quick Glucose Form Submit
  const quickGlucoseForm = document.getElementById('quick-glucose-form');
  if (quickGlucoseForm) {
    quickGlucoseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = parseInt(document.getElementById('quick-glucose-val').value);
      const type = document.getElementById('quick-glucose-type').value;
      const notes = document.getElementById('quick-glucose-notes').value;

      if (!value || isNaN(value)) return;

      state.readings.push({
        id: `r-${Date.now()}`,
        value,
        type,
        time: new Date().toISOString(), // Default to current time
        notes
      });

      saveState();
      refreshDashboard();

      // Reset form
      quickGlucoseForm.reset();
      
      // Flash a little success message
      const logButton = quickGlucoseForm.querySelector('button[type="submit"]');
      const originalText = logButton.textContent;
      logButton.textContent = '✓ Logged!';
      logButton.style.backgroundColor = 'var(--color-success)';
      logButton.style.color = '#000';
      setTimeout(() => {
        logButton.textContent = originalText;
        logButton.style.backgroundColor = '';
        logButton.style.color = '';
      }, 1500);
    });
  }

  // Quick Medication Form Submit
  const quickMedForm = document.getElementById('quick-medication-form');
  if (quickMedForm) {
    quickMedForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('quick-med-name').value;
      const dose = document.getElementById('quick-med-dose').value;
      const notes = document.getElementById('quick-med-notes').value;

      if (!name || !dose) return;

      state.medications.push({
        id: `m-${Date.now()}`,
        name,
        dose,
        time: new Date().toISOString(), // Default to current time
        notes
      });

      saveState();
      refreshDashboard();

      // Reset form
      quickMedForm.reset();

      // Flash success
      const logButton = quickMedForm.querySelector('button[type="submit"]');
      const originalText = logButton.textContent;
      logButton.textContent = '✓ Logged!';
      logButton.style.backgroundColor = 'var(--color-success)';
      logButton.style.color = '#000';
      setTimeout(() => {
        logButton.textContent = originalText;
        logButton.style.backgroundColor = '';
        logButton.style.color = '';
      }, 1500);
    });
  }

  // Doctor Report configuration and launch
  document.getElementById('report-config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const doctorName = document.getElementById('report-doctor-name').value || "Dr. Smith";
    const range = parseInt(document.getElementById('report-range').value) || 30;
    const notes = document.getElementById('report-custom-notes').value || "";

    document.getElementById('report-config-modal').close();
    compileAndPrintReport(doctorName, range, notes);
  });

  // ----------------------------------------------------
  // LIGHT-DISMISS BACKDROP CLICK FALLBACK
  // ----------------------------------------------------
  const dialogs = document.querySelectorAll('dialog');
  dialogs.forEach(dialog => {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isInside = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (!isInside) {
          dialog.close();
        }
      });
    }
  });

  // Render initial dashboard view
  refreshDashboard();
});
