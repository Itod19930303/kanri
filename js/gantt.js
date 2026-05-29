let ganttYear = new Date().getFullYear();
let ganttMonth = new Date().getMonth();

function renderGantt(allTickets) {
  const view = document.getElementById('gantt-view');

  const year = ganttYear;
  const month = ganttMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthLabel = `${year}年${month + 1}月`;

  const withDue = allTickets.filter(t => t.dueDate);
  const noDue   = allTickets.filter(t => !t.dueDate);

  const STATUS_LABEL = { not_started: '未着手', todo: 'Todo', in_progress: '進行中', done: '完了' };
  const PRI_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function barStyle(t) {
    const start = new Date(t.createdAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(t.dueDate);
    end.setHours(0, 0, 0, 0);

    const monthStart = new Date(year, month, 1);
    const monthEnd   = new Date(year, month, daysInMonth);

    const barStart = start < monthStart ? monthStart : start;
    const barEnd   = end   > monthEnd   ? monthEnd   : end;

    if (barEnd < monthStart || barStart > monthEnd) return null;

    const startDay = barStart.getDate();
    const endDay   = barEnd.getDate();
    const span     = endDay - startDay + 1;
    const overdue  = end < today && t.status !== 'done';
    const color    = overdue ? '#ef4444' : '#7c3aed';
    const opacity  = t.status === 'done' ? '0.45' : '1';

    return { startDay, span, color, opacity };
  }

  const headerCells = days.map(d => {
    const dt = new Date(year, month, d);
    dt.setHours(0, 0, 0, 0);
    const isToday = dt.getTime() === today.getTime();
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    return `
      <th class="gantt-day-header ${isToday ? 'gantt-today-col' : ''} ${isWeekend ? 'gantt-weekend' : ''}">
        <div>${d}</div>
      </th>
    `;
  }).join('');

  const ticketRows = withDue.map(t => {
    const bar = barStyle(t);
    const cells = days.map(d => {
      if (!bar) return `<td class="gantt-cell"></td>`;
      if (d === bar.startDay) {
        return `
          <td class="gantt-cell" colspan="${bar.span}" style="padding:2px 0">
            <div class="gantt-bar" style="background:${bar.color};opacity:${bar.opacity}" title="${escHtml(t.title)}">
              ${bar.span > 2 ? `<span class="gantt-bar-label">${escHtml(t.title)}</span>` : ''}
            </div>
          </td>
        `;
      }
      if (d > bar.startDay && d <= bar.startDay + bar.span - 1) return '';
      return `<td class="gantt-cell"></td>`;
    }).join('');

    const overdue = t.dueDate && new Date(t.dueDate) < today && t.status !== 'done';
    const priColor = PRI_COLOR[t.priority] || '#94a3b8';
    return `
      <tr class="gantt-row">
        <td class="gantt-label-cell">
          <div class="flex items-center gap-1.5">
            <span class="gantt-pri-dot" style="background:${priColor}"></span>
            <span class="gantt-label-text" title="${escHtml(t.title)}">${escHtml(t.title)}</span>
          </div>
          <div class="gantt-meta">
            <span>${STATUS_LABEL[t.status] || t.status}</span>
            <span class="${overdue ? 'text-red-500 font-bold' : ''}">${t.dueDate}</span>
          </div>
        </td>
        ${cells}
      </tr>
    `;
  }).join('');

  const todayColStyle = days.map(d => {
    const dt = new Date(year, month, d);
    dt.setHours(0, 0, 0, 0);
    return dt.getTime() === today.getTime() ? `<col class="gantt-today-line">` : `<col>`;
  }).join('');

  view.innerHTML = `
    <div class="gantt-container">
      <!-- ナビゲーション -->
      <div class="gantt-nav">
        <button id="gantt-prev" class="btn btn-ghost btn-sm">‹ 前月</button>
        <h2 class="gantt-month-label">${monthLabel}</h2>
        <button id="gantt-next" class="btn btn-ghost btn-sm">次月 ›</button>
      </div>

      ${withDue.length === 0 ? `
        <div class="gantt-empty">
          <p>期限日が設定されたチケットがありません</p>
          <p class="text-sm mt-1" style="color:#9ca3af">チケットに期限日を設定するとガントチャートに表示されます</p>
        </div>
      ` : `
        <div class="gantt-scroll-wrap">
          <table class="gantt-table">
            <colgroup>
              <col class="gantt-label-col">
              ${todayColStyle}
            </colgroup>
            <thead>
              <tr>
                <th class="gantt-label-header">チケット</th>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${ticketRows}
            </tbody>
          </table>
        </div>
      `}

      ${noDue.length > 0 ? `
        <div class="gantt-no-due">
          <p class="gantt-no-due-title">期限日なし（${noDue.length}件）</p>
          <div class="flex flex-wrap gap-2">
            ${noDue.map(t => `
              <span class="gantt-no-due-chip" title="${escHtml(t.title)}">${escHtml(t.title)}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('gantt-prev').addEventListener('click', () => {
    ganttMonth--;
    if (ganttMonth < 0) { ganttMonth = 11; ganttYear--; }
    renderGantt(allTickets);
  });

  document.getElementById('gantt-next').addEventListener('click', () => {
    ganttMonth++;
    if (ganttMonth > 11) { ganttMonth = 0; ganttYear++; }
    renderGantt(allTickets);
  });
}
