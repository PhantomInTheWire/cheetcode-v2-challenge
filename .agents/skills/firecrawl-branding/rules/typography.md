# Firecrawl Typography System

## Font Families

```css
/* Primary - Premium sans-serif for all UI text */
--font-primary: "SuisseIntl", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

/* Monospace - Code, technical content, data */
--font-mono: "Geist Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace;

/* ASCII Art - Animations and decorative elements */
--font-ascii: "Roboto Mono", monospace;
```

## Title Hierarchy

For headings and major text elements:

| Class | Size | Line Height | Letter Spacing | Usage |
|-------|------|-------------|----------------|-------|
| title-h1 | 60px | 64px | -0.3px | Hero headlines |
| title-h2 | 52px | 56px | -0.52px | Section titles |
| title-h3 | 40px | 44px | -0.4px | Feature titles |
| title-h4 | 32px | 36px | -0.32px | Card titles |
| title-h5 | 24px | 32px | -0.24px | Sub-headings |

```css
.title-h1 {
  font-family: var(--font-primary);
  font-size: 60px;
  line-height: 64px;
  letter-spacing: -0.3px;
  font-weight: 500;
}

.title-h2 {
  font-family: var(--font-primary);
  font-size: 52px;
  line-height: 56px;
  letter-spacing: -0.52px;
  font-weight: 500;
}

.title-h3 {
  font-family: var(--font-primary);
  font-size: 40px;
  line-height: 44px;
  letter-spacing: -0.4px;
  font-weight: 500;
}

.title-h4 {
  font-family: var(--font-primary);
  font-size: 32px;
  line-height: 36px;
  letter-spacing: -0.32px;
  font-weight: 500;
}

.title-h5 {
  font-family: var(--font-primary);
  font-size: 24px;
  line-height: 32px;
  letter-spacing: -0.24px;
  font-weight: 500;
}
```

## Body Text

For paragraphs and general content:

| Class | Size | Line Height | Letter Spacing | Usage |
|-------|------|-------------|----------------|-------|
| body-x-large | 20px | 28px | 0 | Lead paragraphs |
| body-large | 16px | 24px | 0 | Standard body |
| body-medium | 14px | 20px | 0.14px | Default text |
| body-small | 13px | 20px | 0 | Secondary text |
| body-input | 15px | 24px | 0 | Form inputs |

```css
.body-x-large {
  font-family: var(--font-primary);
  font-size: 20px;
  line-height: 28px;
  font-weight: 400;
}

.body-large {
  font-family: var(--font-primary);
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
}

.body-medium {
  font-family: var(--font-primary);
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.14px;
  font-weight: 400;
}

.body-small {
  font-family: var(--font-primary);
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
}

.body-input {
  font-family: var(--font-primary);
  font-size: 15px;
  line-height: 24px;
  font-weight: 400;
}
```

## Labels

For buttons, badges, and UI labels (weight: 450):

| Class | Size | Line Height | Usage |
|-------|------|-------------|-------|
| label-x-large | 20px | 28px | Large buttons |
| label-large | 16px | 24px | Standard buttons |
| label-medium | 14px | 20px | Default labels |
| label-small | 13px | 18px | Small buttons |
| label-x-small | 12px | 16px | Badges, tags |

```css
.label-x-large {
  font-family: var(--font-primary);
  font-size: 20px;
  line-height: 28px;
  font-weight: 450;
}

.label-large {
  font-family: var(--font-primary);
  font-size: 16px;
  line-height: 24px;
  font-weight: 450;
}

.label-medium {
  font-family: var(--font-primary);
  font-size: 14px;
  line-height: 20px;
  font-weight: 450;
}

.label-small {
  font-family: var(--font-primary);
  font-size: 13px;
  line-height: 18px;
  font-weight: 450;
}

.label-x-small {
  font-family: var(--font-primary);
  font-size: 12px;
  line-height: 16px;
  font-weight: 450;
}
```

## Monospace

For code blocks and technical content:

| Class | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| mono-medium | 14px | 22px | 400 | Code blocks |
| mono-small | 13px | 20px | 500 | Inline code |
| mono-x-small | 12px | 16px | 500 | Compact code |

```css
.mono-medium {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 22px;
  font-weight: 400;
}

.mono-small {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
}

.mono-x-small {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
}
```

## Usage Examples

### Hero Section

```tsx
<h1 className="title-h1 text-accent-black">
  Turn websites into
  <span className="text-heat-100"> LLM-ready data</span>
</h1>
<p className="body-x-large text-accent-black/60 mt-16 max-w-[600px]">
  Power your AI applications with clean, structured data from any website.
</p>
```

### Card with Title

```tsx
<div className="p-24">
  <h3 className="title-h5 text-accent-black mb-8">
    Web Scraping API
  </h3>
  <p className="body-medium text-accent-black/60">
    Extract data from any website with a simple API call.
  </p>
</div>
```

### Code Block

```tsx
<pre className="mono-medium bg-surface-raised p-16 rounded-8">
  <code>
    curl https://api.firecrawl.dev/v1/scrape \
      -H "Authorization: Bearer fc-..."
  </code>
</pre>
```

### Button Labels

```tsx
<button className="label-medium">Get Started</button>
<span className="label-x-small bg-heat-8 text-heat-100 px-8 py-2 rounded-full">
  New
</span>
```
