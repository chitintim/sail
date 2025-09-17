import { GPSTracker } from './core/gps.js';
import { Navigation } from './core/navigation.js';
import { MapController } from './core/map.js';
import { Storage } from './data/storage.js';
import { BoatPolar } from './core/polar.js';
import { WindCalculator } from './core/wind.js';

class SailNavApp {
  constructor() {
    this.gps = new GPSTracker();
    this.navigation = new Navigation();
    this.map = new MapController('map');
    this.storage = new Storage();
    this.polar = new BoatPolar();
    this.wind = new WindCalculator();
    this.isAddingWaypoint = false;
    this.currentPosition = null;
    this.performanceVisible = false;
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

    document.getElementById('set-wind').addEventListener('click', () => {
      this.setWind();
    });

    document.getElementById('show-laylines').addEventListener('change', (e) => {
      this.toggleLaylines(e.target.checked);
    });

    document.getElementById('show-polars').addEventListener('click', () => {
      this.togglePerformancePanel();
    });

    document.getElementById('close-performance')?.addEventListener('click', () => {
      this.togglePerformancePanel(false);
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
    console.log('Setting up GPS permission...');
    console.log('Location:', window.location.href);
    console.log('Protocol:', window.location.protocol);
    console.log('Geolocation available:', 'geolocation' in navigator);

    // Check if geolocation is available
    if (!('geolocation' in navigator)) {
      console.error('Geolocation not supported');
      this.showGPSError('GPS not supported on this device');
      return;
    }

    // Check if we're on HTTPS (required for geolocation)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.error('Not on HTTPS');
      this.showGPSError('GPS requires HTTPS. Please use https:// URL');
      return;
    }

    // Update loading screen to show GPS permission request
    const loadingEl = document.getElementById('loading');
    loadingEl.classList.remove('hidden'); // Ensure it's visible
    loadingEl.innerHTML = `
      <div class="loading-content">
        <h2>Enable GPS</h2>
        <p>To use navigation features, please allow location access</p>
        <button id="enable-gps" class="action-btn primary" style="width: auto; padding: 12px 24px; margin-top: 20px; border-radius: 8px; font-size: 16px;">
          Enable GPS
        </button>
        <div style="margin-top: 20px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
          <p style="font-size: 12px; color: var(--text-secondary);">
            Safari will ask for permission after you tap the button
          </p>
        </div>
        <div id="debug-info" style="margin-top: 20px; font-size: 10px; color: var(--text-secondary);"></div>
      </div>
    `;

    // Show debug info
    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
      debugEl.innerHTML = `
        Protocol: ${window.location.protocol}<br>
        Host: ${window.location.hostname}<br>
        Geolocation: ${'geolocation' in navigator ? 'Available' : 'Not Available'}
      `;
    }

    // Add click handler with a small delay to ensure DOM is ready
    setTimeout(() => {
      const enableBtn = document.getElementById('enable-gps');
      if (enableBtn) {
        console.log('Adding click listener to Enable GPS button');
        enableBtn.addEventListener('click', () => {
          console.log('Enable GPS button clicked');
          this.requestGPSPermission();
        });
      } else {
        console.error('Enable GPS button not found');
        this.showGPSError('UI initialization error');
      }
    }, 100);
  }

  async requestGPSPermission() {
    const loadingEl = document.getElementById('loading');
    loadingEl.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Requesting GPS permission...</p>
      <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">Please tap "Allow" when prompted</p>
    `;

    // Check if we have permission first (Safari often returns 'prompt' even if denied)
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        console.log('Permission status:', permission.state);

        // Add permission state change listener
        permission.addEventListener('change', () => {
          console.log('Permission state changed to:', permission.state);
        });
      }
    } catch (e) {
      console.log('Permissions API not supported or error:', e);
    }

    // Use setTimeout to work around Safari issues
    setTimeout(() => {
      console.log('Attempting to get current position...');

      // Request permission and get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('GPS permission granted:', position.coords);
          this.setupGPS();
          this.hideLoading();
          // Center map on current position
          this.map.centerOnPosition(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('GPS Error Code:', error.code);
          console.error('GPS Error Message:', error.message);

          let errorMsg = 'Location access denied';

          switch(error.code) {
            case 1: // PERMISSION_DENIED
              errorMsg = 'Location permission denied. Please enable in Settings > Safari > Location';
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMsg = 'Location unavailable. Please ensure Location Services are enabled';
              break;
            case 3: // TIMEOUT
              errorMsg = 'Location request timed out. Please try again';
              break;
          }

          this.showGPSError(errorMsg);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increase timeout for slow GPS
          maximumAge: 0
        }
      );
    }, 100); // Small delay to help Safari
  }

  showGPSError(message) {
    const loadingEl = document.getElementById('loading');
    loadingEl.classList.remove('hidden');
    loadingEl.innerHTML = `
      <div class="loading-content">
        <h2>Location Required</h2>
        <p style="margin: 20px 0;">${message}</p>
        <button id="retry-gps" class="action-btn primary" style="width: auto; padding: 12px 24px; margin-top: 20px; border-radius: 8px;">
          Try Again
        </button>
        <div style="margin-top: 30px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
          <p style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">To enable location:</p>
          <ol style="text-align: left; font-size: 13px; line-height: 1.6;">
            <li>Open iPhone Settings</li>
            <li>Scroll to Safari</li>
            <li>Tap Location</li>
            <li>Select "While Using App"</li>
            <li>Return here and tap "Try Again"</li>
          </ol>
        </div>
      </div>
    `;

    setTimeout(() => {
      document.getElementById('retry-gps')?.addEventListener('click', () => {
        this.requestGPSPermission();
      });
    }, 100);
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

        this.updatePerformanceMetrics(data);

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

  setWind() {
    const speed = parseFloat(document.getElementById('wind-speed').value);
    const direction = parseFloat(document.getElementById('wind-direction').value);

    if (!isNaN(speed) && !isNaN(direction)) {
      this.wind.setWind(speed, direction);

      // Update wind arrow on map
      if (this.currentPosition) {
        this.map.updateWindArrow(direction, this.currentPosition.lat, this.currentPosition.lon);
      }

      // Update laylines if active waypoint
      const activeWaypoint = this.navigation.getActiveWaypoint();
      if (activeWaypoint && this.currentPosition) {
        const laylines = this.wind.calculateLaylines(
          this.currentPosition.lat,
          this.currentPosition.lon,
          activeWaypoint.lat,
          activeWaypoint.lon,
          this.polar
        );
        this.map.updateLaylines(laylines, this.currentPosition.lat, this.currentPosition.lon);
      }

      document.getElementById('menu-panel').classList.add('hidden');
    }
  }

  toggleLaylines(show) {
    this.map.toggleLaylines(show);
    this.storage.saveSetting('showLaylines', show);
  }

  togglePerformancePanel(show = !this.performanceVisible) {
    const panel = document.getElementById('performance-panel');
    if (show) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
    this.performanceVisible = show;
    document.getElementById('menu-panel').classList.add('hidden');
  }

  updatePerformanceMetrics(gpsData) {
    if (!this.currentPosition || !gpsData.sog) return;

    const heading = gpsData.cog || 0;
    const twa = this.wind.getTrueWindAngle(heading);
    const targetSpeed = this.polar.getTargetSpeed(this.wind.trueWindSpeed, twa);
    const performance = this.polar.getPerformanceRatio(gpsData.sog, this.wind.trueWindSpeed, twa);

    // Update performance panel if visible
    if (this.performanceVisible) {
      document.getElementById('tws').textContent = this.wind.trueWindSpeed.toFixed(0);
      document.getElementById('twa').textContent = Math.round(twa).toString().padStart(3, '0');
      document.getElementById('target-speed').textContent = targetSpeed.toFixed(1);
      document.getElementById('performance').textContent = Math.round(performance).toString();
    }

    // Calculate true VMG if we have a waypoint
    const activeWaypoint = this.navigation.getActiveWaypoint();
    if (activeWaypoint) {
      const targetBearing = this.wind.calculateBearing(
        this.currentPosition.lat,
        this.currentPosition.lon,
        activeWaypoint.lat,
        activeWaypoint.lon
      );
      const vmg = gpsData.sog * Math.cos((heading - targetBearing) * Math.PI / 180);
      document.getElementById('vmg').textContent = vmg.toFixed(1);
    }
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