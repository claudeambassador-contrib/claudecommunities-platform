"use client";

import Image from "next/image";
import { useCities } from "@/components/CitiesProvider";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import {
  capitalCities as getCapitalCities,
  regionalCities as getRegionalCities,
} from "@/lib/cities";

export default function Footer() {
  const {
    countryName,
    shortName,
    merchEnabled,
    discordCommunityInvite,
    footerIndustries,
    footerResources,
  } = useTenantConfig();
  const cities = useCities();
  const capitalCities = getCapitalCities(cities);
  const regionalCities = getRegionalCities(cities);
  return (
    <footer className="py-16 px-6 bg-[#1C1917] border-t border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <TenantLink href="/" prefetch={false} className="flex items-center gap-3 mb-4">
              <Image
                src="/icons/favicon.png"
                alt=""
                width={32}
                height={32}
                className="w-8 h-8 rounded"
              />
              <span className="font-semibold text-[#FAF9F6]">{shortName}</span>
            </TenantLink>
            <p className="text-[#A8A29E] text-[0.9375rem]">
              {`${countryName}'s Claude Code community. Meetups, courses, and a network of AI-powered developers.`}
            </p>
          </div>

          <div>
            <h4 className="text-[0.875rem] uppercase tracking-wider text-[#78716C] mb-4">
              Community
            </h4>
            <ul className="space-y-3">
              <li>
                <TenantLink
                  href="/events"
                  prefetch={false}
                  className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                >
                  Events & Meetups
                </TenantLink>
              </li>
              <li>
                <TenantLink
                  href="/professionals"
                  prefetch={false}
                  className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                >
                  Professionals
                </TenantLink>
              </li>
              <li>
                <TenantLink
                  href="/vibe-coders"
                  prefetch={false}
                  className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                >
                  Vibe Coders
                </TenantLink>
              </li>
              <li>
                <TenantLink
                  href="/speak"
                  prefetch={false}
                  className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                >
                  Become a Speaker
                </TenantLink>
              </li>
              {merchEnabled && (
                <li>
                  <TenantLink
                    href="/merch"
                    prefetch={false}
                    className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                  >
                    Merch Store
                  </TenantLink>
                </li>
              )}
              <li>
                <TenantLink
                  href="/login"
                  prefetch={false}
                  className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                >
                  Join Community
                </TenantLink>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[0.875rem] uppercase tracking-wider text-[#78716C] mb-4">
              Capital Cities
            </h4>
            <ul className="space-y-3">
              {capitalCities.map((city) => (
                <li key={city.slug}>
                  <TenantLink
                    href={`/cities/${city.slug}`}
                    prefetch={false}
                    className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                  >
                    {city.name}
                  </TenantLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[0.875rem] uppercase tracking-wider text-[#78716C] mb-4">
              Regional
            </h4>
            <ul className="space-y-3">
              {regionalCities.map((city) => (
                <li key={city.slug}>
                  <TenantLink
                    href={`/cities/${city.slug}`}
                    prefetch={false}
                    className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                  >
                    {city.name}
                  </TenantLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[0.875rem] uppercase tracking-wider text-[#78716C] mb-4">
              Industries
            </h4>
            <ul className="space-y-3">
              {footerIndustries.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  {link.href.startsWith("http") ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <TenantLink
                      href={link.href}
                      prefetch={false}
                      className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                    >
                      {link.label}
                    </TenantLink>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[0.875rem] uppercase tracking-wider text-[#78716C] mb-4">
              Resources
            </h4>
            <ul className="space-y-3">
              {footerResources.map((link) => {
                const href = link.href || discordCommunityInvite;
                const external = !link.href || link.href.startsWith("http");
                return (
                  <li key={`${link.label}-${link.href}`}>
                    {external ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <TenantLink
                        href={href}
                        prefetch={false}
                        className="text-[#A8A29E] hover:text-[#FAF9F6] transition-colors"
                      >
                        {link.label}
                      </TenantLink>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.06] text-center text-[#78716C] text-[0.875rem]">
          <p>A community initiative. Not affiliated with Anthropic.</p>
        </div>
      </div>
    </footer>
  );
}
