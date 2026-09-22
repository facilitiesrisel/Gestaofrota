import { Multa, Veiculo, Motorista, CodigoMulta } from '../types';

const DB_NAME = 'RiselMultasDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export const getDB = (): Promise<IDBDatabase> => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB não disponível no ambiente"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        try {
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
        } catch (e) {
          console.warn("Aviso no upgrade de IndexedDB:", e);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn("Aviso ao abrir IndexedDB:", request.error);
        dbPromise = null;
        reject(request.error);
      };
      request.onblocked = () => {
        console.warn("Aviso: Conexão IndexedDB bloqueada por outra aba");
        dbPromise = null;
        reject(new Error("IndexedDB bloqueado"));
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
};

export const idbGetAll = async <T>(storeName: string): Promise<T[]> => {
  try {
    const db = await getDB();
    return await new Promise<T[]>((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (e) {
    console.warn(`Aviso ao ler de IndexedDB (${storeName}):`, e);
    return [];
  }
};

export const idbPut = async <T>(storeName: string, item: T): Promise<void> => {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (e) {
    console.warn(`Aviso ao gravar no IndexedDB (${storeName}):`, e);
  }
};

export const idbDelete = async (storeName: string, key: string): Promise<void> => {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (e) {
    console.warn(`Aviso ao remover do IndexedDB (${storeName}):`, e);
  }
};

export const idbBulkPut = async <T>(storeName: string, items: T[]): Promise<void> => {
  try {
    if (!items || items.length === 0) return;
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        items.forEach(item => {
          try {
            store.put(item);
          } catch (itemErr) {
            console.warn(`Aviso ao gravar item individual no store ${storeName}:`, itemErr);
          }
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Transação abortada"));
      } catch (err) {
        reject(err);
      }
    });
  } catch (e) {
    console.warn(`Aviso ao gravar em lote no IndexedDB (${storeName}):`, e);
  }
};
