export class WindOverlay {
  constructor(map) {
    this.map = map;
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.windData = null;
    this.animationId = null;
    this.visible = false;
  }

  initialize() {
    // Create canvas overlay
    const container = this.map.getContainer();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wind-overlay';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '400';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    // Handle map events
    this.map.on('move', () => this.render());
    this.map.on('resize', () => this.resize());

    this.resize();
  }

  resize() {
    const size = this.map.getSize();
    this.canvas.width = size.x;
    this.canvas.height = size.y;
    this.render();
  }

  setWindData(windData) {
    this.windData = windData;
    if (this.visible) {
      this.initParticles();
      this.render();
    }
  }

  show() {
    this.visible = true;
    this.canvas.style.display = 'block';
    this.initParticles();
    this.animate();
  }

  hide() {
    this.visible = false;
    this.canvas.style.display = 'none';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  initParticles() {
    if (!this.windData) return;

    this.particles = [];
    const numParticles = 100;

    for (let i = 0; i < numParticles; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        age: Math.random() * 100,
        maxAge: 100 + Math.random() * 100
      });
    }
  }

  animate() {
    if (!this.visible) return;

    this.updateParticles();
    this.render();

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  updateParticles() {
    if (!this.windData) return;

    this.particles.forEach(particle => {
      // Get wind at particle position
      const wind = this.getWindAtPixel(particle.x, particle.y);

      if (wind) {
        // Move particle based on wind
        const speed = wind.speed / 10; // Scale for animation
        const dirRad = (270 - wind.direction) * Math.PI / 180; // Meteorological to math convention

        particle.x += Math.cos(dirRad) * speed;
        particle.y += Math.sin(dirRad) * speed;
      }

      // Age particle
      particle.age++;

      // Reset if out of bounds or too old
      if (particle.age > particle.maxAge ||
          particle.x < 0 || particle.x > this.canvas.width ||
          particle.y < 0 || particle.y > this.canvas.height) {
        particle.x = Math.random() * this.canvas.width;
        particle.y = Math.random() * this.canvas.height;
        particle.age = 0;
        particle.maxAge = 100 + Math.random() * 100;
      }
    });
  }

  getWindAtPixel(x, y) {
    if (!this.windData) return null;

    // Convert pixel to lat/lon
    const point = this.map.containerPointToLatLng([x, y]);

    // Find nearest wind data point (simplified)
    // In production, would interpolate between grid points
    let nearest = null;
    let minDist = Infinity;

    if (Array.isArray(this.windData)) {
      this.windData.forEach(data => {
        const dist = Math.sqrt(
          Math.pow(data.lat - point.lat, 2) +
          Math.pow(data.lon - point.lng, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          nearest = data.wind;
        }
      });
    } else if (this.windData.wind) {
      // Single wind data point
      nearest = this.windData.wind;
    }

    return nearest;
  }

  render() {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.visible || !this.windData) return;

    // Draw particles
    this.drawParticles();

    // Draw wind barbs at grid points
    this.drawWindBarbs();
  }

  drawParticles() {
    this.ctx.strokeStyle = 'rgba(30, 64, 175, 0.6)'; // Primary color with transparency
    this.ctx.lineWidth = 1.5;

    this.particles.forEach(particle => {
      const opacity = 1 - (particle.age / particle.maxAge);
      this.ctx.globalAlpha = opacity * 0.6;

      // Draw particle trail
      const wind = this.getWindAtPixel(particle.x, particle.y);
      if (wind) {
        const dirRad = (270 - wind.direction) * Math.PI / 180;
        const tailLength = Math.min(wind.speed / 2, 20);

        this.ctx.beginPath();
        this.ctx.moveTo(particle.x, particle.y);
        this.ctx.lineTo(
          particle.x - Math.cos(dirRad) * tailLength,
          particle.y - Math.sin(dirRad) * tailLength
        );
        this.ctx.stroke();
      }
    });

    this.ctx.globalAlpha = 1;
  }

  drawWindBarbs() {
    if (!Array.isArray(this.windData)) return;

    this.ctx.strokeStyle = 'rgba(30, 64, 175, 0.8)';
    this.ctx.lineWidth = 2;

    this.windData.forEach(data => {
      const point = this.map.latLngToContainerPoint([data.lat, data.lon]);

      this.drawWindBarb(
        point.x,
        point.y,
        data.wind.speed,
        data.wind.direction
      );
    });
  }

  drawWindBarb(x, y, speed, direction) {
    // Draw standard wind barb
    const barbLength = 30;
    const dirRad = (270 - direction) * Math.PI / 180;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(dirRad + Math.PI);

    // Main shaft
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, barbLength);
    this.ctx.stroke();

    // Add barbs based on speed
    // 50 knots = flag, 10 knots = long barb, 5 knots = short barb
    let remainingSpeed = speed;
    let barbPosition = barbLength;

    // Flags (50 knots)
    while (remainingSpeed >= 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, barbPosition);
      this.ctx.lineTo(7, barbPosition - 4);
      this.ctx.lineTo(0, barbPosition - 8);
      this.ctx.fill();
      barbPosition -= 10;
      remainingSpeed -= 50;
    }

    // Long barbs (10 knots)
    while (remainingSpeed >= 10) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, barbPosition);
      this.ctx.lineTo(7, barbPosition - 4);
      this.ctx.stroke();
      barbPosition -= 5;
      remainingSpeed -= 10;
    }

    // Short barb (5 knots)
    if (remainingSpeed >= 5) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, barbPosition);
      this.ctx.lineTo(4, barbPosition - 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
}