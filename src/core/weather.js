export class Weather {
  constructor() {
    // OpenWeatherMap free tier API key (you'll need to replace with your own)
    // Sign up at https://openweathermap.org/api
    this.apiKey = 'YOUR_API_KEY_HERE';
    this.weatherData = null;
    this.windField = null;
    this.lastFetch = null;
    this.cacheTime = 30 * 60 * 1000; // 30 minutes cache
  }

  async fetchWeatherData(lat, lon) {
    // Check cache
    if (this.lastFetch && Date.now() - this.lastFetch < this.cacheTime) {
      return this.weatherData;
    }

    try {
      // For now, use OpenWeatherMap API (free tier allows 1000 calls/day)
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Weather fetch failed');
      }

      const data = await response.json();

      this.weatherData = {
        wind: {
          speed: data.wind.speed * 1.94384, // Convert m/s to knots
          direction: data.wind.deg,
          gust: data.wind.gust ? data.wind.gust * 1.94384 : null
        },
        pressure: data.main.pressure,
        temp: data.main.temp,
        humidity: data.main.humidity,
        visibility: data.visibility,
        clouds: data.clouds.all,
        timestamp: Date.now()
      };

      this.lastFetch = Date.now();
      return this.weatherData;
    } catch (error) {
      console.error('Weather fetch error:', error);
      // Return last known data or default
      return this.weatherData || this.getDefaultWind();
    }
  }

  async fetchWindField(bounds) {
    // Fetch wind data for the entire visible area
    // This would use a more comprehensive API or GRIB data
    // For now, we'll interpolate from multiple points

    const gridSize = 5; // 5x5 grid
    const latRange = bounds.north - bounds.south;
    const lonRange = bounds.east - bounds.west;

    const windGrid = [];

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const lat = bounds.south + (i / (gridSize - 1)) * latRange;
        const lon = bounds.west + (j / (gridSize - 1)) * lonRange;

        // In production, batch these requests or use a proper wind field API
        // For now, use interpolated/simulated data
        windGrid.push({
          lat,
          lon,
          wind: this.interpolateWind(lat, lon)
        });
      }
    }

    this.windField = windGrid;
    return windGrid;
  }

  interpolateWind(lat, lon) {
    // Simulate wind patterns for demo
    // In production, this would use real data
    if (this.weatherData) {
      // Add some variation based on location
      const variation = Math.sin(lat * 10) * 5;
      return {
        speed: this.weatherData.wind.speed + variation,
        direction: (this.weatherData.wind.direction + variation * 2) % 360
      };
    }

    // Default prevailing westerlies
    return {
      speed: 10 + Math.random() * 5,
      direction: 270 + Math.random() * 30
    };
  }

  getDefaultWind() {
    // Default wind for testing/demo
    return {
      wind: {
        speed: 10,
        direction: 270,
        gust: null
      },
      timestamp: Date.now()
    };
  }

  calculateTWA(boatHeading, windDirection) {
    // Calculate True Wind Angle
    let twa = windDirection - boatHeading;

    // Normalize to -180 to 180
    while (twa > 180) twa -= 360;
    while (twa < -180) twa += 360;

    return Math.abs(twa);
  }

  calculateApparentWind(trueWindSpeed, trueWindDirection, boatSpeed, boatHeading) {
    // Convert to radians
    const twdRad = trueWindDirection * Math.PI / 180;
    const hdgRad = boatHeading * Math.PI / 180;

    // True wind components
    const twx = trueWindSpeed * Math.sin(twdRad);
    const twy = trueWindSpeed * Math.cos(twdRad);

    // Boat motion components (opposite direction)
    const bx = -boatSpeed * Math.sin(hdgRad);
    const by = -boatSpeed * Math.cos(hdgRad);

    // Apparent wind components
    const awx = twx + bx;
    const awy = twy + by;

    // Calculate apparent wind speed and direction
    const aws = Math.sqrt(awx * awx + awy * awy);
    const awd = Math.atan2(awx, awy) * 180 / Math.PI;

    return {
      speed: aws,
      direction: (awd + 360) % 360
    };
  }

  isInNoGoZone(boatHeading, windDirection, noGoAngle = 45) {
    // Check if boat is pointing too close to the wind
    const twa = this.calculateTWA(boatHeading, windDirection);
    return twa < noGoAngle;
  }

  calculateOptimalTack(currentPosition, targetPosition, windDirection, boatType = 'catamaran') {
    // Calculate optimal tacking angles for upwind sailing
    const closeHauledAngle = boatType === 'catamaran' ? 50 : 45;

    const directBearing = this.calculateBearing(
      currentPosition.lat, currentPosition.lon,
      targetPosition.lat, targetPosition.lon
    );

    const twa = this.calculateTWA(directBearing, windDirection);

    if (twa < closeHauledAngle) {
      // Need to tack - calculate port and starboard options
      const portTack = (windDirection - closeHauledAngle + 360) % 360;
      const starboardTack = (windDirection + closeHauledAngle) % 360;

      // Calculate which tack gets us closer to target
      const portProgress = Math.cos((portTack - directBearing) * Math.PI / 180);
      const starboardProgress = Math.cos((starboardTack - directBearing) * Math.PI / 180);

      return {
        needsTacking: true,
        recommendedTack: portProgress > starboardProgress ? 'port' : 'starboard',
        courseToSteer: portProgress > starboardProgress ? portTack : starboardTack,
        tackAngle: closeHauledAngle
      };
    }

    return {
      needsTacking: false,
      courseToSteer: directBearing
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
}