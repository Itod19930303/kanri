let sortState = { col: 'createdAt', asc: false };

function renderList(tickets) {
  const view = document.getElementById('list-view');

  const sorted = [...tickets].sort((a, b) => {
    let va = a[sortState.col], vb = b[sortState.col];
    if (va == null) va = '';
    if (vb == null) vb = '';
    if (va < vb) return sortState.asc ? -1 : 1;
    if (va > vb) return sortState.asc ? 1 : -1;
    return 0;
  });

  const STATUS_LABEL = { not_started: '未着手', todo: 'Todo', in_progress: '進行中', done: '完了' };
  const STATUS_BADGE = { not_started: 'badge-ghost', todo: 'badge-neutral', in_progress: 'badge-info', done: 'badge-success' };
  const PRI_LABEL = { high: '高', medium: '中', low: '低' };
  const PRI_CLASS = { high: 'text-error', medium: 'text-warning', low: 'text-success' };

  const cols = [
    { key: 'title', label: 'タイトル' },
    { key: 'status', label: 'ステータス' },
    { key: 'priority', label: '優先度' },
    { key: 'dueDate', label: '期限日' },
    { key: 'labels', label: 'ラベル', noSort: true },
    { key: '_actions', label: '', noSort: true }
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
          ${sorted.length === 0
            ? `<tr><td colspan="${cols.length}" class="text-center text-base-content/40 py-8">チケットがありません</td></tr>`
            : sorted.map(t => {
              const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
              return `
                <tr class="hover">
                  <td>
                    <div>
                      <p class="font-medium">${escHtml(t.title)}</p>
                      ${t.description ? `<p class="text-xs text-base-content/50 line-clamp-1">${escHtml(t.description)}</p>` : ''}
                    </div>
                  </td>
                  <td><span class="badge ${STATUS_BADGE[t.status]} badge-sm">${STATUS_LABEL[t.status]}</span></td>
                  <td><span class="font-medium text-sm ${PRI_CLASS[t.priority] || ''}">${PRI_LABEL[t.priority] || ''}</span></td>
                  <td><span class="${overdue ? 'text-error font-bold' : ''}">${t.dueDate || '—'}</span></td>
                  <td><div class="flex flex-wrap gap-1">${t.labels.map(l => `<span class="badge badge-outline badge-xs">${escHtml(l)}</span>`).join('')}</div></td>
                  <td>
                    <div class="flex gap-1">
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

  view.querySelectorAll('th[data-col]').forEach(th => {
    if (!th.dataset.col || th.dataset.col === '_actions' || th.dataset.col === 'labels') return;
    th.addEventListener('click', () => {
      if (sortState.col === th.dataset.col) {
        sortState.asc = !sortState.asc;
      } else {
        sortState.col = th.dataset.col;
        sortState.asc = true;
      }
      App.render();
    });
  });

  view.querySelectorAll('.list-edit').forEach(btn => {
    btn.addEventListener('click', () => App.openModal(parseInt(btn.dataset.id)));
  });

  view.querySelectorAll('.list-delete').forEach(btn => {
    btn.addEventListener('click', () => App.deleteTicket(parseInt(btn.dataset.id)));
  });
}
