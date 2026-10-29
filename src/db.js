// IndexedDB 에 ISS 좌표를 저장한다. 키는 API 타임스탬프(초)이므로 중복 응답은 덮어쓴다.
const DB_NAME = 'iss-tracker';
const STORE = 'positions';
export const RETENTION_SEC = 4 * 60 * 60;

let dbPromise;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 't' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const result = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function savePosition({ t, lat, lon }) {
  return run('readwrite', (store) => store.put({ t, lat, lon }));
}

/** 4시간보다 오래된 좌표를 삭제한다. */
export function pruneOld(nowSec = Date.now() / 1000) {
  const cutoff = nowSec - RETENTION_SEC;
  return run('readwrite', (store) => store.delete(IDBKeyRange.upperBound(cutoff, true)));
}

/** 저장된 좌표를 시간 오름차순으로 모두 읽는다. */
export function loadPositions() {
  return run('readonly', (store) => store.getAll());
}
