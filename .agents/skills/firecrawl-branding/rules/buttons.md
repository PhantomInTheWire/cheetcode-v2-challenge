# Firecrawl Button System

## Primary Button (Heat)

The signature Firecrawl button with multi-layer shadows:

```tsx
// React/Tailwind
<button className="
  bg-heat-100
  text-accent-white
  px-16 py-8
  rounded-8
  font-medium
  transition-all duration-200
  hover:shadow-lg
  active:scale-[0.995]
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Get Started
</button>
```

### Full CSS Implementation

```css
.btn-primary {
  /* Base styles */
  background: #ff4c00;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 450;
  font-size: 14px;
  line-height: 20px;
  border: none;
  cursor: pointer;

  /* Smooth transition */
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);

  /* Multi-layer shadow for depth */
  box-shadow:
    /* Inner glow */
    inset 0px -6px 12px 0px rgba(255, 0, 0, 0.2),
    /* Outer layers for depth */
    0px 0.6px 0.8px 0px rgba(255, 139, 0, 0.22),
    0px 1.3px 1.7px 0px rgba(255, 139, 0, 0.19),
    0px 2.5px 3.1px 0px rgba(255, 139, 0, 0.16),
    0px 4.4px 5.5px 0px rgba(255, 139, 0, 0.13),
    0px 8.3px 10.3px 0px rgba(255, 139, 0, 0.1),
    /* Main shadow */
    0px 2px 4px 0px rgba(250, 93, 25, 0.3);
}

.btn-primary:hover {
  /* Enhanced shadow on hover */
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
  /* Subtle press effect */
  transform: scale(0.995);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary:focus-visible {
  outline: 2px solid #fa5d19;
  outline-offset: 2px;
}
```

## Secondary Button

Subtle background, for secondary actions:

```css
.btn-secondary {
  background: rgba(0, 0, 0, 0.04);
  color: #262626;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 450;
  font-size: 14px;
  line-height: 20px;
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

.btn-secondary:disabled {
  background: rgba(0, 0, 0, 0.03);
  color: rgba(0, 0, 0, 0.4);
  cursor: not-allowed;
}

/* Dark mode */
.dark .btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  color: #f5f5f5;
}

.dark .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.06);
}
```

## Tertiary Button (Ghost)

Transparent, for minimal emphasis:

```css
.btn-tertiary {
  background: transparent;
  color: #262626;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 450;
  font-size: 14px;
  line-height: 20px;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.btn-tertiary:hover {
  background: rgba(0, 0, 0, 0.04);
}

.btn-tertiary:active {
  transform: scale(0.98);
}

.btn-tertiary:disabled {
  color: rgba(0, 0, 0, 0.4);
  cursor: not-allowed;
}
```

## Destructive Button

For dangerous/irreversible actions:

```css
.btn-destructive {
  background: #dc2626;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 450;
  font-size: 14px;
  line-height: 20px;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.btn-destructive:hover {
  background: #b91c1c;
}

.btn-destructive:active {
  transform: scale(0.98);
}

.btn-destructive:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## Button Sizes

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| sm | 32px | 8px 12px | 13px |
| md | 40px | 8px 16px | 14px |
| lg | 48px | 12px 24px | 16px |

```css
.btn-sm {
  height: 32px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 18px;
}

.btn-md {
  height: 40px;
  padding: 8px 16px;
  font-size: 14px;
  line-height: 20px;
}

.btn-lg {
  height: 48px;
  padding: 12px 24px;
  font-size: 16px;
  line-height: 24px;
  border-radius: 10px;
}
```

## Icon Buttons

With icon left or right:

```tsx
<button className="btn-primary flex items-center gap-8">
  <IconArrowRight className="w-16 h-16" />
  <span>Continue</span>
</button>

<button className="btn-secondary flex items-center gap-8">
  <span>Download</span>
  <IconDownload className="w-16 h-16" />
</button>
```

## Loading State

```tsx
const Button = ({ loading, children, ...props }) => (
  <button
    disabled={loading}
    aria-busy={loading}
    {...props}
  >
    {loading ? (
      <span className="flex items-center gap-8">
        <BrailleSpinner />
        <span>Loading...</span>
      </span>
    ) : (
      children
    )}
  </button>
);
```

## Link Styled as Button

```tsx
// Fire action link
<a className="
  text-heat-100
  underline-offset-2
  hover:underline
  transition-colors
">
  Learn more
</a>

// Button-styled link
<a className="
  inline-block
  py-4 px-8
  rounded-6
  bg-heat-4
  text-heat-100
  hover:bg-heat-8
  active:scale-[0.98]
  transition-all
">
  View documentation
</a>
```
