import { Multa, Veiculo, Motorista, CodigoMulta } from '../types';

const DB_NAME = 'RiselMultasDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export const getDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('multas')) {
        db.createObjectStore('multas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('veiculos')) {
        db.createObjectStore('veiculos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('motoristas')) {
        db.createObjectStore('motoristas', { keyPath: 'login' });
      }
      if (!db.objectStoreNames.contains('codigos')) {
        db.createObjectStore('codigos', { keyPath: 'codigo' });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error("Erro ao abrir IndexedDB:", request.error);
      reject(request.error);
    };
  });

  return dbPromise;
};

export const idbGetAll = async <T>(storeName: string): Promise<T[]> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error(`Erro ao ler de IndexedDB (${storeName}):`, e);
    return [];
  }
};

export const idbPut = async <T>(storeName: string, item: T): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error(`Erro ao gravar no IndexedDB (${storeName}):`, e);
  }
};

export const idbDelete = async (storeName: string, key: string): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error(`Erro ao remover do IndexedDB (${storeName}):`, e);
  }
};

export const idbBulkPut = async <T>(storeName: string, items: T[]): Promise<void> => {
  try {
    if (!items || items.length === 0) return;
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error(`Erro ao gravar em lote no IndexedDB (${storeName}):`, e);
  }
};
