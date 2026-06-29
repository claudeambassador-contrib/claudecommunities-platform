import type { Metadata } from "next";
import { getTenantConfig, siteUrl } from "@/lib/tenant-config";
import SpeakerForm from "./SpeakerForm";

export async function generateMetadata(): Promise<Metadata> {
  const { communityName } = await getTenantConfig();
  const SITE_URL = await siteUrl();
  return {
    title: `Speak at a Meetup | ${communityName}`,
    description:
      "Want to share your knowledge? Submit to speak at a Claude Code Community meetup. All experience levels welcome — from lightning talks to deep dives.",
    openGraph: {
      title: `Speak at a Meetup | ${communityName}`,
      description:
        "Submit to speak at a Claude Code Community meetup. All experience levels welcome.",
      url: `${SITE_URL}/speak`,
    },
    alternates: {
      canonical: `${SITE_URL}/speak`,
    },
  };
}

export default async function SpeakPage() {
  const { countryName } = await getTenantConfig();
  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#D4836A]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-12 relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A]/10 rounded-full text-[#D4836A] text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-[#D4836A] rounded-full animate-pulse" />
              Now accepting speakers
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Got something to share?
            </h1>
            <p className="text-lg text-[#A8A29E] max-w-xl mx-auto leading-relaxed">
              We&apos;d love to hear from you. Whether it&apos;s a 5-minute lightning talk or a full
              session, every perspective matters. No stage experience required.
            </p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-5 gap-10">
          {/* Info sidebar */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-white font-semibold mb-3">What we&apos;re looking for</h3>
              <ul className="space-y-2.5 text-[#A8A29E] text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#D4836A] mt-0.5">-</span>
                  Claude Code tips, tricks & workflows
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#D4836A] mt-0.5">-</span>
                  Project demos & show-and-tells
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#D4836A] mt-0.5">-</span>
                  AI in production — lessons learned
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#D4836A] mt-0.5">-</span>
                  Beginner-friendly introductions
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">What happens next?</h3>
              <p className="text-[#A8A29E] text-sm leading-relaxed">
                We&apos;ll review your submission and reach out to chat about timing and format.
                Most talks happen at our city meetups across {countryName}.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            <SpeakerForm />
          </div>
        </div>
      </div>
    </div>
  );
}
