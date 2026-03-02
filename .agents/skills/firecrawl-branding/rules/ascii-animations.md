# Firecrawl ASCII Animations

## Overview

Firecrawl uses pre-rendered ASCII art frames for a retro-tech, developer-focused aesthetic. Animations are stored as JSON arrays and played using `setIntervalOnVisible()` for performance.

## Animation Types

### HeroFlame

**Purpose:** Hero section decoration with mirrored flames

```
Dimensions: 686px × 190px
Frame interval: 85ms
Color: text-black-alpha-20
Position: Both sides of hero, one mirrored
```

**Implementation:**

```tsx
import heroFlameData from "./hero-flame-data.json";

const HeroFlame = () => {
  const [frameIndex, setFrameIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = setIntervalOnVisible(
      containerRef.current,
      () => setFrameIndex((i) => (i + 1) % heroFlameData.length),
      85,
    );
    return cleanup;
  }, []);

  return (
    <div ref={containerRef} className="flex justify-between">
      <pre className="font-mono text-black-alpha-20 text-[8px] leading-[8px]">
        {heroFlameData[frameIndex]}
      </pre>
      <pre className="font-mono text-black-alpha-20 text-[8px] leading-[8px] scale-x-[-1]">
        {heroFlameData[frameIndex]}
      </pre>
    </div>
  );
};
```

### AsciiExplosion

**Purpose:** Dramatic CTA accent, attention-grabbing burst

```
Dimensions: 720px × 400px
Frame interval: 40ms (fast)
Color: #FA5D19 (heat-100)
Initial delay: Skip first 40 frames
```

**Implementation:**

```tsx
import explosionData from "./explosion-data.json";

const AsciiExplosion = () => {
  const [frameIndex, setFrameIndex] = useState(40); // Start after delay
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = setIntervalOnVisible(
      containerRef.current,
      () => setFrameIndex((i) => (i + 1) % explosionData.length),
      40,
    );
    return cleanup;
  }, []);

  return (
    <pre ref={containerRef} className="font-mono text-heat-100 text-[6px] leading-[6px]">
      {explosionData[frameIndex]}
    </pre>
  );
};
```

### CoreFlame

**Purpose:** Subtle background texture

```
Dimensions: 1110px × 470px
Frame interval: 80ms
Opacity: ~10%
```

### FlameBackground

**Purpose:** Intensity-reactive background for dashboards/metrics

```tsx
interface FlameBackgroundProps {
  intensity: number; // 0-100
  pulse?: boolean;
  children: React.ReactNode;
}

const FlameBackground = ({ intensity, pulse = false, children }) => {
  // Opacity scales with intensity (0.0 to 1.0)
  // Animation speed increases with intensity
  // Optional pulse effect

  const opacity = intensity / 100;
  const interval = Math.max(40, 100 - intensity); // Faster at high intensity

  return (
    <div className="relative">
      <div className={`absolute inset-0 ${pulse ? "animate-pulse" : ""}`} style={{ opacity }}>
        <CoreFlame interval={interval} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
};
```

## Performance Utility

### setIntervalOnVisible

Only animates when element is in viewport:

```tsx
export function setIntervalOnVisible(
  element: HTMLElement | null,
  callback: () => void,
  interval: number,
): () => void {
  if (!element) return () => {};

  let timerId: number | null = null;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Start animation
          timerId = window.setInterval(callback, interval);
        } else {
          // Stop animation
          if (timerId) {
            clearInterval(timerId);
            timerId = null;
          }
        }
      });
    },
    { threshold: 0.1 },
  );

  observer.observe(element);

  return () => {
    observer.disconnect();
    if (timerId) clearInterval(timerId);
  };
}
```

## Data File Format

ASCII frames are stored as JSON arrays of strings:

```json
["  ╱╲  \n ╱  ╲ \n╱____╲", "  ╱╲  \n ╱##╲ \n╱____╲", "  ╱╲  \n ╱@@╲ \n╱____╲"]
```

## Animation Data Files

| File                   | Animation      | Frames |
| ---------------------- | -------------- | ------ |
| `hero-flame-data.json` | HeroFlame      | ~60    |
| `explosion-data.json`  | AsciiExplosion | ~120   |
| `wave-data.json`       | SubtleWave     | ~40    |
| `pulse-data.json`      | AuthPulse      | ~30    |
| `grid-data.json`       | SlateGrid      | ~20    |

## Accessibility

Always respect reduced motion preferences:

```tsx
useEffect(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Show static frame instead
    setFrameIndex(0);
    return;
  }

  // Start animation...
}, []);
```
