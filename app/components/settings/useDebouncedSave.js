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

export function useDebouncedSave(value, save, delay = 500) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const storedRef = useRef(value);
  storedRef.current = value;
  const baselineRef = useRef(cloneDeep(value));
  const draftRef = useRef(cloneDeep(value));
  const dirtyRef = useRef(false);
  const [draft, setDraftState] = useState(() => cloneDeep(value));

  useEffect(() => {
    if (!dirtyRef.current) {
      baselineRef.current = cloneDeep(value);
      draftRef.current = cloneDeep(value);
      setDraftState(cloneDeep(value));
    }
  }, [value]);

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
    baselineRef.current = cloneDeep(next);
    draftRef.current = cloneDeep(next);
    setDraftState(cloneDeep(next));
    dirtyRef.current = false;
    return { ok: true };
  }, []);

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
    async nextDraft => {
      debouncedRef.current.cancel();
      dirtyRef.current = true;
      draftRef.current = cloneDeep(nextDraft);
      setDraftState(cloneDeep(nextDraft));
      await runFlush();
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
