function renderDashboard(tickets) {
  const view = document.getElementById('dashboard-view');

  const newTickets = [...tickets]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  const updatedTickets = [...tickets]
    .filter(t => {
      if (!t.updatedAt || !t.createdAt) return false;
      return new Date(t.updatedAt).getTime() > new Date(t.createdAt).getTime();
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 10);

  view.innerHTML = `
    <div class="dashboard-grid">
      <section class="dashboard-section">
        <div class="dashboard-section-header">
          <div class="dashboard-section-icon-wrap" style="background:#ede9fe">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" style="color:#5624d0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <h2 class="dashboard-section-title">新規チケット</h2>
          <span class="dashboard-section-badge">${newTickets.length}</span>
        </div>
        <div class="dashboard-card-list">
          ${newTickets.length > 0
            ? newTickets.map(t => dashboardTicketCard(t, t.createdAt)).join('')
            : '<p class="dashboard-empty">チケットがありません</p>'}
        </div>
      </section>

      <section class="dashboard-section">
        <div class="dashboard-section-header">
          <div class="dashboard-section-icon-wrap" style="background:#fef3c7">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" style="color:#d97706" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </div>
          <h2 class="dashboard-section-title">更新されたチケット</h2>
          <span class="dashboard-section-badge">${updatedTickets.length}</span>
        </div>
        <div class="dashboard-card-list">
          ${updatedTickets.length > 0
            ? updatedTickets.map(t => dashboardTicketCard(t, t.updatedAt)).join('')
            : '<p class="dashboard-empty">更新されたチケットがありません</p>'}
        </div>
      </section>
    </div>`;

  view.querySelectorAll('.dashboard-ticket-card').forEach(card => {
    card.addEventListener('click', () => App.openModal(card.dataset.id));
  });
}

function dashboardTicketCard(ticket, timeIso) {
  const STATUS_LABEL = { todo: 'Todo', not_started: '未着手', in_progress: '進行中', done: '完了' };
  const STATUS_COLOR = {
    todo:        { bg: '#dbeafe', text: '#1d4ed8' },
    not_started: { bg: '#e5e7eb', text: '#374151' },
    in_progress: { bg: '#fef9c3', text: '#92400e' },
    done:        { bg: '#dcfce7', text: '#166534' }
  };
  const PRI_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

  const sc = STATUS_COLOR[ticket.status] || STATUS_COLOR.not_started;
  const priColor = PRI_COLOR[ticket.priority] || '#d1d7dc';
  const label = STATUS_LABEL[ticket.status] || ticket.status;
  const labelHtml = ticket.labels && ticket.labels.length > 0
    ? `<div class="flex flex-wrap gap-1 mt-1.5">
        ${ticket.labels.slice(0, 3).map(l => `<span class="dashboard-label">${escHtml(l)}</span>`).join('')}
        ${ticket.labels.length > 3 ? `<span class="dashboard-label">+${ticket.labels.length - 3}</span>` : ''}
       </div>`
    : '';

  return `
    <div class="dashboard-ticket-card" data-id="${ticket.id}">
      <div class="dashboard-ticket-pri-bar" style="background:${priColor}"></div>
      <div class="dashboard-ticket-body">
        <div class="flex items-start justify-between gap-2">
          <span class="dashboard-ticket-title">${escHtml(ticket.title)}</span>
          <span class="dashboard-status-badge flex-shrink-0" style="background:${sc.bg};color:${sc.text}">${label}</span>
        </div>
        ${labelHtml}
        <div class="dashboard-ticket-time">${timeAgo(timeIso)}</div>
      </div>
    </div>`;
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);

  if (minutes < 1)  return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24)   return `${hours}時間前`;
  if (days === 1)   return '昨日';
  if (days < 30)    return `${days}日前`;
  return new Date(isoString).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
}
