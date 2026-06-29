import { getRegionConfig, majorCitiesPhrase } from "@/lib/region";

const { countryName, nationality, communityName } = getRegionConfig();

export interface VerticalUseCase {
  title: string;
  description: string;
  icon: string;
}

export interface VerticalFeature {
  title: string;
  description: string;
  bulletPoints: string[];
}

export interface VerticalFaq {
  question: string;
  answer: string;
}

export interface VerticalBenefit {
  stat: string;
  label: string;
}

export interface Vertical {
  slug: string;
  name: string;
  tagline: string;
  // SEO
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  // Hero
  heroHeading: string;
  heroSubheading: string;
  heroBadge: string;
  // Content
  introParagraphs: string[];
  useCases: VerticalUseCase[];
  benefits: VerticalBenefit[];
  features: VerticalFeature[];
  faqs: VerticalFaq[];
  // Cross-linking
  relatedVerticals: string[];
  ctaHeading: string;
  ctaDescription: string;
}

export const VERTICALS: Vertical[] = [
  {
    slug: "ecommerce",
    name: "E-Commerce",
    tagline: "Build better online stores with AI-powered development",
    title: "Claude Code for E-Commerce - AI-Powered Store Development",
    description: `Learn how ${nationality} e-commerce developers use Claude Code to build Shopify stores, WooCommerce sites, checkout flows, and product pages faster. Join the community.`,
    keywords: [
      "Claude Code ecommerce",
      "Claude Code Shopify",
      "Claude Code WooCommerce",
      "AI ecommerce development",
      "AI online store builder",
      "Claude Code checkout flow",
      "AI product page development",
      `ecommerce developer ${countryName}`,
    ],
    ogTitle: "Claude Code for E-Commerce - Build Better Stores with AI",
    ogDescription: `${nationality} developers are using Claude Code to build Shopify stores, checkout flows, and product pages faster. Join the community.`,
    heroHeading: "Claude Code for E-Commerce",
    heroSubheading: `${nationality} developers are using Claude Code to build high-converting online stores, streamline checkout flows, and ship product pages faster than ever.`,
    heroBadge: "E-Commerce",
    introParagraphs: [
      `E-commerce development in ${countryName} is booming. From Shopify custom themes to headless WooCommerce builds, developers are under pressure to deliver fast, accessible, and conversion-optimised storefronts. Claude Code is changing how teams approach this work — enabling solo devs and agencies alike to build in hours what used to take days.`,
      `Whether you're integrating Stripe and Afterpay payment gateways, building dynamic product filtering, or optimising checkout UX for mobile, Claude Code helps you write production-ready code with fewer bugs and faster iteration cycles. Our community includes developers building for some of ${countryName}'s biggest online retailers.`,
      `Join the Claude Code Community to connect with e-commerce developers across ${countryName}, share integration patterns, and learn from real-world case studies at our regular meetups.`,
    ],
    useCases: [
      {
        title: "Shopify Theme Development",
        description:
          "Build custom Shopify Liquid themes and sections with Claude Code. Generate responsive product grids, collection pages, and cart drawers in minutes.",
        icon: "ShoppingBag",
      },
      {
        title: "Checkout Flow Optimisation",
        description:
          "Create streamlined, accessible checkout experiences. Claude Code helps build multi-step forms, address validation, and payment gateway integrations.",
        icon: "CreditCard",
      },
      {
        title: "Product Page Generation",
        description:
          "Generate SEO-optimised product pages with structured data, image galleries, variant selectors, and dynamic pricing components.",
        icon: "Package",
      },
      {
        title: "Payment Gateway Integration",
        description:
          "Integrate Stripe, Afterpay, PayPal, and other payment providers. Claude Code generates type-safe webhook handlers and secure payment flows.",
        icon: "Wallet",
      },
      {
        title: "Inventory & Order Management",
        description:
          "Build real-time inventory tracking, order status dashboards, and automated fulfilment workflows with clean, maintainable code.",
        icon: "ClipboardList",
      },
      {
        title: "Analytics & Conversion Tracking",
        description:
          "Implement GA4 e-commerce events, Facebook Pixel tracking, and custom conversion funnels with properly typed data layers.",
        icon: "BarChart3",
      },
    ],
    benefits: [
      { stat: "3x", label: "Faster storefront development" },
      { stat: "60%", label: "Less boilerplate code" },
      { stat: "45%", label: "Fewer checkout bugs" },
    ],
    features: [
      {
        title: "Rapid Storefront Prototyping",
        description:
          "Go from wireframe to working storefront in a single session. Claude Code understands e-commerce patterns and generates production-quality components.",
        bulletPoints: [
          "Generate complete product listing pages with filtering and sorting",
          "Build responsive cart and checkout components from a description",
          "Create Shopify Liquid templates with proper section schema",
          "Scaffold headless commerce frontends with Next.js and your preferred CMS",
        ],
      },
      {
        title: "Payment & Integration Code",
        description: `Integrating third-party services is where Claude Code really shines. Generate type-safe, tested integration code for the services ${nationality} stores depend on.`,
        bulletPoints: [
          "Stripe Checkout and Afterpay integration with webhook verification",
          "Local courier shipping rate calculators",
          "Klaviyo, Mailchimp, and Omnisend email automation triggers",
          "Xero and MYOB accounting sync for order data",
        ],
      },
      {
        title: "Performance & SEO Optimisation",
        description:
          "E-commerce sites live and die by their Core Web Vitals and search rankings. Claude Code helps you build fast, crawlable storefronts from the start.",
        bulletPoints: [
          "Generate optimised image components with lazy loading and srcset",
          "Build JSON-LD product schema for rich search results",
          "Create server-rendered product pages for instant load times",
          "Implement smart preloading and code splitting strategies",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Claude Code build a complete Shopify store?",
        answer:
          "Claude Code excels at generating Shopify Liquid theme code, custom sections, and app integrations. While it works best as a development accelerator alongside a developer, it can generate complete theme sections, checkout customisations, and metafield configurations. Many community members report building custom Shopify themes 3x faster with Claude Code.",
      },
      {
        question: "Does Claude Code work with WooCommerce and WordPress?",
        answer:
          "Yes. Claude Code can generate WooCommerce plugin code, custom product templates, checkout modifications, and REST API integrations. It understands WordPress hooks, filters, and the WooCommerce data model, making it effective for custom store development.",
      },
      {
        question: "How does Claude Code handle payment gateway integration?",
        answer: `Claude Code generates secure, type-safe payment integration code for Stripe, Afterpay, PayPal, and other providers popular in ${countryName}. It follows best practices for webhook verification, idempotency keys, and PCI compliance patterns. Always review generated payment code with your security team before deploying to production.`,
      },
      {
        question: "Can Claude Code help with e-commerce SEO?",
        answer:
          "Absolutely. Claude Code can generate JSON-LD product schema, meta tag configurations, canonical URL structures, and SEO-friendly routing patterns. It understands structured data requirements for Google Shopping and can help build server-rendered pages that score well on Core Web Vitals.",
      },
      {
        question: "Is there a community for e-commerce developers using Claude Code?",
        answer: `Yes! The ${communityName} hosts regular meetups across ${countryName} where e-commerce developers share patterns, integrations, and case studies. Join our online community to connect with developers building stores with Claude Code.`,
      },
      {
        question: "What e-commerce frameworks does Claude Code support?",
        answer:
          "Claude Code works with all major e-commerce frameworks and platforms including Shopify (Liquid, Hydrogen), WooCommerce, Magento, BigCommerce, Medusa, Saleor, and headless solutions using Next.js, Nuxt, or Remix. It generates code in the patterns and conventions specific to each platform.",
      },
    ],
    relatedVerticals: ["marketing", "saas", "agencies"],
    ctaHeading: "Start Building Better Stores",
    ctaDescription: `Join ${nationality} e-commerce developers who are shipping faster with Claude Code. Get access to meetups, workshops, and a community that understands online retail.`,
  },
  {
    slug: "marketing",
    name: "Marketing",
    tagline: "Ship marketing sites and campaigns faster with AI",
    title: "Claude Code for Marketing - AI-Powered Marketing Development",
    description: `Learn how ${nationality} marketing developers use Claude Code to build landing pages, email templates, analytics dashboards, and A/B tests faster. Join the community.`,
    keywords: [
      "Claude Code marketing",
      "Claude Code landing pages",
      "Claude Code email templates",
      "AI marketing development",
      "AI landing page builder",
      "Claude Code A/B testing",
      "AI analytics dashboard",
      `marketing developer ${countryName}`,
    ],
    ogTitle: "Claude Code for Marketing - Ship Campaigns Faster with AI",
    ogDescription: `${nationality} marketing teams are using Claude Code to build landing pages, email templates, and analytics dashboards faster. Join the community.`,
    heroHeading: "Claude Code for Marketing",
    heroSubheading: `${nationality} marketing teams are using Claude Code to build high-converting landing pages, email campaigns, and analytics dashboards at startup speed.`,
    heroBadge: "Marketing",
    introParagraphs: [
      `Marketing moves fast. Campaign deadlines, A/B test variations, new landing pages every week — marketing developers and growth engineers need to ship quality code without the luxury of long sprint cycles. Claude Code is becoming the secret weapon for marketing teams across ${countryName}.`,
      "From pixel-perfect landing pages to complex analytics pipelines, Claude Code helps marketing developers translate briefs into working code faster. Build responsive email templates that render across every client, set up event tracking that actually captures the right data, and create CRM integrations that keep your sales team happy.",
      `The Claude Code Community brings together marketing developers, growth engineers, and technical marketers to share what's working. Join our meetups to learn how ${nationality} teams are using AI-assisted development to outpace their competition.`,
    ],
    useCases: [
      {
        title: "Landing Page Development",
        description:
          "Build high-converting landing pages in minutes. Claude Code generates responsive, accessible pages with proper heading hierarchy and conversion-optimised layouts.",
        icon: "Layout",
      },
      {
        title: "Email Template Engineering",
        description:
          "Create bulletproof HTML email templates that render perfectly in Outlook, Gmail, and Apple Mail. Generate responsive table-based layouts with dark mode support.",
        icon: "Mail",
      },
      {
        title: "Analytics & Tracking Setup",
        description:
          "Implement GA4, Segment, and Mixpanel tracking with properly typed event schemas. Build custom dashboards that surface the metrics that matter.",
        icon: "BarChart3",
      },
      {
        title: "A/B Testing Infrastructure",
        description:
          "Build feature flag systems and A/B testing frameworks. Generate variant components, tracking code, and statistical analysis helpers.",
        icon: "Split",
      },
      {
        title: "CRM Integration",
        description:
          "Connect your marketing stack to HubSpot, Salesforce, or ActiveCampaign. Generate type-safe API clients and sync pipelines for lead management.",
        icon: "Users",
      },
      {
        title: "Content Management Systems",
        description:
          "Build custom CMS integrations with Contentful, Sanity, or Strapi. Generate typed content models, preview routes, and webhook handlers.",
        icon: "FileText",
      },
    ],
    benefits: [
      { stat: "5x", label: "Faster landing page builds" },
      { stat: "70%", label: "Less time on email templates" },
      { stat: "40%", label: "More A/B test variations shipped" },
    ],
    features: [
      {
        title: "Landing Pages at Startup Speed",
        description:
          "Stop waiting on dev sprints to launch campaigns. Claude Code lets marketing developers go from Figma to deployed landing page in a single session.",
        bulletPoints: [
          "Generate complete landing pages from a brief or wireframe description",
          "Build component libraries for hero sections, testimonials, pricing tables, and CTAs",
          "Create responsive layouts that look great on mobile without manual tweaking",
          "Add micro-interactions and scroll animations with Framer Motion or CSS",
        ],
      },
      {
        title: "Email Development Without the Pain",
        description:
          "HTML email development is notoriously painful. Claude Code understands the quirks of email rendering engines and generates compatible code out of the box.",
        bulletPoints: [
          "Table-based layouts that render correctly in Outlook 2016+",
          "Dark mode support with proper colour fallbacks for Apple Mail and Gmail",
          "Responsive designs using hybrid coding techniques",
          "Generate MJML or Foundation for Emails templates from plain descriptions",
        ],
      },
      {
        title: "Analytics That Actually Work",
        description:
          "Tracking code is easy to get wrong and expensive to fix. Claude Code generates correctly structured analytics implementations from the start.",
        bulletPoints: [
          "GA4 e-commerce and custom event implementations with proper parameters",
          "Server-side tracking with Segment or RudderStack for ad-blocker resilience",
          "Custom Looker Studio and Metabase dashboard queries",
          "UTM parameter handling and attribution model helpers",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Claude Code build landing pages from a design brief?",
        answer:
          "Yes. Claude Code can generate complete, responsive landing pages from a text description of the design and content requirements. Many marketing developers in our community use it to go from campaign brief to deployed page in under an hour. It generates clean HTML, CSS, and JavaScript with proper semantic structure.",
      },
      {
        question: "Does Claude Code work with marketing automation platforms?",
        answer:
          "Claude Code generates integration code for popular marketing platforms including HubSpot, Mailchimp, ActiveCampaign, Klaviyo, and Braze. It can build webhook handlers, API sync scripts, and custom integration layers that keep your marketing stack connected.",
      },
      {
        question: "How does Claude Code help with A/B testing?",
        answer:
          "Claude Code can generate A/B test variant components, feature flag implementations, and statistical analysis helpers. It understands popular testing frameworks like LaunchDarkly, Optimizely, and custom solutions. Many teams use it to ship more test variations in less time.",
      },
      {
        question: "Can Claude Code create HTML email templates?",
        answer:
          "Yes, and this is one of its strongest use cases for marketing teams. Claude Code understands the quirks of email rendering in Outlook, Gmail, and Apple Mail. It generates table-based layouts, inline CSS, and dark mode fallbacks that work across email clients.",
      },
      {
        question: "Is Claude Code useful for non-technical marketers?",
        answer:
          "Claude Code is a developer tool, so it's most effective when used by someone comfortable with code. However, technical marketers who know basic HTML/CSS find it incredibly useful for building and modifying landing pages, email templates, and tracking implementations without waiting for engineering support.",
      },
    ],
    relatedVerticals: ["ecommerce", "agencies", "startups"],
    ctaHeading: "Ship Campaigns Faster",
    ctaDescription: `Join ${nationality} marketing developers who are building landing pages, email campaigns, and analytics implementations at startup speed with Claude Code.`,
  },
  {
    slug: "saas",
    name: "SaaS",
    tagline: "Build and ship SaaS products faster with AI-assisted development",
    title: "Claude Code for SaaS - AI-Powered Product Development",
    description: `Learn how ${nationality} SaaS developers use Claude Code to build MVPs, authentication systems, APIs, billing integrations, and admin dashboards faster. Join the community.`,
    keywords: [
      "Claude Code SaaS",
      "Claude Code MVP",
      "Claude Code API development",
      "AI SaaS development",
      "AI MVP builder",
      "Claude Code authentication",
      "Claude Code billing integration",
      `SaaS developer ${countryName}`,
    ],
    ogTitle: "Claude Code for SaaS - Build Products Faster with AI",
    ogDescription: `${nationality} SaaS teams are using Claude Code to ship MVPs, build APIs, and integrate billing systems faster. Join the community.`,
    heroHeading: "Claude Code for SaaS",
    heroSubheading: `${nationality} SaaS builders are using Claude Code to go from idea to MVP faster, build robust APIs, and ship features that would normally take entire sprints.`,
    heroBadge: "SaaS",
    introParagraphs: [
      `${countryName}'s SaaS scene is thriving, with startups and scale-ups building products for local and global markets. The challenge is always the same: ship fast, build reliably, and keep technical debt under control. Claude Code is becoming an essential tool for SaaS development teams who need to move at startup speed without sacrificing code quality.`,
      "Whether you're prototyping a new MVP, building a multi-tenant authentication system, or integrating Stripe billing with usage-based pricing, Claude Code helps you generate production-ready code from clear specifications. It understands modern SaaS patterns — from API design to webhook handling to role-based access control.",
      `Join the Claude Code Community to connect with SaaS founders, CTOs, and senior developers across ${countryName}. Share architectural patterns, get feedback on technical decisions, and learn from teams who are shipping real products with AI-assisted development.`,
    ],
    useCases: [
      {
        title: "MVP Prototyping",
        description:
          "Go from idea to working prototype in days, not weeks. Claude Code generates full-stack scaffolding, database schemas, and API routes from your product spec.",
        icon: "Rocket",
      },
      {
        title: "Authentication & Authorisation",
        description:
          "Build secure auth systems with JWT, OAuth, magic links, or passkeys. Generate role-based access control, team management, and session handling.",
        icon: "Shield",
      },
      {
        title: "API Development",
        description:
          "Design and build REST or GraphQL APIs with proper validation, error handling, rate limiting, and OpenAPI documentation generation.",
        icon: "Code",
      },
      {
        title: "Billing & Subscriptions",
        description:
          "Integrate Stripe Billing with subscription management, usage-based pricing, invoicing, and customer portal. Handle webhooks and edge cases properly.",
        icon: "CreditCard",
      },
      {
        title: "Admin Dashboards",
        description:
          "Build internal tools and admin panels with data tables, charts, user management, and audit logs. Generate full CRUD interfaces from your database schema.",
        icon: "LayoutDashboard",
      },
      {
        title: "Background Jobs & Queues",
        description:
          "Set up job queues with BullMQ, Inngest, or Trigger.dev. Generate workers, retry logic, and monitoring for email sends, data processing, and integrations.",
        icon: "Layers",
      },
    ],
    benefits: [
      { stat: "4x", label: "Faster MVP development" },
      { stat: "50%", label: "Less time on boilerplate" },
      { stat: "3x", label: "More features per sprint" },
    ],
    features: [
      {
        title: "From Idea to MVP in Days",
        description:
          "Claude Code understands modern SaaS architecture. Describe your product and get a working foundation with auth, database, API routes, and a basic UI.",
        bulletPoints: [
          "Generate full-stack Next.js or Remix applications with database models",
          "Scaffold authentication with NextAuth, Clerk, or Supabase Auth",
          "Build type-safe API routes with Zod validation and proper error responses",
          "Create database schemas with Prisma or Drizzle ORM from a spec description",
        ],
      },
      {
        title: "Billing That Just Works",
        description:
          "Stripe integration is one of the most complex parts of any SaaS. Claude Code generates battle-tested billing code that handles the edge cases.",
        bulletPoints: [
          "Stripe Checkout, Customer Portal, and webhook handler generation",
          "Usage-based billing with metering API integration",
          "Subscription lifecycle management (trials, upgrades, cancellations)",
          "Invoice generation and tax handling for local GST requirements",
        ],
      },
      {
        title: "Production-Ready Infrastructure Code",
        description:
          "SaaS products need more than features. Claude Code helps you build the operational foundations that keep products running smoothly.",
        bulletPoints: [
          "Rate limiting, API key management, and usage tracking middleware",
          "Multi-tenant database patterns with row-level security",
          "Background job processing with retry logic and dead letter queues",
          "Health checks, structured logging, and error tracking integration",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Claude Code build a complete SaaS MVP?",
        answer: `Claude Code is excellent for accelerating MVP development. It can generate full-stack applications including auth, database schemas, API routes, and UI components. While it works best with a developer guiding the architecture, many ${nationality} founders in our community have shipped working MVPs in days rather than weeks using Claude Code.`,
      },
      {
        question: "How does Claude Code handle Stripe billing integration?",
        answer:
          "Claude Code generates production-quality Stripe integration code including Checkout sessions, Customer Portal, webhook handlers, and subscription management. It understands Stripe's event model and generates idempotent webhook handlers that properly handle edge cases like payment failures and subscription changes.",
      },
      {
        question: "Does Claude Code support multi-tenant SaaS architecture?",
        answer:
          "Yes. Claude Code can generate multi-tenant patterns including shared database with tenant isolation, schema-per-tenant approaches, and row-level security policies. It understands the trade-offs between different multi-tenancy strategies and generates appropriate middleware and data access layers.",
      },
      {
        question: "Can Claude Code generate API documentation?",
        answer:
          "Claude Code can generate OpenAPI/Swagger specifications from your API routes, create typed API clients, and build documentation pages. It understands REST and GraphQL conventions and generates proper request/response schemas with validation.",
      },
      {
        question: "Is Claude Code suitable for enterprise SaaS development?",
        answer:
          "Many teams in our community use Claude Code for enterprise SaaS development. It generates code that follows security best practices including input validation, SQL injection prevention, proper authentication patterns, and audit logging. As always, generated code should be reviewed by your team before deployment.",
      },
      {
        question: "What tech stacks work best with Claude Code for SaaS?",
        answer:
          "Claude Code works with all major SaaS tech stacks. Popular choices in our community include Next.js with Prisma, Remix with Drizzle, and Node.js with Express. It also works well with Python (Django, FastAPI), Ruby on Rails, and Go backends. The key is providing clear context about your stack in your prompts.",
      },
    ],
    relatedVerticals: ["startups", "agencies", "real-estate"],
    ctaHeading: "Build Your SaaS Faster",
    ctaDescription: `Join ${nationality} SaaS developers who are shipping MVPs, building APIs, and integrating billing in record time with Claude Code.`,
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    tagline: "Build property platforms and agent tools with AI-powered development",
    title: "Claude Code for Real Estate - AI-Powered PropTech Development",
    description: `Learn how ${nationality} real estate developers use Claude Code to build property listings, search platforms, agent portals, and integrations with the major local property portals. Join the community.`,
    keywords: [
      "Claude Code real estate",
      "Claude Code property listings",
      "Claude Code property portal API",
      "AI real estate development",
      "AI property platform",
      "Claude Code agent portal",
      `PropTech development ${countryName}`,
      `real estate developer ${countryName}`,
    ],
    ogTitle: "Claude Code for Real Estate - Build PropTech Faster with AI",
    ogDescription: `${nationality} PropTech developers are using Claude Code to build property platforms, agent portals, and listing integrations faster. Join the community.`,
    heroHeading: "Claude Code for Real Estate",
    heroSubheading: `${nationality} PropTech developers are using Claude Code to build property listing platforms, search experiences, and agent tools that compete with the major local property portals.`,
    heroBadge: "Real Estate",
    introParagraphs: [
      `${countryName}'s property market runs on technology. From the major local property portals to boutique agency platforms, real estate technology is a massive and growing sector. PropTech developers face unique challenges: complex search and filtering, map integrations, listing data management, and integrations with industry-specific APIs. Claude Code is helping teams ship these features faster.`,
      "Whether you're building property search with map-based filtering, integrating with the major local property portal listing APIs, creating agent CRM portals, or generating suburb profile pages for SEO, Claude Code understands the patterns that PropTech demands. It generates clean, performant code for the data-heavy interfaces that real estate platforms require.",
      `Join the Claude Code Community to connect with PropTech developers across ${countryName}. Share integration patterns for the major local property portal APIs, learn how teams are building modern property platforms, and attend meetups focused on real estate technology.`,
    ],
    useCases: [
      {
        title: "Property Listing Pages",
        description:
          "Generate rich property listing pages with image galleries, floor plans, feature lists, and enquiry forms. Build SEO-optimised templates that rank for suburb searches.",
        icon: "Home",
      },
      {
        title: "Search & Filtering",
        description:
          "Build advanced property search with map integration, suburb autocomplete, price range filters, and saved search alerts. Handle complex query logic cleanly.",
        icon: "Search",
      },
      {
        title: "Agent Portals & CRM",
        description:
          "Create agent dashboards with listing management, lead tracking, inspection scheduling, and vendor reporting. Build the tools agencies need to operate.",
        icon: "UserCircle",
      },
      {
        title: "Property Portal Integration",
        description:
          "Integrate with the major local property portal APIs for listing syndication, market data, and property valuations. Generate type-safe API clients and sync logic.",
        icon: "Globe",
      },
      {
        title: "Suburb & Market Profiles",
        description:
          "Generate data-rich suburb profile pages with median prices, growth trends, school zones, and demographic data for SEO and buyer research.",
        icon: "MapPin",
      },
      {
        title: "Virtual Tours & Media",
        description:
          "Build interactive property media experiences with image galleries, virtual tour embeds, video players, and 3D floor plan viewers.",
        icon: "Camera",
      },
    ],
    benefits: [
      { stat: "3x", label: "Faster feature delivery" },
      { stat: "55%", label: "Less integration code time" },
      { stat: "40%", label: "More listings pages shipped" },
    ],
    features: [
      {
        title: "Property Search That Converts",
        description:
          "Search is the heart of any property platform. Claude Code helps you build search experiences that are fast, intuitive, and handle the complexity of real estate data.",
        bulletPoints: [
          "Map-based search with Mapbox or Google Maps clustering and boundary drawing",
          "Faceted filtering with suburb, price, bedrooms, property type, and custom criteria",
          "Suburb and address autocomplete with local address format handling",
          "Saved search alerts with email notification pipelines",
        ],
      },
      {
        title: "Listing Data Pipeline",
        description:
          "Real estate platforms live and die by their listing data. Claude Code generates the integration code that keeps your platform in sync with the industry.",
        bulletPoints: [
          "Property portal API integration for listing syndication and market data",
          "Portal XML feed parsing and normalisation for multi-portal publishing",
          "XML and JSON data format handling with validation",
          "Automated image processing, watermarking, and CDN upload pipelines",
        ],
      },
      {
        title: "Agent Tools & Portals",
        description:
          "Real estate agencies need specialised tools. Claude Code helps you build the dashboards, CRMs, and operational tools that win agency clients.",
        bulletPoints: [
          "Listing management dashboards with drag-and-drop status workflows",
          "Lead capture forms with CRM integration and automated follow-up sequences",
          "Inspection booking systems with calendar sync and SMS notifications",
          "Vendor reporting with market comparison data and campaign performance",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Claude Code integrate with the major property portal APIs?",
        answer:
          "Yes. Claude Code can generate type-safe API clients for the major local property portal APIs, including listing retrieval, market data queries, and property valuations. It handles authentication, pagination, rate limiting, and data normalisation. Many PropTech developers in our community use it to accelerate their portal integrations.",
      },
      {
        question: "How does Claude Code help with property search?",
        answer: `Claude Code generates complete property search implementations including map-based interfaces with Mapbox or Google Maps, faceted filtering for property attributes, suburb autocomplete, and saved search alert systems. It understands the data structures and UX patterns specific to ${nationality} property search.`,
      },
      {
        question: "Can Claude Code build property listing pages for SEO?",
        answer:
          "Absolutely. Claude Code generates SEO-optimised property listing templates with JSON-LD structured data (RealEstateListing schema), proper heading hierarchy, canonical URLs, and server-rendered content. It can also generate suburb profile pages that target location-based search queries.",
      },
      {
        question: `Does Claude Code work with ${nationality} address formats?`,
        answer: `Yes. Claude Code understands ${nationality} address formats including unit/lot numbers, street types, suburb/state/postcode structure, and special cases. It can generate address parsing, validation, and autocomplete components that handle local addresses correctly.`,
      },
      {
        question: "Is Claude Code suitable for building agent CRM systems?",
        answer:
          "Claude Code is excellent for building agent-facing tools including CRM dashboards, listing management interfaces, lead tracking systems, and reporting tools. It generates full CRUD interfaces, data tables with filtering and sorting, and integration code for email and SMS communication.",
      },
      {
        question: "What PropTech frameworks work well with Claude Code?",
        answer:
          "Popular PropTech stacks in our community include Next.js for server-rendered listing pages, React with Mapbox for search interfaces, and Node.js backends for API integrations. Claude Code also works well with Python for data processing pipelines and PostgreSQL with PostGIS for geospatial queries.",
      },
    ],
    relatedVerticals: ["agencies", "saas", "startups"],
    ctaHeading: "Build Better Property Platforms",
    ctaDescription: `Join ${nationality} PropTech developers who are building listing platforms, agent tools, and search experiences faster with Claude Code.`,
  },
  {
    slug: "agencies",
    name: "Digital Agencies",
    tagline: "Deliver client work faster with AI-powered development",
    title: "Claude Code for Digital Agencies - Deliver Client Work Faster with AI",
    description: `Learn how ${nationality} digital, creative, and SEO agencies use Claude Code to deliver client websites, campaigns, and technical projects faster. Join the community.`,
    keywords: [
      "Claude Code agency",
      "Claude Code digital agency",
      "Claude Code SEO agency",
      `Claude Code agency ${countryName}`,
      `Claude Code agency ${getRegionConfig().majorCities[0]}`,
      "AI agency development",
      "AI web agency tools",
      `digital agency developer ${countryName}`,
    ],
    ogTitle: "Claude Code for Digital Agencies - Deliver Client Work Faster",
    ogDescription: `${nationality} digital agencies are using Claude Code to deliver client websites, SEO implementations, and campaigns faster. Join the community.`,
    heroHeading: "Claude Code for Digital Agencies",
    heroSubheading: `${nationality} digital agencies are using Claude Code to deliver client websites, SEO implementations, and marketing campaigns in a fraction of the usual time.`,
    heroBadge: "Digital Agencies",
    introParagraphs: [
      `Digital agencies in ${countryName} are under constant pressure to deliver more, faster, and at higher quality. Whether you run a full-service creative agency, an SEO-focused shop, or a boutique web development studio, the economics are the same: billable hours are finite, client expectations are rising, and margins are tight. Claude Code is changing the math for agencies that adopt it.`,
      "From building bespoke WordPress and Next.js sites to implementing technical SEO audits, generating schema markup, and scaffolding entire client projects from a brief, Claude Code lets agency developers punch well above their weight. Teams report delivering proposals-to-production in days instead of weeks, winning more pitches because they can prototype live in client meetings, and reducing the QA cycle dramatically.",
      `Join the Claude Code Community to connect with agency owners, creative directors, and lead developers across ${countryName}. Share client delivery patterns, learn pricing strategies for AI-assisted work, and attend meetups where agencies present real case studies on how Claude Code transformed their workflows.`,
    ],
    useCases: [
      {
        title: "Client Website Builds",
        description:
          "Deliver polished client websites faster. Claude Code generates WordPress themes, Next.js sites, and custom CMS builds from design briefs and Figma files.",
        icon: "Monitor",
      },
      {
        title: "Technical SEO Implementation",
        description:
          "Implement technical SEO at scale. Generate schema markup, fix crawl issues, build XML sitemaps, and create server-rendered pages that rank.",
        icon: "Search",
      },
      {
        title: "Campaign Landing Pages",
        description:
          "Spin up campaign-specific landing pages in hours. Build A/B test variants, conversion tracking, and lead capture forms for client campaigns.",
        icon: "Target",
      },
      {
        title: "Client Reporting Dashboards",
        description:
          "Build custom analytics dashboards for clients. Pull data from GA4, Search Console, and ad platforms into branded reporting interfaces.",
        icon: "BarChart3",
      },
      {
        title: "Design System Implementation",
        description:
          "Translate client brand guidelines into reusable component libraries. Generate design tokens, styled components, and Storybook documentation.",
        icon: "PenTool",
      },
      {
        title: "Multi-Site Management Tools",
        description:
          "Build internal tools to manage dozens of client sites. Generate deployment scripts, uptime monitors, and bulk update utilities.",
        icon: "Layers",
      },
    ],
    benefits: [
      { stat: "3x", label: "Faster client delivery" },
      { stat: "60%", label: "Less time on boilerplate" },
      { stat: "2x", label: "More projects per quarter" },
    ],
    features: [
      {
        title: "Proposals to Production in Days",
        description:
          "Claude Code lets agency teams collapse the timeline from signed proposal to live site. Scaffold entire projects from a client brief and iterate in real-time.",
        bulletPoints: [
          "Generate complete WordPress themes or Next.js sites from a design brief",
          "Build interactive prototypes during client meetings to close deals faster",
          "Scaffold page templates, navigation, forms, and CMS integration in a single session",
          "Create reusable starter kits for common agency project types",
        ],
      },
      {
        title: "SEO That Wins Rankings",
        description:
          "Technical SEO is a core agency service and Claude Code makes implementation dramatically faster. Generate the markup, structure, and page architecture that search engines reward.",
        bulletPoints: [
          "Generate JSON-LD schema markup for LocalBusiness, FAQPage, Product, and Article types",
          "Build programmatic SEO pages with dynamic content and proper internal linking",
          "Create XML sitemaps, robots.txt configurations, and canonical URL structures",
          "Implement Core Web Vitals optimisations including lazy loading, code splitting, and image optimisation",
        ],
      },
      {
        title: "Scale Without Scaling Headcount",
        description:
          "The biggest constraint for agencies is developer time. Claude Code lets small teams deliver enterprise-quality work without hiring for every new client.",
        bulletPoints: [
          "Junior developers produce senior-quality output with Claude Code assistance",
          "Reduce QA cycles with cleaner, more consistent generated code",
          "Build internal tools and automation that eliminate repetitive agency tasks",
          "Generate documentation and handover materials for client training",
        ],
      },
    ],
    faqs: [
      {
        question: `How are ${nationality} agencies using Claude Code?`,
        answer: `Agencies across ${countryName} are using Claude Code to accelerate client website builds, implement technical SEO, generate landing pages for campaigns, and build custom reporting dashboards. The most common use case is collapsing the time from signed proposal to live website — agencies in our community report delivering projects 2-3x faster than their pre-Claude Code timelines.`,
      },
      {
        question: "Can Claude Code help with SEO agency work?",
        answer: `Absolutely. Claude Code is particularly strong for technical SEO implementation — generating schema markup (JSON-LD), building programmatic SEO page templates, creating XML sitemaps, implementing server-side rendering for crawlability, and fixing Core Web Vitals issues. SEO agencies across ${countryName} are using it to deliver technical audits and implementations significantly faster.`,
      },
      {
        question: "Is Claude Code suitable for WordPress agency work?",
        answer:
          "Yes. Claude Code generates WordPress theme code, custom Gutenberg blocks, Advanced Custom Fields configurations, WooCommerce customisations, and plugin development code. It understands WordPress hooks, filters, the REST API, and theme hierarchy. Many agencies in our community use it as their primary development accelerator for WordPress projects.",
      },
      {
        question: "How does Claude Code affect agency pricing and margins?",
        answer:
          "This is a topic our community discusses frequently. Most agencies find that Claude Code improves margins by reducing development time while maintaining quality. Some agencies pass savings to clients to win more competitive pitches; others maintain pricing and reinvest the time saved into better QA, more creative exploration, or taking on additional projects.",
      },
      {
        question: "Can junior developers use Claude Code effectively?",
        answer:
          "Yes, and this is one of the biggest advantages for agencies. Junior developers with Claude Code can produce code that approaches senior-level quality and consistency. They still need senior oversight for architecture decisions and code review, but the day-to-day output gap narrows significantly. Several agency owners in our community describe it as having a senior developer pair-programming with every junior.",
      },
      {
        question: `Is there a community for agencies using Claude Code in ${countryName}?`,
        answer: `Yes. The ${communityName} includes a growing cohort of agency owners, creative directors, and lead developers. We host meetups in ${majorCitiesPhrase()} where agencies share workflows, pricing strategies, and case studies. Join to connect with agencies who are already delivering client work faster with Claude Code.`,
      },
    ],
    relatedVerticals: ["marketing", "ecommerce", "startups"],
    ctaHeading: "Deliver Client Work Faster",
    ctaDescription: `Join ${nationality} digital agencies who are winning more pitches and delivering projects faster with Claude Code. Connect with agency owners and developers at our meetups.`,
  },
  {
    slug: "startups",
    name: "Startups",
    tagline: "Build your MVP and scale faster with AI-powered development",
    title: "Claude Code for Startups - Ship Your MVP Faster with AI",
    description: `Learn how ${nationality} startup founders and early-stage teams use Claude Code to build MVPs, validate ideas, and ship products faster. Join the community.`,
    keywords: [
      "Claude Code startup",
      "Claude Code MVP",
      `Claude Code startup ${countryName}`,
      `Claude Code startup ${getRegionConfig().majorCities[0]}`,
      "AI startup development",
      `AI MVP builder ${countryName}`,
      "Claude Code founder tools",
      `startup developer ${countryName}`,
    ],
    ogTitle: "Claude Code for Startups - Ship Your MVP Faster with AI",
    ogDescription: `${nationality} startup founders are using Claude Code to build MVPs, validate ideas, and ship products faster. Join the community.`,
    heroHeading: "Claude Code for Startups",
    heroSubheading: `${nationality} startup founders and early-stage teams are using Claude Code to go from idea to launched product faster than ever before.`,
    heroBadge: "Startups",
    introParagraphs: [
      `${countryName}'s startup ecosystem is thriving — from the major tech hubs to emerging regional centres. But the fundamental challenge for every early-stage founder is the same: you need to build fast, validate faster, and stretch every dollar of runway. Claude Code is becoming the unfair advantage for technical and non-technical founders alike.`,
      "Whether you're a solo technical founder building your first MVP, a two-person team iterating on product-market fit, or a seed-stage startup hiring your first engineers, Claude Code compresses your development timeline dramatically. Build functional prototypes in a weekend, ship features that would normally require a full engineering team, and iterate based on user feedback in hours instead of sprints.",
      `Join the Claude Code Community to connect with startup founders, CTOs, and early-stage engineers across ${countryName}. Share war stories from the trenches, get feedback on your technical architecture, and learn from founders who have used Claude Code to go from zero to launched product.`,
    ],
    useCases: [
      {
        title: "MVP Development",
        description:
          "Go from idea to working product in days. Claude Code generates full-stack applications with auth, database, payments, and UI from your product specification.",
        icon: "Rocket",
      },
      {
        title: "Rapid Prototyping",
        description:
          "Build clickable prototypes and proof-of-concept demos to validate ideas with users and investors before committing to full development.",
        icon: "Lightbulb",
      },
      {
        title: "Pitch Deck Demos",
        description:
          "Create working product demos for investor pitches. Build interactive prototypes that show your vision better than slides ever could.",
        icon: "Presentation",
      },
      {
        title: "User Feedback Iteration",
        description:
          "Ship changes based on user feedback in hours, not weeks. Claude Code lets small teams iterate at the speed that early-stage products demand.",
        icon: "MessageSquare",
      },
      {
        title: "Landing Pages & Waitlists",
        description:
          "Build launch landing pages with email capture, waitlist management, and analytics. Test positioning and messaging before writing a line of product code.",
        icon: "Layout",
      },
      {
        title: "Third-Party Integrations",
        description:
          "Connect your product to Stripe, Auth0, SendGrid, Twilio, and other services. Generate type-safe integration code without reading API docs for hours.",
        icon: "Plug",
      },
    ],
    benefits: [
      { stat: "5x", label: "Faster MVP development" },
      { stat: "80%", label: "Less time on boilerplate" },
      { stat: "10x", label: "More iterations per month" },
    ],
    features: [
      {
        title: "Weekend MVPs That Actually Work",
        description:
          "Claude Code understands modern full-stack architecture. Describe your product and get a working application with authentication, database, API, and UI — not a toy prototype.",
        bulletPoints: [
          "Generate complete Next.js or Remix applications from a product spec",
          "Scaffold authentication, database models, and API routes in one session",
          "Build responsive UIs with Tailwind CSS that look professional from day one",
          "Set up Stripe payments and subscription billing before your first customer arrives",
        ],
      },
      {
        title: "Iterate at Startup Speed",
        description:
          "In the early days, speed of iteration is everything. Claude Code lets founders ship changes and new features at the pace the market demands.",
        bulletPoints: [
          "Implement user-requested features in hours instead of sprinting for weeks",
          "Pivot your product direction without rewriting everything from scratch",
          "A/B test different approaches quickly to find product-market fit",
          "Build and ship database migrations, API changes, and UI updates together",
        ],
      },
      {
        title: "Punch Above Your Weight",
        description:
          "Early-stage startups cannot afford large engineering teams. Claude Code lets tiny teams build products that compete with well-funded incumbents.",
        bulletPoints: [
          "Solo founders build features that normally require a 3-5 person team",
          "Generate production-quality code with proper error handling and validation",
          "Build admin dashboards, analytics, and internal tools without dedicated resources",
          "Create API documentation and developer onboarding materials as you grow",
        ],
      },
    ],
    faqs: [
      {
        question: "Can a non-technical founder use Claude Code to build an MVP?",
        answer:
          "Claude Code is a developer tool that works best when you have some programming knowledge. However, founders with basic coding skills (HTML, CSS, some JavaScript) have successfully used it to build functional MVPs. For non-technical founders, it's most effective when paired with a technical co-founder or freelance developer who can guide the architecture. Several founders in our community started with minimal coding experience and built launched products with Claude Code.",
      },
      {
        question: "How fast can I build an MVP with Claude Code?",
        answer: `Many founders in the ${communityName} have built functional MVPs in 1-2 weeks, with some shipping basic products over a single weekend. The timeline depends on complexity, but Claude Code dramatically compresses the development cycle. A typical SaaS MVP with auth, database, payments, and a core feature set can go from idea to deployed product in under two weeks with focused effort.`,
      },
      {
        question: "Is Claude Code suitable for products that need to scale?",
        answer:
          "Yes. Claude Code generates clean, well-structured code that follows established patterns — it's not throwaway prototype code. Many startups in our community have scaled products originally built with Claude Code to thousands of users without major rewrites. The key is providing clear architectural guidance in your prompts and reviewing the generated code for your specific scaling requirements.",
      },
      {
        question: "How does Claude Code compare to no-code tools for startups?",
        answer:
          "No-code tools like Bubble or Webflow are great for certain use cases, but they create vendor lock-in and hit walls when you need custom logic, integrations, or performance. Claude Code generates real code that you own, can customise without limits, and can deploy anywhere. Startups in our community often start with Claude Code precisely to avoid the no-code ceiling they've hit before.",
      },
      {
        question: "Can Claude Code help with investor demos and pitches?",
        answer: `Absolutely. Several founders in our community have used Claude Code to build working product demos for investor meetings — far more compelling than mockups or slide decks. You can build interactive prototypes that demonstrate your core value proposition and even process real data. This is especially powerful in the ${nationality} VC scene where investors want to see traction and technical capability.`,
      },
      {
        question: `Is there a startup community using Claude Code in ${countryName}?`,
        answer: `Yes. The ${communityName} has a growing cohort of startup founders from across the country, with particularly active groups in ${majorCitiesPhrase()}. We host regular meetups where founders demo products they've built, share technical architecture decisions, and help each other navigate the challenges of early-stage development. Join to connect with founders who understand the startup journey.`,
      },
    ],
    relatedVerticals: ["saas", "agencies", "education"],
    ctaHeading: "Ship Your Startup Faster",
    ctaDescription: `Join ${nationality} startup founders who are building MVPs, validating ideas, and shipping products faster with Claude Code. Connect with founders and early-stage engineers at our meetups.`,
  },
  {
    slug: "education",
    name: "Education",
    tagline: "Build learning platforms and edtech products with AI-powered development",
    title: "Claude Code for Education - AI-Powered EdTech Development",
    description: `Learn how ${nationality} educators, edtech developers, and training organisations use Claude Code to build learning platforms, course tools, and educational software. Join the community.`,
    keywords: [
      "Claude Code education",
      "Claude Code edtech",
      `Claude Code education ${countryName}`,
      "Claude Code learning platform",
      "AI edtech development",
      `AI education tools ${countryName}`,
      "Claude Code training platform",
      `edtech developer ${countryName}`,
    ],
    ogTitle: "Claude Code for Education - Build Learning Platforms Faster",
    ogDescription: `${nationality} educators and edtech developers are using Claude Code to build learning platforms, course tools, and training software. Join the community.`,
    heroHeading: "Claude Code for Education",
    heroSubheading: `${nationality} educators, edtech developers, and training organisations are using Claude Code to build learning platforms and educational tools that actually engage learners.`,
    heroBadge: "Education",
    introParagraphs: [
      `${countryName}'s education sector is undergoing a technology transformation. From universities adopting blended learning to corporate training platforms going digital, the demand for well-built educational software has never been higher. Edtech developers face unique challenges: accessibility compliance, diverse learner needs, complex content management, and integration with institutional systems like LMSes and student information systems. Claude Code helps teams build these specialised applications faster.`,
      "Whether you're building an online course platform, developing interactive coding exercises, creating assessment and grading tools, or building a corporate training LMS, Claude Code understands the patterns that education technology demands. It generates accessible, well-structured code for content delivery, progress tracking, quiz engines, and learner analytics — the building blocks that every edtech product needs.",
      `Join the Claude Code Community to connect with edtech developers, instructional designers who code, and educators building their own tools across ${countryName}. Share patterns for building effective learning experiences, discuss accessibility best practices, and learn from teams shipping real education products.`,
    ],
    useCases: [
      {
        title: "Course Platform Development",
        description:
          "Build online course platforms with lesson management, video hosting integration, progress tracking, and completion certificates. Generate the LMS features learners expect.",
        icon: "GraduationCap",
      },
      {
        title: "Assessment & Quiz Engines",
        description:
          "Create interactive quizzes, coding challenges, and assessment tools with auto-grading, feedback systems, and analytics on learner performance.",
        icon: "ClipboardCheck",
      },
      {
        title: "Interactive Learning Content",
        description:
          "Build interactive exercises, code playgrounds, simulations, and multimedia learning experiences that keep students engaged and practicing.",
        icon: "Play",
      },
      {
        title: "Student Progress Dashboards",
        description:
          "Generate analytics dashboards for educators and learners. Track completion rates, quiz scores, engagement metrics, and identify students who need support.",
        icon: "BarChart3",
      },
      {
        title: "LMS Integration",
        description:
          "Integrate with Moodle, Canvas, Blackboard, and other learning management systems. Generate LTI tool implementations and grade passback handlers.",
        icon: "Link",
      },
      {
        title: "Accessibility Compliance",
        description:
          "Build WCAG 2.1 AA compliant learning interfaces. Generate accessible forms, navigation, media players, and content structures that work for all learners.",
        icon: "Eye",
      },
    ],
    benefits: [
      { stat: "4x", label: "Faster platform development" },
      { stat: "65%", label: "Less time on CRUD features" },
      { stat: "3x", label: "More learning features shipped" },
    ],
    features: [
      {
        title: "Course Platforms That Engage",
        description:
          "Claude Code understands what makes learning platforms work. Generate the features that keep learners coming back — not just content delivery, but real engagement tools.",
        bulletPoints: [
          "Build lesson sequencing with prerequisites, drip content, and adaptive pathways",
          "Generate video player components with chapters, notes, bookmarks, and playback speed controls",
          "Create discussion forums and peer review systems for collaborative learning",
          "Scaffold certificate generation with PDF export and verification URLs",
        ],
      },
      {
        title: "Assessments That Actually Assess",
        description:
          "Quizzes and assessments are the backbone of any learning platform. Claude Code generates sophisticated assessment tools that go beyond multiple choice.",
        bulletPoints: [
          "Build auto-graded coding exercises with sandboxed execution environments",
          "Generate diverse question types: multiple choice, drag-and-drop, fill-in-the-blank, and essay",
          "Create rubric-based assessment tools with structured feedback templates",
          "Implement spaced repetition algorithms and knowledge retention tracking",
        ],
      },
      {
        title: "Accessible by Default",
        description:
          "Education must be accessible to all learners. Claude Code generates WCAG-compliant code and helps teams build inclusive learning experiences from the start.",
        bulletPoints: [
          "Generate semantic HTML with proper ARIA labels, roles, and live regions",
          "Build keyboard-navigable interfaces for all interactive learning components",
          "Create responsive layouts that work on school-issued devices and personal phones",
          "Implement captions, transcripts, and alternative text throughout media content",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Claude Code build a full learning management system?",
        answer:
          "Claude Code is excellent for building LMS features including course management, lesson delivery, student enrolment, progress tracking, and assessment tools. While a full enterprise LMS is a large project, many edtech developers in our community have built focused learning platforms — such as coding bootcamp tools, corporate training portals, and online course marketplaces — significantly faster with Claude Code than traditional development.",
      },
      {
        question: "Does Claude Code help with educational accessibility?",
        answer:
          "Yes, and this is one of its strongest contributions to edtech development. Claude Code generates WCAG 2.1 AA compliant HTML with proper semantic structure, ARIA attributes, keyboard navigation, and screen reader support. It understands accessibility requirements specific to educational content, including media players with captions, accessible quizzes, and navigable document structures.",
      },
      {
        question: "Can Claude Code integrate with Moodle, Canvas, or Blackboard?",
        answer: `Claude Code can generate LTI (Learning Tools Interoperability) tool implementations that integrate with Moodle, Canvas, Blackboard, and other LMS platforms. It handles OAuth authentication, grade passback, deep linking, and content item selection. Teams in our community have built custom tools that plug into institutional LMS deployments across ${nationality} universities.`,
      },
      {
        question: "How is Claude Code used for coding education platforms?",
        answer:
          "Several developers in our community build coding education tools with Claude Code. It can generate code playground components with syntax highlighting and sandboxed execution, auto-grading systems that evaluate student submissions against test cases, and progress tracking for multi-lesson coding curricula. It's particularly effective because it understands the code it's helping you teach.",
      },
      {
        question: "Is Claude Code suitable for corporate training platforms?",
        answer:
          "Yes. Corporate training platforms share many patterns with other edtech products — course delivery, progress tracking, assessments, and reporting — and Claude Code handles all of these well. Additional corporate features like SCORM compliance, team management, manager dashboards, and completion reporting for compliance training are all areas where Claude Code accelerates development.",
      },
      {
        question: `Is there an edtech community using Claude Code in ${countryName}?`,
        answer: `Yes. The ${communityName} includes edtech developers, instructional designers who code, and educators building their own tools. We host meetups where education technologists share how they're building learning platforms, discuss accessibility best practices, and demo tools they've built with Claude Code. Join to connect with the ${nationality} edtech community.`,
      },
    ],
    relatedVerticals: ["startups", "saas", "marketing"],
    ctaHeading: "Build Better Learning Experiences",
    ctaDescription: `Join ${nationality} edtech developers and educators who are building learning platforms, course tools, and educational software faster with Claude Code.`,
  },
];

// `VERTICALS` is the per-region BUILT-IN set. Runtime reads go through the
// tenant-aware merge layer in `@/lib/industries` (which overlays per-tenant
// `IndustryPage` rows on top of these), not these arrays directly.
