const KANBAN_COLUMNS = [
  { id: 'todo',        label: 'Todo',  colorClass: 'col-todo' },
  { id: 'not_started', label: '未着手', colorClass: 'col-not-started' },
  { id: 'in_progress', label: '進行中', colorClass: 'col-in-progress' },
  { id: 'done',        label: '完了',  colorClass: 'col-done' }
];

let sortableInstances = [];

function renderKanban(tickets, allTickets) {
  const view = document.getElementById('kanban-view');
  view.innerHTML = '';

  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];

  // カンバンにはルート課題のみ表示（子・孫はカード内アコーディオン）
  const rootTickets = tickets.filter(t => {
    if (!t.parentId) return true;
    // 親がフィルタ結果に含まれていれば非表示（親のカードに含まれるため）
    return !tickets.some(p => p.id === t.parentId);
  });

  KANBAN_COLUMNS.forEach(col => {
    const colTickets = rootTickets.filter(t => t.status === col.id);
    const colEl = document.createElement('div');
    colEl.className = 'flex flex-col gap-3 min-w-[280px] w-80';
    colEl.innerHTML = `
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <span class="col-count-badge ${col.colorClass}">${colTickets.length}</span>
          <h2 class="font-bold text-sm" style="color:#1c1d1f">${col.label}</h2>
        </div>
        <button class="btn btn-ghost btn-xs add-in-col" data-status="${col.id}" title="追加">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        </button>
      </div>
      <div class="kanban-col flex flex-col gap-2 min-h-[120px] rounded-xl p-2" data-status="${col.id}">
        ${colTickets.map(t => ticketCard(t, allTickets)).join('')}
      </div>
    `;
    view.appendChild(colEl);

    const listEl = colEl.querySelector('.kanban-col');
    const sortable = Sortable.create(listEl, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'opacity-40',
      onEnd: async (evt) => {
        const id = evt.item.dataset.id;
        const newStatus = evt.to.dataset.status;
        await DB.update(id, { status: newStatus });
        await App.refresh();
      }
    });
    sortableInstances.push(sortable);
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
        <div class="flex items-center justify-between mt-1">
          <span class="text-xs font-medium ${priorityClass.replace('border-', 'text-')}">${priorityLabel ? '● ' + priorityLabel : ''}</span>
          ${t.dueDate ? `<span class="text-xs ${overdue ? 'text-error font-bold' : 'text-base-content/50'}">${t.dueDate}</span>` : ''}
        </div>
        ${childrenSection}
      </div>
    </div>
  `;
}

function childMiniCard(t, allTickets) {
  const grandChildren = allTickets ? allTickets.filter(c => c.parentId === t.id) : [];
  const STATUS_COLOR = { not_started: '#d1d5db', todo: '#93c5fd', in_progress: '#fcd34d', done: '#86efac' };
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
        <span class="child-status-dot" style="background:${STATUS_COLOR[t.status] || '#d1d5db'}"></span>
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
  const STATUS_COLOR = { not_started: '#d1d5db', todo: '#93c5fd', in_progress: '#fcd34d', done: '#86efac' };
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
  return `
    <div class="grandchild-item">
      <span class="child-status-dot" style="background:${STATUS_COLOR[t.status] || '#d1d5db'}"></span>
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
