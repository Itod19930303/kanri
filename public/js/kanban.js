const KANBAN_COLUMNS = [
  { id: 'todo',        label: 'Todo',  colorClass: 'col-todo' },
  { id: 'not_started', label: '未着手', colorClass: 'col-not-started' },
  { id: 'in_progress', label: '進行中', colorClass: 'col-in-progress' },
  { id: 'done',        label: '完了',  colorClass: 'col-done' }
];

const STATUS_LABELS = {
  todo: 'Todo', not_started: '未着手', in_progress: '進行中', done: '完了'
};
const STATUS_STYLES = {
  todo:        { bg: '#dbeafe', color: '#1d4ed8' },
  not_started: { bg: '#e5e7eb', color: '#374151' },
  in_progress: { bg: '#fef9c3', color: '#92400e' },
  done:        { bg: '#dcfce7', color: '#166534' },
};
const STATUS_DOT_COLOR = {
  not_started: '#d1d5db', todo: '#93c5fd', in_progress: '#fcd34d', done: '#86efac'
};

let sortableInstances = [];
let activeKanbanCol = 'todo';
let _activeStatusPicker = null;

function closeStatusPicker() {
  if (_activeStatusPicker) { _activeStatusPicker.remove(); _activeStatusPicker = null; }
}

function showStatusPicker(anchorEl, ticketId, currentStatus) {
  closeStatusPicker();

  const picker = document.createElement('div');
  picker.className = 'status-picker';
  picker.innerHTML = Object.entries(STATUS_LABELS).map(([id, label]) => `
    <button class="status-picker-opt${id === currentStatus ? ' current' : ''}" data-new-status="${id}"
      style="background:${STATUS_STYLES[id].bg};color:${STATUS_STYLES[id].color}">${label}</button>
  `).join('');
  document.body.appendChild(picker);
  _activeStatusPicker = picker;

  const rect = anchorEl.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.zIndex = '9999';
  picker.style.left = `${rect.left}px`;
  picker.style.top = `${rect.bottom + 4}px`;

  requestAnimationFrame(() => {
    const pr = picker.getBoundingClientRect();
    if (pr.right > window.innerWidth - 8) picker.style.left = `${window.innerWidth - pr.width - 8}px`;
    if (pr.bottom > window.innerHeight - 8) picker.style.top = `${rect.top - pr.height - 4}px`;
  });

  picker.querySelectorAll('[data-new-status]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const newStatus = btn.dataset.newStatus;
      closeStatusPicker();
      if (newStatus !== currentStatus) {
        await DB.update(ticketId, { status: newStatus });
        await App.refresh();
      }
    });
  });
}

document.addEventListener('click', e => {
  if (_activeStatusPicker && !_activeStatusPicker.contains(e.target)) closeStatusPicker();
});

function renderKanban(tickets, allTickets) {
  const view = document.getElementById('kanban-view');
  view.innerHTML = '';

  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];

  // カンバンにはルート課題のみ表示（子・孫はカード内アコーディオン）
  const rootTickets = tickets.filter(t => {
    if (!t.parentId) return true;
    return !tickets.some(p => p.id === t.parentId);
  });

  const colData = KANBAN_COLUMNS.map(col => ({
    ...col,
    colTickets: rootTickets.filter(t => t.status === col.id)
  }));

  // モバイル用タブバー（デスクトップではCSS非表示）
  const tabBar = document.createElement('div');
  tabBar.className = 'kanban-tabs-mobile';
  tabBar.innerHTML = colData.map(col => `
    <button class="kanban-tab-btn${col.id === activeKanbanCol ? ' kanban-tab-active' : ''}" data-target-col="${col.id}">
      <span class="col-count-badge ${col.colorClass}">${col.colTickets.length}</span>
      <span>${col.label}</span>
    </button>
  `).join('');
  view.appendChild(tabBar);

  colData.forEach(col => {
    const isActive = col.id === activeKanbanCol;
    const colEl = document.createElement('div');
    colEl.className = `kanban-column-wrapper flex flex-col gap-3 min-w-[280px] w-80${isActive ? ' kanban-col-active' : ''}`;
    colEl.dataset.colId = col.id;
    colEl.innerHTML = `
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <span class="col-count-badge ${col.colorClass}">${col.colTickets.length}</span>
          <h2 class="font-bold text-sm" style="color:#1c1d1f">${col.label}</h2>
        </div>
        <button class="btn btn-ghost btn-xs add-in-col" data-status="${col.id}" title="追加">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        </button>
      </div>
      <div class="kanban-col flex flex-col gap-2 min-h-[120px] rounded-xl p-2" data-status="${col.id}">
        ${col.colTickets.map(t => ticketCard(t, allTickets)).join('')}
      </div>
    `;
    view.appendChild(colEl);

    const listEl = colEl.querySelector('.kanban-col');
    const sortable = Sortable.create(listEl, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'opacity-40',
      delay: 200,
      delayOnTouchOnly: true,
      onEnd: async (evt) => {
        const id = evt.item.dataset.id;
        const newStatus = evt.to.dataset.status;
        await DB.update(id, { status: newStatus });
        await App.refresh();
      }
    });
    sortableInstances.push(sortable);
  });

  // タブ切り替え
  view.querySelectorAll('.kanban-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeKanbanCol = btn.dataset.targetCol;
      view.querySelectorAll('.kanban-tab-btn').forEach(b => b.classList.remove('kanban-tab-active'));
      btn.classList.add('kanban-tab-active');
      view.querySelectorAll('.kanban-column-wrapper').forEach(col => {
        col.classList.toggle('kanban-col-active', col.dataset.colId === activeKanbanCol);
      });
    });
  });

  view.querySelectorAll('.add-in-col').forEach(btn => {
    btn.addEventListener('click', () => App.openModal(null, btn.dataset.status));
  });
  view.querySelectorAll('.card-edit').forEach(btn => {
    btn.addEventListener('click', () => App.openModal(btn.dataset.id));
  });
  view.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', () => App.deleteTicket(btn.dataset.id));
  });
  view.querySelectorAll('.card-add-child').forEach(btn => {
    btn.addEventListener('click', () => App.openModal(null, 'not_started', btn.dataset.id));
  });
  view.querySelectorAll('.child-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); App.openModal(btn.dataset.id); });
  });
  view.querySelectorAll('[data-status-btn]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); showStatusPicker(btn, btn.dataset.id, btn.dataset.status); });
  });

  // アコーディオントグル（子課題・孫課題共通）
  view.querySelectorAll('.acc-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const targetId = btn.dataset.target;
      const body = document.getElementById(targetId);
      if (!body) return;
      const isOpen = body.classList.contains('is-open');
      body.classList.toggle('is-open');
      btn.querySelector('.acc-arrow').textContent = isOpen ? '▶' : '▼';
    });
  });
}

function ticketCard(t, allTickets) {
  const priorityClass = { high: 'border-error', medium: 'border-warning', low: 'border-success' }[t.priority] || '';
  const priorityLabel = { high: '高', medium: '中', low: '低' }[t.priority] || '';
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
  const children = allTickets ? allTickets.filter(c => c.parentId === t.id) : [];
  const depth = allTickets ? getDepth(t.id, allTickets) : 0;

  const depthBadge = depth > 0
    ? `<span class="badge badge-xs" style="background:#ede9fe;color:#5624d0;border:none">${depth === 1 ? '子' : '孫'}</span>`
    : '';

  const childrenSection = children.length > 0 ? `
    <button class="acc-toggle w-full" data-target="children-${t.id}">
      <span class="acc-arrow">▶</span>
      <span>子課題 ${children.length}件</span>
    </button>
    <div id="children-${t.id}" class="acc-body">
      ${children.map(c => childMiniCard(c, allTickets)).join('')}
      <button class="card-add-child acc-add-btn" data-id="${t.id}">+ 子課題を追加</button>
    </div>
  ` : '';

  const canAddChild = depth < 2;

  return `
    <div class="card bg-base-100 shadow-sm border-l-4 ${priorityClass} cursor-grab active:cursor-grabbing" data-id="${t.id}">
      <div class="card-body p-3 gap-1">
        <div class="flex justify-between items-start gap-1">
          <div class="flex items-center gap-1 flex-1 min-w-0">
            ${depthBadge}
            <p class="font-semibold text-sm leading-snug truncate">${escHtml(t.title)}</p>
          </div>
          <div class="flex gap-1 shrink-0">
            ${canAddChild && children.length === 0 ? `<button class="btn btn-ghost btn-xs card-add-child" data-id="${t.id}" title="子課題を追加">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            </button>` : ''}
            <button class="btn btn-ghost btn-xs card-edit" data-id="${t.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.829 1.172H7v-2a4 4 0 011.172-2.828z"/></svg>
            </button>
            <button class="btn btn-ghost btn-xs card-delete text-error" data-id="${t.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        ${t.description ? `<p class="text-xs text-base-content/60 line-clamp-2">${escHtml(t.description)}</p>` : ''}
        <div class="flex flex-wrap gap-1 mt-1">
          ${t.labels.map(l => `<span class="badge badge-outline badge-xs">${escHtml(l)}</span>`).join('')}
        </div>
        <div class="flex items-center justify-between gap-1 mt-1">
          <span class="text-xs font-medium ${priorityClass.replace('border-', 'text-')}">${priorityLabel ? '● ' + priorityLabel : ''}</span>
          <div class="flex items-center gap-1.5">
            ${t.dueDate ? `<span class="text-xs ${overdue ? 'text-error font-bold' : 'text-base-content/50'}">${t.dueDate}</span>` : ''}
            <button class="status-quick-btn" data-status-btn data-id="${t.id}" data-status="${t.status}"
              style="background:${STATUS_STYLES[t.status]?.bg||'#e5e7eb'};color:${STATUS_STYLES[t.status]?.color||'#374151'}">
              ${STATUS_LABELS[t.status] || t.status}
            </button>
          </div>
        </div>
        ${childrenSection}
      </div>
    </div>
  `;
}

function childMiniCard(t, allTickets) {
  const grandChildren = allTickets ? allTickets.filter(c => c.parentId === t.id) : [];
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';

  const grandSection = grandChildren.length > 0 ? `
    <button class="acc-toggle w-full mt-1" data-target="grand-${t.id}">
      <span class="acc-arrow">▶</span>
      <span>孫課題 ${grandChildren.length}件</span>
    </button>
    <div id="grand-${t.id}" class="acc-body">
      ${grandChildren.map(g => grandChildItem(g)).join('')}
    </div>
  ` : '';

  return `
    <div class="child-mini-card">
      <div class="flex items-center gap-1.5">
        <button class="child-status-dot status-quick-dot" data-status-btn data-id="${t.id}" data-status="${t.status}"
          style="background:${STATUS_DOT_COLOR[t.status] || '#d1d5db'}" title="ステータスを変更"></button>
        <span class="child-title flex-1 truncate ${overdue ? 'text-error' : ''}">${escHtml(t.title)}</span>
        <button class="child-edit-btn" data-id="${t.id}" title="編集">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.829 1.172H7v-2a4 4 0 011.172-2.828z"/></svg>
        </button>
      </div>
      ${grandSection}
    </div>
  `;
}

function grandChildItem(t) {
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
  return `
    <div class="grandchild-item">
      <button class="child-status-dot status-quick-dot" data-status-btn data-id="${t.id}" data-status="${t.status}"
        style="background:${STATUS_DOT_COLOR[t.status] || '#d1d5db'}" title="ステータスを変更"></button>
      <span class="child-title flex-1 truncate ${overdue ? 'text-error' : ''}">${escHtml(t.title)}</span>
      <button class="child-edit-btn" data-id="${t.id}" title="編集">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.829 1.172H7v-2a4 4 0 011.172-2.828z"/></svg>
      </button>
    </div>
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
