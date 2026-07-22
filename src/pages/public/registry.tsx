import type { ComponentType, LazyExoticComponent } from 'react';
// <public:imports>
// </public:imports>

// Registry for agent-built (bespoke) public pages. A slug registered here
// REPLACES the generic config-driven form renderer for that slug — the
// shared link (/#/public/<slug>) stays identical, which is exactly the
// upgrade path: a generic form can become a custom page without a new URL.
//
// To register a page, add `import { lazy } from 'react';` inside the
// <public:imports> markers and an entry inside <public:pages>, e.g.:
//   'buchung': lazy(() => import('@/pages/public/Booking')),
export const PUBLIC_PAGES: Record<string, LazyExoticComponent<ComponentType>> = {
  // <public:pages>
  // </public:pages>
};
