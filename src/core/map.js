import L from 'leaflet';

export class MapController {
  constructor(containerId) {
    this.map = null;
    this.containerId = containerId;
    this.boatMarker = null;
    this.waypointMarkers = new Map();
    this.routeLine = null;
    this.trackLine = null;
    this.trackUp = false;
    this.centerOnBoat = false; // Don't auto-center by default
    this.laylines = null;
    this.windArrow = null;
    this.baseTileLayer = null;
    this.seaMarkLayer = null;
    this.nightMode = false;
  }

  init(initialLat = 37.7749, initialLon = -122.4194) {
    this.map = L.map(this.containerId, {
      center: [initialLat, initialLon],
      zoom: 13,
      zoomControl: false
    });

    L.control.zoom({
      position: 'topright'
    }).addTo(this.map);

    // Store tile layers for switching
    this.baseTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);

    this.seaMarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      attribution: '© OpenSeaMap',
      opacity: 0.8,
      maxZoom: 19
    }).addTo(this.map);

    this.createBoatMarker(initialLat, initialLon);
  }

  createBoatMarker(lat, lon) {
    const boatIcon = L.divIcon({
      className: 'boat-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this.boatMarker = L.marker([lat, lon], {
      icon: boatIcon,
      zIndexOffset: 1000
    }).addTo(this.map);
  }

  updateBoatPosition(lat, lon, heading = null) {
    if (!this.boatMarker) {
      this.createBoatMarker(lat, lon);
    } else {
      this.boatMarker.setLatLng([lat, lon]);
    }

    if (this.centerOnBoat) {
      if (this.trackUp && heading !== null) {
        this.map.setBearing(-heading);
      }
      this.map.panTo([lat, lon]);
    }
  }

  addWaypoint(waypoint) {
    const waypointIcon = L.divIcon({
      className: 'waypoint-marker',
      html: `<div style="text-align: center; margin-top: 20px; white-space: nowrap; font-size: 12px; font-weight: bold;">${waypoint.name}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([waypoint.lat, waypoint.lon], {
      icon: waypointIcon,
      draggable: true
    }).addTo(this.map);

    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      waypoint.lat = pos.lat;
      waypoint.lon = pos.lng;
      this.updateRouteLine();
    });

    this.waypointMarkers.set(waypoint.id, marker);
    this.updateRouteLine();
  }

  removeWaypoint(waypointId) {
    const marker = this.waypointMarkers.get(waypointId);
    if (marker) {
      this.map.removeLayer(marker);
      this.waypointMarkers.delete(waypointId);
      this.updateRouteLine();
    }
  }

  updateRouteLine() {
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }

    const waypoints = Array.from(this.waypointMarkers.values()).map(marker => marker.getLatLng());

    if (waypoints.length > 1) {
      this.routeLine = L.polyline(waypoints, {
        color: '#ef4444',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
      }).addTo(this.map);
    }
  }

  updateTrackLine(trackPoints) {
    if (!trackPoints || trackPoints.length < 2) return;

    if (this.trackLine) {
      this.map.removeLayer(this.trackLine);
    }

    const latLngs = trackPoints.map(p => [p.lat, p.lon]);

    this.trackLine = L.polyline(latLngs, {
      color: '#10b981',
      weight: 2,
      opacity: 0.6
    }).addTo(this.map);
  }

  clearRoute() {
    this.waypointMarkers.forEach(marker => this.map.removeLayer(marker));
    this.waypointMarkers.clear();

    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
  }

  onMapClick(callback) {
    this.map.on('click', (e) => {
      callback(e.latlng.lat, e.latlng.lng);
    });
  }

  setCenterOnBoat(center) {
    this.centerOnBoat = center;
  }

  setTrackUp(trackUp) {
    this.trackUp = trackUp;
    if (!trackUp && this.map.getBearing) {
      this.map.setBearing(0);
    }
  }

  centerOnPosition(lat, lon) {
    this.map.setView([lat, lon], this.map.getZoom());
  }

  getMap() {
    return this.map;
  }

  setNightMode(enabled) {
    this.nightMode = enabled;

    // Remove current layers
    if (this.baseTileLayer) {
      this.map.removeLayer(this.baseTileLayer);
    }

    // Add appropriate tile layer based on night mode
    if (enabled) {
      // Use a dark tile provider for night mode
      this.baseTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(this.map);
    } else {
      // Use standard OpenStreetMap for day mode
      this.baseTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
      }).addTo(this.map);
    }

    // Move basemap to back
    this.baseTileLayer.setZIndex(0);

    // Ensure sea marks stay on top
    if (this.seaMarkLayer) {
      this.seaMarkLayer.setZIndex(1);
    }
  }

  updateLaylines(laylineData, boatLat, boatLon) {
    // Remove existing laylines
    if (this.laylines) {
      this.map.removeLayer(this.laylines);
    }

    if (!laylineData) return;

    // Create layline polylines
    const portLayline = [
      [boatLat, boatLon],
      [laylineData.port.intercept.lat, laylineData.port.intercept.lon]
    ];

    const starboardLayline = [
      [boatLat, boatLon],
      [laylineData.starboard.intercept.lat, laylineData.starboard.intercept.lon]
    ];

    // Create a feature group for both laylines
    this.laylines = L.featureGroup([
      L.polyline(portLayline, {
        color: '#ef4444',
        weight: 2,
        opacity: 0.6,
        dashArray: '5, 10'
      }),
      L.polyline(starboardLayline, {
        color: '#10b981',
        weight: 2,
        opacity: 0.6,
        dashArray: '5, 10'
      })
    ]).addTo(this.map);
  }

  updateWindArrow(windDirection, lat, lon) {
    // Remove existing wind arrow
    if (this.windArrow) {
      this.map.removeLayer(this.windArrow);
    }

    // Create wind arrow as a polyline
    const arrowLength = 0.01; // degrees
    const arrowEnd = [
      lat + arrowLength * Math.cos((windDirection - 180) * Math.PI / 180),
      lon + arrowLength * Math.sin((windDirection - 180) * Math.PI / 180) / Math.cos(lat * Math.PI / 180)
    ];

    this.windArrow = L.polyline([[lat, lon], arrowEnd], {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.7
    }).addTo(this.map);

    // Add arrowhead
    const arrowHeadSize = 0.003;
    const angle1 = windDirection - 180 + 30;
    const angle2 = windDirection - 180 - 30;

    const head1 = [
      arrowEnd[0] + arrowHeadSize * Math.cos(angle1 * Math.PI / 180),
      arrowEnd[1] + arrowHeadSize * Math.sin(angle1 * Math.PI / 180) / Math.cos(lat * Math.PI / 180)
    ];

    const head2 = [
      arrowEnd[0] + arrowHeadSize * Math.cos(angle2 * Math.PI / 180),
      arrowEnd[1] + arrowHeadSize * Math.sin(angle2 * Math.PI / 180) / Math.cos(lat * Math.PI / 180)
    ];

    L.polyline([head1, arrowEnd, head2], {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.7
    }).addTo(this.map);
  }

  toggleLaylines(show) {
    if (this.laylines) {
      if (show) {
        this.laylines.addTo(this.map);
      } else {
        this.map.removeLayer(this.laylines);
      }
    }
  }
}