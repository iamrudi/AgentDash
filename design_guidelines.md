# Agency Client Portal - Design Guidelines

## Design Approach: Modern SaaS Dashboard System

**Selected Framework:** Hybrid approach combining shadcn/ui component patterns with Linear's minimalist aesthetics and Notion's content hierarchy principles. This choice aligns with the data-intensive, productivity-focused nature of agency management tools.

**Core Principles:**
- **Clarity over decoration**: Data and functionality take precedence
- **Purposeful hierarchy**: Clear visual separation between portals and data types
- **Professional restraint**: Sophisticated, trustworthy appearance for B2B context

---

## Color Palette

### Light Mode
- **Background Layers**: 
  - Primary: 0 0% 100% (pure white)
  - Secondary: 240 5% 96% (subtle gray)
  - Elevated cards: 0 0% 100% with subtle shadow
- **Text**: 
  - Primary: 240 10% 4% (near-black)
  - Secondary: 240 5% 45% (muted gray)
- **Brand/Primary**: 221 83% 53% (professional blue)
- **Accent (Success)**: 142 76% 36% (green for positive metrics)
- **Warning**: 38 92% 50% (amber for pending items)
- **Danger**: 0 84% 60% (red for overdue/critical)

### Dark Mode
- **Background Layers**: 
  - Primary: 240 10% 4% (deep slate)
  - Secondary: 240 6% 10% (elevated slate)
  - Cards: 240 5% 15% (card background)
- **Text**: 
  - Primary: 0 0% 98% (near-white)
  - Secondary: 240 5% 65% (muted light gray)
- **Brand/Primary**: 221 83% 63% (brighter blue for dark)
- **Accent colors remain similar with adjusted lightness for contrast**

---

## Typography

**Font Stack:**
- **Primary**: Inter (via Google Fonts CDN) - body text, labels, data
- **Monospace**: JetBrains Mono - numbers, metrics, invoice amounts

**Scale & Weights:**
- **Headings**: 
  - H1: text-3xl (30px), font-semibold (600) - portal titles
  - H2: text-2xl (24px), font-semibold - section headers
  - H3: text-lg (18px), font-medium (500) - card titles
- **Body**: text-sm (14px), font-normal (400) - default
- **Labels**: text-xs (12px), font-medium, uppercase tracking-wide - input labels
- **Data/Numbers**: text-base (16px), font-mono, font-medium - metrics display

---

## Layout System

**Spacing Primitives:** Consistent use of Tailwind units: 2, 4, 6, 8, 12, 16
- **Component padding**: p-4 to p-6 (cards, panels)
- **Section spacing**: mb-8, gap-6 (between dashboard widgets)
- **Page margins**: px-6 lg:px-8 (responsive horizontal spacing)
- **Grid gaps**: gap-4 to gap-6 (dashboard grid items)

**Container Strategy:**
- **Full-width dashboards**: max-w-7xl mx-auto px-6
- **Centered forms**: max-w-md mx-auto (auth pages)
- **Data tables**: w-full with horizontal scroll on mobile

**Grid Patterns:**
- **Agency Dashboard**: 12-column grid (grid-cols-12) for react-grid-layout flexibility
- **Client Dashboard**: 2-column on desktop (lg:grid-cols-2), single on mobile
- **Staff Task List**: Single column with card-based layout

---

## Component Library

### Navigation
- **Sidebar** (Agency/Staff): 
  - Fixed left, 240px width on desktop, collapsible to 64px
  - Dark background (240 10% 8%) with active state highlight
  - Icon + label layout, smooth transitions
- **Top Bar** (Client Portal): 
  - Horizontal navigation, company logo left, user menu right
  - Sticky positioning, backdrop blur effect
  - Height: h-16

### Data Display
- **Dashboard Cards**:
  - White/dark card background with rounded-lg borders
  - Shadow: shadow-sm, hover:shadow-md transition
  - Header with icon + title, body with primary metric, footer with trend indicator
  
- **Charts** (Recharts):
  - Line charts: Primary blue stroke, 2px width, smooth curves
  - Bar charts: Rounded tops, primary fill with 0.8 opacity
  - Area charts: Gradient fill from primary to transparent
  - Grid: Subtle stroke (240 5% 90% in light mode)

- **Data Tables** (Radix UI):
  - Striped rows (even: subtle background)
  - Hover: background highlight with smooth transition
  - Compact row height: py-2
  - Sortable headers with arrow indicators

### Forms & Inputs
- **Input Fields**:
  - Height: h-10, rounded-md borders
  - Border: 2px solid, neutral color, focus:ring-2 ring-primary
  - Consistent dark mode styling for all text inputs
  - Placeholder text: muted foreground color

- **Buttons**:
  - Primary: bg-primary text-white, px-4 py-2, rounded-md
  - Secondary: variant="outline" with border
  - Ghost: variant="ghost" for sidebar items
  - Icon buttons: 40x40px touch target
  - On images: backdrop-blur-md bg-white/20 border border-white/40

### Status Indicators
- **Project Status Pills**:
  - Active: green background, dark green text
  - Pending: amber background, dark amber text
  - Completed: blue background, dark blue text
  - Rounded-full, px-3 py-1, text-xs font-medium

- **Task Priority**:
  - Color-coded left border on task cards (4px width)
  - High: red, Medium: amber, Low: blue

### Modals & Overlays
- **Dialog** (Radix):
  - Backdrop: bg-black/50 backdrop-blur-sm
  - Content: max-w-lg, rounded-lg, p-6
  - Header with close button (top-right)
  - Footer with action buttons (right-aligned)

- **Dropdowns** (Radix):
  - Rounded-md, shadow-lg
  - Items: px-3 py-2, hover:bg-accent smooth transition
  - Dividers between logical groups

---

## Portal-Specific Designs

### Client Portal
- **Landing**: Clean hero with company logo, gradient background (primary to secondary), centered CTA
- **Dashboard**: 2-column grid, priority cards (Active Projects, Pending Invoices) top, metrics below
- **Card emphasis**: Larger headings, generous padding (p-6), welcoming tone

### Agency Portal
- **Dashboard**: Fully customizable react-grid-layout
- **Widget variety**: Mix of charts, tables, metric cards, AI recommendation panels
- **Dense information**: Compact spacing, multiple data points per widget
- **Command center aesthetic**: Dark sidebar, data-rich main area

### Staff Portal
- **Task-centric**: Card-based task list dominates the view
- **Filters**: Top bar with status/date filters, clean pill-style toggles
- **Minimal chrome**: Focus on task content, reduced navigation footprint

---

## Animations & Interactions

**Lottie Loading States:**
- Use on data fetch: 200x200px centered spinner with subtle brand color
- Page transitions: 150ms fade-in for new content

**Micro-interactions:**
- Button press: scale-95 transform on active state
- Card hover: translate-y-[-2px] with shadow increase
- Chart tooltips: Fade in/out 200ms
- Tab switching: Smooth content fade (300ms)

**Performance:**
- Minimize motion: Use prefers-reduced-motion media query
- CSS transforms over position changes
- Debounce dashboard grid drag operations

---

## Images

This application primarily uses **iconography and data visualization** rather than photography. However, include:

1. **Company Logos**: Client company logos displayed in:
   - Client portal header (max-h-8)
   - Agency dashboard client cards (h-10 w-10 rounded)
   - Invoice headers

2. **Empty States**: Minimal illustrations (not photos) for:
   - No projects state: Simple line art of folder/checklist
   - No tasks state: Checkmark icon with supportive text
   - No data charts: Placeholder chart wireframe

3. **Avatar Placeholders**: User profile images (if uploaded):
   - Rounded-full, h-10 w-10 standard size
   - Fallback: Initials in colored circle

**No large hero images** - this is a utility dashboard, not a marketing site. The login page may have a split-screen design with a subtle gradient background pattern instead of photography.