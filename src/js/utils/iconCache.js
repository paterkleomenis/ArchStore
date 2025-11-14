/**
 * Icon Cache Utility
 * Handles caching of app icons with localStorage and IndexedDB
 */

const CACHE_PREFIX = 'archstore_icon_';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
const CDN_PROXY = 'https://images.weserv.nl/?url=';

// IndexedDB setup for binary data storage
let db = null;

async function initDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ArchStoreIcons', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('icons')) {
        const store = db.createObjectStore('icons', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Store icon in IndexedDB
async function storeIconInDB(iconId, blob, url) {
  try {
    await initDB();
    const transaction = db.transaction(['icons'], 'readwrite');
    const store = transaction.objectStore('icons');

    await store.put({
      id: iconId,
      blob: blob,
      url: url,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('[IconCache] Failed to store in IndexedDB:', err);
  }
}

// Get icon from IndexedDB
async function getIconFromDB(iconId) {
  try {
    await initDB();
    const transaction = db.transaction(['icons'], 'readonly');
    const store = transaction.objectStore('icons');

    return new Promise((resolve, reject) => {
      const request = store.get(iconId);
      request.onsuccess = () => {
        const result = request.result;
        if (result && Date.now() - result.timestamp < CACHE_EXPIRY) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// Clean old cache entries
async function cleanOldCache() {
  try {
    await initDB();
    const transaction = db.transaction(['icons'], 'readwrite');
    const store = transaction.objectStore('icons');
    const index = store.index('timestamp');
    const cutoffTime = Date.now() - CACHE_EXPIRY;

    const request = index.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.timestamp < cutoffTime) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (err) {
    console.warn('[IconCache] Failed to clean cache:', err);
  }
}

// Generate cache key for icon
function getCacheKey(appName) {
  return `${CACHE_PREFIX}${appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

// Fetch icon with CDN proxy fallback
async function fetchIcon(url, useCDN = false) {
  try {
    const fetchUrl = useCDN ? `${CDN_PROXY}${encodeURIComponent(url)}` : url;
    const response = await fetch(fetchUrl, {
      mode: 'cors',
      cache: 'force-cache'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.blob();
  } catch (err) {
    // Try with CDN proxy if direct fetch failed
    if (!useCDN) {
      console.log('[IconCache] Direct fetch failed, trying CDN proxy');
      return await fetchIcon(url, true);
    }
    throw err;
  }
}

// Get cached icon or fetch if needed
export async function getCachedIcon(appName, iconUrl) {
  const cacheKey = getCacheKey(appName);

  // Check IndexedDB first
  try {
    const cached = await getIconFromDB(cacheKey);
    if (cached && cached.blob) {
      return URL.createObjectURL(cached.blob);
    }
  } catch (err) {
    console.warn('[IconCache] Error reading from IndexedDB:', err);
  }

  // Check localStorage for metadata (faster than IndexedDB)
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const { dataUrl, timestamp } = JSON.parse(cachedData);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return dataUrl;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (err) {
    console.warn('[IconCache] Error reading from localStorage:', err);
  }

  // Fetch and cache icon
  try {
    const blob = await fetchIcon(iconUrl);
    const dataUrl = URL.createObjectURL(blob);

    // Store in IndexedDB (for larger icons)
    await storeIconInDB(cacheKey, blob, iconUrl);

    // Also store in localStorage if small enough (< 100KB)
    if (blob.size < 100 * 1024) {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              dataUrl: reader.result,
              timestamp: Date.now()
            }));
          } catch (err) {
            // localStorage full, clean up old entries
            cleanOldCache();
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn('[IconCache] Failed to store in localStorage:', err);
      }
    }

    return dataUrl;
  } catch (err) {
    console.error('[IconCache] Failed to fetch icon:', err);
    return null;
  }
}

// Preload icons for faster display
export async function preloadIcons(apps) {
  const promises = apps.map(app => {
    if (app.icon) {
      return getCachedIcon(app.name, app.icon).catch(() => null);
    }
    return Promise.resolve(null);
  });

  await Promise.allSettled(promises);
}

// Clear entire icon cache
export async function clearIconCache() {
  try {
    // Clear localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });

    // Clear IndexedDB
    await initDB();
    const transaction = db.transaction(['icons'], 'readwrite');
    const store = transaction.objectStore('icons');
    await store.clear();

    console.log('[IconCache] Cache cleared successfully');
  } catch (err) {
    console.error('[IconCache] Failed to clear cache:', err);
  }
}

// Get cache statistics
export async function getCacheStats() {
  try {
    const stats = {
      localStorage: 0,
      indexedDB: 0,
      totalSize: 0
    };

    // Count localStorage entries
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        stats.localStorage++;
        const data = localStorage.getItem(key);
        stats.totalSize += data ? data.length : 0;
      }
    });

    // Count IndexedDB entries
    await initDB();
    const transaction = db.transaction(['icons'], 'readonly');
    const store = transaction.objectStore('icons');
    const countRequest = store.count();

    stats.indexedDB = await new Promise((resolve) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => resolve(0);
    });

    return stats;
  } catch (err) {
    console.error('[IconCache] Failed to get stats:', err);
    return null;
  }
}

// Initialize cache cleanup on module load
cleanOldCache().catch(() => {});
