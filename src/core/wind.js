export class WindCalculator {
  constructor() {
    this.trueWindSpeed = 10; // knots
    this.trueWindDirection = 0; // degrees (0 = North)
    this.currentSet = 0; // degrees
    this.currentDrift = 0; // knots
  }

  setWind(speed, direction) {
    this.trueWindSpeed = speed;
    this.trueWindDirection = direction;
  }

  setCurrent(set, drift) {
    this.currentSet = set;
    this.currentDrift = drift;
  }

  getTrueWindAngle(heading) {
    // Calculate TWA relative to boat heading
    let twa = this.trueWindDirection - heading;

    // Normalize to -180 to 180
    while (twa > 180) twa -= 360;
    while (twa < -180) twa += 360;

    return Math.abs(twa);
  }

  getApparentWind(boatSpeed, heading) {
    // Convert to radians
    const headingRad = heading * Math.PI / 180;
    const twdRad = this.trueWindDirection * Math.PI / 180;

    // True wind components
    const twx = this.trueWindSpeed * Math.sin(twdRad);
    const twy = this.trueWindSpeed * Math.cos(twdRad);

    // Boat velocity components (opposite direction)
    const bvx = -boatSpeed * Math.sin(headingRad);
    const bvy = -boatSpeed * Math.cos(headingRad);

    // Apparent wind components
    const awx = twx + bvx;
    const awy = twy + bvy;

    // Calculate apparent wind speed and angle
    const apparentSpeed = Math.sqrt(awx * awx + awy * awy);
    let apparentDirection = Math.atan2(awx, awy) * 180 / Math.PI;

    // Normalize direction
    if (apparentDirection < 0) apparentDirection += 360;

    // Calculate apparent wind angle relative to heading
    let awa = apparentDirection - heading;
    while (awa > 180) awa -= 360;
    while (awa < -180) awa += 360;

    return {
      speed: apparentSpeed,
      direction: apparentDirection,
      angle: Math.abs(awa)
    };
  }

  calculateLaylines(currentLat, currentLon, targetLat, targetLon, boatPolar) {
    // Calculate bearing to target
    const targetBearing = this.calculateBearing(currentLat, currentLon, targetLat, targetLon);

    // Get optimal VMG angles
    const optimalAngles = boatPolar.findOptimalVMGAngles(this.trueWindSpeed, 0);

    // Calculate layline bearings
    const portLayline = (this.trueWindDirection + optimalAngles.upwind.angle) % 360;
    const starboardLayline = (this.trueWindDirection - optimalAngles.upwind.angle + 360) % 360;

    // Calculate distance to laylines
    const distanceToTarget = this.calculateDistance(currentLat, currentLon, targetLat, targetLon);

    // Calculate layline intercept points
    const portIntercept = this.calculateLaylineIntercept(
      currentLat, currentLon, targetLat, targetLon,
      portLayline, targetBearing
    );

    const starboardIntercept = this.calculateLaylineIntercept(
      currentLat, currentLon, targetLat, targetLon,
      starboardLayline, targetBearing
    );

    return {
      port: {
        bearing: portLayline,
        intercept: portIntercept,
        angle: optimalAngles.upwind.angle,
        vmg: optimalAngles.upwind.vmg
      },
      starboard: {
        bearing: starboardLayline,
        intercept: starboardIntercept,
        angle: optimalAngles.upwind.angle,
        vmg: optimalAngles.upwind.vmg
      },
      targetBearing,
      distanceToTarget
    };
  }

  calculateLaylineIntercept(boatLat, boatLon, targetLat, targetLon, laylineBearing, targetBearing) {
    // Simplified calculation for layline intercept
    // In practice, this would involve more complex spherical trigonometry
    const angleToTarget = Math.abs(laylineBearing - targetBearing);
    const distanceToTarget = this.calculateDistance(boatLat, boatLon, targetLat, targetLon);

    // Calculate distance to sail on current tack before tacking
    const distanceOnLayline = distanceToTarget * Math.sin(angleToTarget * Math.PI / 180);

    // Calculate intercept point
    const interceptLat = boatLat + (distanceOnLayline / 60) * Math.cos(laylineBearing * Math.PI / 180);
    const interceptLon = boatLon + (distanceOnLayline / 60) * Math.sin(laylineBearing * Math.PI / 180) / Math.cos(boatLat * Math.PI / 180);

    return {
      lat: interceptLat,
      lon: interceptLon,
      distance: distanceOnLayline
    };
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

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // nautical miles
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

  calculateLeeway(boatSpeed, heelAngle, trueWindAngle) {
    // Simplified leeway calculation
    // Leeway increases with heel and decreases with speed
    const baseLeeway = 3; // degrees
    const heelFactor = Math.abs(heelAngle) / 15; // 1 degree per 15 degrees heel
    const speedFactor = Math.max(0, 1 - boatSpeed / 8); // reduces with speed

    let leeway = baseLeeway * heelFactor * speedFactor;

    // Leeway is minimal when running
    if (trueWindAngle > 135) {
      leeway *= 0.2;
    }

    return leeway;
  }

  getWindShift(previousDirection) {
    const shift = this.trueWindDirection - previousDirection;

    // Normalize to -180 to 180
    let normalizedShift = shift;
    while (normalizedShift > 180) normalizedShift -= 360;
    while (normalizedShift < -180) normalizedShift += 360;

    return {
      magnitude: Math.abs(normalizedShift),
      direction: normalizedShift > 0 ? 'veer' : 'back',
      favorable: null // Will be calculated based on tack
    };
  }
}