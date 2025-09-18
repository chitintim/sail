# Sail Navigation

A Progressive Web App for sailing navigation, optimized for catamarans. No backend, no API keys, 100% client-side.

**Live App**: https://chitintim.github.io/sail/

## Features

### 🧭 Navigation
- Real-time GPS tracking with advanced smoothing
- Multi-waypoint route planning
- Cross-track error (XTE) display
- Course-to-steer (CTS) calculations
- Automatic waypoint advancement
- Skip waypoint functionality

### ⛵ Performance
- Catamaran-optimized polars (default 40ft Lagoon)
- VMG calculations
- Target speed display
- Performance percentage
- Laylines for optimal tacking angles

### 🌤️ Weather (No API Key Required!)
- Automatic wind data from OpenMeteo
- Wind visualization with animated particles
- Wind barbs display
- No-go zone warnings
- Tacking recommendations
- Route wind forecasting

### 📱 Mobile Optimized
- One-handed operation
- Large touch targets
- Works offline (PWA)
- Install to home screen
- Auto-caching of map tiles

## Quick Start

### Using the App

1. **Access**: Navigate to https://chitintim.github.io/sail/
2. **GPS Setup**:
   - Click "Enable GPS" for real-time navigation
   - Or "Continue Without GPS" for planning mode
3. **Add Waypoints**: Press the + button, then tap the map
4. **Start Navigating**: Follow the bearing and distance to waypoints

### Controls

- **☰** - Menu (settings, routes, boat setup)
- **+** - Add waypoint mode
- **⊕** - Center map on current position

## Development Setup

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/chitintim/sail.git
cd sail

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Deployment
The app automatically deploys to GitHub Pages when you push to the main branch.

## iOS Setup

### GPS Permission
1. Use Safari (Chrome won't work for GPS on iOS)
2. Access via HTTPS: https://chitintim.github.io/sail/
3. Settings > Safari > Location > While Using App
4. Click "Enable GPS" when prompted

### Install as App
1. Open in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. The app will work offline once installed

## Troubleshooting

### GPS Not Working
- **iOS**: Must use Safari and HTTPS URL
- Check Settings > Safari > Location is enabled
- Clear Safari cache if permission was previously denied

### Buttons Not Responding
- Hard refresh: Cmd+Shift+R (Mac)
- Clear Safari cache: Settings > Safari > Clear History

### Old Version Showing
- Service worker may be caching old version
- Force refresh or clear all site data

## Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Map**: Leaflet + OpenSeaMap
- **Storage**: IndexedDB
- **Weather**: OpenMeteo API (free, no key)
- **PWA**: Service Worker with offline support
- **Build**: Vite
- **Deploy**: GitHub Pages

## Browser Support

- iOS Safari 14+ (primary target)
- Chrome Mobile 90+
- Firefox Mobile 88+

## Data Privacy

- All data stays on your device
- No backend servers
- No user tracking
- Weather data fetched anonymously

## Contributing

Pull requests welcome! Please test on real devices, especially iOS Safari.

## License

MIT

## Author

Built for sailors who value simplicity and privacy.

---

*For detailed development documentation, see [DEVELOPMENT.md](DEVELOPMENT.md)*