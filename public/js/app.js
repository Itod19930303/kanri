let _currentUserId = null;
let _currentUserEmail = '';

const PROJECT_COLORS = [
  '#5624d0', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#0891b2'
];

const App = (() => {
  let state = {
    tickets: [],
    projects: [],
    pendingInvites: [],
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
  let _inviteProjectId = null;
  let _eventsBound = false;

  const VIEWS = ['dashboard', 'kanban', 'list', 'gantt'];

  // ===== 初期化 =====

  async function init() {
    // ユーザー切り替え時に状態をリセット
    state.currentProjectId = null;
    state.view = 'kanban';
    state.search = '';
    state.filterPriority = '';
    state.filterLabel = '';
    state.editingId = null;

    if (!_eventsBound) {
      _eventsBound = true;
      bindEvents();
      bindProjectEvents();
    }

    state.projects = await DB.getProjects();
    state.tickets = await DB.getAll();
    try {
      state.pendingInvites = DB.mode === 'firestore' ? await DB.getMyInvites() : [];
    } catch (e) {
      state.pendingInvites = [];
    }
    showProjectListUI();
    renderProjectList();
  }

  async function refresh() {
    state.projects = await DB.getProjects();
    state.tickets = await DB.getAll();
    if (DB.mode === 'firestore') {
      try { state.pendingInvites = await DB.getMyInvites(); } catch (e) {}
    }
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

    if (state.view === 'dashboard') renderDashboard(filtered);
    else if (state.view === 'kanban') renderKanban(filtered, state.tickets);
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
    const hasInvites = state.pendingInvites.length > 0;

    if (state.projects.length === 0 && !hasInvites) {
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
      ${hasInvites ? renderPendingInviteNotifications() : ''}
      ${state.projects.length > 0 ? `
        <div class="mb-5">
          <h2 class="text-xl font-bold" style="color:#1c1d1f">プロジェクト一覧</h2>
          <p class="text-sm mt-0.5" style="color:#6a6f73">${state.projects.length} 件のプロジェクト</p>
        </div>
        <div class="project-grid">
          ${state.projects.map(p => {
            const count = state.tickets.filter(t => t.projectId === p.id).length;
            return renderProjectCard(p, count);
          }).join('')}
        </div>
      ` : ''}`;

    container.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => enterProject(card.dataset.projectId));
    });
    container.querySelectorAll('.project-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openProjectModal(btn.dataset.id); });
    });
    container.querySelectorAll('.project-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deleteProjectWithConfirm(btn.dataset.id); });
    });
    container.querySelectorAll('.project-invite-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openInviteModal(btn.dataset.id); });
    });
    container.querySelectorAll('.btn-accept-invite').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await DB.acceptInvite(btn.dataset.inviteId, btn.dataset.projectId);
          await refresh();
        } catch (e) {
          btn.disabled = false;
        }
      });
    });
    container.querySelectorAll('.btn-decline-invite').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await DB.declineInvite(btn.dataset.inviteId);
          await refresh();
        } catch (e) {
          btn.disabled = false;
        }
      });
    });
  }

  function renderPendingInviteNotifications() {
    return `
      <div class="mb-6">
        <h2 class="text-base font-bold mb-3" style="color:#1c1d1f">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mr-1" style="color:#5624d0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          招待の通知 (${state.pendingInvites.length}件)
        </h2>
        ${state.pendingInvites.map(inv => `
          <div class="invite-notification-card">
            <div class="invite-color-dot" style="background:${escHtml(inv.projectColor || '#5624d0')}"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold" style="color:#1c1d1f">${escHtml(inv.projectName || '')}</p>
              <p class="text-xs mt-0.5" style="color:#6a6f73">${escHtml(inv.inviterEmail || '')} から招待されました</p>
            </div>
            <div class="flex gap-1 flex-shrink-0">
              <button class="btn btn-xs btn-accept-invite text-white"
                data-invite-id="${inv.id}" data-project-id="${escHtml(inv.projectId)}"
                style="background:#5624d0;border-color:#5624d0">承諾</button>
              <button class="btn btn-xs btn-decline-invite"
                data-invite-id="${inv.id}"
                style="background:#f3f0ff;border-color:#c4b5fd;color:#5624d0">辞退</button>
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  function renderProjectCard(project, ticketCount) {
    const color = project.color || PROJECT_COLORS[0];
    const isOwner = DB.mode !== 'firestore' || project.userId === _currentUserId;
    const memberCount = (project.memberIds || []).length;

    const ownerButtons = `
      <button class="project-invite-btn btn btn-ghost btn-xs" data-id="${project.id}" title="メンバー管理" onclick="event.stopPropagation()">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </button>
      <button class="project-edit-btn btn btn-ghost btn-xs" data-id="${project.id}" title="編集" onclick="event.stopPropagation()">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
      </button>
      <button class="project-delete-btn btn btn-ghost btn-xs" data-id="${project.id}" title="削除" onclick="event.stopPropagation()">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>`;

    return `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-card-color-bar" style="background:${color}"></div>
        <div class="project-card-content">
          <div class="flex items-start justify-between gap-2 mb-3">
            <h3 class="project-card-title line-clamp-2">${escHtml(project.name)}</h3>
            <div class="flex gap-1 flex-shrink-0 project-card-actions">
              ${isOwner ? ownerButtons : '<span class="project-shared-badge">共有</span>'}
            </div>
          </div>
          ${project.description ? `<p class="project-card-desc line-clamp-2">${escHtml(project.description)}</p>` : ''}
          <div class="project-card-footer">
            <div class="flex items-center gap-3">
              <span class="project-ticket-count">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 inline mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                ${ticketCount} チケット
              </span>
              ${memberCount > 0 ? `
                <span class="project-member-count">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 inline mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                  ${memberCount + 1}人
                </span>
              ` : ''}
            </div>
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
    document.getElementById('invite-modal-close').addEventListener('click', () => {
      document.getElementById('invite-modal').close();
      _inviteProjectId = null;
    });

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

  // ===== 招待モーダル =====

  async function openInviteModal(projectId) {
    _inviteProjectId = projectId;
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    document.getElementById('invite-modal-title').textContent = `メンバー管理 — ${project.name}`;
    document.getElementById('invite-modal-content').innerHTML =
      `<div class="text-center py-6"><span class="loading loading-spinner" style="color:#5624d0"></span></div>`;
    document.getElementById('invite-modal').showModal();

    await renderInviteModalContent(project);
  }

  async function renderInviteModalContent(project) {
    const contentEl = document.getElementById('invite-modal-content');
    let projectInvites = [];
    try {
      projectInvites = await DB.getProjectInvites(project.id);
    } catch (e) {
      console.warn('招待の取得に失敗:', e);
    }

    const pendingInvites = projectInvites.filter(i => i.status === 'pending');
    const members = Object.entries(project.memberDetails || {}).map(([uid, det]) => ({ uid, email: det.email || '' }));

    contentEl.innerHTML = `
      <div class="mb-4">
        <p class="invite-section-label">メンバー (${members.length + 1}人)</p>
        <div class="member-item">
          <div class="member-avatar">${(_currentUserEmail || '?').charAt(0).toUpperCase()}</div>
          <span class="text-sm flex-1 truncate" style="color:#1c1d1f">${escHtml(_currentUserEmail || '')}</span>
          <span class="invite-badge invite-badge-owner">オーナー</span>
        </div>
        ${members.map(m => `
          <div class="member-item">
            <div class="member-avatar member-avatar-member">${(m.email || '?').charAt(0).toUpperCase()}</div>
            <span class="text-sm flex-1 truncate" style="color:#1c1d1f">${escHtml(m.email)}</span>
            <button class="btn btn-ghost btn-xs text-error btn-remove-member" data-uid="${m.uid}" data-project-id="${project.id}" title="削除">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>

      ${pendingInvites.length > 0 ? `
        <div class="mb-4">
          <p class="invite-section-label">招待済み (${pendingInvites.length}件)</p>
          ${pendingInvites.map(inv => `
            <div class="member-item">
              <div class="member-avatar member-avatar-pending">${(inv.inviteeEmail || '?').charAt(0).toUpperCase()}</div>
              <span class="text-sm flex-1 truncate" style="color:#1c1d1f">${escHtml(inv.inviteeEmail)}</span>
              <span class="invite-badge invite-badge-pending mr-2">招待中</span>
              <button class="btn btn-ghost btn-xs btn-cancel-invite" data-invite-id="${inv.id}" title="キャンセル">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="border-top:1px solid #e5e0f8;padding-top:16px">
        <p class="invite-section-label">メンバーを招待</p>
        <form id="invite-send-form" class="flex gap-2">
          <input id="invite-email-input" type="email" placeholder="メールアドレスを入力"
            class="input input-bordered input-sm flex-1" required>
          <button type="submit" class="btn btn-sm text-white" style="background:#5624d0;border-color:#5624d0">招待</button>
        </form>
        <p id="invite-send-msg" class="hidden text-xs mt-2"></p>
      </div>`;

    contentEl.querySelectorAll('.btn-remove-member').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('このメンバーをプロジェクトから削除しますか？')) return;
        btn.disabled = true;
        try {
          await DB.removeMember(btn.dataset.projectId, btn.dataset.uid);
          state.projects = await DB.getProjects();
          const updated = state.projects.find(p => p.id === project.id);
          if (updated) await renderInviteModalContent(updated);
        } catch (e) {
          btn.disabled = false;
          showInviteMsg('削除に失敗しました: ' + e.message, false);
        }
      });
    });

    contentEl.querySelectorAll('.btn-cancel-invite').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await DB.cancelInvite(btn.dataset.inviteId);
          await renderInviteModalContent(project);
        } catch (e) {
          btn.disabled = false;
          showInviteMsg('キャンセルに失敗しました: ' + e.message, false);
        }
      });
    });

    document.getElementById('invite-send-form').addEventListener('submit', async e => {
      e.preventDefault();
      const emailInput = document.getElementById('invite-email-input');
      const email = emailInput.value.trim();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await DB.sendInvite(project.id, project.name, project.color, email);
        emailInput.value = '';
        showInviteMsg(`${email} に招待を送りました`, true);
        await renderInviteModalContent(project);
      } catch (err) {
        showInviteMsg('招待の送信に失敗しました: ' + err.message, false);
        submitBtn.disabled = false;
      }
    });
  }

  function showInviteMsg(msg, isSuccess) {
    const el = document.getElementById('invite-send-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isSuccess ? '#059669' : '#ef4444';
    el.classList.remove('hidden');
  }

  // ===== チケットイベント =====

  function bindEvents() {
    document.getElementById('btn-dashboard').addEventListener('click', () => setView('dashboard'));
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

  return { init, refresh, render, openModal, deleteTicket, enterProject, backToProjects, openProjectModal, openInviteModal, showProjectListUI };
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

// ===== 認証 =====

let _lastUserId = null;

function handleAuthState(user) {
  if (user) {
    (async () => {
      if (user.uid !== _lastUserId) {
        _lastUserId = user.uid;
        _currentUserId = user.uid;
        _currentUserEmail = user.email || '';
        initDB(user.uid, user.email || '');

        // 初回ログイン時: userId なし既存データを現在ユーザーへ移行
        const migKey = `kanri_migrated_${user.uid}`;
        if (!localStorage.getItem(migKey) && DB && typeof DB.migrateOrphanedData === 'function') {
          try {
            await DB.migrateOrphanedData();
          } catch (e) {
            console.warn('データ移行をスキップしました:', e.message);
          }
          localStorage.setItem(migKey, '1');
        }
      }
      updateUserUI(user);
      try {
        await App.init();
      } catch (e) {
        console.error('初期化エラー:', e);
      }
      document.getElementById('login-screen').classList.add('hidden');
    })();
  } else {
    _lastUserId = null;
    _currentUserId = null;
    _currentUserEmail = '';
    clearUserUI();
    showLoginUI();
  }
}

function showLoginUI() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-loading').classList.add('hidden');
  document.getElementById('login-form-container').classList.remove('hidden');
}

function updateUserUI(user) {
  const infoEl = document.getElementById('user-info');
  const avatarEl = document.getElementById('user-avatar');
  infoEl.classList.remove('hidden');
  infoEl.style.display = 'flex';
  if (user.photoURL) {
    avatarEl.innerHTML = `<img src="${escSrc(user.photoURL)}" class="w-full h-full object-cover" alt="">`;
  } else {
    avatarEl.textContent = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  }
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = user.displayName || user.email || '';
}

function clearUserUI() {
  const infoEl = document.getElementById('user-info');
  if (infoEl) { infoEl.classList.add('hidden'); infoEl.style.display = ''; }
}

const AUTH_ERRORS = {
  'auth/invalid-credential':    'メールアドレスまたはパスワードが間違っています',
  'auth/email-already-in-use':  'このメールアドレスは既に使用されています',
  'auth/invalid-email':         'メールアドレスの形式が正しくありません',
  'auth/weak-password':         'パスワードは6文字以上で設定してください',
  'auth/user-not-found':        'メールアドレスまたはパスワードが間違っています',
  'auth/wrong-password':        'メールアドレスまたはパスワードが間違っています',
  'auth/too-many-requests':     'ログイン試行回数が多すぎます。しばらくお待ちください',
  'auth/popup-closed-by-user':  'サインインがキャンセルされました',
  'auth/network-request-failed':'ネットワークエラーが発生しました',
};

function setLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

function escSrc(url) {
  return url.replace(/"/g, '%22');
}

function bindLoginFormEvents() {
  let isSignupMode = false;

  document.getElementById('btn-google-signin')?.addEventListener('click', async () => {
    setLoginError('');
    try {
      await Auth.signInWithGoogle();
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') setLoginError(AUTH_ERRORS[e.code] || '認証エラーが発生しました');
    }
  });

  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    setLoginError('');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-submit-btn');
    btn.disabled = true;
    try {
      if (isSignupMode) {
        await Auth.signUpWithEmail(email, password);
      } else {
        await Auth.signInWithEmail(email, password);
      }
    } catch (e) {
      setLoginError(AUTH_ERRORS[e.code] || '認証エラーが発生しました');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('login-toggle-btn')?.addEventListener('click', () => {
    isSignupMode = !isSignupMode;
    document.getElementById('login-submit-btn').textContent = isSignupMode ? '新規登録' : 'ログイン';
    document.getElementById('login-toggle-label').textContent = isSignupMode ? 'すでにアカウントをお持ちの方は' : 'アカウントをお持ちでない方は';
    document.getElementById('login-toggle-btn').textContent = isSignupMode ? 'ログイン' : '新規登録';
    setLoginError('');
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await Auth.signOut();
    App.showProjectListUI();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isAvailable()) {
    bindLoginFormEvents();
    Auth.onAuthStateChanged(handleAuthState);
  } else {
    initDB(null);
    document.getElementById('login-screen').classList.add('hidden');
    App.init();
  }
});
