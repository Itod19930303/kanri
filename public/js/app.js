const PROJECT_COLORS = [
  '#5624d0', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#0891b2'
];

const App = (() => {
  let state = {
    tickets: [],
    projects: [],
    currentProjectId: null,
    view: 'kanban',
    search: '',
    filterPriority: '',
    filterLabel: '',
    editingId: null
  };

  let currentLabels = [];
  let editingProjectId = null;
  let selectedProjectColor = PROJECT_COLORS[0];

  const VIEWS = ['kanban', 'list', 'gantt'];

  // ===== 初期化 =====

  async function init() {
    state.projects = await DB.getProjects();
    state.tickets = await DB.getAll();
    bindEvents();
    bindProjectEvents();
    showProjectListUI();
    renderProjectList();
  }

  async function refresh() {
    state.projects = await DB.getProjects();
    state.tickets = await DB.getAll();
    if (state.currentProjectId == null) {
      renderProjectList();
    } else {
      render();
    }
  }

  // ===== チケットビュー描画 =====

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
    else if (state.view === 'gantt') renderGantt(filtered);

    document.getElementById('ticket-count').textContent = `${filtered.length} 件`;
  }

  function applyFilters(tickets) {
    return tickets.filter(t => {
      if (state.currentProjectId && t.projectId !== state.currentProjectId) return false;
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
    const projectTickets = state.currentProjectId
      ? state.tickets.filter(t => t.projectId === state.currentProjectId)
      : state.tickets;
    const allLabels = [...new Set(projectTickets.flatMap(t => t.labels))].sort();
    const options = `<option value="">ラベル: すべて</option>` +
      allLabels.map(l => `<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('');

    const sel = document.getElementById('filter-label');
    sel.innerHTML = options;
    sel.value = state.filterLabel;

    const mobSel = document.getElementById('mob-filter-label');
    if (mobSel) {
      mobSel.innerHTML = options;
      mobSel.value = state.filterLabel;
    }
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('view-btn-active'));
    document.getElementById(`btn-${v}`).classList.add('view-btn-active');
    render();
  }

  // ===== プロジェクト画面 UI 切り替え =====

  function showProjectListUI() {
    document.getElementById('btn-back').classList.add('hidden');
    document.getElementById('header-project-name').classList.add('hidden');
    document.getElementById('ticket-count').classList.add('hidden');
    document.getElementById('project-controls').classList.remove('hidden');
    document.getElementById('ticket-controls').classList.add('hidden');
    document.getElementById('mobile-ticket-ui').classList.add('hidden');

    VIEWS.forEach(v => document.getElementById(`${v}-view`).classList.add('hidden'));
    document.getElementById('project-view').classList.remove('hidden');
  }

  function showTicketUI() {
    const project = state.projects.find(p => p.id === state.currentProjectId);
    document.getElementById('header-project-name').textContent = project ? project.name : '';
    document.getElementById('btn-back').classList.remove('hidden');
    document.getElementById('header-project-name').classList.remove('hidden');
    document.getElementById('ticket-count').classList.remove('hidden');
    document.getElementById('project-controls').classList.add('hidden');
    document.getElementById('ticket-controls').classList.remove('hidden');
    document.getElementById('mobile-ticket-ui').classList.remove('hidden');

    document.getElementById('project-view').classList.add('hidden');
  }

  function enterProject(id) {
    state.currentProjectId = id;
    state.search = '';
    state.filterPriority = '';
    state.filterLabel = '';
    document.getElementById('search-input').value = '';
    document.getElementById('filter-priority').value = '';
    document.getElementById('mob-filter-priority').value = '';

    showTicketUI();
    render();
  }

  function backToProjects() {
    state.currentProjectId = null;
    showProjectListUI();
    renderProjectList();
  }

  // ===== プロジェクト一覧描画 =====

  function renderProjectList() {
    const container = document.getElementById('project-view');

    if (state.projects.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="rounded-full p-5 mb-5" style="background:#ede9fe">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" style="color:#5624d0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
            </svg>
          </div>
          <h2 class="text-xl font-bold mb-2" style="color:#1c1d1f">プロジェクトがありません</h2>
          <p class="text-sm mb-6" style="color:#6a6f73">新しいプロジェクトを作成してチケットを管理しましょう</p>
          <button class="btn text-white px-6" style="background:#5624d0; border-color:#5624d0" id="btn-empty-new-project">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            プロジェクトを作成
          </button>
        </div>`;
      document.getElementById('btn-empty-new-project').addEventListener('click', () => openProjectModal(null));
      return;
    }

    container.innerHTML = `
      <div class="mb-5">
        <h2 class="text-xl font-bold" style="color:#1c1d1f">プロジェクト一覧</h2>
        <p class="text-sm mt-0.5" style="color:#6a6f73">${state.projects.length} 件のプロジェクト</p>
      </div>
      <div class="project-grid">
        ${state.projects.map(p => {
          const count = state.tickets.filter(t => t.projectId === p.id).length;
          return renderProjectCard(p, count);
        }).join('')}
      </div>`;

    container.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => enterProject(card.dataset.projectId));
    });
    container.querySelectorAll('.project-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openProjectModal(btn.dataset.id); });
    });
    container.querySelectorAll('.project-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deleteProjectWithConfirm(btn.dataset.id); });
    });
  }

  function renderProjectCard(project, ticketCount) {
    const color = project.color || PROJECT_COLORS[0];
    return `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-card-color-bar" style="background:${color}"></div>
        <div class="project-card-content">
          <div class="flex items-start justify-between gap-2 mb-3">
            <h3 class="project-card-title line-clamp-2">${escHtml(project.name)}</h3>
            <div class="flex gap-1 flex-shrink-0 project-card-actions">
              <button class="project-edit-btn btn btn-ghost btn-xs" data-id="${project.id}" title="編集" onclick="event.stopPropagation()">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button class="project-delete-btn btn btn-ghost btn-xs" data-id="${project.id}" title="削除" onclick="event.stopPropagation()">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
          ${project.description ? `<p class="project-card-desc line-clamp-2">${escHtml(project.description)}</p>` : ''}
          <div class="project-card-footer">
            <span class="project-ticket-count">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 inline mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              ${ticketCount} チケット
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 project-card-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </div>`;
  }

  // ===== プロジェクトモーダル =====

  function openProjectModal(id) {
    editingProjectId = id;
    const nameInput = document.getElementById('project-name-input');
    const descInput = document.getElementById('project-desc-input');
    const deleteBtn = document.getElementById('project-modal-delete');

    if (id != null) {
      const project = state.projects.find(p => p.id === id);
      if (!project) return;
      nameInput.value = project.name;
      descInput.value = project.description || '';
      selectedProjectColor = project.color || PROJECT_COLORS[0];
      document.getElementById('project-modal-title-text').textContent = 'プロジェクトを編集';
      deleteBtn.classList.remove('hidden');
    } else {
      nameInput.value = '';
      descInput.value = '';
      selectedProjectColor = PROJECT_COLORS[0];
      document.getElementById('project-modal-title-text').textContent = '新しいプロジェクト';
      deleteBtn.classList.add('hidden');
    }

    renderColorSwatches();
    document.getElementById('project-modal').showModal();
    nameInput.focus();
  }

  function renderColorSwatches() {
    const container = document.getElementById('project-color-swatches');
    container.innerHTML = PROJECT_COLORS.map(c => `
      <button type="button" class="color-swatch${c === selectedProjectColor ? ' color-swatch-active' : ''}"
        data-color="${c}" style="background:${c}" title="${c}"></button>
    `).join('');
  }

  function bindProjectEvents() {
    document.getElementById('btn-new-project').addEventListener('click', () => openProjectModal(null));
    document.getElementById('btn-back').addEventListener('click', backToProjects);

    document.getElementById('project-modal-cancel').addEventListener('click', () => {
      document.getElementById('project-modal').close();
      editingProjectId = null;
    });

    document.getElementById('project-modal-delete').addEventListener('click', () => {
      if (editingProjectId == null) return;
      const id = editingProjectId;
      document.getElementById('project-modal').close();
      editingProjectId = null;
      deleteProjectWithConfirm(id);
    });

    document.getElementById('project-color-swatches').addEventListener('click', e => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      selectedProjectColor = swatch.dataset.color;
      renderColorSwatches();
    });

    document.getElementById('project-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('project-name-input').value.trim();
      const description = document.getElementById('project-desc-input').value.trim();
      if (!name) return;

      if (editingProjectId != null) {
        await DB.updateProject(editingProjectId, { name, description, color: selectedProjectColor });
      } else {
        await DB.addProject({ name, description, color: selectedProjectColor });
      }

      document.getElementById('project-modal').close();
      editingProjectId = null;
      await refresh();
    });
  }

  function deleteProjectWithConfirm(id) {
    const project = state.projects.find(p => p.id === id);
    const ticketCount = state.tickets.filter(t => t.projectId === id).length;
    showDeleteModal(
      `「${project ? escHtml(project.name) : 'このプロジェクト'}」を削除しますか？`,
      ticketCount > 0 ? `${ticketCount} 件のチケットが含まれています。削除するとチケットのプロジェクト関連付けが解除されます。` : null,
      async () => {
        const linked = state.tickets.filter(t => t.projectId === id);
        await Promise.all(linked.map(t => DB.update(t.id, { projectId: null })));
        await DB.deleteProject(id);
        await refresh();
      }
    );
  }

  // ===== チケットイベント =====

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
      const mob = document.getElementById('mob-filter-priority');
      if (mob) mob.value = e.target.value;
      render();
    });

    document.getElementById('filter-label').addEventListener('change', e => {
      state.filterLabel = e.target.value;
      const mob = document.getElementById('mob-filter-label');
      if (mob) mob.value = e.target.value;
      render();
    });

    document.getElementById('mob-filter-priority').addEventListener('change', e => {
      state.filterPriority = e.target.value;
      document.getElementById('filter-priority').value = e.target.value;
      render();
    });

    document.getElementById('mob-filter-label').addEventListener('change', e => {
      state.filterLabel = e.target.value;
      document.getElementById('filter-label').value = e.target.value;
      render();
    });

    document.getElementById('btn-filter-toggle').addEventListener('click', () => {
      const panel = document.getElementById('mobile-filter-panel');
      panel.classList.toggle('hidden');
    });

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
        parentId: parentIdRaw ? String(parentIdRaw) : null,
        projectId: state.currentProjectId
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
    document.getElementById('modal-delete').addEventListener('click', () => {
      if (state.editingId == null) return;
      const id = state.editingId;
      const ticket = state.tickets.find(t => t.id === id);
      const hasChildren = state.tickets.some(t => t.parentId === id);
      closeModal();
      showDeleteModal(
        `「${ticket ? escHtml(ticket.title) : 'このチケット'}」を削除しますか？`,
        hasChildren ? '子課題が存在します。削除すると子課題の親は解除されます。' : null,
        async () => {
          if (hasChildren) {
            const children = state.tickets.filter(t => t.parentId === id);
            await Promise.all(children.map(c => DB.update(c.id, { parentId: null })));
          }
          await DB.delete(id);
          await refresh();
        }
      );
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
      if (state.currentProjectId && t.projectId !== state.currentProjectId) return false;
      return getDepth(t.id, state.tickets) < 2;
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

  function deleteTicket(id) {
    const ticket = state.tickets.find(t => t.id === id);
    const hasChildren = state.tickets.some(t => t.parentId === id);
    showDeleteModal(
      `「${ticket ? escHtml(ticket.title) : 'このチケット'}」を削除しますか？`,
      hasChildren ? '子課題が存在します。削除すると子課題の親は解除されます。' : null,
      async () => {
        if (hasChildren) {
          const children = state.tickets.filter(t => t.parentId === id);
          await Promise.all(children.map(c => DB.update(c.id, { parentId: null })));
        }
        await DB.delete(id);
        await refresh();
      }
    );
  }

  function showDeleteModal(msg, sub, onConfirm) {
    document.getElementById('delete-modal-msg').textContent = msg;
    const subEl = document.getElementById('delete-modal-sub');
    if (sub) { subEl.textContent = sub; subEl.style.display = ''; }
    else { subEl.style.display = 'none'; }

    const modal = document.getElementById('delete-modal');
    const oldBtn = document.getElementById('delete-modal-confirm');
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.replaceWith(newBtn);
    newBtn.addEventListener('click', () => { modal.close(); onConfirm(); });
    document.getElementById('delete-modal-cancel').onclick = () => modal.close();
    modal.showModal();
  }

  return { init, refresh, render, openModal, deleteTicket, enterProject, backToProjects, openProjectModal };
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
