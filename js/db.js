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
  labels: Array.isArray(ticket.labels) ? ticket.labels : []
});

const toStoredTicket = ticket => ({
  ...ticket,
  parentId: ticket.parentId == null || ticket.parentId === '' ? null : String(ticket.parentId),
  labels: Array.isArray(ticket.labels) ? ticket.labels : []
});

function createDexieStore() {
  const db = new Dexie('KanriDB');
  db.version(1).stores({
    tickets: '++id, status, priority, dueDate, createdAt'
  });
  db.version(2).stores({
    tickets: '++id, status, priority, dueDate, createdAt, parentId'
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
    }
  };
}

function createFirestoreStore() {
  if (!firebase.apps.length) {
    firebase.initializeApp(window.KANRI_FIREBASE_CONFIG);
  }

  const firestore = firebase.firestore();
  const collection = firestore.collection('tickets');

  return {
    mode: 'firestore',
    async getAll() {
      const snapshot = await collection.orderBy('createdAt', 'asc').get();
      return snapshot.docs.map(doc => toAppTicket({ id: doc.id, ...doc.data() }));
    },
    async add(ticket) {
      const now = new Date().toISOString();
      const docRef = await collection.add({
        ...toStoredTicket(ticket),
        createdAt: now,
        updatedAt: now
      });
      return docRef.id;
    },
    async update(id, changes) {
      return await collection.doc(String(id)).update({
        ...toStoredTicket(changes),
        updatedAt: new Date().toISOString()
      });
    },
    async delete(id) {
      return await collection.doc(String(id)).delete();
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
