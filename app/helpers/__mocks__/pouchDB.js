import { vi } from 'vitest';
import faker from 'faker';
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
      id: crypto.randomUUID(),
      description: 'Dragons',
      price: '100',
      quantity: '3',
    },
  ],
};

const mockData = {
  contactsRecords: [contactDoc],
  invoicesRecords: [invoiceDoc],
};

const getAllDocs = vi.fn(
  dbName =>
    new Promise((resolve, reject) => {
      switch (dbName) {
        case 'contacts':
          resolve(mockData.contactsRecords);
        case 'invoices':
          resolve(mockData.invoicesRecords);
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
    })
);

const updateDoc = vi.fn(
  (dbName, doc) =>
    new Promise((resolve, reject) => {
      !dbName && reject(new Error('No database found!'));
      !doc && reject(new Error('No doc found!'));
      dbName === 'contacts' && resolve([...mockData.contactsRecords]);
      dbName === 'invoices' && resolve([...mockData.invoicesRecords]);
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

export {
  getAllDocs,
  getSingleDoc,
  saveDoc,
  updateDoc,
  deleteDoc,
  mockData,
};
