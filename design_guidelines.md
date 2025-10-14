# Agency Client Portal - Design Guidelines

## Design Approach: macOS-Inspired Interface System

**Selected Framework:** macOS 2.6 design language integrated with shadcn/ui component architecture. This creates a premium, native-feeling experience that combines Apple's refined aesthetics with the productivity-focused nature of agency management tools.

**Core Principles:**
- **Premium simplicity**: Clean, uncluttered interfaces with purposeful use of space
- **Subtle depth**: Gentle shadows and layering without excessive decoration
- **Responsive feedback**: Smooth interactions and visual confirmations
- **System coherence**: Consistent patterns across all portals and features

---

## Color Palette

### Dark Mode (Default - macOS Dark)
- **Background Layers**: 
  - Primary: 0 0% 18% (#2d2d2d - Dark Gray)
  - Cards: 0 0% 24% (#3c3c3c)
  - Sidebar: 0 0% 13% (#202020 - Darker for depth)
- **Text**: 
  - Primary: 0 0% 100% (White)
  - Secondary: 0 0% 80% (#cccccc)
  - Muted: 0 0% 56% (#8e8e93)
- **Brand Colors**:
  - Primary: 211 100% 50% (#0a84ff - Apple Blue)
  - Secondary: 243 75% 59% (#5e5ce6 - Indigo)
  - Accent: 32 100% 52% (#ff9f0a - Orange)
  - Destructive: 4 100% 60% (#ff453a - Red)
- **Borders & Inputs**: 0 0% 33% (#545458)

### Light Mode (macOS Light)
- **Background Layers**: 
  - Primary: 0 0% 100% (Pure White)
  - Cards: 0 0% 98% (Very Light Gray)
  - Sidebar: 0 0% 96% (Light Gray)
- **Text**: 
  - Primary: 0 0% 0% (Black)
  - Secondary: 0 0% 40%
  - Muted: 0 0% 60%
- **Brand Colors**: Same as dark mode (optimized for both)
- **Borders & Inputs**: 0 0% 90%

---

## Typography

**Font Stack:**
- **Primary (Sans)**: San Francisco system font stack
  - `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  - Provides native macOS feel on Apple devices, graceful fallbacks elsewhere
- **Monospace**: SF Mono, Monaco, Inconsolata, "Roboto Mono"
  - For code, numbers, metrics, and data display

**Scale & Weights:**
- **Headings**: 
  - H1: text-3xl (30px), font-semibold (600) - Portal titles
  - H2: text-2xl (24px), font-semibold - Section headers
  - H3: text-lg (18px), font-medium (500) - Card titles
- **Body**: text-sm (14px), font-normal (400) - Default text
- **Labels**: text-xs (12px), font-medium - Form labels, metadata
- **Data/Numbers**: text-base (16px), font-mono, font-medium - Metrics

**macOS Typography Principles:**
- Use system font weights (400, 500, 600) for authenticity
- Maintain generous line-height (1.5-1.6) for readability
- Letter-spacing: slightly tighter for headings (-0.01em)

---

## Layout System

**Spacing Grid:** 4px base unit (macOS standard)
- **Micro spacing**: space-1 (4px), space-2 (8px)
- **Component padding**: p-3 (12px), p-4 (16px), p-6 (24px)
- **Section spacing**: mb-6, gap-4, gap-6
- **Page margins**: px-6 lg:px-8

**Border Radius (macOS Values):**
- **Small**: rounded-sm (4px) - Badges, tags, small buttons
- **Medium**: rounded-md (8px) - Inputs, standard buttons, cards
- **Large**: rounded-lg (12px) - Modals, large cards, containers

**Container Strategy:**
- **Full-width dashboards**: max-w-7xl mx-auto px-6
- **Centered content**: max-w-4xl mx-auto
- **Forms**: max-w-md mx-auto
- **Modals**: max-w-2xl with centered positioning

**Grid Patterns:**
- **Dashboard grids**: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- **Two-column layouts**: lg:grid-cols-2
- **Sidebar layouts**: Fixed sidebar (280px) + flex content area

---

## Component Patterns

### Buttons (macOS Style)
- **Primary**: bg-primary with subtle shadow, hover state lifts
- **Secondary**: bg-muted with border, subdued appearance
- **Ghost**: Transparent with hover background
- **Destructive**: bg-destructive for critical actions

**Sizing:**
- sm: h-8 px-3 text-xs
- md (default): h-9 px-4 text-sm
- lg: h-10 px-6 text-base

**Interaction:**
- Subtle scale on active state (scale-[0.98])
- Smooth transitions (150ms ease)
- Focus ring: ring-2 ring-ring ring-offset-2

### Cards
- **Background**: bg-card with card-foreground text
- **Border**: 1px solid border color
- **Shadow**: Subtle drop shadow (shadow-sm)
- **Padding**: p-6 for content
- **Hover state**: Slight lift (shadow-md) for interactive cards

### Inputs & Forms
- **Base style**: bg-input with border
- **Focus**: ring-2 ring-ring (Apple Blue)
- **Padding**: px-3 py-2
- **Disabled**: opacity-50 with cursor-not-allowed

### Modals/Dialogs
- **Overlay**: Semi-transparent black (bg-black/50)
- **Content**: bg-card, rounded-lg, shadow-xl
- **Animation**: Smooth fade + scale entrance
- **Max width**: max-w-2xl

---

## Icon System

**Library:** lucide-react (already installed)
- Clean, line-art style matches macOS aesthetic
- Consistent 24x24px base size
- Stroke width: 2px (default) for clarity

**Usage:**
- **Navigation**: 20x20px icons with 12px gap from text
- **Action buttons**: 16x16px icons in buttons
- **Status indicators**: 14x14px with appropriate color
- **Headers**: 24x24px for emphasis

---

## Interaction & Motion

**Animation Principles (macOS Easing):**
- **Default duration**: 150-200ms
- **Easing**: ease-in-out for natural feel
- **Hover states**: Subtle elevation, no abrupt changes
- **Loading states**: Smooth skeleton loaders

**Focus & Accessibility:**
- Always show focus ring on keyboard navigation
- Minimum touch target: 44x44px (macOS standard)
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Screen reader support with proper ARIA labels

---

## Portal-Specific Guidelines

### Client Portal
- Simplified navigation with clear visual hierarchy
- Large, touch-friendly action buttons
- Generous whitespace for clarity
- Prominent CTA for strategic initiatives

### Agency Admin Portal
- Dense data displays with clear separation
- Sidebar navigation with collapsible sections
- Quick actions always accessible
- Color-coded status indicators

### Staff Portal
- Task-focused, minimal chrome
- Clear assignment indicators
- Progress visualization
- Quick status updates

---

## Dark/Light Mode

**Toggle Behavior:**
- Smooth transition between modes (200ms)
- Preserve user preference in localStorage
- Automatically adjust all color tokens
- Icon adapts (moon/sun indicators)

**Color Adjustments:**
- Dark mode: Slightly reduce saturation for comfort
- Light mode: Increase contrast for outdoor readability
- Both modes: Ensure WCAG AA compliance

---

## Best Practices

1. **Consistency**: Always use design tokens from index.css
2. **Spacing**: Stick to 4px grid system
3. **Typography**: Use system font stack for native feel
4. **Colors**: Reference CSS variables, never hardcode
5. **Icons**: lucide-react only, consistent sizing
6. **Interactions**: Subtle, purposeful animations
7. **Accessibility**: Keyboard navigation, screen readers, contrast
8. **Responsive**: Mobile-first approach, touch-friendly targets

---

## Component Checklist

Before creating/modifying components:
- [ ] Uses CSS color variables from index.css
- [ ] Follows macOS border radius (sm: 4px, md: 8px, lg: 12px)
- [ ] Has proper focus states with ring-2
- [ ] Includes dark mode support
- [ ] Has smooth transitions (150-200ms)
- [ ] Uses lucide-react icons where applicable
- [ ] Follows 4px spacing grid
- [ ] Meets WCAG AA contrast requirements
- [ ] Has appropriate hover/active states
- [ ] Includes proper data-testid attributes
