export class BoatPolar {
  constructor() {
    this.polarData = this.getDefaultPolar();
    this.customPolar = null;
  }

  getDefaultPolar() {
    return {
      name: 'Default 35ft Cruiser',
      hullSpeed: 7.5, // knots
      angles: [0, 30, 45, 60, 75, 90, 110, 120, 135, 150, 165, 180],
      speeds: {
        5: [0, 0, 2.5, 3.2, 3.8, 4.2, 4.0, 3.5, 3.0, 2.5, 2.0, 1.8],
        10: [0, 0, 4.5, 5.5, 6.0, 6.5, 6.8, 6.5, 5.5, 4.5, 3.8, 3.5],
        15: [0, 0, 5.5, 6.5, 7.0, 7.5, 7.8, 7.5, 6.8, 6.0, 5.5, 5.2],
        20: [0, 0, 5.8, 6.8, 7.2, 7.5, 8.0, 7.8, 7.2, 6.8, 6.5, 6.2],
        25: [0, 0, 5.5, 6.5, 7.0, 7.3, 7.8, 7.6, 7.0, 6.8, 6.8, 6.8],
        30: [0, 0, 5.0, 6.0, 6.5, 6.8, 7.2, 7.0, 6.8, 6.8, 7.0, 7.0]
      }
    };
  }

  setCustomPolar(polarData) {
    this.customPolar = polarData;
  }

  getCurrentPolar() {
    return this.customPolar || this.polarData;
  }

  getBoatSpeed(trueWindSpeed, trueWindAngle) {
    const polar = this.getCurrentPolar();

    // Normalize wind angle to 0-180 (port/starboard doesn't matter for speed)
    const normalizedAngle = Math.min(Math.abs(trueWindAngle), 360 - Math.abs(trueWindAngle));

    // Find the two closest wind speeds in our polar table
    const windSpeeds = Object.keys(polar.speeds).map(Number).sort((a, b) => a - b);
    let lowerWindSpeed = windSpeeds[0];
    let upperWindSpeed = windSpeeds[windSpeeds.length - 1];

    for (let i = 0; i < windSpeeds.length - 1; i++) {
      if (trueWindSpeed >= windSpeeds[i] && trueWindSpeed <= windSpeeds[i + 1]) {
        lowerWindSpeed = windSpeeds[i];
        upperWindSpeed = windSpeeds[i + 1];
        break;
      }
    }

    // Get speeds for both wind speeds
    const lowerSpeeds = this.interpolateAngle(polar.speeds[lowerWindSpeed], polar.angles, normalizedAngle);
    const upperSpeeds = this.interpolateAngle(polar.speeds[upperWindSpeed], polar.angles, normalizedAngle);

    // Interpolate between wind speeds
    if (lowerWindSpeed === upperWindSpeed) {
      return lowerSpeeds;
    }

    const windRatio = (trueWindSpeed - lowerWindSpeed) / (upperWindSpeed - lowerWindSpeed);
    return lowerSpeeds + (upperSpeeds - lowerSpeeds) * windRatio;
  }

  interpolateAngle(speeds, angles, targetAngle) {
    // Find the two closest angles
    for (let i = 0; i < angles.length - 1; i++) {
      if (targetAngle >= angles[i] && targetAngle <= angles[i + 1]) {
        const angleRatio = (targetAngle - angles[i]) / (angles[i + 1] - angles[i]);
        return speeds[i] + (speeds[i + 1] - speeds[i]) * angleRatio;
      }
    }

    // If angle is beyond our data, return the closest
    if (targetAngle <= angles[0]) return speeds[0];
    return speeds[speeds.length - 1];
  }

  calculateVMG(trueWindSpeed, trueWindAngle, targetAngle) {
    const boatSpeed = this.getBoatSpeed(trueWindSpeed, trueWindAngle);
    const angleDiff = Math.abs(trueWindAngle - targetAngle);
    return boatSpeed * Math.cos(angleDiff * Math.PI / 180);
  }

  findOptimalVMGAngles(trueWindSpeed, targetAngle) {
    const polar = this.getCurrentPolar();
    let bestUpwindAngle = 45;
    let bestUpwindVMG = 0;
    let bestDownwindAngle = 135;
    let bestDownwindVMG = 0;

    // Check all angles for best VMG
    for (let angle of polar.angles) {
      const vmg = this.calculateVMG(trueWindSpeed, angle, targetAngle);

      // Upwind (angles less than 90)
      if (angle < 90 && angle > 30) {
        if (vmg > bestUpwindVMG) {
          bestUpwindVMG = vmg;
          bestUpwindAngle = angle;
        }
      }

      // Downwind (angles greater than 90)
      if (angle > 90 && angle < 180) {
        const downwindVMG = this.calculateVMG(trueWindSpeed, angle, targetAngle + 180);
        if (downwindVMG > bestDownwindVMG) {
          bestDownwindVMG = downwindVMG;
          bestDownwindAngle = angle;
        }
      }
    }

    return {
      upwind: { angle: bestUpwindAngle, vmg: bestUpwindVMG },
      downwind: { angle: bestDownwindAngle, vmg: bestDownwindVMG }
    };
  }

  getTargetSpeed(trueWindSpeed, trueWindAngle) {
    return this.getBoatSpeed(trueWindSpeed, trueWindAngle);
  }

  getPerformanceRatio(currentSpeed, trueWindSpeed, trueWindAngle) {
    const targetSpeed = this.getTargetSpeed(trueWindSpeed, trueWindAngle);
    if (targetSpeed === 0) return 0;
    return (currentSpeed / targetSpeed) * 100;
  }

  exportPolar() {
    return JSON.stringify(this.getCurrentPolar(), null, 2);
  }

  importPolar(jsonString) {
    try {
      const polar = JSON.parse(jsonString);
      // Validate structure
      if (polar.angles && polar.speeds && polar.name) {
        this.customPolar = polar;
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
}