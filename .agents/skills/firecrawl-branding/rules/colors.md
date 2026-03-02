# Firecrawl Color System

## Primary Brand Color

```
Heat Orange: #fa5d19
```

This is the signature Firecrawl color. Always use it for:
- Primary CTAs and buttons
- Active/selected states
- Accent highlights
- Brand elements

## Complete Heat Scale

```css
/* Heat colors with opacity */
--heat-4: rgba(250, 93, 25, 0.04);
--heat-8: rgba(250, 93, 25, 0.08);
--heat-12: rgba(250, 93, 25, 0.12);
--heat-16: rgba(250, 93, 25, 0.16);
--heat-20: rgba(250, 93, 25, 0.20);
--heat-100: #fa5d19;
```

## Accent Colors

```css
--amethyst: #9061ff;  /* Purple - special features */
--bluetron: #2a6dfb;  /* Blue - links, info */
--crimson: #eb3424;   /* Red - errors, destructive */
--forest: #42c366;    /* Green - success */
--honey: #ecb730;     /* Yellow - warnings */
```

## Semantic Colors

### Text Colors

```css
/* Primary text - inverts in dark mode */
--accent-black: #262626; /* light */
--accent-black: #f5f5f5; /* dark */

/* Inverse text */
--accent-white: #f5f5f5; /* light */
--accent-white: #262626; /* dark */
```

### Background Colors

```css
/* Page background */
--bg-base: #f9f9f9;       /* light */
--bg-base: #0a0a0a;       /* dark */

/* Card/surface background */
--bg-surface: #ffffff;    /* light */
--bg-surface: #171717;    /* dark */

/* Elevated surface */
--bg-surface-raised: #ffffff;  /* light */
--bg-surface-raised: #262626;  /* dark */

/* Subtle background */
--bg-lighter: #fafafa;    /* light */
--bg-lighter: #0f0f0f;    /* dark */
```

### Border Colors

```css
/* Subtle borders */
--border-faint: #f0f0f0;  /* light */
--border-faint: #262626;  /* dark */

/* Standard borders */
--border-muted: #e8e8e8;  /* light */
--border-muted: #333333;  /* dark */

/* Prominent borders */
--border-loud: #d1d1d1;   /* light */
--border-loud: #525252;   /* dark */
```

## Alpha Scales

### Black Alpha (Light Mode)

```css
--black-alpha-3: rgba(0, 0, 0, 0.03);
--black-alpha-4: rgba(0, 0, 0, 0.04);
--black-alpha-5: rgba(0, 0, 0, 0.05);
--black-alpha-6: rgba(0, 0, 0, 0.06);
--black-alpha-7: rgba(0, 0, 0, 0.07);
--black-alpha-8: rgba(0, 0, 0, 0.08);
--black-alpha-10: rgba(0, 0, 0, 0.10);
--black-alpha-12: rgba(0, 0, 0, 0.12);
--black-alpha-20: rgba(0, 0, 0, 0.20);
--black-alpha-50: rgba(0, 0, 0, 0.50);
--black-alpha-80: rgba(0, 0, 0, 0.80);
```

### White Alpha (Dark Mode)

```css
--white-alpha-3: rgba(255, 255, 255, 0.03);
--white-alpha-4: rgba(255, 255, 255, 0.04);
/* ... same scale pattern */
```

## Usage Examples

### Button Background

```tsx
// Primary button
<button className="bg-heat-100 text-accent-white">
  Get Started
</button>

// Secondary button
<button className="bg-black-alpha-4 hover:bg-black-alpha-6">
  Learn More
</button>
```

### Card with Border

```tsx
<div className="bg-surface border border-border-muted rounded-12">
  <p className="text-accent-black">Card content</p>
</div>
```

### Accent Text

```tsx
<h1>
  <span className="text-heat-100">Fire</span>crawl
</h1>
```
