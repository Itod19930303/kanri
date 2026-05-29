const db = new Dexie('KanriDB');

db.version(1).stores({
  tickets: '++id, status, priority, dueDate, createdAt'
});

db.version(2).stores({
  tickets: '++id, status, priority, dueDate, createdAt, parentId'
});

const DB = {
  async getAll() {
    return await db.tickets.toArray();
  },

  async add(ticket) {
    const now = new Date();
    return await db.tickets.add({
      ...ticket,
      labels: ticket.labels || [],
      parentId: ticket.parentId || null,
      createdAt: now,
      updatedAt: now
    });
  },

  async update(id, changes) {
    return await db.tickets.update(id, { ...changes, updatedAt: new Date() });
  },

  async delete(id) {
    return await db.tickets.delete(id);
  }
};
