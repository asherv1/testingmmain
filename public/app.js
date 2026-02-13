const mallEl = document.getElementById('mall');
const yearEl = document.getElementById('year');
const monthEl = document.getElementById('month');
const gridEl = document.getElementById('grid');

gridEl.textContent = 'Loading dashboard data...';
const template = document.getElementById('card-template');

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function setOptions(select, values, selectedValue) {
  select.innerHTML = '';
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    if (String(value) === String(selectedValue)) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function formatRating(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '-';
}

function render(data) {
  gridEl.innerHTML = '';

  data.monthly.forEach((month) => {
    const node = template.content.cloneNode(true);
    node.querySelector('.month-name').textContent = month.month;

    const list = node.querySelector('.feedback-list');
    if (!month.reportData.items.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No feedback for this month.';
      list.appendChild(empty);
    } else {
      month.reportData.items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `#${item.rank} ${item.caption} (${formatRating(item.avgRating)})`;

        const small = document.createElement('small');
        small.textContent = `feedback: ${item.feedbackCount}`;
        li.appendChild(small);
        list.appendChild(li);
      });
    }

    node.querySelector('.meta').textContent = `Feedback: ${month.reportData.totalFeedback} • Visitors: ${month.visitors}`;

    gridEl.appendChild(node);
  });
}

async function refresh() {
  const params = new URLSearchParams({ year: yearEl.value, mall: mallEl.value });
  if (monthEl.value) {
    params.set('month', monthEl.value);
  }

  const data = await fetchJSON(`/api/top3?${params}`);
  render(data);
}

async function init() {
  try {
    const filters = await fetchJSON('/api/filters');
    setOptions(yearEl, filters.years, filters.defaultYear);
    setOptions(mallEl, filters.malls, filters.defaultMall);

    yearEl.addEventListener('change', refresh);
    mallEl.addEventListener('change', refresh);
    monthEl.addEventListener('change', refresh);

    await refresh();
  } catch (error) {
    gridEl.innerHTML = '';
    const message = document.createElement('div');
    message.style.color = '#b91c1c';
    message.style.background = '#fee2e2';
    message.style.border = '1px solid #fecaca';
    message.style.padding = '12px';
    message.style.borderRadius = '8px';
    message.textContent = `Failed to load dashboard: ${error.message}`;
    gridEl.appendChild(message);
  }
}

init();
