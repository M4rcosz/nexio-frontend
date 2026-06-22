/**
 * Multi-tenant branding registry.
 *
 * Everything that differs per white-label tenant lives here: name, logo,
 * tagline, marketing description and the full color palette. Colors are stored
 * as space-separated RGB triples so they can be injected straight into CSS
 * custom properties (`rgb(var(--brand-500) / <alpha>)`), which means a tenant
 * can re-skin the entire UI without touching a single component.
 *
 * In production this registry would be backed by the API / a tenants table;
 * for now it's a static map with a sensible default.
 */

export type ColorScale = {
  '50': string
  '100': string
  '200': string
  '300': string
  '400': string
  '500': string
  '600': string
  '700': string
  '800': string
  '900': string
  '950': string
}

export type LocalizedText = Record<string, string>

export type Tenant = {
  id: string
  /** Full display name, e.g. "Raízes do Nordeste". A proper noun — not translated. */
  name: string
  /** Short name used in tight spots. */
  shortName: string
  /** Single glyph/initials shown inside the logo badge when there's no image. */
  logoMark: string
  /** Optional logo image URL. When set, it replaces the badge. */
  logoUrl: string | null
  /** Small uppercase tagline under the logo, per locale. */
  tagline: LocalizedText
  /** Marketing description used for <meta name="description">, per locale. */
  description: LocalizedText
  /** Per-tenant color palette. */
  theme: {
    brand: ColorScale
    accent: ColorScale
  }
}

/** Branding subset safe to ship to the client (no need for the heavy theme). */
export type TenantBranding = Pick<
  Tenant,
  'id' | 'name' | 'shortName' | 'logoMark' | 'logoUrl' | 'tagline'
>

export const DEFAULT_TENANT_ID = 'raizes'

const CRIMSON: ColorScale = {
  '50': '255 240 243',
  '100': '255 219 226',
  '200': '255 184 198',
  '300': '255 132 153',
  '400': '251 64 99',
  '500': '230 12 52',
  '600': '194 0 41',
  '700': '158 3 34',
  '800': '130 8 33',
  '900': '107 10 32',
  '950': '61 1 13',
}

const NEON_ROSE: ColorScale = {
  '50': '255 240 244',
  '100': '255 217 227',
  '200': '255 176 203',
  '300': '255 117 163',
  '400': '255 45 110',
  '500': '255 10 76',
  '600': '230 0 57',
  '700': '189 0 48',
  '800': '155 5 44',
  '900': '130 10 42',
  '950': '72 0 18',
}

const AMBER: ColorScale = {
  '50': '255 248 235',
  '100': '253 237 200',
  '200': '251 216 140',
  '300': '249 192 77',
  '400': '247 166 36',
  '500': '240 136 0',
  '600': '213 106 0',
  '700': '177 74 5',
  '800': '143 58 12',
  '900': '118 48 15',
  '950': '67 22 4',
}

const EMBER: ColorScale = {
  '50': '255 242 237',
  '100': '255 224 212',
  '200': '255 188 168',
  '300': '255 148 116',
  '400': '255 106 64',
  '500': '255 74 32',
  '600': '230 53 13',
  '700': '190 41 8',
  '800': '156 36 10',
  '900': '128 33 13',
  '950': '70 12 3',
}

export const TENANTS: Record<string, Tenant> = {
  raizes: {
    id: 'raizes',
    name: 'Raízes do Nordeste',
    shortName: 'Raízes',
    logoMark: 'R',
    logoUrl: null,
    tagline: {
      en: 'Flavors · from · the · sertão',
      'pt-BR': 'Sabores · do · sertão',
    },
    description: {
      en: "Authentic flavors of Brazil's Northeast. Pick a unit, place your order and track it in real time.",
      'pt-BR':
        'Sabores autênticos do Nordeste brasileiro. Escolha sua unidade, monte seu pedido e acompanhe em tempo real.',
    },
    theme: { brand: CRIMSON, accent: NEON_ROSE },
  },

  // Example of a second white-label tenant — proves the theme/branding swap.
  sertao: {
    id: 'sertao',
    name: 'Sabor do Sertão',
    shortName: 'Sertão',
    logoMark: 'S',
    logoUrl: null,
    tagline: {
      en: 'Fire · roots · tradition',
      'pt-BR': 'Fogo · raiz · tradição',
    },
    description: {
      en: 'Wood-fire Northeastern cooking. Choose a kitchen, order and follow it live.',
      'pt-BR':
        'Comida nordestina na lenha. Escolha uma cozinha, peça e acompanhe ao vivo.',
    },
    theme: { brand: AMBER, accent: EMBER },
  },
}

export function getTenantById(id?: string | null): Tenant {
  if (id && TENANTS[id]) return TENANTS[id]
  return TENANTS[DEFAULT_TENANT_ID]
}

export function toBranding(tenant: Tenant): TenantBranding {
  return {
    id: tenant.id,
    name: tenant.name,
    shortName: tenant.shortName,
    logoMark: tenant.logoMark,
    logoUrl: tenant.logoUrl,
    tagline: tenant.tagline,
  }
}

/**
 * Builds the inline CSS-variable map that re-skins the UI for a tenant.
 * Returned as a plain record; cast to React.CSSProperties at the call site.
 */
export function tenantThemeVars(tenant: Tenant): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [stop, value] of Object.entries(tenant.theme.brand)) {
    vars[`--brand-${stop}`] = value
  }
  for (const [stop, value] of Object.entries(tenant.theme.accent)) {
    vars[`--accent-${stop}`] = value
  }
  return vars
}

export function localized(text: LocalizedText, locale: string): string {
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? ''
}
