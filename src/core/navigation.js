export class Navigation {
  constructor() {
    this.waypoints = [];
    this.activeWaypointIndex = 0;
    this.routeLine = null;
    this.autoAdvance = true; // Automatically advance to next waypoint when close
  }

  addWaypoint(lat, lon, name = null) {
    const waypoint = {
      id: Date.now(),
      lat,
      lon,
      name: name || `WPT ${this.waypoints.length + 1}`
    };
    this.waypoints.push(waypoint);
    return waypoint;
  }

  removeWaypoint(id) {
    const index = this.waypoints.findIndex(wp => wp.id === id);
    if (index !== -1) {
      this.waypoints.splice(index, 1);
      if (this.activeWaypointIndex >= this.waypoints.length) {
        this.activeWaypointIndex = Math.max(0, this.waypoints.length - 1);
      }
    }
  }

  setActiveWaypoint(index) {
    if (index >= 0 && index < this.waypoints.length) {
      this.activeWaypointIndex = index;
    }
  }

  getActiveWaypoint() {
    return this.waypoints[this.activeWaypointIndex] || null;
  }

  calculateNavigationData(currentPosition) {
    // Auto-detect closest leg if needed
    if (this.autoAdvance && this.waypoints.length > 0) {
      this.updateActiveWaypoint(currentPosition);
    }

    const activeWaypoint = this.getActiveWaypoint();
    if (!activeWaypoint || !currentPosition) {
      return null;
    }

    const distance = this.calculateDistance(
      currentPosition.lat,
      currentPosition.lon,
      activeWaypoint.lat,
      activeWaypoint.lon
    );

    const bearing = this.calculateBearing(
      currentPosition.lat,
      currentPosition.lon,
      activeWaypoint.lat,
      activeWaypoint.lon
    );

    const xte = this.calculateCrossTrackError(currentPosition);

    const vmg = this.calculateVMG(currentPosition, activeWaypoint, bearing);

    const eta = this.calculateETA(distance, vmg);

    // Check if we've reached the waypoint (within 0.05nm)
    if (distance < 0.05 && this.activeWaypointIndex < this.waypoints.length - 1) {
      this.activeWaypointIndex++;
    }

    return {
      waypoint: activeWaypoint,
      dtw: Math.round(distance * 10) / 10,
      brg: Math.round(bearing),
      xte: Math.round(xte * 100) / 100,
      vmg: Math.round(vmg * 10) / 10,
      eta,
      activeIndex: this.activeWaypointIndex,
      totalWaypoints: this.waypoints.length
    };
  }

  updateActiveWaypoint(currentPosition) {
    if (this.waypoints.length < 2) return;

    let closestLegIndex = 0;
    let minDistance = Infinity;

    // Find which leg we're closest to
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const fromWpt = this.waypoints[i];
      const toWpt = this.waypoints[i + 1];

      // Calculate distance to the line between waypoints
      const distToLeg = this.distanceToLeg(
        currentPosition,
        fromWpt,
        toWpt
      );

      if (distToLeg < minDistance) {
        minDistance = distToLeg;
        closestLegIndex = i + 1; // We navigate TO the second waypoint
      }
    }

    // Only update if we're significantly closer to a different leg
    if (Math.abs(closestLegIndex - this.activeWaypointIndex) > 0 && minDistance < 1.0) {
      this.activeWaypointIndex = closestLegIndex;
    }
  }

  distanceToLeg(position, fromWpt, toWpt) {
    // Calculate perpendicular distance from position to the line between waypoints
    const d12 = this.calculateDistance(fromWpt.lat, fromWpt.lon, toWpt.lat, toWpt.lon);
    const d1p = this.calculateDistance(fromWpt.lat, fromWpt.lon, position.lat, position.lon);
    const d2p = this.calculateDistance(toWpt.lat, toWpt.lon, position.lat, position.lon);

    // If we're past either end of the leg, use distance to endpoints
    if (d1p > d12 || d2p > d12) {
      return Math.min(d1p, d2p);
    }

    // Otherwise calculate perpendicular distance
    const bearing12 = this.calculateBearing(fromWpt.lat, fromWpt.lon, toWpt.lat, toWpt.lon);
    const bearing1p = this.calculateBearing(fromWpt.lat, fromWpt.lon, position.lat, position.lon);
    const angle = Math.abs(bearing1p - bearing12) * Math.PI / 180;

    return Math.abs(d1p * Math.sin(angle));
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  calculateCrossTrackError(currentPosition) {
    // For first waypoint or single waypoint, no XTE
    if (this.waypoints.length < 2) {
      return 0;
    }

    // Calculate XTE from the line between previous and current waypoint
    // If we're going to first waypoint, use current position as start
    let prevWaypoint;
    if (this.activeWaypointIndex === 0) {
      // Going to first waypoint - no previous leg to calculate XTE from
      return 0;
    } else {
      prevWaypoint = this.waypoints[this.activeWaypointIndex - 1];
    }

    const activeWaypoint = this.waypoints[this.activeWaypointIndex];

    const d13 = this.calculateDistance(
      prevWaypoint.lat,
      prevWaypoint.lon,
      currentPosition.lat,
      currentPosition.lon
    );

    const θ13 = this.calculateBearing(
      prevWaypoint.lat,
      prevWaypoint.lon,
      currentPosition.lat,
      currentPosition.lon
    ) * Math.PI / 180;

    const θ12 = this.calculateBearing(
      prevWaypoint.lat,
      prevWaypoint.lon,
      activeWaypoint.lat,
      activeWaypoint.lon
    ) * Math.PI / 180;

    const xte = Math.asin(Math.sin(d13 / 3440.065) * Math.sin(θ13 - θ12)) * 3440.065;

    return xte;
  }

  calculateVMG(currentPosition, waypoint, bearing) {
    if (!currentPosition.sog) return 0;

    const cogRad = (currentPosition.cog || 0) * Math.PI / 180;
    const brgRad = bearing * Math.PI / 180;
    const angleDiff = cogRad - brgRad;

    return currentPosition.sog * Math.cos(angleDiff);
  }

  calculateETA(distance, vmg) {
    if (vmg <= 0) return '--:--';

    const hoursToGo = distance / vmg;
    const now = new Date();
    const eta = new Date(now.getTime() + hoursToGo * 3600000);

    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  clearRoute() {
    this.waypoints = [];
    this.activeWaypointIndex = 0;
    this.routeLine = null;
  }

  getRoute() {
    return {
      waypoints: this.waypoints,
      activeWaypointIndex: this.activeWaypointIndex
    };
  }

  loadRoute(route) {
    this.waypoints = route.waypoints || [];
    this.activeWaypointIndex = route.activeWaypointIndex || 0;
  }

  getTotalDistance() {
    let total = 0;
    for (let i = 1; i < this.waypoints.length; i++) {
      total += this.calculateDistance(
        this.waypoints[i - 1].lat,
        this.waypoints[i - 1].lon,
        this.waypoints[i].lat,
        this.waypoints[i].lon
      );
    }
    return Math.round(total * 10) / 10;
  }
}