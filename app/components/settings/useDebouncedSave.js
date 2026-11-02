import { cloneDeep, debounce, get, isEqual, set } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

function collectLeafPaths(base, draft, prefix = '') {
  if (isEqual(base, draft)) {
    return [];
  }
  const baseObj = base && typeof base === 'object';
  const draftObj = draft && typeof draft === 'object';
  if (!baseObj || !draftObj || Array.isArray(base) || Array.isArray(draft)) {
    return prefix ? [prefix] : [];
  }
  const keys = new Set([...Object.keys(base), ...Object.keys(draft)]);
  const paths = [];
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(...collectLeafPaths(base[key], draft[key], path));
  }
  return paths;
}

function mergePaths(stored, draft, paths) {
  const next = cloneDeep(stored);
  for (const path of paths) {
    set(next, path, get(draft, path));
  }
  return next;
}

function persistedFromSaveResult(sent, result) {
  if (result?.data != null && typeof result.data === 'object') {
    return cloneDeep(result.data);
  }
  return cloneDeep(sent);
}

export function useDebouncedSave(value, save, delay = 500) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const storedRef = useRef(value);
  storedRef.current = value;
  const baselineRef = useRef(cloneDeep(value));
  const draftRef = useRef(cloneDeep(value));
  const dirtyRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const [draft, setDraftState] = useState(() => cloneDeep(value));

  useEffect(() => {
    if (!dirtyRef.current) {
      baselineRef.current = cloneDeep(value);
      draftRef.current = cloneDeep(value);
      storedRef.current = value;
      setDraftState(cloneDeep(value));
    }
  }, [value]);

  const adoptPersisted = useCallback(persisted => {
    storedRef.current = cloneDeep(persisted);
    baselineRef.current = cloneDeep(persisted);
    draftRef.current = cloneDeep(persisted);
    setDraftState(cloneDeep(persisted));
    dirtyRef.current = false;
  }, []);

  const runFlush = useCallback(async () => {
    if (!dirtyRef.current) {
      return { ok: true };
    }
    const paths = collectLeafPaths(baselineRef.current, draftRef.current);
    if (!paths.length) {
      dirtyRef.current = false;
      return { ok: true };
    }
    const next = mergePaths(storedRef.current, draftRef.current, paths);
    const result = await saveRef.current(next);
    if (result?.ok === false) {
      return result;
    }
    const persisted = persistedFromSaveResult(next, result);
    adoptPersisted(persisted);
    return { ok: true, data: persisted };
  }, [adoptPersisted]);

  const debouncedRef = useRef(null);
  if (!debouncedRef.current) {
    debouncedRef.current = debounce(() => {
      runFlush();
    }, delay);
  }

  const setDraft = useCallback(updater => {
    dirtyRef.current = true;
    setDraftState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      draftRef.current = cloneDeep(next);
      debouncedRef.current();
      return next;
    });
  }, []);

  const saveNow = useCallback(
    async updater => {
      debouncedRef.current.cancel();
      const run = async () => {
        dirtyRef.current = true;
        const nextDraft =
          typeof updater === 'function'
            ? updater(cloneDeep(draftRef.current))
            : updater;
        draftRef.current = cloneDeep(nextDraft);
        setDraftState(cloneDeep(nextDraft));
        return runFlush();
      };
      const chained = saveQueueRef.current.then(run, run);
      saveQueueRef.current = chained.then(
        () => undefined,
        () => undefined
      );
      return chained;
    },
    [runFlush]
  );

  const flush = useCallback(async () => {
    debouncedRef.current.flush();
    return runFlush();
  }, [runFlush]);

  const onBlur = useCallback(() => {
    debouncedRef.current.flush();
  }, []);

  useEffect(
    () => () => {
      debouncedRef.current.flush();
      debouncedRef.current.cancel();
    },
    []
  );

  return { draft, setDraft, saveNow, flush, onBlur };
}
