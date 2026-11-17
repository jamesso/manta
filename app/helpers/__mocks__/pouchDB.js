import { vi } from 'vitest';
const contactDoc = {
  id: 'jon-snow',
  fullname: 'Jon Snow',
  email: 'jon@hbo.com',
};

const invoiceDoc = {
  id: 'jon-invoice',
  recipient: {
    fullname: 'Jon Snow',
    email: 'jon@hbo.com',
  },
  rows: [
    {
      id: 'row-dragons',
      description: 'Dragons',
      price: '100',
      quantity: '3',
    },
  ],
};

const itemDoc = {
  _id: 'item-1',
  name: 'Design',
  description: '',
  unitPrice: 80,
  unitCode: 'HUR',
  taxRateId: null,
  archived: false,
  created_at: 1,
};

const mockData = {
  contactsRecords: [contactDoc],
  invoicesRecords: [invoiceDoc],
  itemsRecords: [itemDoc],
  recurringRecords: [],
};

function resetMockPouchData() {
  mockData.contactsRecords = [{ ...contactDoc }];
  mockData.invoicesRecords = [
    {
      ...invoiceDoc,
      rows: invoiceDoc.rows.map(row => ({ ...row })),
    },
  ];
  mockData.itemsRecords = [{ ...itemDoc }];
  mockData.recurringRecords = [];
}

const getAllDocs = vi.fn(
  dbName =>
    new Promise((resolve, reject) => {
      switch (dbName) {
        case 'contacts':
          resolve(mockData.contactsRecords);
          break;
        case 'invoices':
          resolve(mockData.invoicesRecords);
          break;
        case 'items':
          resolve(mockData.itemsRecords);
          break;
        case 'recurring':
          resolve(mockData.recurringRecords);
          break;
        default:
          reject(new Error('Incorrect database!'));
      }
    })
);

function persistDoc(dbName, doc) {
  if (!dbName) return Promise.reject(new Error('No database found!'));
  if (!doc) return Promise.reject(new Error('No doc found!'));
  const key = `${dbName}Records`;
  if (!mockData[key]) return Promise.reject(new Error('Incorrect database!'));
  const id = doc._id ?? doc.id ?? crypto.randomUUID();
  const rev = `${Number.parseInt(doc._rev || '0', 10) + 1}-mock`;
  const stored = { ...doc, _id: id, _rev: rev };
  mockData[key] = mockData[key]
    .filter(d => (d._id ?? d.id) !== id)
    .concat(stored);
  return Promise.resolve({ ok: true, id, rev });
}

const saveDoc = vi.fn(persistDoc);
const updateDoc = vi.fn(persistDoc);

const getSingleDoc = vi.fn(
  (dbName, docID) =>
    new Promise((resolve, reject) => {
      !dbName && reject(new Error('No database found!'));
      !docID && reject(new Error('No docID found!'));
      dbName === 'contacts' && resolve([...mockData.contactsRecords][0]);
      dbName === 'invoices' && resolve([...mockData.invoicesRecords][0]);
      dbName === 'recurring' &&
        resolve(
          mockData.recurringRecords.find(d => d._id === docID) ??
            mockData.recurringRecords[0]
        );
    })
);

const deleteDoc = vi.fn(async (dbName, docId) => {
  const key = `${dbName}Records`;
  mockData[key] = (mockData[key] ?? []).filter(d => (d._id ?? d.id) !== docId);
  return { ok: true, id: docId };
});

const removeDocs = vi.fn((dbName, ids) => {
  const key = `${dbName}Records`;
  const idSet = new Set(ids);
  const removed = [];
  if (mockData[key]) {
    const kept = [];
    for (const doc of mockData[key]) {
      const docId = doc._id ?? doc.id;
      if (idSet.has(docId)) {
        const { _rev, ...snapshot } = doc;
        removed.push({ ...snapshot, _id: docId });
      } else {
        kept.push(doc);
      }
    }
    mockData[key] = kept;
  }
  return Promise.resolve({
    removed,
    failed: [],
    succeeded: removed.map(doc => doc._id),
  });
});

const restoreDocs = vi.fn((dbName, docs) => {
  const key = `${dbName}Records`;
  if (mockData[key]) {
    const byId = new Map(mockData[key].map(doc => [doc._id ?? doc.id, doc]));
    for (const doc of docs) {
      byId.set(doc._id, { ...doc });
    }
    mockData[key] = [...byId.values()];
  }
  return Promise.resolve({ succeeded: docs.map(doc => doc._id), failed: [] });
});

const updateDocs = vi.fn(async (dbName, docs) => {
  for (const doc of docs) await persistDoc(dbName, doc);
  return { succeeded: docs.map(doc => doc._id), failed: [] };
});

const bulkSaveDocs = vi.fn(async (dbName, docs) => {
  for (const doc of docs) await persistDoc(dbName, doc);
  return { succeeded: docs.map(doc => doc._id), failed: [] };
});

export {
  getAllDocs,
  getSingleDoc,
  saveDoc,
  updateDoc,
  deleteDoc,
  removeDocs,
  restoreDocs,
  updateDocs,
  bulkSaveDocs,
  mockData,
  resetMockPouchData,
};
