const hasFirebaseConfig = () => {
  const config = window.KANRI_FIREBASE_CONFIG;
  return Boolean(
    config &&
    config.apiKey &&
    config.authDomain &&
    config.projectId &&
    config.appId
  );
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
  id: String(project.id)
});

function createDexieStore() {
  const db = new Dexie('KanriDB');
  db.version(1).stores({ tickets: '++id, status, priority, dueDate, createdAt' });
  db.version(2).stores({ tickets: '++id, status, priority, dueDate, createdAt, parentId' });
  db.version(3).stores({
    tickets: '++id, status, priority, dueDate, createdAt, parentId, projectId',
    projects: '++id, name, createdAt'
  });

  const toDexieId = id => {
    const n = Number(id);
    return Number.isInteger(n) ? n : id;
  };

  return {
    mode: 'indexeddb',
    async getAll() {
      return (await db.tickets.toArray()).map(toAppTicket);
    },
    async add(ticket) {
      const now = new Date().toISOString();
      return await db.tickets.add({ ...toStoredTicket(ticket), createdAt: now, updatedAt: now });
    },
    async update(id, changes) {
      return await db.tickets.update(toDexieId(id), { ...toStoredTicket(changes), updatedAt: new Date().toISOString() });
    },
    async delete(id) {
      return await db.tickets.delete(toDexieId(id));
    },
    async getProjects() {
      return (await db.projects.toArray()).map(toAppProject);
    },
    async addProject(project) {
      const now = new Date().toISOString();
      return String(await db.projects.add({ ...project, createdAt: now, updatedAt: now }));
    },
    async updateProject(id, changes) {
      return await db.projects.update(toDexieId(id), { ...changes, updatedAt: new Date().toISOString() });
    },
    async deleteProject(id) {
      return await db.projects.delete(toDexieId(id));
    }
  };
}

function createFirestoreStore(userId) {
  if (!firebase.apps.length && window.KANRI_FIREBASE_CONFIG) {
    firebase.initializeApp(window.KANRI_FIREBASE_CONFIG);
  }
  const fs = firebase.firestore();
  const ticketsCol = fs.collection('tickets');
  const projectsCol = fs.collection('projects');

  const sortByCreated = arr => arr.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  return {
    mode: 'firestore',
    async getAll() {
      const snap = await ticketsCol.where('userId', '==', userId).get();
      return sortByCreated(snap.docs.map(d => toAppTicket({ id: d.id, ...d.data() })));
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
    async getProjects() {
      const snap = await projectsCol.where('userId', '==', userId).get();
      return sortByCreated(snap.docs.map(d => toAppProject({ id: d.id, ...d.data() })));
    },
    async addProject(project) {
      const now = new Date().toISOString();
      const ref = await projectsCol.add({ ...project, userId, createdAt: now, updatedAt: now });
      return ref.id;
    },
    async updateProject(id, changes) {
      return await projectsCol.doc(String(id)).update({ ...changes, updatedAt: new Date().toISOString() });
    },
    async deleteProject(id) {
      return await projectsCol.doc(String(id)).delete();
    },
    // userId なしのドキュメントを初回ログイン時に現在ユーザーへ移行
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

function initDB(userId) {
  try {
    if (userId && hasFirebaseConfig() && window.firebase && firebase.firestore) {
      DB = createFirestoreStore(userId);
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
