import { normalize } from './commandSearch';
import { getItemErrors } from './items';

let writeChain = Promise.resolve();

export function runItemCatalogWrite(task) {
  const next = writeChain.then(task);
  writeChain = next.catch(() => {});
  return next;
}

export function willItemBeActive(doc) {
  return !doc.archived;
}

export function validateItemDocForWrite(doc, items) {
  return getItemErrors(
    {
      name: doc.name ?? '',
      description: doc.description ?? '',
      unitPrice: String(doc.unitPrice ?? ''),
      unitCode: doc.unitCode,
    },
    items,
    doc._id,
    { willBeActive: willItemBeActive(doc) }
  );
}

export function prepareItemsForRestore(incoming, current) {
  const activeByName = new Map();
  for (const item of current) {
    if (!item.archived) {
      const norm = normalize(String(item.name ?? '').trim());
      if (norm) {
        activeByName.set(norm, item._id);
      }
    }
  }

  let archivedDueToConflict = false;
  const docs = incoming.map(raw => {
    let doc = { ...raw };
    if (willItemBeActive(doc)) {
      const norm = normalize(String(doc.name ?? '').trim());
      if (norm) {
        const owner = activeByName.get(norm);
        if (owner && owner !== doc._id) {
          doc = { ...doc, archived: true };
          archivedDueToConflict = true;
        } else {
          activeByName.set(norm, doc._id);
        }
      }
    }
    return doc;
  });

  return { docs, archivedDueToConflict };
}
