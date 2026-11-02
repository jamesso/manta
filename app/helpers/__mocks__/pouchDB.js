import { vi } from 'vitest';
import { faker } from '@faker-js/faker';
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
        default:
          reject(new Error('Incorrect database!'));
      }
    })
);

const saveDoc = vi.fn(
  (dbName, doc) =>
    new Promise((resolve, reject) => {
      !dbName && reject(new Error('No database found!'));
      !doc && reject(new Error('No doc found!'));
      dbName === 'contacts' && resolve([...mockData.contactsRecords, doc]);
      dbName === 'invoices' && resolve([...mockData.invoicesRecords, doc]);
      dbName === 'items' && resolve([...mockData.itemsRecords, doc]);
    })
);

const updateDoc = vi.fn(
  (dbName, doc) =>
    new Promise((resolve, reject) => {
      !dbName && reject(new Error('No database found!'));
      !doc && reject(new Error('No doc found!'));
      dbName === 'contacts' && resolve([...mockData.contactsRecords]);
      dbName === 'invoices' && resolve([...mockData.invoicesRecords]);
      dbName === 'items' && resolve([...mockData.itemsRecords]);
    })
);

const getSingleDoc = vi.fn(
  (dbName, docID) =>
    new Promise((resolve, reject) => {
      !dbName && reject(new Error('No database found!'));
      !docID && reject(new Error('No docID found!'));
      dbName === 'contacts' && resolve([...mockData.contactsRecords][0]);
      dbName === 'invoices' && resolve([...mockData.invoicesRecords][0]);
    })
);

const deleteDoc = vi.fn(
  (dbName, docId) =>
    new Promise((resolve, reject) => {
      !dbName && reject(new Error('No database found!'));
      !docId && reject(new Error('No docID found!'));
      if (dbName === 'contacts') {
        docId == contactDoc.id
          ? resolve([])
          : reject(new Error('No contact found!'));
      }
      if (dbName === 'invoices') {
        docId == invoiceDoc.id
          ? resolve([])
          : reject(new Error('No invoice found!'));
      }
    })
);

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
    docs: mockData[key] ?? [],
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
  return Promise.resolve(mockData[key] ?? []);
});

const updateDocs = vi.fn(() => Promise.resolve(mockData.invoicesRecords));

const bulkSaveDocs = vi.fn(() =>
  Promise.resolve({ succeeded: [], failed: [], allDocs: [] })
);

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
