# Responsive Layout Verification Checklist

## Overview

This document verifies the SGRail responsive layout implementation against Requirements 28 (Mobile) and 29 (Desktop). The application uses a **768px breakpoint** to switch between mobile and desktop layouts.

## Implementation Architecture

| Component | File | Role |
|-----------|------|------|
| `useResponsive` | `frontend/src/hooks/useResponsive.ts` | Central hook using `window.matchMedia` with 767px max-width query |
| `BottomNav` | `frontend/src/components/common/BottomNav.tsx` | Mobile bottom navigation (< 768px) |
| `SideNav` | `frontend/src/components/common/SideNav.tsx` | Desktop side navigation rail (≥ 768px) |
| `App` (AppLayout) | `frontend/src/app/App.tsx` | Layout shell switching between BottomNav/SideNav |
| `ResponsivePanel` | `frontend/src/components/common/ResponsivePanel.tsx` | Renders BottomSheet (mobile) or SidePanel (desktop) |
| `BottomSheet` | `frontend/src/components/common/BottomSheet.tsx` | Vaul Drawer for mobile slide-up panels |
| `SidePanel` | `frontend/src/components/common/SidePanel.tsx` | Shadcn Sheet for desktop right-side panels |
| `CommunityPage` | `frontend/src/pages/CommunityPage.tsx` | Single-column (mobile) / sidebar filters (desktop) |

## Breakpoint Strategy

- **Single breakpoint**: 768px (matching iPad portrait / standard tablet width)
- **Detection method**: `window.matchMedia('(max-width: 767px)')` with `change` event listener
- **Layout system**: CSS Grid, Flexbox, and fluid sizing (Req 28.6) — no user-agent detection
- **Tailwind responsive prefix**: `md:` classes used for progressive enhancement

---

## Viewport Verification Matrix

### 375px — iPhone SE / Small Mobile

| # | Check Item | Expected Behaviour | Req |
|---|------------|-------------------|-----|
| 1 | Navigation | BottomNav visible, fixed at bottom | 28.1 |
| 2 | SideNav | Hidden (not rendered) | 28.1 |
| 3 | Map page | Full-screen map above bottom nav (pb-16 padding) | 28.2 |
| 4 | Station panel | BottomSheet (slide-up drawer) | 28.2 |
| 5 | Community page | Single-column feed, inline filters | 28.3 |
| 6 | Forms | Full-width layout | 28.4 |
| 7 | Route results | Collapsible cards, full width | 28.5 |
| 8 | Touch targets | Minimum 44px effective tap areas | 26.5 |

### 430px — iPhone Pro Max / Large Mobile

| # | Check Item | Expected Behaviour | Req |
|---|------------|-------------------|-----|
| 1 | Navigation | BottomNav visible, fixed at bottom | 28.1 |
| 2 | SideNav | Hidden (not rendered) | 28.1 |
| 3 | Map page | Full-screen map above bottom nav | 28.2 |
| 4 | Station panel | BottomSheet (slide-up drawer) | 28.2 |
| 5 | Community page | Single-column feed, inline filters | 28.3 |
| 6 | Forms | Full-width layout | 28.4 |
| 7 | Route results | Collapsible cards, full width | 28.5 |
| 8 | Touch targets | Minimum 44px effective tap areas | 26.5 |

### 768px — iPad / Tablet (Breakpoint Boundary)

| # | Check Item | Expected Behaviour | Req |
|---|------------|-------------------|-----|
| 1 | Navigation | SideNav rail visible (80px wide, left edge) | 29.1 |
| 2 | BottomNav | Hidden (not rendered) | 29.1 |
| 3 | Main content | Offset left by pl-20 (80px) for SideNav | 29.1 |
| 4 | Map page | Map and station panel visible simultaneously | 29.2 |
| 5 | Station panel | SidePanel (right-side sheet) | 29.2 |
| 6 | Community page | Sidebar filters visible alongside feed | 29.3 |
| 7 | AI chat | Wider panel format | 29.4 |
| 8 | Profile settings | Multi-column layout | 29.5 |

### 1024px — Laptop / Small Desktop

| # | Check Item | Expected Behaviour | Req |
|---|------------|-------------------|-----|
| 1 | Navigation | SideNav rail visible | 29.1 |
| 2 | BottomNav | Hidden (not rendered) | 29.1 |
| 3 | Map page | Map + station side panel simultaneously | 29.2 |
| 4 | Community page | Sidebar filters + wider feed column | 29.3 |
| 5 | Route results | Cards with additional detail visible | 29.2 |
| 6 | AI chat | Wide panel format with more context | 29.4 |
| 7 | Profile settings | Multi-column settings layout | 29.5 |
| 8 | Content areas | Reasonable max-width, not stretched edge-to-edge | — |

### 1440px — Large Desktop / External Monitor

| # | Check Item | Expected Behaviour | Req |
|---|------------|-------------------|-----|
| 1 | Navigation | SideNav rail visible | 29.1 |
| 2 | BottomNav | Hidden (not rendered) | 29.1 |
| 3 | Map page | Map + station side panel, generous spacing | 29.2 |
| 4 | Community page | Sidebar filters + wider feed, max-width applied | 29.3 |
| 5 | AI chat | Wide panel, max-width prevents over-stretching | 29.4 |
| 6 | Profile settings | Multi-column, balanced use of space | 29.5 |
| 7 | Overall layout | Content remains readable — not stretched to edges | — |
| 8 | SideNav | Same 80px rail width (does not expand) | 29.1 |

---

## Implementation Verification Results

### ✅ 1. `useResponsive.ts` — matchMedia with 768px breakpoint

- **Status**: PASS
- **Evidence**: Uses `window.matchMedia('(max-width: 767px)')` which triggers at the 768px boundary
- **Behaviour**: Returns `{ isMobile: boolean, isDesktop: boolean }` — SSR-safe with `typeof window` check
- **Reactivity**: Listens to `change` event on the MediaQueryList for live viewport switching

### ✅ 2. `BottomNav.tsx` — conditionally rendered for mobile only

- **Status**: PASS
- **Evidence**: Rendered in `App.tsx` with `{isMobile && <BottomNav />}`
- **Layout**: Fixed bottom, z-50, full-width with safe-area padding
- **Items**: 5 nav items (Map, Route, Community, AI, Profile) with icons + labels

### ✅ 3. `SideNav.tsx` — conditionally rendered for desktop only

- **Status**: PASS
- **Evidence**: Rendered in `App.tsx` with `{!isMobile && <SideNav />}`
- **Layout**: Fixed left, top-to-bottom, 80px wide (w-20), z-50
- **Items**: Same 5 nav items as BottomNav, displayed vertically

### ✅ 4. `App.tsx` — switches between BottomNav/SideNav based on viewport

- **Status**: PASS
- **Evidence**: `AppLayout` calls `useResponsive()` and conditionally renders:
  - `{!isMobile && <SideNav />}` — desktop side nav
  - `{isMobile && <BottomNav />}` — mobile bottom nav
- **Content offset**: `pb-16` (bottom padding for mobile nav) / `pl-20` (left padding for side nav)

### ✅ 5. `ResponsivePanel.tsx` — switches BottomSheet vs SidePanel at 768px

- **Status**: PASS
- **Evidence**: Calls `useResponsive()` and renders `<BottomSheet>` when `isMobile` or `<SidePanel>` when desktop
- **BottomSheet**: Vaul Drawer component (slide-up drawer for mobile)
- **SidePanel**: Shadcn Sheet component (right-side panel for desktop)

### ✅ 6. `CommunityPage.tsx` — single column mobile / sidebar filters desktop

- **Status**: PASS
- **Evidence**: Uses `useResponsive()`:
  - Desktop (`isDesktop`): `<IncidentFilters>` in a `shrink-0 border-r p-4` sidebar div
  - Mobile (`!isDesktop`): `<IncidentFilters>` rendered inline above the feed
- **Layout**: Flexbox-based (`flex flex-1 overflow-hidden`) for the content split

---

## Testing Approaches

Since browser-based visual testing cannot run in this environment, the following strategies ensure correctness:

1. **Code review** (completed above): All conditional rendering paths verified against requirements
2. **Unit tests**: `useResponsive` hook can be tested with `matchMedia` mocks
3. **Tailwind responsive classes**: `md:` prefix classes verified in component classNames
4. **Manual QA**: Use browser DevTools responsive mode at each viewport width listed above
5. **Automated visual regression**: Consider Playwright or Cypress with viewport configurations:
   ```typescript
   const VIEWPORTS = [
     { name: 'iPhone SE', width: 375, height: 667 },
     { name: 'iPhone Pro Max', width: 430, height: 932 },
     { name: 'iPad', width: 768, height: 1024 },
     { name: 'Laptop', width: 1024, height: 768 },
     { name: 'Desktop', width: 1440, height: 900 },
   ];
   ```

---

## Summary

All 6 implementation checkpoints pass verification. The responsive system uses:
- A single `useResponsive()` hook as the source of truth
- `window.matchMedia` for efficient, event-driven viewport detection
- Conditional React rendering (not CSS display:none) to avoid rendering unused components
- CSS Grid/Flexbox (Tailwind) for fluid layouts within each breakpoint tier
- No user-agent sniffing — purely viewport-based (Req 28.6)
