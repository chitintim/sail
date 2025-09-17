export class Storage {
  constructor() {
    this.dbName = 'SailNavigationDB';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('routes')) {
          const routeStore = db.createObjectStore('routes', { keyPath: 'id' });
          routeStore.createIndex('name', 'name', { unique: false });
          routeStore.createIndex('created', 'created', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('tiles')) {
          const tileStore = db.createObjectStore('tiles', { keyPath: 'url' });
          tileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveRoute(route) {
    const routeData = {
      id: route.id || Date.now().toString(),
      name: route.name || `Route ${new Date().toLocaleDateString()}`,
      waypoints: route.waypoints,
      activeWaypointIndex: route.activeWaypointIndex || 0,
      created: route.created || Date.now(),
      modified: Date.now(),
      totalDistance: route.totalDistance || 0
    };

    return this.save('routes', routeData);
  }

  async loadRoute(id) {
    return this.get('routes', id);
  }

  async getAllRoutes() {
    return this.getAll('routes');
  }

  async deleteRoute(id) {
    return this.delete('routes', id);
  }

  async saveSetting(key, value) {
    return this.save('settings', { key, value, timestamp: Date.now() });
  }

  async getSetting(key) {
    const result = await this.get('settings', key);
    return result ? result.value : null;
  }

  async getAllSettings() {
    const settings = await this.getAll('settings');
    const result = {};
    settings.forEach(setting => {
      result[setting.key] = setting.value;
    });
    return result;
  }

  async cacheTile(url, data) {
    return this.save('tiles', {
      url,
      data,
      timestamp: Date.now()
    });
  }

  async getCachedTile(url) {
    return this.get('tiles', url);
  }

  async cleanOldTiles(maxAge = 30 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    const transaction = this.db.transaction(['tiles'], 'readwrite');
    const store = transaction.objectStore('tiles');
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(cutoff);
    const request = index.openCursor(range);

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async save(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  exportRoutes() {
    return this.getAll('routes').then(routes => {
      const dataStr = JSON.stringify(routes, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `sail-routes-${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    });
  }

  async importRoutes(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const routes = JSON.parse(e.target.result);

          if (!Array.isArray(routes)) {
            throw new Error('Invalid route file format');
          }

          for (const route of routes) {
            await this.saveRoute(route);
          }

          resolve(routes.length);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}