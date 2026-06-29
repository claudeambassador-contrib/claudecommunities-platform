import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { capitalCities, regionalCities } from "@/lib/cities";
import { getCities } from "@/lib/cities-data";
import { getIndustries } from "@/lib/industries";
import { getRegionConfig, siteUrl } from "@/lib/region";

// Cities are read from D1 at request time (per-tenant catalog); without this the
// page is prerendered at build, where no tenant context / DB binding exists and
// getCities() fails closed. Mirrors sitemap.xml/route.ts.
export const dynamic = "force-dynamic";

const { communityName } = getRegionConfig();

const SITE_URL = siteUrl();

export const metadata: Metadata = {
  title: "Sitemap",
  description: `Browse all pages on ${communityName}. Find city pages, events, courses, and community resources.`,
  alternates: {
    canonical: `${SITE_URL}/sitemap`,
  },
};

export default async function SitemapPage() {
  const cities = await getCities();
  const capitals = capitalCities(cities);
  const regionals = regionalCities(cities);
  const industries = await getIndustries();

  const mainPages = [
    { href: "/", label: "Home" },
    { href: "/events", label: "Events" },
    { href: "/courses", label: "Courses" },
    { href: "/professionals", label: "For Professionals" },
    { href: "/vibe-coders", label: "For Vibe Coders" },
    { href: "/cowork", label: "Co-Work" },
    { href: "/pricing", label: "Pricing" },
    { href: "/community", label: "Community" },
  ];

  const accountPages = [
    { href: "/login", label: "Sign In" },
    { href: "/signup", label: "Create Account" },
  ];

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="pt-[92px] pb-16 px-6">
        <div className="max-w-[1200px] mx-auto">
          <h1 className="text-4xl font-bold text-white mb-2">Sitemap</h1>
          <p className="text-[#A8A29E] mb-12">All pages on {communityName}</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
            {/* Main Pages */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Main Pages</h2>
              <ul className="space-y-2">
                {mainPages.map((page) => (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className="text-[#A8A29E] hover:text-[#D4836A] transition-colors"
                    >
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
              <ul className="space-y-2">
                {accountPages.map((page) => (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className="text-[#A8A29E] hover:text-[#D4836A] transition-colors"
                    >
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Industries */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Industries</h2>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/for"
                    className="text-[#A8A29E] hover:text-[#D4836A] transition-colors"
                  >
                    All Industries
                  </Link>
                </li>
                {industries.map((vertical) => (
                  <li key={vertical.slug}>
                    <Link
                      href={`/for/${vertical.slug}`}
                      className="text-[#A8A29E] hover:text-[#D4836A] transition-colors"
                    >
                      {vertical.name || vertical.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Capital Cities */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Capital Cities</h2>
              <ul className="space-y-2">
                {capitals.map((city) => (
                  <li key={city.slug}>
                    <Link
                      href={`/cities/${city.slug}`}
                      className="text-[#A8A29E] hover:text-[#D4836A] transition-colors inline-flex items-center gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {city.name}, {city.state}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Regional Cities */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Regional Cities</h2>
              <ul className="space-y-2">
                {regionals.map((city) => (
                  <li key={city.slug}>
                    <Link
                      href={`/cities/${city.slug}`}
                      className="text-[#A8A29E] hover:text-[#D4836A] transition-colors inline-flex items-center gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {city.name}, {city.state}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
