const App = (() => {
  let state = {
    tickets: [],
    view: 'kanban',
    search: '',
    filterPriority: '',
    filterLabel: '',
    editingId: null
  };

  let currentLabels = [];

  const VIEWS = ['kanban', 'list', 'gantt'];

  async function init() {
    state.tickets = await DB.getAll();
    bindEvents();
    render();
  }

  async function refresh() {
    state.tickets = await DB.getAll();
    render();
  }

  function render() {
    const filtered = applyFilters(state.tickets);
    updateLabelFilter();

    VIEWS.forEach(v => {
      const el = document.getElementById(`${v}-view`);
      if (v === state.view) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });

    if (state.view === 'kanban') renderKanban(filtered, state.tickets);
    else if (state.view === 'list') renderList(filtered, state.tickets);
    else if (state.view === 'gantt') renderGantt(state.tickets);

    document.getElementById('ticket-count').textContent = `${filtered.length} 件`;
  }

  function applyFilters(tickets) {
    return tickets.filter(t => {
      if (state.filterPriority && t.priority !== state.filterPriority) return false;
      if (state.filterLabel && !t.labels.includes(state.filterLabel)) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  function updateLabelFilter() {
    const allLabels = [...new Set(state.tickets.flatMap(t => t.labels))].sort();
    const sel = document.getElementById('filter-label');
    const cur = sel.value;
    sel.innerHTML = `<option value="">ラベル: すべて</option>` +
      allLabels.map(l => `<option value="${escHtml(l)}" ${cur === l ? 'selected' : ''}>${escHtml(l)}</option>`).join('');
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('view-btn-active'));
    document.getElementById(`btn-${v}`).classList.add('view-btn-active');
    render();
  }

  function bindEvents() {
    document.getElementById('btn-kanban').addEventListener('click', () => setView('kanban'));
    document.getElementById('btn-list').addEventListener('click', () => setView('list'));
    document.getElementById('btn-gantt').addEventListener('click', () => setView('gantt'));

    document.getElementById('btn-new').addEventListener('click', () => openModal(null));

    document.getElementById('search-input').addEventListener('input', e => {
      state.search = e.target.value;
      render();
    });

    document.getElementById('filter-priority').addEventListener('change', e => {
      state.filterPriority = e.target.value;
      render();
    });

    document.getElementById('filter-label').addEventListener('change', e => {
      state.filterLabel = e.target.value;
      render();
    });

    // ラベル入力：Enter or カンマで追加
    const labelInput = document.getElementById('label-input');
    labelInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addLabel(labelInput.value); }
    });
    labelInput.addEventListener('input', e => {
      const val = e.target.value;
      if (val.endsWith(',')) addLabel(val.slice(0, -1));
    });

    document.getElementById('ticket-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const parentIdRaw = document.getElementById('parent-select').value;

      const data = {
        title: fd.get('title').trim(),
        description: fd.get('description').trim(),
        status: fd.get('status'),
        priority: fd.get('priority'),
        dueDate: fd.get('dueDate'),
        labels: [...currentLabels],
        parentId: parentIdRaw ? String(parentIdRaw) : null
      };

      if (state.editingId != null) {
        await DB.update(state.editingId, data);
      } else {
        await DB.add(data);
      }

      closeModal();
      await refresh();
    });

    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-delete').addEventListener('click', async () => {
      if (state.editingId != null) {
        const hasChildren = state.tickets.some(t => t.parentId === state.editingId);
        if (hasChildren && !confirm('子課題が存在します。このチケットを削除しますか？（子課題の親は解除されます）')) return;
        if (!hasChildren && !confirm('このチケットを削除しますか？')) return;
        if (hasChildren) {
          const children = state.tickets.filter(t => t.parentId === state.editingId);
          await Promise.all(children.map(c => DB.update(c.id, { parentId: null })));
        }
        await DB.delete(state.editingId);
        closeModal();
        await refresh();
      }
    });
  }

  // ===== ラベルチップ管理 =====
  function addLabel(raw) {
    const val = raw.trim();
    if (val && !currentLabels.includes(val)) {
      currentLabels.push(val);
      renderLabelChips();
    }
    document.getElementById('label-input').value = '';
  }

  function renderLabelChips() {
    const container = document.getElementById('label-chips');
    container.innerHTML = currentLabels.map(l => `
      <span class="label-chip">${escHtml(l)}<button type="button" class="label-chip-del" data-label="${escHtml(l)}">×</button></span>
    `).join('');
    container.querySelectorAll('.label-chip-del').forEach(btn => {
      btn.addEventListener('click', () => {
        currentLabels = currentLabels.filter(l => l !== btn.dataset.label);
        renderLabelChips();
      });
    });

    // サジェスト更新
    const allLabels = [...new Set(state.tickets.flatMap(t => t.labels))].sort();
    const dl = document.getElementById('label-suggestions');
    dl.innerHTML = allLabels
      .filter(l => !currentLabels.includes(l))
      .map(l => `<option value="${escHtml(l)}">`)
      .join('');
  }

  // ===== 親課題選択更新 =====
  function updateParentSelect(editingId) {
    const sel = document.getElementById('parent-select');
    const candidates = state.tickets.filter(t => {
      if (t.id === editingId) return false;
      if (editingId != null && isDescendant(t.id, editingId, state.tickets)) return false;
      return getDepth(t.id, state.tickets) < 2; // 最大3段階（深さ0,1,2）
    });

    sel.innerHTML = `<option value="">なし（ルート課題）</option>` +
      candidates.map(t => {
        const depth = getDepth(t.id, state.tickets);
        const prefix = depth === 0 ? '' : depth === 1 ? '　└ ' : '　　└ ';
        return `<option value="${t.id}">${prefix}${escHtml(t.title)}</option>`;
      }).join('');
  }

  function openModal(id, defaultStatus = 'todo', defaultParentId = null) {
    state.editingId = id;
    const form = document.getElementById('ticket-form');
    form.reset();
    currentLabels = [];

    const deleteBtn = document.getElementById('modal-delete');
    updateParentSelect(id);

    if (id != null) {
      const t = state.tickets.find(x => x.id === id);
      if (!t) return;
      form.elements['title'].value = t.title;
      form.elements['description'].value = t.description || '';
      form.elements['status'].value = t.status;
      form.elements['priority'].value = t.priority;
      form.elements['dueDate'].value = t.dueDate || '';
      currentLabels = [...(t.labels || [])];
      if (t.parentId) document.getElementById('parent-select').value = t.parentId;
      document.getElementById('modal-title-text').textContent = 'チケットを編集';
      deleteBtn.classList.remove('hidden');
    } else {
      form.elements['status'].value = defaultStatus;
      form.elements['priority'].value = 'medium';
      if (defaultParentId) document.getElementById('parent-select').value = defaultParentId;
      document.getElementById('modal-title-text').textContent = '新しいチケット';
      deleteBtn.classList.add('hidden');
    }

    renderLabelChips();
    document.getElementById('ticket-modal').showModal();
  }

  function closeModal() {
    document.getElementById('ticket-modal').close();
    state.editingId = null;
    currentLabels = [];
  }

  async function deleteTicket(id) {
    const hasChildren = state.tickets.some(t => t.parentId === id);
    const msg = hasChildren
      ? 'このチケットを削除しますか？（子課題の親は解除されます）'
      : 'このチケットを削除しますか？';
    if (!confirm(msg)) return;
    if (hasChildren) {
      const children = state.tickets.filter(t => t.parentId === id);
      await Promise.all(children.map(c => DB.update(c.id, { parentId: null })));
    }
    await DB.delete(id);
    await refresh();
  }

  return { init, refresh, render, openModal, deleteTicket };
})();

// ===== 階層ユーティリティ（グローバル） =====
function getDepth(id, tickets) {
  let depth = 0;
  let cur = tickets.find(t => t.id === id);
  while (cur && cur.parentId) {
    depth++;
    cur = tickets.find(t => t.id === cur.parentId);
    if (depth > 10) break;
  }
  return depth;
}

function isDescendant(ticketId, ancestorId, tickets) {
  const children = tickets.filter(t => t.parentId === ancestorId);
  for (const child of children) {
    if (child.id === ticketId) return true;
    if (isDescendant(ticketId, child.id, tickets)) return true;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', () => App.init());
