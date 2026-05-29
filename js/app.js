const App = (() => {
  let state = {
    tickets: [],
    view: 'kanban',
    search: '',
    filterPriority: '',
    filterLabel: '',
    editingId: null
  };

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

    if (state.view === 'kanban') renderKanban(filtered);
    else if (state.view === 'list') renderList(filtered);
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

    document.getElementById('ticket-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const labelsRaw = fd.get('labels') || '';
      const labels = labelsRaw.split(',').map(s => s.trim()).filter(Boolean);

      const data = {
        title: fd.get('title').trim(),
        description: fd.get('description').trim(),
        status: fd.get('status'),
        priority: fd.get('priority'),
        dueDate: fd.get('dueDate'),
        labels
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
        await DB.delete(state.editingId);
        closeModal();
        await refresh();
      }
    });
  }

  function openModal(id, defaultStatus = 'not_started') {
    state.editingId = id;
    const form = document.getElementById('ticket-form');
    form.reset();

    const deleteBtn = document.getElementById('modal-delete');

    if (id != null) {
      const t = state.tickets.find(x => x.id === id);
      if (!t) return;
      form.elements['title'].value = t.title;
      form.elements['description'].value = t.description || '';
      form.elements['status'].value = t.status;
      form.elements['priority'].value = t.priority;
      form.elements['dueDate'].value = t.dueDate || '';
      form.elements['labels'].value = t.labels.join(', ');
      document.getElementById('modal-title-text').textContent = 'チケットを編集';
      deleteBtn.classList.remove('hidden');
    } else {
      form.elements['status'].value = defaultStatus;
      form.elements['priority'].value = 'medium';
      document.getElementById('modal-title-text').textContent = '新しいチケット';
      deleteBtn.classList.add('hidden');
    }

    document.getElementById('ticket-modal').showModal();
  }

  function closeModal() {
    document.getElementById('ticket-modal').close();
    state.editingId = null;
  }

  async function deleteTicket(id) {
    if (!confirm('このチケットを削除しますか？')) return;
    await DB.delete(id);
    await refresh();
  }

  return { init, refresh, render, openModal, deleteTicket };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
