// Roadmap availability is presentation metadata, never a permission.
export type NavigationItem = {
  id: string; translationKey: string; icon: string; permission?: string;
} & ({ kind: 'page'; status: 'enabled' | 'disabled'; href?: string } |
     { kind: 'submenu'; children: NavigationItem[] });
export interface NavigationGroup { id: string; translationKey: string; items: NavigationItem[] }
export const navigationRoadmap: NavigationGroup[] = [
  {
    id: "overview",
    translationKey: "cpanel.navigation.group.overview",
    items: [
      {
        id: "foundation",
        translationKey: "cpanel.shell.foundation",
        icon: "grid",
        kind: "page",
        href: "/cpanel",
        status: "enabled"
      },
      {
        id: "dashboard",
        translationKey: "cpanel.navigation.dashboard",
        icon: "dashboard",
        kind: "page",
        status: "disabled"
      }
    ]
  },
  {
    id: "catalog",
    translationKey: "cpanel.navigation.group.catalog",
    items: [
      {
        id: "products",
        translationKey: "cpanel.navigation.products",
        icon: "box",
        kind: "page",
        status: "enabled",
        permission: "products.view",
        href: "/cpanel/products"
      },
      {
        id: "categories",
        translationKey: "cpanel.navigation.categories",
        icon: "categories",
        kind: "page",
        status: "enabled",
        permission: "categories.view",
        href: "/cpanel/categories"
      },
      {
        id: "brands",
        translationKey: "cpanel.navigation.brands",
        icon: "tag",
        kind: "page",
        status: "enabled",
        permission: "brands.view",
        href: "/cpanel/brands"
      },
      {
        id: "media",
        translationKey: "cpanel.navigation.media",
        icon: "image",
        kind: "page",
        status: "enabled",
        permission: "media.view",
        href: "/cpanel/media"
      },
      {
        id: "discounts",
        translationKey: "cpanel.navigation.discounts",
        icon: "discount",
        kind: "page",
        status: "enabled",
        permission: "discounts.view",
        href: "/cpanel/discounts"
      }
    ]
  },
  {
    id: "vendors",
    translationKey: "cpanel.navigation.group.vendors",
    items: [
      {
        id: "vendors",
        translationKey: "cpanel.navigation.vendors",
        icon: "store",
        kind: "page",
        status: "enabled",
        href: "/cpanel/vendors",
        permission: "vendors.view"
      },
      {
        id: "sourceProducts",
        translationKey: "cpanel.navigation.sourceProducts",
        icon: "source",
        kind: "page",
        status: "enabled",
        permission: "source_products.view",
        href: "/cpanel/source-products"
      }
    ]
  },
  {
    id: "sales",
    translationKey: "cpanel.navigation.group.sales",
    items: [
      {
        id: "orders",
        translationKey: "cpanel.navigation.orders",
        icon: "orders",
        kind: "page",
        status: "disabled"
      },
      {
        id: "customers",
        translationKey: "cpanel.navigation.customers",
        icon: "users",
        kind: "page",
        status: "disabled"
      },
      {
        id: "shopping",
        translationKey: "cpanel.navigation.shopping",
        icon: "cart",
        kind: "submenu",
        children: [
          {
            id: "carts",
            translationKey: "cpanel.navigation.carts",
            icon: "cart",
            kind: "page",
            status: "disabled"
          },
          {
            id: "favorites",
            translationKey: "cpanel.navigation.favorites",
            icon: "heart",
            kind: "page",
            status: "disabled"
          }
        ]
      },
      {
        id: "reviews",
        translationKey: "cpanel.navigation.reviews",
        icon: "star",
        kind: "page",
        status: "disabled"
      }
    ]
  },
  {
    id: "communication",
    translationKey: "cpanel.navigation.group.communication",
    items: [
      {
        id: "liveChat",
        translationKey: "cpanel.navigation.liveChat",
        icon: "chat",
        kind: "page",
        status: "disabled"
      },
      {
        id: "notifications",
        translationKey: "cpanel.navigation.notifications",
        icon: "bell",
        kind: "page",
        status: "disabled"
      }
    ]
  },
  {
    id: "content",
    translationKey: "cpanel.navigation.group.content",
    items: [
      {
        id: "customPages",
        translationKey: "cpanel.navigation.customPages",
        icon: "file",
        kind: "page",
        status: "disabled"
      },
      {
        id: "groups",
        translationKey: "cpanel.navigation.groups",
        icon: "layers",
        kind: "page",
        status: "disabled"
      }
    ]
  },
  {
    id: "marketplace",
    translationKey: "cpanel.navigation.group.marketplace",
    items: [
      {id:'currencies',translationKey:'cpanel.currencies.title',icon:'card',kind:'submenu',children:[
        {id:'frontendCurrencies',translationKey:'cpanel.currencies.frontend',icon:'globe',kind:'page',status:'enabled',href:'/cpanel/currencies/frontend',permission:'currencies.frontend.view'},
        {id:'vendorCurrencyRates',translationKey:'cpanel.currencies.vendors',icon:'store',kind:'page',status:'enabled',href:'/cpanel/currencies/vendors',permission:'currencies.vendor_rates.view'},
      ]},
      {
        id: "deliveryTypes",
        translationKey: "cpanel.navigation.deliveryTypes",
        icon: "truck",
        kind: "page",
        status: "enabled", href: "/cpanel/delivery-types", permission: "delivery_types.view"
      },
      {
        id: "paymentTypes",
        translationKey: "cpanel.navigation.paymentTypes",
        icon: "card",
        kind: "page",
        status: "enabled", href: "/cpanel/payment-types", permission: "payment_types.view"
      },
      {
        id: "orderStatuses",
        translationKey: "cpanel.navigation.orderStatuses",
        icon: "checklist",
        kind: "page",
        status: "enabled", href: "/cpanel/order-statuses", permission: "order_statuses.view"
      },
      {
        id: "restrictions",
        translationKey: "cpanel.navigation.restrictions",
        icon: "shield",
        kind: "page",
        status: "disabled"
      }
    ]
  },
  {
    id: "searchAnalytics",
    translationKey: "cpanel.navigation.group.searchAnalytics",
    items: [
      {
        id: "search",
        translationKey: "cpanel.navigation.search",
        icon: "search",
        kind: "page",
        status: "disabled"
      },
      {
        id: "searchSynonyms",
        translationKey: "cpanel.navigation.searchSynonyms",
        icon: "synonyms",
        kind: "page",
        status: "disabled"
      },
      {
        id: "analytics",
        translationKey: "cpanel.navigation.analytics",
        icon: "chart",
        kind: "page",
        status: "disabled"
      }
    ]
  },
  {
    id: "system",
    translationKey: "cpanel.navigation.group.system",
    items: [
      {
        id: "access",
        translationKey: "cpanel.navigation.access",
        icon: "lock",
        kind: "submenu",
        children: [
          {
            id: "users",
            permission: "users.view",
            translationKey: "cpanel.navigation.users",
            icon: "users",
            kind: "page",
            status: "enabled",
            href: "/cpanel/users"
          },
          {
            id: "permissions",
            translationKey: "cpanel.navigation.permissions",
            icon: "key",
            kind: "page",
            status: "enabled",
            permission: "permissions.view",
            href: "/cpanel/permissions"
          }
        ]
      },
      {
        id: "localization",
        translationKey: "cpanel.navigation.localization",
        icon: "globe",
        kind: "submenu",
        children: [
          {
            id: "languages",
            translationKey: "cpanel.navigation.languages",
            icon: "globe",
            kind: "page",
            status: "enabled",
            href: "/cpanel/languages",
            permission: "languages.view"
          },
          {
            id: "interfaceTranslations",
            translationKey: "cpanel.navigation.interfaceTranslations",
            icon: "translate",
            kind: "page",
            status: "enabled",
            href: "/cpanel/interface-translations",
            permission: "interface_translations.view"
          }
        ]
      },
      {
        id: "settings",
        translationKey: "cpanel.navigation.settings",
        icon: "settings",
        kind: "page",
        status: "enabled", href: "/cpanel/settings", permission: "settings.view"
      },
      {
        id: "systemEvents",
        translationKey: "cpanel.navigation.systemEvents",
        icon: "activity",
        kind: "page",
        status: "disabled"
      }
    ]
  }
];

export function prepareNavigation(groups: NavigationGroup[], translate: (key: string) => string, route: string, allowed: (permission: string) => boolean = () => true) {
  interface PreparedItem { id: string; label: string; icon: string; href?: string; status?: 'enabled' | 'disabled'; active: boolean; children?: PreparedItem[] }
  const visible = (item: NavigationItem) => !item.permission || allowed(item.permission);
  const nonempty = (item: PreparedItem) => !item.children || item.children.length > 0;
  function prepare(item: NavigationItem): PreparedItem {
    const children = item.kind === 'submenu' ? item.children.filter(visible).map(prepare).filter(nonempty) : undefined;
    const enabled = item.kind === 'page' && item.status === 'enabled';
    return { id: item.id, label: translate(item.translationKey), icon: item.icon,
      status: item.kind === 'page' ? item.status : undefined,
      // Disabled items never expose even a configured future URL to the template.
      href: enabled ? item.href : undefined,
      active: children ? children.some(child => child.active) : enabled && item.href === route,
      children };
  }
  return groups.map(group => ({ id: group.id, label: translate(group.translationKey), items: group.items.filter(visible).map(prepare).filter(nonempty) }));
}
