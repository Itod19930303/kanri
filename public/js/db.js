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
  db.version(1).stores({
    tickets: '++id, status, priority, dueDate, createdAt'
  });
  db.version(2).stores({
    tickets: '++id, status, priority, dueDate, createdAt, parentId'
  });
  db.version(3).stores({
    tickets: '++id, status, priority, dueDate, createdAt, parentId, projectId',
    projects: '++id, name, createdAt'
  });

  const toDexieId = id => {
    const numericId = Number(id);
    return Number.isInteger(numericId) ? numericId : id;
  };

  return {
    mode: 'indexeddb',
    async getAll() {
      const tickets = await db.tickets.toArray();
      return tickets.map(toAppTicket);
    },
    async add(ticket) {
      const now = new Date().toISOString();
      return await db.tickets.add({
        ...toStoredTicket(ticket),
        createdAt: now,
        updatedAt: now
      });
    },
    async update(id, changes) {
      return await db.tickets.update(toDexieId(id), {
        ...toStoredTicket(changes),
        updatedAt: new Date().toISOString()
      });
    },
    async delete(id) {
      return await db.tickets.delete(toDexieId(id));
    },
    async getProjects() {
      return (await db.projects.toArray()).map(toAppProject);
    },
    async addProject(project) {
      const now = new Date().toISOString();
      const id = await db.projects.add({ ...project, createdAt: now, updatedAt: now });
      return String(id);
    },
    async updateProject(id, changes) {
      return await db.projects.update(toDexieId(id), { ...changes, updatedAt: new Date().toISOString() });
    },
    async deleteProject(id) {
      return await db.projects.delete(toDexieId(id));
    }
  };
}

function createFirestoreStore() {
  if (!firebase.apps.length) {
    firebase.initializeApp(window.KANRI_FIREBASE_CONFIG);
  }

  const firestore = firebase.firestore();
  const ticketsCol = firestore.collection('tickets');
  const projectsCol = firestore.collection('projects');

  return {
    mode: 'firestore',
    async getAll() {
      const snapshot = await ticketsCol.orderBy('createdAt', 'asc').get();
      return snapshot.docs.map(doc => toAppTicket({ id: doc.id, ...doc.data() }));
    },
    async add(ticket) {
      const now = new Date().toISOString();
      const docRef = await ticketsCol.add({
        ...toStoredTicket(ticket),
        createdAt: now,
        updatedAt: now
      });
      return docRef.id;
    },
    async update(id, changes) {
      return await ticketsCol.doc(String(id)).update({
        ...toStoredTicket(changes),
        updatedAt: new Date().toISOString()
      });
    },
    async delete(id) {
      return await ticketsCol.doc(String(id)).delete();
    },
    async getProjects() {
      const snapshot = await projectsCol.orderBy('createdAt', 'asc').get();
      return snapshot.docs.map(doc => toAppProject({ id: doc.id, ...doc.data() }));
    },
    async addProject(project) {
      const now = new Date().toISOString();
      const docRef = await projectsCol.add({ ...project, createdAt: now, updatedAt: now });
      return docRef.id;
    },
    async updateProject(id, changes) {
      return await projectsCol.doc(String(id)).update({ ...changes, updatedAt: new Date().toISOString() });
    },
    async deleteProject(id) {
      return await projectsCol.doc(String(id)).delete();
    }
  };
}

let DB;
try {
  if (hasFirebaseConfig() && window.firebase && firebase.firestore) {
    DB = createFirestoreStore();
    console.info('Kanri DB: Firestoreを使用します。');
  } else {
    DB = createDexieStore();
    console.info('Kanri DB: IndexedDBを使用します。Firestore設定が入るとクラウド保存に切り替わります。');
  }
} catch (error) {
  console.error('Kanri DB: Firestore初期化に失敗したためIndexedDBへ切り替えます。', error);
  DB = createDexieStore();
}
