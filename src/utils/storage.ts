/**
 * Cross-browser storage utilities.
 *
 * Firefox MV2 `chrome.storage.local.get()` only supports callbacks (returns void).
 * Chrome MV3 `chrome.storage.local.get()` returns a Promise.
 * This wrapper normalizes both to always return a Promise.
 */

export function storageGet(keys: string | string[]): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result || {});
    });
  });
}

export function storageSet(items: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => {
      resolve();
    });
  });
}

export function storageRemove(keys: string | string[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => {
      resolve();
    });
  });
}
