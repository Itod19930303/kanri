const hasFirebaseConfig = () => {
  const config = window.KANRI_FIREBASE_CONFIG;
  return Boolean(config && config.apiKey && config.authDomain && config.projectId && config.appId);
};

const toAppTicket = ticket => ({
  ...ticket,
  id: String(ticket.id),
  parentId: ticket.parentId == null || ticket.parentId === '' ? null : String(ticket.parentId),
  projectId: ticket.projectId || null,
  labels: Array.isArray(ticket.labels) ? ticket.labels : []
});

const toStoredTicket = ticket => ({
  ...ticket,
  parentId: ticket.parentId == null || ticket.parentId === '' ? null : String(ticket.parentId),
  projectId: ticket.projectId || null,
  labels: Array.isArray(ticket.labels) ? ticket.labels : []
});

const toAppProject = project => ({
  ...project,
  id: String(project.id),
  memberIds: project.memberIds || [],
  memberDetails: project.memberDetails || {}
});

function createDexieStore() {
  const db = new Dexie('KanriDB');
  db.version(1).stores({ tickets: '++id, status, priority, dueDate, createdAt' });
  db.version(2).stores({ tickets: '++id, status, priority, dueDate, createdAt, parentId' });
  db.version(3).stores({
    tickets: '++id, status, priority, dueDate, createdAt, parentId, projectId',
    projects: '++id, name, createdAt'
  });

  const toDexieId = id => { const n = Number(id); return Number.isInteger(n) ? n : id; };

  return {
    mode: 'indexeddb',
    async getAll() { return (await db.tickets.toArray()).map(toAppTicket); },
    async add(ticket) {
      const now = new Date().toISOString();
      return await db.tickets.add({ ...toStoredTicket(ticket), createdAt: now, updatedAt: now });
    },
    async update(id, changes) {
      return await db.tickets.update(toDexieId(id), { ...toStoredTicket(changes), updatedAt: new Date().toISOString() });
    },
    async delete(id) { return await db.tickets.delete(toDexieId(id)); },
    async getProjects() { return (await db.projects.toArray()).map(toAppProject); },
    async addProject(project) {
      const now = new Date().toISOString();
      return String(await db.projects.add({ ...project, createdAt: now, updatedAt: now }));
    },
    async updateProject(id, changes) {
      return await db.projects.update(toDexieId(id), { ...changes, updatedAt: new Date().toISOString() });
    },
    async deleteProject(id) { return await db.projects.delete(toDexieId(id)); },
    // IndexedDB では招待機能は未対応
    async getMyInvites() { return []; },
    async sendInvite() { return null; },
    async acceptInvite() {},
    async declineInvite() {},
    async getProjectInvites() { return []; },
    async cancelInvite() {},
    async removeMember() {}
  };
}

function createFirestoreStore(userId, userEmail) {
  if (!firebase.apps.length && window.KANRI_FIREBASE_CONFIG) {
    firebase.initializeApp(window.KANRI_FIREBASE_CONFIG);
  }
  const fs = firebase.firestore();
  const ticketsCol  = fs.collection('tickets');
  const projectsCol = fs.collection('projects');
  const invitesCol  = fs.collection('invites');

  const sortByCreated = arr => arr.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  // 現在のユーザーがアクセスできるプロジェクト ID 一覧を取得
  async function getAccessibleProjectIds() {
    const [ownedSnap, memberSnap] = await Promise.all([
      projectsCol.where('userId', '==', userId).get(),
      projectsCol.where('memberIds', 'array-contains', userId).get()
    ]);
    const ids = new Set([
      ...ownedSnap.docs.map(d => d.id),
      ...memberSnap.docs.map(d => d.id)
    ]);
    return [...ids];
  }

  return {
    mode: 'firestore',

    // ===== チケット =====
    async getAll() {
      const projectIds = await getAccessibleProjectIds();
      const ticketMap = new Map();

      // 自分が作成したチケット
      const ownedSnap = await ticketsCol.where('userId', '==', userId).get();
      ownedSnap.docs.forEach(d => ticketMap.set(d.id, { id: d.id, ...d.data() }));

      // 共有プロジェクト内の他メンバーのチケット
      for (let i = 0; i < projectIds.length; i += 30) {
        const chunk = projectIds.slice(i, i + 30);
        const snap = await ticketsCol.where('projectId', 'in', chunk).get();
        snap.docs.forEach(d => ticketMap.set(d.id, { id: d.id, ...d.data() }));
      }

      return sortByCreated([...ticketMap.values()].map(toAppTicket));
    },
    async add(ticket) {
      const now = new Date().toISOString();
      const ref = await ticketsCol.add({ ...toStoredTicket(ticket), userId, createdAt: now, updatedAt: now });
      return ref.id;
    },
    async update(id, changes) {
      return await ticketsCol.doc(String(id)).update({ ...toStoredTicket(changes), updatedAt: new Date().toISOString() });
    },
    async delete(id) {
      return await ticketsCol.doc(String(id)).delete();
    },

    // ===== プロジェクト =====
    async getProjects() {
      const [ownedSnap, memberSnap] = await Promise.all([
        projectsCol.where('userId', '==', userId).get(),
        projectsCol.where('memberIds', 'array-contains', userId).get()
      ]);
      const map = new Map();
      [...ownedSnap.docs, ...memberSnap.docs].forEach(d => {
        map.set(d.id, toAppProject({ id: d.id, ...d.data() }));
      });
      return sortByCreated([...map.values()]);
    },
    async addProject(project) {
      const now = new Date().toISOString();
      const ref = await projectsCol.add({ ...project, userId, memberIds: [], memberDetails: {}, createdAt: now, updatedAt: now });
      return ref.id;
    },
    async updateProject(id, changes) {
      return await projectsCol.doc(String(id)).update({ ...changes, updatedAt: new Date().toISOString() });
    },
    async deleteProject(id) {
      return await projectsCol.doc(String(id)).delete();
    },

    // ===== 招待 =====

    // 自分宛の未対応招待を取得
    async getMyInvites() {
      if (!userEmail) return [];
      const snap = await invitesCol.where('inviteeEmail', '==', userEmail.toLowerCase()).get();
      return snap.docs
        .filter(d => d.data().status === 'pending')
        .map(d => ({ id: d.id, ...d.data() }));
    },

    // 招待を送信
    async sendInvite(projectId, projectName, projectColor, inviteeEmail) {
      const email = inviteeEmail.toLowerCase().trim();
      const now = new Date().toISOString();
      // 重複確認
      const existing = await invitesCol
        .where('projectId', '==', projectId)
        .where('inviteeEmail', '==', email)
        .where('status', '==', 'pending')
        .get();
      if (!existing.empty) return existing.docs[0].id;
      const ref = await invitesCol.add({
        projectId,
        projectName,
        projectColor: projectColor || '#5624d0',
        inviterUserId: userId,
        inviterEmail: userEmail || '',
        inviteeEmail: email,
        status: 'pending',
        createdAt: now
      });
      return ref.id;
    },

    // 招待を承諾
    async acceptInvite(inviteId, projectId) {
      const batch = fs.batch();
      batch.update(projectsCol.doc(projectId), {
        memberIds: firebase.firestore.FieldValue.arrayUnion(userId),
        [`memberDetails.${userId}`]: { email: userEmail || '' }
      });
      batch.update(invitesCol.doc(inviteId), { status: 'accepted' });
      await batch.commit();
    },

    // 招待を辞退
    async declineInvite(inviteId) {
      await invitesCol.doc(inviteId).update({ status: 'declined' });
    },

    // プロジェクトの全招待を取得（オーナー用）
    async getProjectInvites(projectId) {
      const snap = await invitesCol.where('projectId', '==', projectId).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // 招待をキャンセル（未承諾のみ）
    async cancelInvite(inviteId) {
      await invitesCol.doc(inviteId).delete();
    },

    // メンバーを削除
    async removeMember(projectId, memberUserId) {
      await projectsCol.doc(projectId).update({
        memberIds: firebase.firestore.FieldValue.arrayRemove(memberUserId),
        [`memberDetails.${memberUserId}`]: firebase.firestore.FieldValue.delete()
      });
    },

    // 既存データのユーザー移行（初回ログイン時）
    async migrateOrphanedData() {
      const [tSnap, pSnap] = await Promise.all([
        fs.collection('tickets').get(),
        fs.collection('projects').get()
      ]);
      const batch = fs.batch();
      let count = 0;
      tSnap.docs.forEach(d => {
        if (!d.data().userId) { batch.update(d.ref, { userId }); count++; }
      });
      pSnap.docs.forEach(d => {
        if (!d.data().userId) { batch.update(d.ref, { userId }); count++; }
      });
      if (count > 0) {
        await batch.commit();
        console.info(`データ移行: ${count} 件を現在のユーザーに関連付けました。`);
      }
      return count;
    }
  };
}

let DB = null;

function initDB(userId, userEmail) {
  try {
    if (userId && hasFirebaseConfig() && window.firebase && firebase.firestore) {
      DB = createFirestoreStore(userId, userEmail || '');
      console.info('Kanri DB: Firestoreを使用します。');
    } else {
      DB = createDexieStore();
      console.info('Kanri DB: IndexedDBを使用します。');
    }
  } catch (e) {
    console.error('DB初期化失敗。IndexedDBへ切り替えます。', e);
    DB = createDexieStore();
  }
}
