// Setup PouchDB
import PouchDB from 'pouchdb-browser';
import { omit } from 'lodash';

// Keep the 'idb' adapter: existing user data was written by it.
// The newer 'indexeddb' adapter cannot read these databases.
const contactsDB = new PouchDB('contacts', { adapter: 'idb' });
const invoicesDB = new PouchDB('invoices', { adapter: 'idb' });

// TEMP (plan 007): expose DBs for count checks. Removed in Step 6.
if (localStorage.getItem('manta.debugDb') === '1') {
  window.__mantaDb = { contactsDB, invoicesDB };
}

// Utility

// Handle Data Migration
async function runMigration(db, version, migrations, done) {
  try {
    // Check if there's any migration to run
    const migrationsToRun = Object.keys(migrations)
      .filter(k => k > version)
      .sort();
    if (!migrationsToRun.length) {
      return done();
    }
    // If there is any migration to run
    // Get all current docs
    const results = await db.allDocs({
      include_docs: true,
      attachments: true,
    });
    // Run each doc through migrations
    const resultsDocs = results.rows
      .map(row => row.doc)
      .map(doc =>
        migrationsToRun.reduce((prev, k) => migrations[k](prev), doc)
      );
    // Save new docs to DB
    await Promise.all(resultsDocs.map(doc => db.put(doc)));
    // Finish & update values
    done(null, migrationsToRun[migrationsToRun.length - 1]);
  } catch (err) {
    done(err);
  }
}

// Run migration for InvoicesDB
let invoiceQueue = [];
let alreadyRunInvoiceMigration = false;
const invoicesVersion = localStorage.invoicesVersion || 0;

const invoicesMigrations = {
  1: doc => {
    // Don't touch newly created docs
    if (doc.status) return doc;
    // Update current doc
    const newDoc = Object.assign({}, doc, {
      // Set default status as 'pending'
      status: 'pending',
      // Update Tax information
      tax: {
        tin: '123-456-789',
        method: 'default',
        // Get the tax amount from 'vat' key
        amount: doc.vat,
      },
    });
    // Omit the 'vat' key
    return omit(newDoc, ['vat']);
  },

  2: doc => {
    // Update current doc currency setting
    const newDoc = Object.assign({}, doc, {
      currency: {
        code: doc.currency.code,
        placement: 'before',
        separator: 'commaDot',
        fraction: 2,
      },
    });
    return newDoc;
  },

  3: doc => {
    if (!doc.dueDate) {
      return doc;
    }
    return Object.assign({}, doc, {
      dueDate: {
        selectedDate: doc.dueDate,
        useCustom: true,
      },
    });
  },

  4: doc => {
    if (!doc.configs) return doc;
    const { configs } = doc;
    const { accentColor } = configs;
    const migratedConfigs = Object.assign({}, configs, {
      accentColor: accentColor.color,
      customAccentColor: accentColor.useCustom,
    });
    return Object.assign({}, doc, {
      configs: migratedConfigs
    });
  },
};

runMigration(
  invoicesDB,
  invoicesVersion,
  invoicesMigrations,
  (err, latestVersion) => {
    alreadyRunInvoiceMigration = true;
    if (latestVersion) {
      localStorage.invoicesVersion = latestVersion;
    }
    // Pass the err to invoiceQueue function
    invoiceQueue.forEach(f => f(err));
    // Reset the invoiceQueue
    invoiceQueue = [];
  }
);

// Set DB via dbName
const setDB = dbName =>
  new Promise((resolve, reject) => {
    if (dbName === 'contacts') {
      resolve(contactsDB);
    }
    if (dbName === 'invoices') {
      if (alreadyRunInvoiceMigration) {
        resolve(invoicesDB);
      }
      // Wait for runInvoiceMigration() to return a value
      invoiceQueue.push(err => {
        if (err) return reject(err);
        resolve(invoicesDB);
      });
    }
  });

// Get All Document
const getAllDocs = dbName =>
  new Promise((resolve, reject) => {
    setDB(dbName)
      .then(db =>
        db.allDocs({
          include_docs: true,
          attachments: true,
        })
      )
      .then(results => {
        const resultsDocs = results.rows.map(row => row.doc);
        resolve(resultsDocs);
      })
      .catch(err => reject(err));
  });

// Get a Single Document
const getSingleDoc = (dbName, docID) =>
  new Promise((resolve, reject) => {
    setDB(dbName)
      .then(db => db.get(docID))
      .then(result => {
        resolve(result);
      })
      .catch(err => reject(err));
  });

// Save a Document
const saveDoc = (dbName, doc) =>
  setDB(dbName)
    .then(db => db.put(doc))
    .then(() => getAllDocs(dbName));

// Delete A Document
const deleteDoc = (dbName, doc) =>
  setDB(dbName)
    .then(db => db.get(doc).then(record => db.remove(record)))
    .then(() => getAllDocs(dbName));

// Update A Document
const updateDoc = (dbName, updatedDoc) =>
  setDB(dbName)
    .then(db => db.put(updatedDoc))
    .then(() => getAllDocs(dbName));

export { getAllDocs, getSingleDoc, deleteDoc, saveDoc, updateDoc };
