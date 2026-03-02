# Firecrawl Branding System - Complete Reference

This document contains the complete Firecrawl branding system for creating beautifully designed, developer-focused pages with ASCII animations, heat-based colors, and polished interactions.

---

## 1. Color System

### Primary Brand Color

```
Heat Orange: #fa5d19
```

This is Firecrawl's signature color representing fire, heat, and speed. It must be used consistently across all primary interactions.

### Heat Scale

| Token | Hex | Usage |
|-------|-----|-------|
| heat-4 | rgba(250, 93, 25, 0.04) | Subtle backgrounds |
| heat-8 | rgba(250, 93, 25, 0.08) | Hover backgrounds |
| heat-12 | rgba(250, 93, 25, 0.12) | Active backgrounds |
| heat-100 | #fa5d19 | Primary brand color |

### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| amethyst | #9061ff | Purple accent |
| bluetron | #2a6dfb | Blue accent |
| crimson | #eb3424 | Red/error states |
| forest | #42c366 | Green/success |
| honey | #ecb730 | Yellow/warning |

### Semantic Colors

| Token | Light | Dark |
|-------|-------|------|
| accent-black | #262626 | #f5f5f5 |
| accent-white | #f5f5f5 | #262626 |
| bg-base | #f9f9f9 | #0a0a0a |
| bg-surface | #ffffff | #171717 |
| bg-surface-raised | #ffffff | #262626 |
| border-faint | #f0f0f0 | #262626 |
| border-muted | #e8e8e8 | #333333 |
| border-loud | #d1d1d1 | #525252 |

### Alpha Scales

**Black Alpha (Light Mode):**
```css
black-alpha-3: rgba(0, 0, 0, 0.03)
black-alpha-4: rgba(0, 0, 0, 0.04)
black-alpha-5: rgba(0, 0, 0, 0.05)
black-alpha-6: rgba(0, 0, 0, 0.06)
black-alpha-7: rgba(0, 0, 0, 0.07)
black-alpha-8: rgba(0, 0, 0, 0.08)
black-alpha-10: rgba(0, 0, 0, 0.10)
black-alpha-12: rgba(0, 0, 0, 0.12)
black-alpha-20: rgba(0, 0, 0, 0.20)
black-alpha-50: rgba(0, 0, 0, 0.50)
black-alpha-80: rgba(0, 0, 0, 0.80)
```

**White Alpha (Dark Mode):**
```css
white-alpha-3: rgba(255, 255, 255, 0.03)
white-alpha-4: rgba(255, 255, 255, 0.04)
/* ... same scale as black-alpha */
```

---

## 2. Typography System

### Font Families

```css
/* Primary - Premium sans-serif */
--font-primary: "SuisseIntl", -apple-system, BlinkMacSystemFont, sans-serif;

/* Monospace - Code and technical content */
--font-mono: "Geist Mono", "SF Mono", Menlo, monospace;

/* ASCII Art - Animations and decorative */
--font-ascii: "Roboto Mono", monospace;
```

### Title Hierarchy

| Class | Size | Line Height | Letter Spacing |
|-------|------|-------------|----------------|
| title-h1 | 60px | 64px | -0.3px |
| title-h2 | 52px | 56px | -0.52px |
| title-h3 | 40px | 44px | -0.4px |
| title-h4 | 32px | 36px | -0.32px |
| title-h5 | 24px | 32px | -0.24px |

### Body Text

| Class | Size | Line Height | Letter Spacing |
|-------|------|-------------|----------------|
| body-x-large | 20px | 28px | 0 |
| body-large | 16px | 24px | 0 |
| body-medium | 14px | 20px | 0.14px |
| body-small | 13px | 20px | 0 |
| body-input | 15px | 24px | 0 |

### Labels (weight: 450)

| Class | Size | Line Height |
|-------|------|-------------|
| label-x-large | 20px | 28px |
| label-large | 16px | 24px |
| label-medium | 14px | 20px |
| label-small | 13px | 18px |
| label-x-small | 12px | 16px |

### Monospace

| Class | Size | Line Height | Weight |
|-------|------|-------------|--------|
| mono-medium | 14px | 22px | 400 |
| mono-small | 13px | 20px | 500 |
| mono-x-small | 12px | 16px | 500 |

---

## 3. Button System

### Primary Button (Heat)

The primary button uses the heat color with multi-layer shadows for depth:

```tsx
// React/Tailwind implementation
<button className="
  bg-heat-100
  text-accent-white
  px-16 py-8
  rounded-8
  font-label-medium
  transition-all duration-200
  hover:shadow-lg
  active:scale-[0.995]
">
  Get Started
</button>
```

```css
/* CSS with full shadow stack */
.btn-primary {
  background: #ff4c00;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 450;
  font-size: 14px;
  line-height: 20px;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);

  /* Multi-layer shadow for depth */
  box-shadow:
    inset 0px -6px 12px 0px rgba(255, 0, 0, 0.2),
    0px 0.6px 0.8px 0px rgba(255, 139, 0, 0.22),
    0px 1.3px 1.7px 0px rgba(255, 139, 0, 0.19),
    0px 2.5px 3.1px 0px rgba(255, 139, 0, 0.16),
    0px 4.4px 5.5px 0px rgba(255, 139, 0, 0.13),
    0px 8.3px 10.3px 0px rgba(255, 139, 0, 0.1),
    0px 2px 4px 0px rgba(250, 93, 25, 0.3);
}

.btn-primary:hover {
  box-shadow:
    inset 0px -6px 12px 0px rgba(255, 0, 0, 0.2),
    0px 0.6px 0.8px 0px rgba(255, 139, 0, 0.24),
    0px 1.3px 1.7px 0px rgba(255, 139, 0, 0.21),
    0px 2.5px 3.1px 0px rgba(255, 139, 0, 0.18),
    0px 4.4px 5.5px 0px rgba(255, 139, 0, 0.15),
    0px 8.3px 10.3px 0px rgba(255, 139, 0, 0.12),
    0px 4px 8px 0px rgba(250, 93, 25, 0.4);
}

.btn-primary:active {
  transform: scale(0.995);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Secondary Button

```css
.btn-secondary {
  background: rgba(0, 0, 0, 0.04);
  color: #262626;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 450;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.btn-secondary:hover {
  background: rgba(0, 0, 0, 0.06);
}

.btn-secondary:active {
  transform: scale(0.99);
  background: rgba(0, 0, 0, 0.07);
}
```

### Tertiary Button (Ghost)

```css
.btn-tertiary {
  background: transparent;
  color: #262626;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 450;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.btn-tertiary:hover {
  background: rgba(0, 0, 0, 0.04);
}
```

### Destructive Button

```css
.btn-destructive {
  background: #dc2626; /* red-600 */
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 450;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.btn-destructive:hover {
  background: #b91c1c; /* red-700 */
}

.btn-destructive:active {
  transform: scale(0.98);
}
```

### Button Sizes

| Size | Height | Padding | Font |
|------|--------|---------|------|
| sm | 32px | 8px 12px | label-small |
| md | 40px | 8px 16px | label-medium |
| lg | 48px | 12px 24px | label-large |

---

## 4. ASCII Art Animations

### Overview

Firecrawl uses pre-rendered ASCII art frames stored in JSON files, animated at specific intervals using `setIntervalOnVisible()` for performance.

### HeroFlame Component

Dual mirrored flames for hero sections:

```tsx
// Component specification
const HeroFlame = () => {
  // Dimensions: 686px × 190px
  // Frame interval: 85ms
  // Color: text-black-alpha-20 (subtle)
  // One flame is mirrored horizontally

  return (
    <div className="flex justify-between w-full">
      <pre className="font-mono text-black-alpha-20">
        {/* Left flame */}
      </pre>
      <pre className="font-mono text-black-alpha-20 scale-x-[-1]">
        {/* Right flame (mirrored) */}
      </pre>
    </div>
  );
};
```

**Data file:** `hero-flame-data.json`

### AsciiExplosion Component

Dramatic burst effect for CTAs:

```tsx
// Component specification
const AsciiExplosion = () => {
  // Dimensions: 720px × 400px
  // Frame interval: 40ms (fast)
  // Color: #FA5D19 (bright heat orange)
  // Initial delay: 40 frames before loop

  return (
    <pre className="font-mono text-heat-100">
      {/* Explosion frames */}
    </pre>
  );
};
```

**Data file:** `explosion-data.json`

### CoreFlame Component

Background texture flame:

```tsx
// Component specification
const CoreFlame = () => {
  // Dimensions: 1110px × 470px
  // Frame interval: 80ms
  // Usage: Background decoration

  return (
    <pre className="font-mono opacity-10">
      {/* Background flame */}
    </pre>
  );
};
```

### FlameBackground Wrapper

Intensity-based flame background:

```tsx
interface FlameBackgroundProps {
  intensity: number; // 0-100
  pulse?: boolean;
  children: React.ReactNode;
}

const FlameBackground = ({ intensity, pulse, children }) => {
  // Opacity scales with intensity
  // Speed increases with intensity
  // Optional pulse animation

  return (
    <div className="relative">
      <div
        className="absolute inset-0"
        style={{ opacity: intensity / 100 }}
      >
        {/* Flame animation */}
      </div>
      {children}
    </div>
  );
};
```

### Animation Utility

```tsx
// setIntervalOnVisible - only animates when in viewport
import { setIntervalOnVisible } from '@/lib/animation-utils';

useEffect(() => {
  const cleanup = setIntervalOnVisible(
    containerRef.current,
    () => {
      setFrameIndex(prev => (prev + 1) % frames.length);
    },
    85 // interval in ms
  );

  return cleanup;
}, [frames.length]);
```

---

## 5. Loading Animations

### Braille Spinner

Unicode braille character spinner:

```tsx
const BrailleSpinner = ({
  interval = 80,
  ariaLabel = "Loading..."
}) => {
  const frames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = setInterval(() => {
      setIndex(i => (i + 1) % frames.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {frames[index]}
    </span>
  );
};
```

### AnimatedDotIcon

Canvas-based dot pattern animation:

```tsx
// Pattern configuration example
const patterns = {
  logs: {
    grid: [
      [0, 5, 10, 15, 20],
      [1, 6, 11, 16, 21],
      [2, 7, 12, 17, 22],
      [3, 8, 13, 18, 23],
    ],
    gridSize: 5,
    cellSize: 2,
    spacing: 2,
    offset: 3,
  },
  // ... other patterns
};

// Animation mechanics:
// - 4 rows with opacity levels: 0.04, 0.2, 0.4, 1.0
// - Rows cycle through grid positions
// - Framer Motion animates opacity (50ms)
// - Cycle duration ~300ms
// - Color: #fa5d19 (heat orange)
```

---

## 6. Layout System

### Breakpoints

| Name | Min Width | Usage |
|------|-----------|-------|
| xs | 390px | Small mobile |
| sm | 576px | Large mobile |
| md | 768px | Tablet |
| lg | 996px | Desktop |
| xl | 1200px | Large desktop |

### Custom Utilities

```css
/* Centered width */
.cw-720 {
  width: 720px;
  margin-left: auto;
  margin-right: auto;
}

/* Centered max-width with padding */
.cmw-1200-24 {
  max-width: 1200px;
  padding-left: 24px;
  padding-right: 24px;
  margin-left: auto;
  margin-right: auto;
}
```

### Layout Helpers

```css
/* Centering */
.center-x {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.center-y {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Overlay */
.overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Inside border effect */
.inside-border {
  position: relative;
}
.inside-border::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: inherit;
  pointer-events: none;
}
```

---

## 7. Component Patterns

### Section Header

```tsx
const SectionHead = ({
  title,
  description,
  action
}) => (
  <div className="flex justify-between items-start mb-24">
    <div>
      <h2 className="text-title-h3">
        <span className="text-heat-100">{title}</span>
      </h2>
      {description && (
        <p className="text-body-large text-accent-black/60 max-w-[590px] mt-8">
          {description}
        </p>
      )}
    </div>
    {action && (
      <div>{action}</div>
    )}
  </div>
);
```

### Card Container

```tsx
const Card = ({ children }) => (
  <div className="
    bg-surface
    border border-border-muted
    rounded-12
    p-24
    inside-border
  ">
    {children}
  </div>
);
```

### Dashboard Background

```tsx
const DashboardBackground = () => (
  <div className="fixed inset-0 -z-10">
    {/* Grid pattern */}
    <div
      className="absolute inset-0 opacity-5"
      style={{
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '8px 8px'
      }}
    />
    {/* Corner gradient */}
    <div
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(
            ellipse at top left,
            rgba(250, 93, 25, 0.05) 0%,
            transparent 50%
          )
        `
      }}
    />
  </div>
);
```

---

## 8. Animation Framework

### Standard Transition

```css
transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
```

### Framer Motion Patterns

```tsx
// Fade in
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2 }
};

// Scale on press
const pressScale = {
  whileTap: { scale: 0.98 }
};

// Stagger children
const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
};
```

### CSS Keyframes

```css
/* Snowfall effect */
@keyframes snowfall {
  0% {
    transform: translateY(-10vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}
```

---

## 9. Brand Assets

### Available Files

| File | Format | Usage |
|------|--------|-------|
| firecrawl-logo.svg | SVG | Primary colored logo |
| firecrawl-logo.png | PNG | Primary colored logo |
| firecrawl-light-logo.svg | SVG | Light/white theme |
| firecrawl-wordmark.svg | SVG | Text-only version |
| firecrawl-black.svg | SVG | Black version |
| firecrawl-icon.png | PNG | App icon |

**Location:** `/public/brand/`

### Logo Usage

```tsx
import Image from 'next/image';

// Primary logo
<Image
  src="/brand/firecrawl-logo.svg"
  alt="Firecrawl"
  width={140}
  height={32}
/>

// Icon only
<Image
  src="/brand/firecrawl-icon.png"
  alt="Firecrawl"
  width={32}
  height={32}
/>
```

---

## 10. Accessibility

### Motion Preferences

```tsx
// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// Disable animations if preferred
useEffect(() => {
  if (prefersReducedMotion) return;
  // Start animation
}, []);
```

### Color Contrast

- Text on heat-100: Use white (#ffffff) for AAA contrast
- Focus rings: 2px solid heat-100
- Disabled states: 50% opacity minimum for readability

### Semantic HTML

```tsx
// Button with loading state
<button
  disabled={isLoading}
  aria-busy={isLoading}
  aria-label={isLoading ? "Processing..." : "Submit"}
>
  {isLoading ? <BrailleSpinner /> : "Submit"}
</button>

// Status indicator
<span
  role="status"
  aria-live="polite"
>
  {statusMessage}
</span>
```

---

## 11. Dark Mode

### Implementation

Colors automatically adjust via CSS custom properties:

```css
:root {
  --accent-black: #262626;
  --accent-white: #f5f5f5;
  --bg-surface: #ffffff;
  --border-muted: #e8e8e8;
}

.dark {
  --accent-black: #f5f5f5;
  --accent-white: #262626;
  --bg-surface: #171717;
  --border-muted: #333333;
}
```

### Usage in Components

```tsx
// Text automatically inverts
<p className="text-accent-black">
  This text is dark in light mode, light in dark mode
</p>

// Background automatically inverts
<div className="bg-surface">
  This surface is white in light mode, dark in dark mode
</div>
```

---

## Quick Start Checklist

When creating a new page or component:

1. **Colors**: Use `heat-100` (#fa5d19) for primary actions
2. **Typography**: Use SuisseIntl for text, Geist Mono for code
3. **Buttons**: Apply multi-layer shadows and 0.995 active scale
4. **Animations**: Use 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) timing
5. **Spacing**: Use pixel values (8, 12, 16, 24, 32)
6. **Borders**: Use border-muted with rounded-8 to rounded-12
7. **Dark mode**: Use semantic color tokens (accent-black, surface)
8. **Motion**: Check prefers-reduced-motion
9. **ASCII art**: Consider adding flame animations for hero sections
