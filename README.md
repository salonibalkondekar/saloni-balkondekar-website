# Saloni Balkondekar - Personal Website

<p align="center">
    <img src="./src/website_ui.png" alt="3D Animated Flower Preview" width="400" />
</p>

A modern, interactive personal portfolio website showcasing expertise in AI and Mechanical Engineering with a stunning 3D animated flower design.

## 🌟 Features

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Interactive 3D Flower**: Fully interactive animated flower with manual rotation controls
- **Modern UI**: Clean, professional design with smooth animations
- **Consistent Design System**: CSS custom properties for maintainable styling
- **Modular Architecture**: Organized component-based file structure

## 🎨 Interactive Elements

### 3D Flower Animation
- **Auto-rotation**: Smooth 3D rotation with floating animation
- **Manual Control**: Click and drag to manually rotate the flower
- **Petal Interactions**: Click individual petals for pulse effects
- **Center Click**: Creates a cascading wave effect through all petals
- **Hover Effects**: Enhanced glow and scale effects
- **Double-click Reset**: Returns to automatic animation

### Social Links
- Animated arrow indicators
- Smooth hover transitions
- Glow effects on interaction

## 🏗️ Project Structure

```
website/
├── index.html              # Main HTML file
├── README.md              # Project documentation
└── src/                   # Source components
    ├── styles.css         # Main styles & variables
    ├── flower.css         # 3D flower animations
    ├── responsive.css     # Responsive design
    └── script.js          # Interactive functionality
```

## 🚀 Getting Started

### Prerequisites
- Modern web browser with CSS3 and ES6 support
- No build tools required - runs directly in browser

### Installation

1. **Clone or download** the project files
2. **Navigate** to the project directory
3. **Open** `index.html` in your preferred web browser

```bash
# If using a local server (recommended)
cd /path/to/website
python -m http.server 8000
# Then visit http://localhost:8000
```

### File Serving
For the best experience, serve the files through a local server rather than opening directly in the browser to avoid CORS issues.

## 🎯 Component Overview

### `src/styles.css`
- **CSS Custom Properties**: Centralized design tokens
- **Base Styles**: Typography, layout, and core styling
- **Component Styles**: Social links, contact info, skill badges
- **Utility Classes**: Reusable styling utilities

### `src/flower.css`
- **3D Flower Component**: Complete flower animation system
- **Keyframe Animations**: Smooth rotation and floating effects
- **Hover States**: Interactive feedback for user engagement
- **Transform Styles**: Complex 3D positioning and rotation

### `src/responsive.css`
- **Mobile-First Design**: Optimized for all screen sizes
- **Breakpoint Management**: Tablet and mobile adaptations
- **Layout Adjustments**: Flexible component sizing

### `src/script.js`
- **Interaction Logic**: Manual rotation and click handlers
- **Animation Controls**: Play/pause and reset functionality
- **Event Management**: Mouse tracking and drag controls
- **Effect Systems**: Petal animations and visual feedback

## 🎨 Design System

### Color Palette
```css
--color-primary: #a855f7    /* Purple */
--color-secondary: #60a5fa  /* Blue */
--color-accent: #ec4899     /* Pink */
--color-text-primary: #ffffff
--color-text-secondary: #94a3b8
--color-text-tertiary: #cbd5e1
--color-background: #0f172a
```

### Spacing Scale
```css
--spacing-xs: 0.5rem   /* 8px */
--spacing-sm: 0.75rem  /* 12px */
--spacing-md: 1rem     /* 16px */
--spacing-lg: 1.5rem   /* 24px */
--spacing-xl: 2rem     /* 32px */
```

### Typography
- **Primary Font**: Inter, with system font fallbacks
- **Responsive Sizing**: clamp() functions for fluid scaling
- **Weight Hierarchy**: 400 (regular), 600 (semibold), 700 (bold)

## 📱 Responsive Breakpoints

- **Desktop**: > 1024px (Full layout with large flower)
- **Tablet**: 768px - 1024px (Reduced flower size)
- **Mobile**: < 768px (Stacked layout, smallest flower)

## 🔧 Customization

### Updating Content
Edit the content directly in `index.html`:
- **Name**: Update the `main-title` element
- **Skills**: Modify the `skill-badge` elements
- **Links**: Update href attributes in social links
- **Contact**: Change email in contact info

### Styling Changes
Modify CSS custom properties in `src/styles.css` for global changes:
- **Colors**: Update color variables
- **Spacing**: Adjust spacing scale
- **Typography**: Change font sizes and weights

### Animation Adjustments
Fine-tune animations in `src/flower.css`:
- **Speed**: Modify animation duration values
- **Intensity**: Adjust transform values and timing functions

## 🌐 Browser Compatibility

- **Chrome**: 60+ ✅
- **Firefox**: 55+ ✅
- **Safari**: 12+ ✅
- **Edge**: 79+ ✅

### Required Features
- CSS Custom Properties
- CSS Grid & Flexbox
- CSS 3D Transforms
- ES6 JavaScript

## 🚀 Performance Optimizations

- **Lightweight**: No external dependencies
- **Efficient Animations**: Hardware-accelerated transforms
- **Optimized Images**: No heavy assets
- **Minimal JavaScript**: Clean, efficient event handling

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Feel free to fork this project and adapt it for your own portfolio! If you make improvements, pull requests are welcome.

## 📞 Contact

- **Email**: saloni.balkondekar@gmail.com
- **LinkedIn**: [linkedin.com/in/salonibalkondekar](https://www.linkedin.com/in/salonibalkondekar)
- **GitHub**: [github.com/salonibalkondekar](https://github.com/salonibalkondekar)

---

Built with ❤️ by Saloni Balkondekar
