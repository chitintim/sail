export class Weather {
  constructor() {
    this.weatherData = null;
    this.windField = null;
    this.forecastCache = new Map();
    this.lastFetch = null;
    this.cacheTime = 3 * 60 * 60 * 1000; // 3 hours cache
  }

  async fetchWeatherData(lat, lon) {
    try {
      // Use NOAA's public WindFinder API proxy (no key needed)
      // Alternative: OpenMeteo free weather API
      const url = `https://api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m&forecast_days=2&wind_speed_unit=kn`;

      const response = await fetch(url);
      if (!response.ok) {
        // Fallback to cached or estimated data
        return this.estimateWind(lat, lon);
      }

      const data = await response.json();

      // Parse the hourly forecast
      const currentHour = new Date().getHours();
      const windSpeed = data.hourly.wind_speed_10m[currentHour];
      const windDirection = data.hourly.wind_direction_10m[currentHour];

      this.weatherData = {
        wind: {
          speed: windSpeed,
          direction: windDirection,
          gust: null
        },
        forecast: data.hourly,
        source: 'openmeteo',
        timestamp: Date.now()
      };

      this.lastFetch = Date.now();
      this.forecastCache.set(`${lat.toFixed(2)},${lon.toFixed(2)}`, this.weatherData);

      return this.weatherData;
    } catch (error) {
      console.warn('Weather fetch failed, using estimation:', error);
      return this.estimateWind(lat, lon);
    }
  }

  estimateWind(lat, lon) {
    // Estimate wind based on typical patterns
    // Trade winds, westerlies, etc.

    // Tropical trade winds (0-30°)
    if (Math.abs(lat) < 30) {
      return {
        wind: {
          speed: 10 + Math.random() * 5,
          direction: lat > 0 ? 60 : 120, // NE trades in north, SE in south
        },
        source: 'estimated',
        timestamp: Date.now()
      };
    }

    // Westerlies (30-60°)
    if (Math.abs(lat) < 60) {
      return {
        wind: {
          speed: 12 + Math.random() * 8,
          direction: 270 + (Math.random() - 0.5) * 60,
        },
        source: 'estimated',
        timestamp: Date.now()
      };
    }

    // Polar easterlies
    return {
      wind: {
        speed: 8 + Math.random() * 6,
        direction: 90,
      },
      source: 'estimated',
      timestamp: Date.now()
    };
  }

  async getWindAtWaypoints(waypoints) {
    // Get wind forecast at each waypoint for route planning
    const windData = [];

    for (const waypoint of waypoints) {
      const weather = await this.fetchWeatherData(waypoint.lat, waypoint.lon);
      windData.push({
        waypoint: waypoint.name,
        lat: waypoint.lat,
        lon: waypoint.lon,
        wind: weather.wind,
        forecast: weather.forecast
      });
    }

    return windData;
  }

  async getRouteWindForecast(route, estimatedSpeeds) {
    // Calculate wind at each leg midpoint based on estimated arrival time
    const forecast = [];
    let cumulativeTime = 0;

    for (let i = 0; i < route.waypoints.length - 1; i++) {
      const from = route.waypoints[i];
      const to = route.waypoints[i + 1];

      // Midpoint of leg
      const midLat = (from.lat + to.lat) / 2;
      const midLon = (from.lon + to.lon) / 2;

      // Estimated time to reach midpoint
      const legDistance = this.calculateDistance(from.lat, from.lon, to.lat, to.lon);
      const legTime = legDistance / (estimatedSpeeds?.[i] || 5); // hours
      cumulativeTime += legTime / 2;

      const weather = await this.fetchWeatherData(midLat, midLon);

      // Get forecast for estimated arrival time
      const forecastHour = Math.min(Math.round(cumulativeTime), 47); // 48 hour forecast max

      forecast.push({
        leg: `${from.name} to ${to.name}`,
        midpoint: { lat: midLat, lon: midLon },
        estimatedTime: cumulativeTime,
        wind: weather.forecast ? {
          speed: weather.forecast.wind_speed_10m[forecastHour],
          direction: weather.forecast.wind_direction_10m[forecastHour]
        } : weather.wind
      });

      cumulativeTime += legTime / 2;
    }

    return forecast;
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