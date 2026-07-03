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
  /** Full display name, e.g. "Nexio". A proper noun — not translated. */
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

export const DEFAULT_TENANT_ID = 'nexio'

/**
 * Indigo → violet. Mid stops are deliberately deep (500 = #7c3aed) so that
 * white text on a brand-filled surface (buttons, badge) clears WCAG AA.
 */
const VIOLET: ColorScale = {
  '50': '245 243 255',
  '100': '237 233 254',
  '200': '221 214 254',
  '300': '196 181 253',
  '400': '167 139 250',
  '500': '124 58 237',
  '600': '109 40 217',
  '700': '91 33 182',
  '800': '76 29 149',
  '900': '59 21 128',
  '950': '46 16 101',
}

/** Cyan accent — the electric counterpoint to the violet brand. */
const CYAN: ColorScale = {
  '50': '236 254 255',
  '100': '207 250 254',
  '200': '165 243 252',
  '300': '103 232 249',
  '400': '34 211 238',
  '500': '6 182 212',
  '600': '8 145 178',
  '700': '14 116 144',
  '800': '21 94 117',
  '900': '22 78 99',
  '950': '8 51 68',
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
  nexio: {
    id: 'nexio',
    name: 'Nexio',
    shortName: 'Nexio',
    logoMark: 'N',
    logoUrl: null,
    tagline: {
      en: 'Commerce · in · motion',
      'pt-BR': 'Comércio · em · movimento',
    },
    description: {
      en: 'The unified commerce platform. Pick a unit, place your order and track it in real time.',
      'pt-BR':
        'A plataforma de comércio unificado. Escolha uma unidade, monte seu pedido e acompanhe em tempo real.',
    },
    theme: { brand: VIOLET, accent: CYAN },
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
