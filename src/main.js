import { GPSTracker } from './core/gps.js';
import { Navigation } from './core/navigation.js';
import { MapController } from './core/map.js';
import { Storage } from './data/storage.js';

class SailNavApp {
  constructor() {
    this.gps = new GPSTracker();
    this.navigation = new Navigation();
    this.map = new MapController('map');
    this.storage = new Storage();
    this.isAddingWaypoint = false;
    this.currentPosition = null;
  }

  async init() {
    await this.storage.init();
    await this.loadSettings();

    this.map.init();

    this.setupEventListeners();

    // Request GPS permission on user interaction for iOS
    this.setupGPSPermission();
  }

  setupEventListeners() {
    document.getElementById('menu-btn').addEventListener('click', () => {
      document.getElementById('menu-panel').classList.remove('hidden');
    });

    document.getElementById('close-menu').addEventListener('click', () => {
      document.getElementById('menu-panel').classList.add('hidden');
    });

    document.getElementById('waypoint-btn').addEventListener('click', () => {
      this.toggleWaypointMode();
    });

    document.getElementById('center-btn').addEventListener('click', () => {
      if (this.currentPosition) {
        this.map.centerOnPosition(this.currentPosition.lat, this.currentPosition.lon);
        this.map.setCenterOnBoat(true);
      }
    });

    document.getElementById('new-route').addEventListener('click', () => {
      this.newRoute();
    });

    document.getElementById('save-route').addEventListener('click', () => {
      this.saveRoute();
    });

    document.getElementById('load-route').addEventListener('click', () => {
      this.loadRouteDialog();
    });

    document.getElementById('clear-route').addEventListener('click', () => {
      this.clearRoute();
    });

    document.getElementById('night-mode').addEventListener('change', (e) => {
      this.setNightMode(e.target.checked);
    });

    document.getElementById('track-up').addEventListener('change', (e) => {
      this.map.setTrackUp(e.target.checked);
    });

    this.map.onMapClick((lat, lon) => {
      if (this.isAddingWaypoint) {
        this.addWaypoint(lat, lon);
        this.toggleWaypointMode();
      }
    });

    this.map.getMap().on('movestart', () => {
      this.map.setCenterOnBoat(false);
    });
  }

  setupGPSPermission() {
    // Check if geolocation is available
    if (!('geolocation' in navigator)) {
      this.showGPSError('GPS not supported on this device');
      return;
    }

    // Update loading screen to show GPS permission request
    const loadingEl = document.getElementById('loading');
    loadingEl.innerHTML = `
      <div class="loading-content">
        <h2>Enable GPS</h2>
        <p>To use navigation features, please allow location access</p>
        <button id="enable-gps" class="action-btn primary" style="width: auto; padding: 12px 24px; margin-top: 20px;">
          Enable GPS
        </button>
        <p style="margin-top: 20px; font-size: 12px; color: var(--text-secondary);">
          iOS: Settings > Safari > Location > Allow
        </p>
      </div>
    `;

    document.getElementById('enable-gps').addEventListener('click', () => {
      this.requestGPSPermission();
    });
  }

  requestGPSPermission() {
    const loadingEl = document.getElementById('loading');
    loadingEl.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Requesting GPS permission...</p>
    `;

    // Request permission and get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('GPS permission granted');
        this.setupGPS();
        this.hideLoading();
        // Center map on current position
        this.map.centerOnPosition(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('GPS permission denied:', error);
        this.showGPSError(error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  showGPSError(message) {
    const loadingEl = document.getElementById('loading');
    loadingEl.innerHTML = `
      <div class="loading-content">
        <h2>GPS Error</h2>
        <p style="color: var(--danger);">${message}</p>
        <button id="retry-gps" class="action-btn primary" style="width: auto; padding: 12px 24px; margin-top: 20px;">
          Retry
        </button>
        <button id="continue-without-gps" class="action-btn" style="width: auto; padding: 12px 24px; margin-top: 10px;">
          Continue Without GPS
        </button>
      </div>
    `;

    document.getElementById('retry-gps')?.addEventListener('click', () => {
      this.requestGPSPermission();
    });

    document.getElementById('continue-without-gps')?.addEventListener('click', () => {
      this.hideLoading();
      // Set a default position (San Francisco Bay)
      this.map.centerOnPosition(37.8095, -122.4095);
    });
  }

  setupGPS() {
    this.gps.onUpdate((data) => {
      if (data.error) {
        console.error('GPS Error:', data.error);
        return;
      }

      this.currentPosition = data.position;
      this.currentPosition.sog = data.sog;
      this.currentPosition.cog = data.cog;

      this.updateDisplay(data);

      if (data.position) {
        this.map.updateBoatPosition(
          data.position.lat,
          data.position.lon,
          data.cog
        );

        if (data.track && data.track.length > 1) {
          this.map.updateTrackLine(data.track);
        }

        const navData = this.navigation.calculateNavigationData(this.currentPosition);
        if (navData) {
          this.updateWaypointInfo(navData);
        }
      }
    });

    this.gps.start();
  }

  updateDisplay(data) {
    document.getElementById('sog').textContent = data.sog.toFixed(1);
    document.getElementById('cog').textContent = data.cog.toString().padStart(3, '0');

    if (data.vmg !== undefined) {
      document.getElementById('vmg').textContent = data.vmg.toFixed(1);
    }
  }

  updateWaypointInfo(navData) {
    document.getElementById('waypoint-info').classList.remove('hidden');
    document.getElementById('wpt-name').textContent = navData.waypoint.name;
    document.getElementById('dtw').textContent = navData.dtw.toFixed(1);
    document.getElementById('brg').textContent = navData.brg.toString().padStart(3, '0');
    document.getElementById('eta').textContent = navData.eta;
    document.getElementById('vmg').textContent = navData.vmg.toFixed(1);
  }

  toggleWaypointMode() {
    this.isAddingWaypoint = !this.isAddingWaypoint;
    const btn = document.getElementById('waypoint-btn');

    if (this.isAddingWaypoint) {
      btn.style.background = '#ef4444';
      document.body.style.cursor = 'crosshair';

      // Show instruction banner
      const banner = document.createElement('div');
      banner.id = 'waypoint-banner';
      banner.className = 'waypoint-banner';
      banner.innerHTML = 'Tap on the map to add a waypoint';
      document.getElementById('app').appendChild(banner);
    } else {
      btn.style.background = '';
      document.body.style.cursor = '';

      // Remove instruction banner
      const banner = document.getElementById('waypoint-banner');
      if (banner) {
        banner.remove();
      }
    }
  }

  addWaypoint(lat, lon) {
    const waypoint = this.navigation.addWaypoint(lat, lon);
    this.map.addWaypoint(waypoint);

    if (this.navigation.waypoints.length === 1) {
      this.navigation.setActiveWaypoint(0);
    }
  }

  newRoute() {
    if (this.navigation.waypoints.length > 0) {
      if (!confirm('Clear current route and start new?')) {
        return;
      }
    }
    this.clearRoute();
    document.getElementById('menu-panel').classList.add('hidden');
  }

  async saveRoute() {
    const name = prompt('Route name:', `Route ${new Date().toLocaleDateString()}`);
    if (!name) return;

    const route = this.navigation.getRoute();
    route.name = name;
    route.totalDistance = this.navigation.getTotalDistance();

    await this.storage.saveRoute(route);
    alert('Route saved successfully');
    document.getElementById('menu-panel').classList.add('hidden');
  }

  async loadRouteDialog() {
    const routes = await this.storage.getAllRoutes();

    if (routes.length === 0) {
      alert('No saved routes');
      return;
    }

    const routeList = routes.map(r =>
      `${r.name} (${r.waypoints.length} waypoints, ${r.totalDistance || 0} nm)`
    ).join('\n');

    const selection = prompt(`Select route:\n${routeList}\n\nEnter route name:`);

    if (selection) {
      const route = routes.find(r => r.name === selection);
      if (route) {
        this.loadRoute(route);
      }
    }

    document.getElementById('menu-panel').classList.add('hidden');
  }

  loadRoute(route) {
    this.clearRoute();
    this.navigation.loadRoute(route);

    route.waypoints.forEach(wp => {
      this.map.addWaypoint(wp);
    });
  }

  clearRoute() {
    this.navigation.clearRoute();
    this.map.clearRoute();
    document.getElementById('waypoint-info').classList.add('hidden');
  }

  setNightMode(enabled) {
    document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
    this.storage.saveSetting('nightMode', enabled);
  }

  async loadSettings() {
    const settings = await this.storage.getAllSettings();

    if (settings.nightMode) {
      document.getElementById('night-mode').checked = true;
      this.setNightMode(true);
    }

    if (settings.trackUp) {
      document.getElementById('track-up').checked = true;
      this.map.setTrackUp(true);
    }
  }

  hideLoading() {
    document.getElementById('loading').classList.add('hidden');
  }
}

const app = new SailNavApp();
app.init().catch(console.error);

// Service worker registration disabled for development
// if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js').catch(console.error);
//   });
// }