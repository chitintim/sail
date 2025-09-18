# Sail Navigation - Development Documentation

## Project Overview

A Progressive Web App (PWA) for sailing navigation optimized for a Lagoon 40 catamaran. Runs entirely client-side with no backend requirements, designed for offline-first operation on mobile devices.

**Live App**: https://chitintim.github.io/sail/

**Key Features**:
- 100% client-side, no backend or API keys required
- Automatic weather data from free sources
- Real-time GPS tracking with advanced smoothing
- Offline-first with PWA capabilities
- Optimized for one-handed mobile operation

## Current Implementation Status

### Phase 1: Core Navigation ✅ COMPLETED
- **GPS Tracking**: Real-time position with SOG/COG display
  - Implemented advanced smoothing algorithm for stable readings
  - Weighted averaging for SOG (10 samples at <1kt, 3 samples at >1kt)
  - Circular mean calculation for COG to handle 360° wraparound
  - COG freezes at very low speeds to prevent erratic readings
- **Map Display**: Leaflet with OpenSeaMap nautical chart overlay
- **Waypoint Management**: Tap to add, drag to reposition
- **Route Planning**: Multi-waypoint routes with distance/bearing calculations
- **Local Storage**: IndexedDB for routes, settings persistence
- **PWA Features**: Service worker, offline caching, install-to-homescreen

### Phase 2: Performance & Tactics ✅ COMPLETED
- **Boat Configuration**:
  - Default: 40ft catamaran (Lagoon 40 characteristics)
  - Hull speed calculations: 1.4 * √length for cats
  - Catamaran-specific performance:
    - Can't point as high (50° vs 45°)
    - Better reaching (+15%)
    - Superior light wind (+20%)
    - Can exceed hull speed easier
- **Polar Performance**:
  - Auto-generated polars based on boat length
  - Realistic catamaran adjustments
  - Target speed calculations
  - Performance percentage display
- **Wind System**:
  - Manual wind input (speed/direction)
  - True Wind Angle (TWA) calculations
  - Apparent wind calculations
- **Laylines**:
  - Port (red) and starboard (green) laylines to waypoints
  - Optimal VMG angle calculations
  - Visual display on map
- **Steering Guidance**:
  - Visual cross-track error (XTE) bar
  - Course-to-steer (CTS) calculations
  - Turn instructions ("TURN 15° PORT")
  - Color-coded deviation indicator

### Phase 3: Weather Integration ✅ COMPLETED
- **Automatic Weather Data**:
  - Uses OpenMeteo free marine API (no key required)
  - Fetches wind data every 3 hours automatically
  - Falls back to estimated wind based on latitude patterns
- **Wind Visualization**:
  - Animated particle overlay showing wind flow
  - Wind barbs for field visualization
  - Toggle on/off from menu
- **Smart Routing**:
  - No-go zone detection and warnings
  - Automatic tacking recommendations
  - Wind-aware route optimization
- **Route Forecasting**:
  - Calculates wind at each waypoint
  - Predicts conditions at leg midpoints
  - 48-hour forecast available

## Technical Architecture

### File Structure
```
/src
  /core
    gps.js         - GPS tracking with smoothing algorithms
    navigation.js  - Route planning and waypoint calculations
    map.js         - Leaflet map controller with laylines
    polar.js       - Boat performance polars (catamaran-optimized)
    wind.js        - Wind calculations and layline logic
    weather.js     - Weather data fetching and processing (NEW)
    wind-overlay.js - Wind visualization on map (NEW)
  /data
    storage.js     - IndexedDB wrapper for persistence
  /styles
    main.css       - All styling including responsive design
  main.js          - Application controller
```

### Key Algorithms

#### GPS Smoothing (New)
```javascript
// Dynamic buffer sizing based on speed
effectiveBufferSize = speed < 1.0kt ? 10 : 3

// Weighted averaging (recent values weighted higher)
weight = index + 1
smoothedValue = Σ(value * weight) / Σ(weight)

// Circular mean for COG
meanAngle = atan2(Σ(sin(θ)*w), Σ(cos(θ)*w))
```

#### Cross-Track Error
```javascript
// Distance from route line
XTE = asin(sin(d13/R) * sin(θ13-θ12)) * R

// Course correction
CTS = BRG + (XTE * 50) // 5° per 0.1nm error
```

#### Catamaran Performance
- Hull speed: 1.4 * √length (vs 1.34 for monohulls)
- Upwind penalty: 0.85x
- Reaching bonus: 1.15x
- Light wind bonus: 1.2x
- Speed potential: 1.3x hull speed

### GPS Permission Flow (Updated December 2024)
1. Show "Enable GPS" / "Continue Without" buttons in HTML immediately
2. Request permission only when user taps Enable
3. Call `gps.start()` after permission granted (critical!)
4. Re-setup event listeners after GPS loads
5. Fallback to San Francisco Bay if no GPS

**iOS Safari Requirements**:
- Must use HTTPS (GitHub Pages URL works)
- Permission request must be from user interaction
- Location Services must be enabled in Settings
- Safari > Location must be set to "Allow"

### Data Persistence
- **Routes**: Waypoints, names, total distance
- **Settings**: Boat length/type, wind data, display preferences
- **Tiles**: Map tile caching for offline use

## Phase 4: Advanced Features (PLANNED)

### Objectives
- Direct GRIB file fetching from NOAA/ECMWF
- Client-side GRIB parsing
- Wind field overlay on map
- Weather routing calculations
- Tide predictions using harmonic constants

### Implementation Plan

#### 3.1 GRIB File Handling
```javascript
// Fetch GRIB directly from NOAA (no API key needed)
const gribUrl = `https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/gfs.${date}/${hour}/gfs.t${hour}z.pgrb2.0p25.f${forecast}`;

// Parse client-side
import GribParser from './weather/grib-parser.js';
const weatherData = await GribParser.decode(gribData);
```

#### 3.2 Wind Field Display
- Canvas/WebGL overlay for smooth rendering
- Animated particles showing wind flow
- Time slider for forecast navigation

#### 3.3 Weather Routing
- Isochrone calculation (where you can sail in X hours)
- Optimal departure timing
- Route safety analysis (avoid gales)

#### 3.4 Tide Integration
- Harmonic constants for major ports
- Client-side tide predictions
- Current atlas data as static JSON

### Technical Considerations

#### GRIB Processing
- Use Web Workers for parsing (non-blocking)
- Store parsed data in IndexedDB
- Implement data decimation for performance

#### Visualization
- WebGL for particle system
- Canvas for wind barbs
- SVG for pressure contours

#### Offline Strategy
- Pre-download GRIB for planned route
- Cache last 3 forecasts
- Graceful degradation when offline

## Phase 5: Future Enhancements (ROADMAP)

### Racing Mode
- Start timer with sync
- Layline time-to-tack calculations
- Competitor tracking (local only)
- Performance analytics

### Anchor Watch
- Drift detection with radius alarm
- Wind shift alerts
- Swing circle visualization

### AIS Integration
- WebRTC for local AIS receiver
- Collision avoidance calculations
- Traffic overlay on map

## Performance Optimizations

### Current
- Debounced calculations (navigation updates)
- Spatial indexing for proximity queries
- Progressive tile loading
- Request animation frame for smooth updates

### Planned
- Virtual scrolling for route lists
- Lazy loading for chart details
- WebAssembly for intensive calculations
- Shared workers for multi-tab sync

## Browser Compatibility

### Required Features
- Geolocation API
- IndexedDB
- Service Workers
- ES6 Modules

### Tested On
- iOS Safari 14+ (primary target)
- Chrome Mobile 90+
- Firefox Mobile 88+

## Development Setup

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Deploy to GitHub Pages
git push (triggers GitHub Actions)
```

## Critical Bug Fixes (December 2024)

### GPS Permission Not Showing
**Problem**: Loading screen stuck on "Acquiring GPS position..."
**Solution**:
- Moved GPS buttons directly into HTML (not dynamically created)
- Added window-level handlers for failsafe
- Call `gps.start()` explicitly after permission granted

### Menu/Buttons Not Working After GPS
**Problem**: UI buttons unresponsive after enabling GPS
**Solution**:
- Re-setup event listeners after GPS loads (500ms delay)
- Added safe null checks for all DOM elements
- Added inline onclick handlers as backup

### Map Auto-Centering
**Problem**: Map keeps centering on boat without user input
**Solution**:
- Changed `centerOnBoat` default to false in map.js
- Only centers when user presses center button

### Waypoint Ordering
**Problem**: Navigation thought waypoints were backwards
**Solution**:
- Fixed leg detection logic in navigation.js
- First waypoint is start, last is destination
- Auto-detects closest leg based on position

### Weather API Requirements
**Problem**: Users don't want API keys or backend
**Solution**:
- Switched to OpenMeteo free API (no key needed)
- Automatic fetching every 3 hours
- Fallback to estimated wind based on latitude

## Known Issues & Workarounds

### iOS Safari GPS
- **Must use HTTPS**: Access via https://chitintim.github.io/sail/
- **Permission Issues**: Settings > Safari > Location > Allow
- **Clear Cache**: Settings > Safari > Clear History and Website Data

### Service Worker Caching
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+F5 (PC)
- Clear site data if stuck on old version
- Service worker updates may take time to propagate

### Low Speed GPS
- Heavy smoothing applied <1kt
- COG freezes when stationary
- Minimum speed threshold 0.1kt

## Testing Checklist

### Core Functionality
- [ ] GPS acquisition and tracking
- [ ] Waypoint creation and editing
- [ ] Route saving and loading
- [ ] Offline operation

### Performance
- [ ] Smooth map panning
- [ ] Stable SOG/COG at low speeds
- [ ] Responsive UI on mobile

### Catamaran Specific
- [ ] Realistic polars for 40ft cat
- [ ] Correct layline angles (50° upwind)
- [ ] Performance calculations

## Contributing Guidelines

### Code Style
- ES6+ JavaScript
- No external frameworks (vanilla JS)
- Mobile-first responsive design
- Comprehensive comments for algorithms

### Git Workflow
- Main branch deploys automatically
- Commit messages describe changes
- Push triggers GitHub Actions

### Testing
- Test on real devices when possible
- Verify offline functionality
- Check GPS smoothing at anchor

## Resources

### Documentation
- [Leaflet API](https://leafletjs.com/reference.html)
- [OpenSeaMap](https://www.openseamap.org/)
- [GRIB Format](https://www.nco.ncep.noaa.gov/pmb/docs/grib2/)
- [Harmonic Tide Prediction](https://tidesandcurrents.noaa.gov/harmonic.html)

### Sailing Calculations
- [Navigation Formulas](https://www.movable-type.co.uk/scripts/latlong.html)
- [Polar Performance](https://www.orc.org/index.asp?id=23)
- [Weather Routing](https://www.sailingusa.info/weather_routing.htm)