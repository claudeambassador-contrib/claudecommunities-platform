/**
 * City catalog — pure helpers + seed data.
 *
 * Cities are now per-tenant DB rows (`City` model). This module no longer reads
 * the build-time region; the server loader (`@/lib/cities-data`) fetches a
 * tenant's rows and the client provider (`@/components/CitiesProvider`) hands
 * them to components. The pure functions below operate on a passed-in `City[]`.
 *
 * `SEED_CITIES` is the single source the seed script (`scripts/seed-tenant.ts`)
 * imports — it carries the legacy `region` tag ONLY for seeding (it picks which
 * cities belong to which tenant). The runtime `City` shape drops `region`.
 */

export interface City {
  slug: string;
  name: string;
  state: string;
  stateFull: string;
  description: string;
  isCapital: boolean;
  keywords: string[];
  timezone: string;
}

/** Seed data — the legacy `ALL_CITIES`, tagged with `region` for the seed script only. */
export const SEED_CITIES: (City & { region: "au" | "nz" })[] = [
  // Australian Capital Cities
  {
    region: "au",
    slug: "sydney",
    name: "Sydney",
    state: "NSW",
    stateFull: "New South Wales",
    description:
      "Join the vibrant Claude Code community in Sydney. Connect with developers, AI enthusiasts, and tech professionals in Australia's largest tech hub.",
    isCapital: true,
    keywords: [
      "Claude Code Sydney",
      "Claude Code meetup Sydney",
      "AI meetups Sydney",
      "developer meetups Sydney",
      "coding community Sydney",
      "tech events Sydney NSW",
    ],
    timezone: "Australia/Sydney",
  },
  {
    region: "au",
    slug: "melbourne",
    name: "Melbourne",
    state: "VIC",
    stateFull: "Victoria",
    description:
      "Be part of Melbourne's growing Claude Code community. Meet fellow developers in Australia's cultural capital and explore the future of AI-powered coding.",
    isCapital: true,
    keywords: [
      "Claude Code Melbourne",
      "Claude Code meetup Melbourne",
      "AI meetups Melbourne",
      "developer meetups Melbourne",
      "coding community Melbourne",
      "tech events Melbourne VIC",
    ],
    timezone: "Australia/Melbourne",
  },
  {
    region: "au",
    slug: "brisbane",
    name: "Brisbane",
    state: "QLD",
    stateFull: "Queensland",
    description:
      "Connect with Brisbane's Claude Code enthusiasts. Join our Sunshine State community for meetups, workshops, and collaborative coding sessions.",
    isCapital: true,
    keywords: [
      "Claude Code Brisbane",
      "Claude Code meetup Brisbane",
      "AI meetups Brisbane",
      "developer meetups Brisbane",
      "coding community Brisbane",
      "tech events Brisbane QLD",
    ],
    timezone: "Australia/Brisbane",
  },
  {
    region: "au",
    slug: "perth",
    name: "Perth",
    state: "WA",
    stateFull: "Western Australia",
    description:
      "Join Perth's Claude Code community. Connect with West Australian developers exploring AI-assisted development and innovative coding practices.",
    isCapital: true,
    keywords: [
      "Claude Code Perth",
      "Claude Code meetup Perth",
      "AI meetups Perth",
      "developer meetups Perth",
      "coding community Perth",
      "tech events Perth WA",
    ],
    timezone: "Australia/Perth",
  },
  {
    region: "au",
    slug: "adelaide",
    name: "Adelaide",
    state: "SA",
    stateFull: "South Australia",
    description:
      "Be part of Adelaide's Claude Code scene. Meet South Australian developers passionate about AI, automation, and the future of software development.",
    isCapital: true,
    keywords: [
      "Claude Code Adelaide",
      "Claude Code meetup Adelaide",
      "AI meetups Adelaide",
      "developer meetups Adelaide",
      "coding community Adelaide",
      "tech events Adelaide SA",
    ],
    timezone: "Australia/Adelaide",
  },
  {
    region: "au",
    slug: "canberra",
    name: "Canberra",
    state: "ACT",
    stateFull: "Australian Capital Territory",
    description:
      "Join Canberra's Claude Code community. Connect with developers in Australia's capital city exploring AI-powered development and public sector innovation.",
    isCapital: true,
    keywords: [
      "Claude Code Canberra",
      "Claude Code meetup Canberra",
      "AI meetups Canberra",
      "developer meetups Canberra",
      "coding community Canberra",
      "tech events Canberra ACT",
    ],
    timezone: "Australia/Sydney",
  },
  {
    region: "au",
    slug: "hobart",
    name: "Hobart",
    state: "TAS",
    stateFull: "Tasmania",
    description:
      "Discover Hobart's Claude Code community. Meet Tasmanian developers pushing the boundaries of AI-assisted coding in Australia's island state.",
    isCapital: true,
    keywords: [
      "Claude Code Hobart",
      "Claude Code meetup Hobart",
      "AI meetups Hobart",
      "developer meetups Hobart",
      "coding community Hobart",
      "tech events Hobart Tasmania",
    ],
    timezone: "Australia/Hobart",
  },
  {
    region: "au",
    slug: "darwin",
    name: "Darwin",
    state: "NT",
    stateFull: "Northern Territory",
    description:
      "Join Darwin's Claude Code community. Connect with Northern Territory developers exploring AI-assisted development in Australia's tropical tech scene.",
    isCapital: true,
    keywords: [
      "Claude Code Darwin",
      "Claude Code meetup Darwin",
      "AI meetups Darwin",
      "developer meetups Darwin",
      "coding community Darwin",
      "tech events Darwin NT",
    ],
    timezone: "Australia/Darwin",
  },

  // Australian Regional Cities
  {
    region: "au",
    slug: "gold-coast",
    name: "Gold Coast",
    state: "QLD",
    stateFull: "Queensland",
    description:
      "Join the Gold Coast Claude Code community. Connect with developers on the glitter strip building the future of AI-powered software.",
    isCapital: false,
    keywords: [
      "Claude Code Gold Coast",
      "Claude Code meetup Gold Coast",
      "AI meetups Gold Coast",
      "developer meetups Gold Coast",
      "coding community Gold Coast",
      "tech events Gold Coast QLD",
    ],
    timezone: "Australia/Brisbane",
  },
  {
    region: "au",
    slug: "newcastle",
    name: "Newcastle",
    state: "NSW",
    stateFull: "New South Wales",
    description:
      "Be part of Newcastle's Claude Code community. Meet Hunter Valley developers passionate about AI-assisted coding and local tech innovation.",
    isCapital: false,
    keywords: [
      "Claude Code Newcastle",
      "Claude Code meetup Newcastle",
      "AI meetups Newcastle",
      "developer meetups Newcastle",
      "coding community Newcastle",
      "tech events Newcastle NSW",
    ],
    timezone: "Australia/Sydney",
  },
  {
    region: "au",
    slug: "sunshine-coast",
    name: "Sunshine Coast",
    state: "QLD",
    stateFull: "Queensland",
    description:
      "Join the Sunshine Coast Claude Code community. Connect with developers in one of Australia's fastest-growing tech regions.",
    isCapital: false,
    keywords: [
      "Claude Code Sunshine Coast",
      "Claude Code meetup Sunshine Coast",
      "AI meetups Sunshine Coast",
      "developer meetups Sunshine Coast",
      "tech events Sunshine Coast QLD",
    ],
    timezone: "Australia/Brisbane",
  },
  {
    region: "au",
    slug: "wollongong",
    name: "Wollongong",
    state: "NSW",
    stateFull: "New South Wales",
    description:
      "Join Wollongong's Claude Code community. Connect with Illawarra developers exploring AI-powered development south of Sydney.",
    isCapital: false,
    keywords: [
      "Claude Code Wollongong",
      "Claude Code meetup Wollongong",
      "AI meetups Wollongong",
      "developer meetups Wollongong",
      "tech events Wollongong NSW",
    ],
    timezone: "Australia/Sydney",
  },
  {
    region: "au",
    slug: "geelong",
    name: "Geelong",
    state: "VIC",
    stateFull: "Victoria",
    description:
      "Be part of Geelong's Claude Code community. Meet developers in Victoria's second city building with AI-assisted tools.",
    isCapital: false,
    keywords: [
      "Claude Code Geelong",
      "Claude Code meetup Geelong",
      "AI meetups Geelong",
      "developer meetups Geelong",
      "tech events Geelong VIC",
    ],
    timezone: "Australia/Melbourne",
  },
  {
    region: "au",
    slug: "townsville",
    name: "Townsville",
    state: "QLD",
    stateFull: "Queensland",
    description:
      "Join Townsville's Claude Code community. Connect with North Queensland developers exploring AI-powered coding and innovation.",
    isCapital: false,
    keywords: [
      "Claude Code Townsville",
      "Claude Code meetup Townsville",
      "AI meetups Townsville",
      "developer meetups Townsville",
      "tech events Townsville QLD",
    ],
    timezone: "Australia/Brisbane",
  },
  {
    region: "au",
    slug: "cairns",
    name: "Cairns",
    state: "QLD",
    stateFull: "Queensland",
    description:
      "Discover Cairns' Claude Code community. Meet Far North Queensland developers passionate about AI-assisted development.",
    isCapital: false,
    keywords: [
      "Claude Code Cairns",
      "Claude Code meetup Cairns",
      "AI meetups Cairns",
      "developer meetups Cairns",
      "tech events Cairns QLD",
    ],
    timezone: "Australia/Brisbane",
  },
  {
    region: "au",
    slug: "toowoomba",
    name: "Toowoomba",
    state: "QLD",
    stateFull: "Queensland",
    description:
      "Join Toowoomba's Claude Code community. Connect with Darling Downs developers building the future of AI-powered software.",
    isCapital: false,
    keywords: [
      "Claude Code Toowoomba",
      "Claude Code meetup Toowoomba",
      "AI meetups Toowoomba",
      "developer meetups Toowoomba",
      "tech events Toowoomba QLD",
    ],
    timezone: "Australia/Brisbane",
  },
  {
    region: "au",
    slug: "ballarat",
    name: "Ballarat",
    state: "VIC",
    stateFull: "Victoria",
    description:
      "Be part of Ballarat's Claude Code community. Meet regional Victorian developers exploring AI-assisted coding and tech innovation.",
    isCapital: false,
    keywords: [
      "Claude Code Ballarat",
      "Claude Code meetup Ballarat",
      "AI meetups Ballarat",
      "developer meetups Ballarat",
      "tech events Ballarat VIC",
    ],
    timezone: "Australia/Melbourne",
  },
  {
    region: "au",
    slug: "bendigo",
    name: "Bendigo",
    state: "VIC",
    stateFull: "Victoria",
    description:
      "Join Bendigo's Claude Code community. Connect with central Victorian developers passionate about AI-powered development.",
    isCapital: false,
    keywords: [
      "Claude Code Bendigo",
      "Claude Code meetup Bendigo",
      "AI meetups Bendigo",
      "developer meetups Bendigo",
      "tech events Bendigo VIC",
    ],
    timezone: "Australia/Melbourne",
  },
  {
    region: "au",
    slug: "launceston",
    name: "Launceston",
    state: "TAS",
    stateFull: "Tasmania",
    description:
      "Discover Launceston's Claude Code community. Meet northern Tasmanian developers exploring the future of AI-assisted software development.",
    isCapital: false,
    keywords: [
      "Claude Code Launceston",
      "Claude Code meetup Launceston",
      "AI meetups Launceston",
      "developer meetups Launceston",
      "tech events Launceston Tasmania",
    ],
    timezone: "Australia/Hobart",
  },

  // New Zealand Cities
  {
    region: "nz",
    slug: "auckland",
    name: "Auckland",
    state: "AUK",
    stateFull: "Auckland",
    description:
      "Join the vibrant Claude Code community in Auckland. Connect with developers, AI enthusiasts, and tech professionals in New Zealand's largest tech hub.",
    isCapital: false,
    keywords: [
      "Claude Code Auckland",
      "Claude Code meetup Auckland",
      "AI meetups Auckland",
      "developer meetups Auckland",
      "coding community Auckland",
      "tech events Auckland",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "wellington",
    name: "Wellington",
    state: "WGN",
    stateFull: "Wellington",
    description:
      "Be part of Wellington's growing Claude Code community. Meet fellow developers in New Zealand's capital and explore the future of AI-powered coding.",
    isCapital: true,
    keywords: [
      "Claude Code Wellington",
      "Claude Code meetup Wellington",
      "AI meetups Wellington",
      "developer meetups Wellington",
      "coding community Wellington",
      "tech events Wellington",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "christchurch",
    name: "Christchurch",
    state: "CAN",
    stateFull: "Canterbury",
    description:
      "Connect with Christchurch's Claude Code enthusiasts. Join our Canterbury community for meetups, workshops, and collaborative coding sessions.",
    isCapital: false,
    keywords: [
      "Claude Code Christchurch",
      "Claude Code meetup Christchurch",
      "AI meetups Christchurch",
      "developer meetups Christchurch",
      "coding community Christchurch",
      "tech events Christchurch Canterbury",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "hamilton",
    name: "Hamilton",
    state: "WKO",
    stateFull: "Waikato",
    description:
      "Join Hamilton's Claude Code community. Connect with Waikato developers exploring AI-assisted development and innovative coding practices.",
    isCapital: false,
    keywords: [
      "Claude Code Hamilton",
      "Claude Code meetup Hamilton",
      "AI meetups Hamilton",
      "developer meetups Hamilton",
      "coding community Hamilton",
      "tech events Hamilton Waikato",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "tauranga",
    name: "Tauranga",
    state: "BOP",
    stateFull: "Bay of Plenty",
    description:
      "Be part of Tauranga's Claude Code community. Meet Bay of Plenty developers passionate about AI, automation, and the future of software development.",
    isCapital: false,
    keywords: [
      "Claude Code Tauranga",
      "Claude Code meetup Tauranga",
      "AI meetups Tauranga",
      "developer meetups Tauranga",
      "coding community Tauranga",
      "tech events Tauranga Bay of Plenty",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "dunedin",
    name: "Dunedin",
    state: "OTA",
    stateFull: "Otago",
    description:
      "Discover Dunedin's Claude Code community. Meet Otago developers pushing the boundaries of AI-assisted coding in New Zealand's deep south.",
    isCapital: false,
    keywords: [
      "Claude Code Dunedin",
      "Claude Code meetup Dunedin",
      "AI meetups Dunedin",
      "developer meetups Dunedin",
      "coding community Dunedin",
      "tech events Dunedin Otago",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "palmerston-north",
    name: "Palmerston North",
    state: "MWT",
    stateFull: "Manawatū-Whanganui",
    description:
      "Join Palmerston North's Claude Code community. Connect with Manawatū developers building the future of AI-powered software.",
    isCapital: false,
    keywords: [
      "Claude Code Palmerston North",
      "Claude Code meetup Palmerston North",
      "AI meetups Palmerston North",
      "developer meetups Palmerston North",
      "coding community Palmerston North",
      "tech events Palmerston North Manawatū",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "napier",
    name: "Napier",
    state: "HKB",
    stateFull: "Hawke's Bay",
    description:
      "Be part of Napier's Claude Code community. Meet Hawke's Bay developers exploring AI-assisted coding and tech innovation.",
    isCapital: false,
    keywords: [
      "Claude Code Napier",
      "Claude Code meetup Napier",
      "AI meetups Napier",
      "developer meetups Napier",
      "coding community Napier",
      "tech events Napier Hawke's Bay",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "nelson",
    name: "Nelson",
    state: "NSN",
    stateFull: "Nelson",
    description:
      "Discover Nelson's Claude Code community. Meet top-of-the-south developers passionate about AI-powered development.",
    isCapital: false,
    keywords: [
      "Claude Code Nelson",
      "Claude Code meetup Nelson",
      "AI meetups Nelson",
      "developer meetups Nelson",
      "coding community Nelson",
      "tech events Nelson",
    ],
    timezone: "Pacific/Auckland",
  },
  {
    region: "nz",
    slug: "queenstown",
    name: "Queenstown",
    state: "OTA",
    stateFull: "Otago",
    description:
      "Join Queenstown's Claude Code community. Connect with Otago developers exploring the future of AI-assisted software development in the Southern Lakes.",
    isCapital: false,
    keywords: [
      "Claude Code Queenstown",
      "Claude Code meetup Queenstown",
      "AI meetups Queenstown",
      "developer meetups Queenstown",
      "coding community Queenstown",
      "tech events Queenstown Otago",
    ],
    timezone: "Pacific/Auckland",
  },
];

// ── Pure helpers ─────────────────────────────────────────────────────────────
// All operate on a caller-supplied `City[]` (the current tenant's rows, resolved
// by `@/lib/cities-data` server-side or `useCities()` client-side). No build-time
// region, no module-level dataset.

/** Capital cities (isCapital = true). */
export function capitalCities(cities: City[]): City[] {
  return cities.filter((city) => city.isCapital);
}

/** Regional cities (isCapital = false). */
export function regionalCities(cities: City[]): City[] {
  return cities.filter((city) => !city.isCapital);
}

/** Find a city by slug (case-insensitive). */
export function cityBySlug(cities: City[], slug: string): City | undefined {
  const target = slug.toLowerCase();
  return cities.find((city) => city.slug.toLowerCase() === target);
}

/** All city slugs. */
export function citySlugs(cities: City[]): string[] {
  return cities.map((city) => city.slug);
}

/** Number of cities. */
export function cityCount(cities: City[]): number {
  return cities.length;
}

/**
 * Resolve the timezone for a city by name (case-insensitive). Returns
 * `fallbackTz` when no city matches.
 */
export function timezoneForCity(cities: City[], cityName: string, fallbackTz: string): string {
  const target = cityName.toLowerCase();
  const city = cities.find((c) => c.name.toLowerCase() === target);
  return city?.timezone ?? fallbackTz;
}
