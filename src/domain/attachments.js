import { deleteServerAttachment, getServerAttachment, isServerStorageEnabled, saveServerAttachment } from "./server-storage.js";

const DATABASE_NAME = "checklist-attachments-v1";
const STORE_NAME = "images";
const DATABASE_VERSION = 1;

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("เบราว์เซอร์นี้ไม่รองรับพื้นที่เก็บรูปภาพในเครื่อง"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("เปิดพื้นที่เก็บรูปภาพไม่สำเร็จ"));
  });
}

function runTransaction(mode, action) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request;
    try {
      request = action(store);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("จัดการรูปภาพไม่สำเร็จ"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error("บันทึกรูปภาพไม่สำเร็จ"));
  }));
}

export function saveStoredAttachment(id, file, options = {}) {
  if (isServerStorageEnabled()) return saveServerAttachment(id, file, options).then(() => undefined);
  return runTransaction("readwrite", (store) => store.put(file, id)).then(() => undefined);
}

export function getStoredAttachment(id) {
  if (!id) return Promise.resolve(null);
  if (isServerStorageEnabled()) return getServerAttachment(id);
  return runTransaction("readonly", (store) => store.get(id));
}

export function getStoredAttachments(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map((id) => String(id)))];
  return Promise.all(uniqueIds.map((id) => getStoredAttachment(id).then((blob) => ({ id, blob }))));
}

export function getAllStoredAttachments() {
  if (isServerStorageEnabled()) return Promise.resolve([]);
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const keysRequest = store.getAllKeys();
    const valuesRequest = store.getAll();
    let keys = null;
    let values = null;
    const finish = () => {
      if (!keys || !values) return;
      resolve(keys.map((key, index) => ({ id: String(key), blob: values[index] || null })));
    };
    keysRequest.onsuccess = () => { keys = keysRequest.result || []; finish(); };
    valuesRequest.onsuccess = () => { values = valuesRequest.result || []; finish(); };
    keysRequest.onerror = () => { database.close(); reject(keysRequest.error || new Error("อ่านรายการไฟล์แนบไม่สำเร็จ")); };
    valuesRequest.onerror = () => { database.close(); reject(valuesRequest.error || new Error("อ่านไฟล์แนบไม่สำเร็จ")); };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("อ่านพื้นที่เก็บไฟล์แนบไม่สำเร็จ")); };
  }));
}

export function deleteStoredAttachment(id) {
  if (!id) return Promise.resolve();
  if (isServerStorageEnabled()) return deleteServerAttachment(id);
  return runTransaction("readwrite", (store) => store.delete(id)).then(() => undefined);
}

export function deleteStoredAttachments(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  return Promise.all(uniqueIds.map((id) => deleteStoredAttachment(id)));
}
