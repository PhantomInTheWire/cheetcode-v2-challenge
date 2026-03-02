# Firecrawl Layout System

## Breakpoints

| Name | Min Width | Tailwind | Usage |
|------|-----------|----------|-------|
| xs | 390px | `xs:` | Small mobile |
| sm | 576px | `sm:` | Large mobile |
| md | 768px | `md:` | Tablet |
| lg | 996px | `lg:` | Desktop |
| xl | 1200px | `xl:` | Large desktop |

```css
/* Custom breakpoints */
@media (min-width: 390px) { /* xs */ }
@media (min-width: 576px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 996px) { /* lg */ }
@media (min-width: 1200px) { /* xl */ }
```

## Container Widths

### Centered Width Utilities

```css
/* Centered fixed width */
.cw-720 {
  width: 720px;
  margin-left: auto;
  margin-right: auto;
}

.cw-960 {
  width: 960px;
  margin-left: auto;
  margin-right: auto;
}

.cw-1200 {
  width: 1200px;
  margin-left: auto;
  margin-right: auto;
}
```

### Max Width with Padding

```css
/* Max width with horizontal padding */
.cmw-1200-24 {
  max-width: 1200px;
  padding-left: 24px;
  padding-right: 24px;
  margin-left: auto;
  margin-right: auto;
}

.cmw-960-16 {
  max-width: 960px;
  padding-left: 16px;
  padding-right: 16px;
  margin-left: auto;
  margin-right: auto;
}
```

## Standard Containers

### Page Container

```tsx
const PageContainer = ({ children }) => (
  <div className="
    max-w-[1200px]
    mx-auto
    px-24
    py-32
    lg:px-32
    lg:py-48
  ">
    {children}
  </div>
);
```

### Content Container (Narrow)

```tsx
const ContentContainer = ({ children }) => (
  <div className="
    max-w-[720px]
    mx-auto
    px-16
    md:px-24
  ">
    {children}
  </div>
);
```

## Centering Utilities

```css
/* Absolute center X */
.center-x {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

/* Absolute center Y */
.center-y {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

/* Absolute center both */
.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Flexbox centering */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

## Overlay Utilities

```css
/* Full overlay */
.overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Fixed overlay (modal background) */
.overlay-fixed {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
}
```

## Border Effects

### Inside Border

Adds a subtle inner border effect:

```css
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

/* Dark mode */
.dark .inside-border::after {
  border-color: rgba(255, 255, 255, 0.08);
}
```

## Grid Layouts

### Two Column

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-24">
  <div>Column 1</div>
  <div>Column 2</div>
</div>
```

### Three Column

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>
```

### Sidebar Layout

```tsx
<div className="flex gap-24">
  {/* Sidebar */}
  <aside className="w-240 flex-shrink-0">
    {/* Navigation */}
  </aside>

  {/* Main content */}
  <main className="flex-1 min-w-0">
    {/* Content */}
  </main>
</div>
```

## Spacing Scale

Use pixel values for spacing:

| Size | Value | Usage |
|------|-------|-------|
| 4 | 4px | Tight spacing |
| 8 | 8px | Small gaps |
| 12 | 12px | Default gaps |
| 16 | 16px | Standard padding |
| 24 | 24px | Card padding |
| 32 | 32px | Section spacing |
| 48 | 48px | Large sections |
| 64 | 64px | Page sections |

```tsx
// Gap utilities
<div className="flex gap-8">...</div>
<div className="flex gap-12">...</div>
<div className="flex gap-16">...</div>

// Padding utilities
<div className="p-16">...</div>
<div className="p-24">...</div>
<div className="px-32 py-48">...</div>

// Margin utilities
<div className="mt-24 mb-32">...</div>
```

## Border Radius Scale

| Size | Value | Usage |
|------|-------|-------|
| rounded-4 | 4px | Tags, badges |
| rounded-6 | 6px | Small buttons |
| rounded-8 | 8px | Standard elements |
| rounded-10 | 10px | Large buttons |
| rounded-12 | 12px | Cards |
| rounded-full | 9999px | Pills, avatars |

## Dashboard Background

Standard background pattern for app pages:

```tsx
const DashboardBackground = () => (
  <div className="fixed inset-0 -z-10 bg-base">
    {/* Grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '8px 8px'
      }}
    />

    {/* Corner gradients */}
    <div
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(ellipse at top left, rgba(250, 93, 25, 0.05) 0%, transparent 50%),
          radial-gradient(ellipse at bottom right, rgba(250, 93, 25, 0.03) 0%, transparent 50%)
        `
      }}
    />
  </div>
);
```
