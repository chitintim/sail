import { GPSTracker } from './core/gps.js';
import { Navigation } from './core/navigation.js';
import { MapController } from './core/map.js';
import { Storage } from './data/storage.js';
import { BoatPolar } from './core/polar.js';
import { WindCalculator } from './core/wind.js';
import { Weather } from './core/weather.js';
import { WindOverlay } from './core/wind-overlay.js';

class SailNavApp {
  constructor() {
    this.gps = new GPSTracker();
    this.navigation = new Navigation();
    this.map = new MapController('map');
    this.storage = new Storage();
    this.polar = new BoatPolar();
    this.wind = new WindCalculator();
    this.weather = new Weather();
    this.windOverlay = null;
    this.isAddingWaypoint = false;
    this.currentPosition = null;
    this.performanceVisible = false;
    this.windOverlayVisible = false;
  }

  async init() {
    console.log('App initializing...');

    try {
      // Initialize storage and settings
      await this.storage.init();
      await this.loadSettings();

      // Initialize map
      this.map.init();

      // Initialize wind overlay
      this.windOverlay = new WindOverlay(this.map.leafletMap);
      this.windOverlay.initialize();

      // Set up event listeners after a delay to ensure DOM is ready
      setTimeout(() => {
        this.setupEventListeners();
        console.log('Event listeners set up');
      }, 100);

      console.log('App initialization complete');

      // The loading screen with buttons is already showing from HTML
      // User needs to click Enable GPS or Continue Without GPS
    } catch (error) {
      console.error('Error during initialization:', error);
      // Keep showing the loading screen with buttons
    }
  }

  setupEventListeners() {
    // Add safe event listener helper
    const addListener = (id, event, handler) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener(event, handler);
      } else {
        console.warn(`Element with id '${id}' not found`);
      }
    };

    addListener('menu-btn', 'click', () => {
      console.log('Menu button clicked');
      const menuPanel = document.getElementById('menu-panel');
      if (menuPanel) {
        menuPanel.classList.remove('hidden');
      }
    });

    addListener('close-menu', 'click', () => {
      const menuPanel = document.getElementById('menu-panel');
      if (menuPanel) {
        menuPanel.classList.add('hidden');
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const menuPanel = document.getElementById('menu-panel');
      const menuBtn = document.getElementById('menu-btn');
      if (menuPanel && !menuPanel.classList.contains('hidden')) {
        // Check if click is outside menu panel and not on menu button
        if (!menuPanel.contains(e.target) && e.target !== menuBtn && !menuBtn.contains(e.target)) {
          menuPanel.classList.add('hidden');
        }
      }
    });

    addListener('waypoint-btn', 'click', () => {
      console.log('Waypoint button clicked');
      this.toggleWaypointMode();
    });

    addListener('center-btn', 'click', () => {
      console.log('Center button clicked');
      if (this.currentPosition) {
        this.map.centerOnPosition(this.currentPosition.lat, this.currentPosition.lon);
        this.map.setCenterOnBoat(true);
      }
    });

    addListener('new-route', 'click', () => this.newRoute());
    addListener('save-route', 'click', () => this.saveRoute());
    addListener('load-route', 'click', () => this.loadRouteDialog());
    addListener('clear-route', 'click', () => this.clearRoute());

    addListener('night-mode', 'change', (e) => this.setNightMode(e.target.checked));
    addListener('track-up', 'change', (e) => this.map.setTrackUp(e.target.checked));
    addListener('show-laylines', 'change', (e) => this.toggleLaylines(e.target.checked));
    addListener('show-polars', 'click', () => this.togglePerformancePanel());
    addListener('close-performance', 'click', () => this.togglePerformancePanel(false));
    addListener('set-boat', 'click', () => this.updateBoatCharacteristics());
    addListener('show-steering', 'change', (e) => this.toggleSteeringDisplay(e.target.checked));

    // Weather controls
    addListener('show-wind', 'change', (e) => this.toggleWindOverlay());
    addListener('auto-routing', 'change', (e) => {
      this.windRoutingEnabled = e.target.checked;
      this.storage.saveSetting('windRouting', e.target.checked);
      if (e.target.checked) {
        this.updateRoutingWithWind();
      }
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
    console.log('showGPSPermissionUI called');

    // Get the loading element
    const loadingEl = document.getElementById('loading');
    if (!loadingEl) {
      console.error('Loading element not found!');
      return;
    }

    // Make sure it's visible
    loadingEl.classList.remove('hidden');

    // Replace content with permission UI
    loadingEl.innerHTML = `
      <div class="loading-content">
        <h2>Sail Navigation</h2>
        <p>Enable GPS for real-time navigation</p>
        <button id="enable-gps-btn" style="width: 200px; padding: 16px 24px; margin-top: 20px; border-radius: 8px; font-size: 18px; background: #1e40af; color: white; border: none; cursor: pointer;">
          Enable GPS
        </button>
        <button id="skip-gps-btn" style="width: 200px; padding: 14px 24px; margin-top: 10px; border-radius: 8px; font-size: 16px; background: #6b7280; color: white; border: none; cursor: pointer;">
          Continue Without GPS
        </button>
        <button id="test-gps-btn" style="width: 200px; padding: 12px 20px; margin-top: 10px; border-radius: 8px; font-size: 14px; background: #10b981; color: white; border: none; cursor: pointer;">
          Test GPS Permission
        </button>
        <div style="margin-top: 30px; padding: 15px; background: rgba(0,0,0,0.05); border-radius: 8px;">
          <p style="font-size: 14px; font-weight: bold;">Troubleshooting:</p>
          <p style="font-size: 12px;">• Access via: https://chitintim.github.io/sail/</p>
          <p style="font-size: 12px;">• iOS: Settings > Safari > Location > Allow</p>
          <p style="font-size: 12px;">• Clear Safari cache if stuck</p>
          <p id="debug-info" style="font-size: 11px; color: #666; margin-top: 10px;"></p>
        </div>
      </div>
    `;

    // Show debug info
    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
      debugEl.textContent = `Protocol: ${window.location.protocol}, Host: ${window.location.hostname}`;
    }

    // Add event listeners immediately
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const enableBtn = document.getElementById('enable-gps-btn');
      const skipBtn = document.getElementById('skip-gps-btn');
      const testBtn = document.getElementById('test-gps-btn');

      console.log('Setting up button listeners:', { enableBtn: !!enableBtn, skipBtn: !!skipBtn, testBtn: !!testBtn });

      if (enableBtn) {
        enableBtn.addEventListener('click', () => {
          console.log('Enable GPS button clicked');
          this.startWithGPS();
        }, { once: true });
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          console.log('Skip GPS button clicked');
          this.startWithoutGPS();
        }, { once: true });
      }

      if (testBtn) {
        testBtn.addEventListener('click', () => {
          console.log('Testing GPS...');
          this.testGPSPermission();
        });
      }
    });
  }

  startWithGPS() {
    console.log('Starting with GPS...');
    const loadingEl = document.getElementById('loading');

    // Check if geolocation is available
    if (!navigator.geolocation) {
      this.showGPSError('Geolocation is not supported by your browser. Please use Safari on iOS or Chrome on Android.');
      return;
    }

    // Check if we're on HTTPS (required for iOS)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      this.showGPSError('GPS requires HTTPS. Please access this app via https:// or from the deployed GitHub Pages site.');
      return;
    }

    loadingEl.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Requesting GPS permission...</p>
      <p style="font-size: 12px; margin-top: 10px;">If nothing happens, check Settings > Safari > Location</p>
    `;

    console.log('Calling getCurrentPosition...');

    // Request GPS permission with a single position first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('GPS enabled successfully');

        // Setup GPS callbacks
        this.setupGPS();

        // START the actual GPS tracking - this was missing!
        try {
          this.gps.start();
          console.log('GPS tracking started');
        } catch (error) {
          console.error('Failed to start GPS tracking:', error);
          this.showGPSError(`Failed to start GPS tracking: ${error.message}`);
          return;
        }

        // Hide loading screen
        this.hideLoading();

        // Re-setup event listeners now that the app is visible
        // This ensures buttons work after GPS is enabled
        setTimeout(() => {
          console.log('Re-setting up event listeners after GPS enabled');
          this.setupEventListeners();
        }, 500);

        // Center map on current position
        this.map.centerOnPosition(position.coords.latitude, position.coords.longitude);

        // Also fetch initial weather
        this.fetchWeatherData(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('GPS error:', error);
        let errorMessage = 'GPS Error: ';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Permission denied. Please enable location access in Settings > Safari > Location.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Position unavailable. Make sure location services are enabled.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Request timed out. Please try again.';
            break;
          default:
            errorMessage += error.message;
        }
        this.showGPSError(errorMessage);
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

    // Re-setup event listeners now that the app is visible
    setTimeout(() => {
      console.log('Re-setting up event listeners after skipping GPS');
      this.setupEventListeners();
    }, 500);

    // Set a default position (San Francisco Bay)
    this.map.centerOnPosition(37.8095, -122.4095);
  }

  testGPSPermission() {
    const debugEl = document.getElementById('debug-info');

    if (!navigator.geolocation) {
      alert('Geolocation not available in your browser!');
      return;
    }

    if (debugEl) {
      debugEl.innerHTML = 'Testing GPS... requesting permission now...';
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const msg = `GPS works! Lat: ${position.coords.latitude.toFixed(4)}, Lon: ${position.coords.longitude.toFixed(4)}`;
        alert(msg);
        if (debugEl) {
          debugEl.innerHTML = msg;
        }
      },
      (error) => {
        let msg = 'GPS Error: ';
        switch(error.code) {
          case 1: msg += 'Permission Denied - Check Settings'; break;
          case 2: msg += 'Position Unavailable'; break;
          case 3: msg += 'Timeout'; break;
          default: msg += error.message;
        }
        alert(msg);
        if (debugEl) {
          debugEl.innerHTML = msg;
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }


  showGPSError(message) {
    const loadingEl = document.getElementById('loading');
    loadingEl.classList.remove('hidden');
    loadingEl.innerHTML = `
      <div class="loading-content">
        <h2>GPS Issue</h2>
        <p style="margin: 20px 0;">${message}</p>
        <button id="retry-gps-btn" style="width: 200px; padding: 16px 24px; margin-top: 20px; border-radius: 8px; font-size: 18px; background: #1e40af; color: white; border: none; cursor: pointer;">
          Try Again
        </button>
        <button id="skip-gps-error-btn" style="width: 200px; padding: 14px 24px; margin-top: 10px; border-radius: 8px; font-size: 16px; background: #6b7280; color: white; border: none; cursor: pointer;">
          Continue Without GPS
        </button>
        <div style="margin-top: 30px; padding: 15px; background: rgba(0,0,0,0.05); border-radius: 8px;">
          <p style="font-size: 12px;">Settings > Safari > Location > While Using App</p>
        </div>
      </div>
    `;

    // Add event listeners
    setTimeout(() => {
      const retryBtn = document.getElementById('retry-gps-btn');
      const skipBtn = document.getElementById('skip-gps-error-btn');

      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.startWithGPS(), { once: true });
      }
      if (skipBtn) {
        skipBtn.addEventListener('click', () => this.startWithoutGPS(), { once: true });
      }
    }, 100);
  }

  setupGPS() {
    this.gps.onUpdate(async (data) => {
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

        // Fetch weather automatically every 3 hours
        if (!this.lastWeatherFetch || Date.now() - this.lastWeatherFetch > 3 * 60 * 60 * 1000) {
          this.fetchWeatherData(data.position.lat, data.position.lon);
        }

        this.updatePerformanceMetrics(data);

        if (data.track && data.track.length > 1) {
          this.map.updateTrackLine(data.track);
        }

        const navData = this.navigation.calculateNavigationData(this.currentPosition);
        if (navData) {
          this.updateWaypointInfo(navData);

          // Update laylines if they're visible and we have wind data
          if (this.currentPosition && navData.waypoint && this.wind.trueWindSpeed > 0) {
            const laylines = this.wind.calculateLaylines(
              this.currentPosition.lat,
              this.currentPosition.lon,
              navData.waypoint.lat,
              navData.waypoint.lon,
              this.polar
            );
            this.map.updateLaylines(laylines, this.currentPosition.lat, this.currentPosition.lon);
          }
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

    // Show which leg we're on (e.g., "WPT 2/5")
    const waypointText = `${navData.waypoint.name} (${navData.activeIndex + 1}/${navData.totalWaypoints})`;
    document.getElementById('wpt-name').textContent = waypointText;

    document.getElementById('dtw').textContent = navData.dtw.toFixed(1);
    document.getElementById('brg').textContent = navData.brg.toString().padStart(3, '0');
    document.getElementById('eta').textContent = navData.eta;
    document.getElementById('vmg').textContent = navData.vmg.toFixed(1);

    // Update steering display if visible
    if (this.steeringVisible) {
      this.updateSteeringDisplay(navData);
    }

    // Check wind routing if enabled
    if (this.windRoutingEnabled && this.weather.windData) {
      this.updateRoutingWithWind();
    }
  }

  skipWaypoint() {
    if (this.navigation.activeWaypointIndex < this.navigation.waypoints.length - 1) {
      this.navigation.activeWaypointIndex++;
      const navData = this.navigation.calculateNavigationData(this.currentPosition);
      if (navData) {
        this.updateWaypointInfo(navData);
      }
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
    // Update map tiles for night mode
    if (this.map) {
      this.map.setNightMode(enabled);
    }
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

    if (settings.windRouting) {
      this.windRoutingEnabled = settings.windRouting;
      document.getElementById('auto-routing').checked = settings.windRouting;
    }

    // Default steering guide to on if not previously set
    if (settings.showSteering === undefined || settings.showSteering) {
      document.getElementById('show-steering').checked = true;
      this.toggleSteeringDisplay(true);
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

      // Also update weather system with manual wind
      this.weather.setManualWind(speed, direction);

      // Update wind arrow on map
      if (this.currentPosition) {
        this.map.updateWindArrow(direction, this.currentPosition.lat, this.currentPosition.lon);
      }

      // Update wind overlay if visible
      if (this.windOverlayVisible) {
        this.updateWindOverlay();
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

  async fetchWeatherData(lat, lon) {
    try {
      const weatherData = await this.weather.fetchWeatherData(lat, lon);
      this.lastWeatherFetch = Date.now();

      if (weatherData) {
        // Update wind calculator with real wind data
        this.wind.setWindSpeed(weatherData.wind.speed);
        this.wind.setWindDirection(weatherData.wind.direction);

        // Update wind overlay if visible
        if (this.windOverlayVisible) {
          await this.updateWindOverlay();
        }

        // Update display with wind info
        this.updateWindDisplay(weatherData.wind);

        // If we have a route, get wind forecast for waypoints
        if (this.navigation.waypoints.length > 0) {
          const routeForecast = await this.weather.getRouteWindForecast(
            this.navigation.getRoute(),
            [this.currentPosition?.sog || 5]
          );
          console.log('Route wind forecast:', routeForecast);
        }
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
    }
  }

  async updateWindOverlay() {
    if (this.windOverlayVisible && this.weather.weatherData) {
      const bounds = this.map.leafletMap.getBounds();
      const windField = await this.weather.fetchWindField({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
      this.windOverlay.setWindData(windField);
    }
  }

  updateWindDisplay(windData) {
    // Update TWS display if performance panel is visible
    if (this.performanceVisible) {
      document.getElementById('tws').textContent = Math.round(windData.speed);
    }

    // Calculate TWA if we have COG
    if (this.currentPosition?.cog) {
      const twa = this.weather.calculateTWA(this.currentPosition.cog, windData.direction);
      if (this.performanceVisible) {
        document.getElementById('twa').textContent = Math.round(twa);
      }

      // Check if in no-go zone and update steering display
      if (this.weather.isInNoGoZone(this.currentPosition.cog, windData.direction)) {
        // Add visual indicator for no-go zone
        this.showNoGoWarning();
      }
    }
  }

  showNoGoWarning() {
    // Visual warning that boat is pointing too close to wind
    const banner = document.createElement('div');
    banner.className = 'waypoint-banner';
    banner.style.background = '#f59e0b';
    banner.textContent = 'Too close to wind - consider tacking';
    banner.id = 'no-go-warning';

    const existing = document.getElementById('no-go-warning');
    if (existing) {
      existing.remove();
    }

    document.getElementById('app').appendChild(banner);

    setTimeout(() => {
      banner.remove();
    }, 5000);
  }

  toggleWindOverlay() {
    this.windOverlayVisible = !this.windOverlayVisible;

    if (this.windOverlayVisible) {
      // Use manual wind data
      this.updateWindOverlay();
      this.windOverlay.show();
    } else {
      this.windOverlay.hide();
    }
  }

  updateRoutingWithWind() {
    // Update navigation to consider wind when calculating routes
    const activeWaypoint = this.navigation.getActiveWaypoint();
    if (activeWaypoint && this.currentPosition && this.weather.windData) {
      const optimalRoute = this.weather.calculateOptimalTack(
        this.currentPosition,
        activeWaypoint,
        this.weather.windData.wind.direction,
        this.polar.boatType
      );

      if (optimalRoute.needsTacking) {
        // Show tacking recommendation
        this.showTackingAdvice(optimalRoute);
      }
    }
  }

  showTackingAdvice(route) {
    const banner = document.createElement('div');
    banner.className = 'waypoint-banner';
    banner.style.background = '#1e40af';
    banner.textContent = `Tack to ${route.recommendedTack} - steer ${Math.round(route.courseToSteer)}°`;
    banner.id = 'tacking-advice';

    const existing = document.getElementById('tacking-advice');
    if (existing) {
      existing.remove();
    }

    document.getElementById('app').appendChild(banner);

    setTimeout(() => {
      banner.remove();
    }, 10000);
  }
}

const app = new SailNavApp();
window.app = app; // Make it globally accessible for onclick handlers

// Add global functions for the buttons
window.startGPS = () => app.startWithGPS();
window.skipGPS = () => app.startWithoutGPS();

// Add global handler for menu button as backup
window.openMenu = () => {
  console.log('Opening menu via global handler');
  const menu = document.getElementById('menu-panel');
  if (menu) {
    menu.classList.remove('hidden');
  }
};

// Initialize the app
app.init().catch(error => {
  console.error('Failed to initialize app:', error);
  // If init fails, still set up the basic functions
  document.getElementById('loading').style.display = 'block';
});

// Service worker registration disabled for development
// if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js').catch(console.error);
//   });
// }