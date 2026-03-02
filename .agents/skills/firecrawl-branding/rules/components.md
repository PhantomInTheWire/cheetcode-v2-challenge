# Firecrawl Component Patterns

## Cards

### Standard Card

```tsx
const Card = ({ children, className }) => (
  <div className={`
    bg-surface
    border border-border-muted
    rounded-12
    p-24
    relative
    ${className}
  `}>
    {/* Inside border effect */}
    <div className="absolute inset-0 rounded-12 border border-black-alpha-3 pointer-events-none" />
    {children}
  </div>
);
```

### Elevated Card

```tsx
const ElevatedCard = ({ children }) => (
  <div className="
    bg-surface-raised
    border border-border-muted
    rounded-12
    p-24
    shadow-sm
    hover:shadow-md
    transition-shadow duration-200
  ">
    {children}
  </div>
);
```

### Feature Card

```tsx
const FeatureCard = ({ icon, title, description }) => (
  <div className="
    bg-surface
    border border-border-muted
    rounded-12
    p-24
    group
    hover:border-heat-20
    transition-colors duration-200
  ">
    <div className="
      w-40 h-40
      rounded-8
      bg-heat-4
      flex items-center justify-center
      mb-16
      group-hover:bg-heat-8
      transition-colors duration-200
    ">
      {icon}
    </div>
    <h3 className="title-h5 text-accent-black mb-8">{title}</h3>
    <p className="body-medium text-accent-black/60">{description}</p>
  </div>
);
```

## Section Headers

### Page Section Header

```tsx
const SectionHead = ({ title, description, action }) => (
  <div className="flex justify-between items-start mb-24">
    <div>
      <h2 className="title-h3 text-accent-black">
        <span className="text-heat-100">{title}</span>
      </h2>
      {description && (
        <p className="body-large text-accent-black/60 max-w-[590px] mt-8">
          {description}
        </p>
      )}
    </div>
    {action && <div>{action}</div>}
  </div>
);
```

### Subsection Header

```tsx
const SubsectionHead = ({ title, description }) => (
  <div className="mb-16">
    <h3 className="title-h5 text-accent-black mb-4">{title}</h3>
    {description && (
      <p className="body-small text-accent-black/50">{description}</p>
    )}
  </div>
);
```

## Inputs

### Text Input

```tsx
const Input = ({ label, error, ...props }) => (
  <div className="flex flex-col gap-6">
    {label && (
      <label className="label-small text-accent-black">{label}</label>
    )}
    <input
      className={`
        h-40
        px-12
        rounded-8
        border
        bg-surface
        body-input
        text-accent-black
        placeholder:text-accent-black/30
        transition-colors duration-200
        focus:outline-none
        focus:ring-2
        focus:ring-heat-100/20
        ${error
          ? 'border-crimson focus:border-crimson'
          : 'border-border-muted focus:border-heat-100'
        }
      `}
      {...props}
    />
    {error && (
      <span className="body-small text-crimson">{error}</span>
    )}
  </div>
);
```

### Code Input (Monospace)

```tsx
const CodeInput = ({ ...props }) => (
  <input
    className="
      h-40
      px-12
      rounded-8
      border border-border-muted
      bg-surface
      mono-small
      text-accent-black
      placeholder:text-accent-black/30
      focus:outline-none
      focus:ring-2 focus:ring-heat-100/20
      focus:border-heat-100
    "
    spellCheck={false}
    {...props}
  />
);
```

## Badges & Tags

### Status Badge

```tsx
const Badge = ({ variant = 'default', children }) => {
  const variants = {
    default: 'bg-black-alpha-5 text-accent-black',
    heat: 'bg-heat-8 text-heat-100',
    success: 'bg-forest/10 text-forest',
    warning: 'bg-honey/10 text-honey',
    error: 'bg-crimson/10 text-crimson',
  };

  return (
    <span className={`
      inline-flex items-center
      px-8 py-2
      rounded-full
      label-x-small
      ${variants[variant]}
    `}>
      {children}
    </span>
  );
};
```

### New Tag

```tsx
const NewTag = () => (
  <span className="
    inline-flex items-center
    px-6 py-1
    rounded-4
    label-x-small
    bg-heat-8
    text-heat-100
  ">
    New
  </span>
);
```

## Loading States

### Braille Spinner

```tsx
const BrailleSpinner = ({ className = '' }) => {
  const frames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={`mono-small ${className}`}
    >
      {frames[index]}
    </span>
  );
};
```

### Skeleton

```tsx
const Skeleton = ({ className }) => (
  <div className={`
    bg-black-alpha-5
    rounded-8
    animate-pulse
    ${className}
  `} />
);

// Usage
<Skeleton className="h-20 w-full" />
<Skeleton className="h-40 w-200" />
```

## Tooltips

```tsx
const Tooltip = ({ content, children }) => (
  <div className="relative group">
    {children}
    <div className="
      absolute bottom-full left-1/2 -translate-x-1/2
      mb-8
      px-12 py-8
      bg-accent-black
      text-accent-white
      body-small
      rounded-8
      whitespace-nowrap
      opacity-0
      invisible
      group-hover:opacity-100
      group-hover:visible
      transition-all duration-200
    ">
      {content}
      {/* Arrow */}
      <div className="
        absolute top-full left-1/2 -translate-x-1/2
        border-4 border-transparent border-t-accent-black
      " />
    </div>
  </div>
);
```

## Navigation

### Sidebar Item

```tsx
const SidebarItem = ({ icon, label, active, href }) => (
  <Link
    href={href}
    className={`
      flex items-center gap-12
      px-12 py-8
      rounded-8
      body-medium
      transition-colors duration-200
      ${active
        ? 'bg-heat-8 text-heat-100'
        : 'text-accent-black/60 hover:bg-black-alpha-4 hover:text-accent-black'
      }
    `}
  >
    <span className="w-20 h-20">{icon}</span>
    <span>{label}</span>
  </Link>
);
```

### Tab Navigation

```tsx
const Tabs = ({ tabs, activeTab, onChange }) => (
  <div className="flex gap-4 border-b border-border-faint">
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`
          px-16 py-12
          label-medium
          border-b-2
          transition-colors duration-200
          ${activeTab === tab.id
            ? 'border-heat-100 text-heat-100'
            : 'border-transparent text-accent-black/60 hover:text-accent-black'
          }
        `}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
```
