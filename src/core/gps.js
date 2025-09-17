export class GPSTracker {
  constructor() {
    this.position = null;
    this.previousPosition = null;
    this.watchId = null;
    this.listeners = new Set();
    this.trackHistory = [];
    this.maxTrackPoints = 1000;

    // Smoothing buffers
    this.sogBuffer = [];
    this.cogBuffer = [];
    this.maxBufferSize = 5; // Average over last 5 readings
    this.lowSpeedThreshold = 1.0; // knots - below this apply heavy smoothing
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

    let rawSog = 0;
    let rawCog = this.position.heading || 0;

    if (this.previousPosition && this.position) {
      const timeDiff = (this.position.timestamp - this.previousPosition.timestamp) / 1000;

      if (timeDiff > 0) {
        const distance = this.calculateDistance(
          this.previousPosition.lat,
          this.previousPosition.lon,
          this.position.lat,
          this.position.lon
        );

        rawSog = (distance / timeDiff) * 1.94384; // Convert m/s to knots

        if (!this.position.heading) {
          rawCog = this.calculateBearing(
            this.previousPosition.lat,
            this.previousPosition.lon,
            this.position.lat,
            this.position.lon
          );
        }
      }
    }

    // Use device speed if available (usually more accurate)
    if (this.position.speed !== null) {
      rawSog = this.position.speed * 1.94384;
    }

    // Apply smoothing
    const smoothedData = this.applySmoothong(rawSog, rawCog);

    return {
      position: this.position,
      sog: Math.round(smoothedData.sog * 10) / 10,
      cog: Math.round(smoothedData.cog),
      track: this.trackHistory
    };
  }

  applySmoothong(rawSog, rawCog) {
    // Add to buffers
    this.sogBuffer.push(rawSog);
    this.cogBuffer.push(rawCog);

    // Adjust buffer size based on speed
    // At low speeds, use more samples for smoothing
    let effectiveBufferSize = rawSog < this.lowSpeedThreshold
      ? Math.min(this.sogBuffer.length, 10) // Heavy smoothing at low speed
      : Math.min(this.sogBuffer.length, 3);  // Light smoothing at higher speeds

    // Trim buffers to max size
    if (this.sogBuffer.length > this.maxBufferSize * 2) {
      this.sogBuffer.shift();
    }
    if (this.cogBuffer.length > this.maxBufferSize * 2) {
      this.cogBuffer.shift();
    }

    // Calculate weighted average for SOG
    // More recent values get higher weight
    let sogSum = 0;
    let weightSum = 0;
    const sogSamples = this.sogBuffer.slice(-effectiveBufferSize);

    sogSamples.forEach((value, index) => {
      const weight = index + 1; // Linear weighting
      sogSum += value * weight;
      weightSum += weight;
    });

    const smoothedSog = weightSum > 0 ? sogSum / weightSum : rawSog;

    // For COG, handle circular averaging
    let smoothedCog = rawCog;

    if (smoothedSog > 0.5) { // Only smooth COG when moving
      const cogSamples = this.cogBuffer.slice(-effectiveBufferSize);
      smoothedCog = this.circularMean(cogSamples);
    } else {
      // At very low speeds, keep the last valid COG
      if (this.cogBuffer.length > 1) {
        // Find last COG when speed was > 0.5 knots
        for (let i = this.cogBuffer.length - 2; i >= 0; i--) {
          if (this.sogBuffer[i] > 0.5) {
            smoothedCog = this.cogBuffer[i];
            break;
          }
        }
      }
    }

    // Apply minimum speed threshold
    const finalSog = smoothedSog < 0.1 ? 0 : smoothedSog;

    return {
      sog: finalSog,
      cog: smoothedCog
    };
  }

  circularMean(angles) {
    // Convert angles to radians and calculate mean using vector addition
    let sinSum = 0;
    let cosSum = 0;
    let weightSum = 0;

    angles.forEach((angle, index) => {
      const weight = index + 1; // Linear weighting
      const radians = angle * Math.PI / 180;
      sinSum += Math.sin(radians) * weight;
      cosSum += Math.cos(radians) * weight;
      weightSum += weight;
    });

    const meanAngle = Math.atan2(sinSum / weightSum, cosSum / weightSum) * 180 / Math.PI;
    return (meanAngle + 360) % 360;
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