---
name: firecrawl-branding
description: USE THIS FOR EVERY DESIGN TASK. Firecrawl's visual identity and branding system for building beautifully designed pages. Use this skill when creating new pages, components, or projects that should follow Firecrawl's branding - including the signature heat orange color (#fa5d19), ASCII art animations, button styles, typography, and design patterns. Triggers on tasks involving landing pages, marketing pages, UI components, styling, animations, or brand consistency.
license: MIT
metadata:
  author: firecrawl
  version: "1.0.0"
---

# Firecrawl Branding Guide

Comprehensive visual identity system for Firecrawl products. Contains design tokens, ASCII animation patterns, component styles, and guidelines for creating beautifully designed, developer-focused pages.

## Design Philosophy

Firecrawl's visual identity is built around **heat, fire, and speed**:

1. **Heat Orange (#fa5d19)** - Primary brand color that appears in every interaction
2. **ASCII Art Animations** - Retro-tech aesthetic that feels developer-focused and innovative
3. **Smooth Transitions** - Cubic-bezier timing creates polished, premium feel
4. **Multi-layer Shadows** - Depth effects that create visual hierarchy
5. **Minimal Dark Mode** - Elegant inversion maintaining readability
6. **Performance-First** - Viewport detection and GPU acceleration ensure smooth animations
7. **Accessibility** - Respects motion preferences and maintains contrast ratios

## When to Apply

Reference these guidelines when:
- Creating new landing pages or marketing pages
- Building UI components that need brand consistency
- Implementing animations or loading states
- Styling buttons, forms, and interactive elements
- Setting up new projects with Firecrawl branding

## Quick Reference

### Primary Brand Color

```
Heat Orange: #fa5d19
```

This is the signature color. Use it for:
- Primary CTAs and buttons
- Accent text and highlights
- ASCII animation colors
- Focus states and active indicators

### Core Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| heat-100 | #fa5d19 | #fa5d19 | Primary brand color |
| accent-black | #262626 | #f5f5f5 | Primary text |
| accent-white | #f5f5f5 | #262626 | Inverse text |
| surface | #ffffff | #171717 | Card backgrounds |
| border-muted | #e8e8e8 | #333333 | Subtle borders |

### Typography Stack

```css
/* Primary Font */
font-family: SuisseIntl, sans-serif;

/* Monospace (code) */
font-family: Geist Mono, monospace;

/* ASCII Art */
font-family: Roboto Mono, monospace;
```

### Button Styles

Primary button with heat color and multi-layer shadow:
```css
.btn-primary {
  background: #ff4c00;
  color: white;
  box-shadow:
    inset 0px -6px 12px 0px rgba(255, 0, 0, 0.2),
    0px 2px 4px 0px rgba(250, 93, 25, 0.3);
  transition: 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.btn-primary:hover {
  box-shadow:
    inset 0px -6px 12px 0px rgba(255, 0, 0, 0.2),
    0px 4px 8px 0px rgba(250, 93, 25, 0.4);
}

.btn-primary:active {
  transform: scale(0.995);
}
```

### Animation Timing

Standard transition:
```css
transition: 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
```

## Categories

| Category | Description | Reference |
|----------|-------------|-----------|
| Colors | Full color system with heat scale | `colors.md` |
| Typography | Font sizes and text styles | `typography.md` |
| Buttons | Button variants and states | `buttons.md` |
| ASCII Animations | Flame and explosion effects | `ascii-animations.md` |
| Components | Reusable UI patterns | `components.md` |
| Layout | Grid and spacing system | `layout.md` |

## How to Use

Read individual reference files for detailed specifications:

```
rules/colors.md
rules/typography.md
rules/buttons.md
rules/ascii-animations.md
```

Each file contains:
- Token definitions and values
- Code examples (CSS/React)
- Usage guidelines
- Dark mode considerations

## Full Compiled Document

For the complete guide with all specifications expanded: `AGENTS.md`
