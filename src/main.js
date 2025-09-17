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

    // Show the GPS permission UI immediately
    this.showGPSPermissionUI();
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

    document.getElementById('set-boat').addEventListener('click', () => {
      this.updateBoatCharacteristics();
    });

    document.getElementById('show-steering').addEventListener('change', (e) => {
      this.toggleSteeringDisplay(e.target.checked);
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

  showGPSPermissionUI() {
    // Don't check anything first, just show the UI immediately
    const loadingEl = document.getElementById('loading');

    // Always show the permission UI right away
    loadingEl.innerHTML = `
      <div class="loading-content">
        <h2>Sail Navigation</h2>
        <p>Enable GPS for real-time navigation</p>
        <button id="enable-gps" onclick="window.app.startWithGPS()" style="width: 200px; padding: 16px 24px; margin-top: 20px; border-radius: 8px; font-size: 18px; background: #1e40af; color: white; border: none; cursor: pointer;">
          Enable GPS
        </button>
        <button id="skip-gps" onclick="window.app.startWithoutGPS()" style="width: 200px; padding: 14px 24px; margin-top: 10px; border-radius: 8px; font-size: 16px; background: #6b7280; color: white; border: none; cursor: pointer;">
          Continue Without GPS
        </button>
      </div>
    `;
  }

  startWithGPS() {
    console.log('Starting with GPS...');
    const loadingEl = document.getElementById('loading');
    loadingEl.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Requesting GPS permission...</p>
    `;

    // Request GPS permission
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('GPS enabled successfully');
        this.setupGPS();
        this.hideLoading();
        this.map.centerOnPosition(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('GPS error:', error);
        this.showGPSError(`GPS Error: ${error.message}. You can retry or continue without GPS.`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  startWithoutGPS() {
    console.log('Starting without GPS...');
    this.hideLoading();
    // Set a default position (San Francisco Bay)
    this.map.centerOnPosition(37.8095, -122.4095);
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
        <h2>GPS Issue</h2>
        <p style="margin: 20px 0;">${message}</p>
        <button onclick="window.app.startWithGPS()" style="width: 200px; padding: 16px 24px; margin-top: 20px; border-radius: 8px; font-size: 18px; background: #1e40af; color: white; border: none; cursor: pointer;">
          Try Again
        </button>
        <button onclick="window.app.startWithoutGPS()" style="width: 200px; padding: 14px 24px; margin-top: 10px; border-radius: 8px; font-size: 16px; background: #6b7280; color: white; border: none; cursor: pointer;">
          Continue Without GPS
        </button>
        <div style="margin-top: 30px; padding: 15px; background: rgba(0,0,0,0.05); border-radius: 8px;">
          <p style="font-size: 12px;">Settings > Safari > Location > While Using App</p>
        </div>
      </div>
    `;
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

    // Update steering display if visible
    if (this.steeringVisible) {
      this.updateSteeringDisplay(navData);
    }
  }

  updateSteeringDisplay(navData) {
    // Calculate course to steer
    const xte = navData.xte || 0;
    const brg = navData.brg;
    const cog = this.currentPosition?.cog || 0;

    // Simple course correction: adjust bearing based on XTE
    // For every 0.1nm off track, adjust 5 degrees (adjustable)
    const xteCorrection = Math.min(Math.max(xte * 50, -30), 30); // Max 30 degree correction
    const courseToSteer = Math.round((brg + xteCorrection + 360) % 360);

    // Update XTE bar position (scale: -1nm to +1nm)
    const xtePosition = Math.min(Math.max(xte / 1, -1), 1); // Normalize to -1 to 1
    const xtePercent = 50 + (xtePosition * 45); // Convert to percentage (5% to 95%)

    const xteMarker = document.getElementById('xte-marker');
    xteMarker.style.left = `${xtePercent}%`;

    // Update XTE value
    const xteValue = document.getElementById('xte-value');
    const xteDirection = xte > 0 ? 'STBD' : xte < 0 ? 'PORT' : '';
    xteValue.textContent = `XTE: ${Math.abs(xte).toFixed(2)}nm ${xteDirection}`;

    // Update course to steer
    document.getElementById('cts').textContent = `${courseToSteer}°`;

    // Calculate steering direction
    let angleDiff = courseToSteer - cog;
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    const steerArrow = document.getElementById('steer-arrow');
    const steerDirection = document.getElementById('steer-direction');

    if (Math.abs(angleDiff) < 5) {
      steerArrow.className = 'steer-arrow';
      steerDirection.textContent = 'ON COURSE';
    } else if (angleDiff > 0) {
      steerArrow.className = 'steer-arrow starboard';
      steerDirection.textContent = `TURN ${Math.abs(angleDiff).toFixed(0)}° STARBOARD`;
    } else {
      steerArrow.className = 'steer-arrow port';
      steerDirection.textContent = `TURN ${Math.abs(angleDiff).toFixed(0)}° PORT`;
    }
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

  updateBoatCharacteristics() {
    const length = parseFloat(document.getElementById('boat-length').value);
    const type = document.getElementById('boat-type').value;

    if (!isNaN(length)) {
      this.polar.setBoatLength(length, type);
      this.storage.saveSetting('boatLength', length);
      this.storage.saveSetting('boatType', type);
      document.getElementById('menu-panel').classList.add('hidden');
    }
  }

  toggleSteeringDisplay(show) {
    const display = document.getElementById('steering-display');
    if (show) {
      display.classList.remove('hidden');
    } else {
      display.classList.add('hidden');
    }
    this.steeringVisible = show;
    this.storage.saveSetting('showSteering', show);
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
window.app = app; // Make it globally accessible for onclick handlers
app.init().catch(console.error);

// Service worker registration disabled for development
// if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js').catch(console.error);
//   });
// }