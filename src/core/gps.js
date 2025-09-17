export class GPSTracker {
  constructor() {
    this.position = null;
    this.previousPosition = null;
    this.watchId = null;
    this.listeners = new Set();
    this.trackHistory = [];
    this.maxTrackPoints = 1000;
  }

  start() {
    if (!('geolocation' in navigator)) {
      throw new Error('Geolocation is not supported');
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => this.handleError(error),
      options
    );
  }

  stop() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  handlePosition(position) {
    this.previousPosition = this.position;
    this.position = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp
    };

    this.trackHistory.push({
      lat: this.position.lat,
      lon: this.position.lon,
      timestamp: this.position.timestamp
    });

    if (this.trackHistory.length > this.maxTrackPoints) {
      this.trackHistory.shift();
    }

    const data = this.calculateNavigationData();
    this.notifyListeners(data);
  }

  handleError(error) {
    console.error('GPS Error:', error);
    this.notifyListeners({ error: error.message });
  }

  calculateNavigationData() {
    if (!this.position) {
      return { sog: 0, cog: 0 };
    }

    let sog = 0;
    let cog = this.position.heading || 0;

    if (this.previousPosition && this.position) {
      const timeDiff = (this.position.timestamp - this.previousPosition.timestamp) / 1000;

      if (timeDiff > 0) {
        const distance = this.calculateDistance(
          this.previousPosition.lat,
          this.previousPosition.lon,
          this.position.lat,
          this.position.lon
        );

        sog = (distance / timeDiff) * 1.94384;

        if (!this.position.heading) {
          cog = this.calculateBearing(
            this.previousPosition.lat,
            this.previousPosition.lon,
            this.position.lat,
            this.position.lon
          );
        }
      }
    }

    if (this.position.speed !== null) {
      sog = this.position.speed * 1.94384;
    }

    return {
      position: this.position,
      sog: Math.round(sog * 10) / 10,
      cog: Math.round(cog),
      track: this.trackHistory
    };
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
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

  onUpdate(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(data) {
    this.listeners.forEach(callback => callback(data));
  }

  getCurrentPosition() {
    return this.position;
  }
}