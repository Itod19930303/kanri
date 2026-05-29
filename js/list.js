let sortState = { col: 'createdAt', asc: false };

function renderList(tickets, allTickets) {
  const view = document.getElementById('list-view');

  const STATUS_LABEL = { not_started: '未着手', todo: 'Todo', in_progress: '進行中', done: '完了' };
  const STATUS_BADGE = { not_started: 'badge-ghost', todo: 'badge-neutral', in_progress: 'badge-info', done: 'badge-success' };
  const PRI_LABEL = { high: '高', medium: '中', low: '低' };
  const PRI_CLASS = { high: 'text-error', medium: 'text-warning', low: 'text-success' };

  const ordered = buildTree(tickets, allTickets);

  const cols = [
    { key: 'title',   label: 'タイトル' },
    { key: 'status',  label: 'ステータス' },
    { key: 'priority',label: '優先度' },
    { key: 'dueDate', label: '期限日' },
    { key: 'labels',  label: 'ラベル', noSort: true },
    { key: '_actions',label: '', noSort: true }
  ];

  view.innerHTML = `
    <div class="overflow-x-auto rounded-xl">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            ${cols.map(c => `
              <th class="${c.noSort ? '' : 'cursor-pointer select-none hover:bg-base-200'}" data-col="${c.key}">
                <span class="flex items-center gap-1">
                  ${c.label}
                  ${!c.noSort && sortState.col === c.key
                    ? `<span class="text-xs">${sortState.asc ? '▲' : '▼'}</span>` : ''}
                </span>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${ordered.length === 0
            ? `<tr><td colspan="${cols.length}" class="text-center py-8" style="color:#9ca3af">チケットがありません</td></tr>`
            : ordered.map(({ ticket: t, depth }) => {
              const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
              const indent = depth * 20;
              const depthStyle = depth === 1
                ? 'background:#ede9fe;color:#5624d0;border:none'
                : depth === 2 ? 'background:#fce7f3;color:#9d174d;border:none' : '';
              const depthLabel = depth === 1 ? '子' : depth === 2 ? '孫' : '';
              const childCount = allTickets ? allTickets.filter(c => c.parentId === t.id).length : 0;

              // 子・孫行は初期非表示
              const isChild = depth > 0;
              const parentId = t.parentId || '';

              const toggleBtn = childCount > 0 ? `
                <button class="tree-toggle acc-toggle-row" data-id="${t.id}" title="${childCount}件の子課題">
                  <span class="acc-arrow">▶</span>
                </button>` : `<span class="w-5 inline-block"></span>`;

              return `
                <tr class="hover list-row" data-row-id="${t.id}" data-parent-id="${parentId}" ${isChild ? 'style="display:none"' : ''}>
                  <td>
                    <div class="flex items-center gap-1" style="padding-left:${indent}px">
                      ${toggleBtn}
                      ${depth > 0 ? `<span style="color:#d1d5db;font-size:10px">└</span>` : ''}
                      ${depthLabel ? `<span class="badge badge-xs shrink-0" style="${depthStyle}">${depthLabel}</span>` : ''}
                      <div class="min-w-0">
                        <p class="font-medium text-sm leading-snug">${escHtml(t.title)}</p>
                        ${t.description ? `<p class="text-xs line-clamp-1" style="color:#6a6f73">${escHtml(t.description)}</p>` : ''}
                      </div>
                    </div>
                  </td>
                  <td><span class="badge ${STATUS_BADGE[t.status]} badge-sm">${STATUS_LABEL[t.status] || t.status}</span></td>
                  <td><span class="font-medium text-sm ${PRI_CLASS[t.priority] || ''}">${PRI_LABEL[t.priority] || ''}</span></td>
                  <td><span class="${overdue ? 'text-error font-bold' : ''}">${t.dueDate || '—'}</span></td>
                  <td><div class="flex flex-wrap gap-1">${(t.labels || []).map(l => `<span class="badge badge-outline badge-xs">${escHtml(l)}</span>`).join('')}</div></td>
                  <td>
                    <div class="flex gap-1">
                      ${depth < 2 ? `
                        <button class="btn btn-ghost btn-xs list-add-child" data-id="${t.id}" title="子課題を追加">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        </button>` : ''}
                      <button class="btn btn-ghost btn-xs list-edit" data-id="${t.id}" title="編集">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.829 1.172H7v-2a4 4 0 011.172-2.828z"/></svg>
                      </button>
                      <button class="btn btn-ghost btn-xs list-delete text-error" data-id="${t.id}" title="削除">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // ソートヘッダー
  view.querySelectorAll('th[data-col]').forEach(th => {
    if (!th.dataset.col || th.dataset.col === '_actions' || th.dataset.col === 'labels') return;
    th.addEventListener('click', () => {
      if (sortState.col === th.dataset.col) sortState.asc = !sortState.asc;
      else { sortState.col = th.dataset.col; sortState.asc = true; }
      App.render();
    });
  });

  // アコーディオントグル（テーブル行の表示/非表示）
  view.querySelectorAll('.tree-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const arrow = btn.querySelector('.acc-arrow');
      const isOpen = btn.dataset.open === '1';

      // 子行を取得（data-parent-idは文字列比較）
      const childRows = view.querySelectorAll(`tr[data-parent-id="${id}"]`);

      if (isOpen) {
        // 折りたたむ：子と孫を全部非表示
        collapseRows(view, id);
        btn.dataset.open = '0';
        arrow.textContent = '▶';
      } else {
        // 展開：直接の子行のみ表示（孫は閉じたまま）
        childRows.forEach(row => { row.style.display = 'table-row'; });
        btn.dataset.open = '1';
        arrow.textContent = '▼';
      }
    });
  });

  view.querySelectorAll('.list-add-child').forEach(btn => {
    btn.addEventListener('click', () => App.openModal(null, 'not_started', btn.dataset.id));
  });
  view.querySelectorAll('.list-edit').forEach(btn => {
    btn.addEventListener('click', () => App.openModal(btn.dataset.id));
  });
  view.querySelectorAll('.list-delete').forEach(btn => {
    btn.addEventListener('click', () => App.deleteTicket(btn.dataset.id));
  });
}

// 指定IDの子孫行を再帰的に非表示にする
function collapseRows(view, parentId) {
  const childRows = view.querySelectorAll(`tr[data-parent-id="${String(parentId)}"]`);
  childRows.forEach(row => {
    row.style.display = 'none';
    const childId = row.dataset.rowId;
    const toggle = row.querySelector('.tree-toggle');
    if (toggle) {
      toggle.dataset.open = '0';
      const arrow = toggle.querySelector('.acc-arrow');
      if (arrow) arrow.textContent = '▶';
    }
    collapseRows(view, childId);
  });
}

function buildTree(filtered, allTickets) {
  const filteredIds = new Set(filtered.map(t => t.id));
  const roots = filtered.filter(t => !t.parentId || !filteredIds.has(t.parentId));

  function sortTickets(arr) {
    return [...arr].sort((a, b) => {
      let va = a[sortState.col], vb = b[sortState.col];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (va < vb) return sortState.asc ? -1 : 1;
      if (va > vb) return sortState.asc ? 1 : -1;
      return 0;
    });
  }

  const result = [];

  function walk(ticket, depth) {
    result.push({ ticket, depth });
    const children = sortTickets(filtered.filter(t => t.parentId === ticket.id));
    children.forEach(c => walk(c, depth + 1));
  }

  sortTickets(roots).forEach(r => walk(r, 0));
  return result;
}
