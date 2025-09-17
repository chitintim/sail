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
    this.centerOnBoat = true;
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

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);

    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
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
}