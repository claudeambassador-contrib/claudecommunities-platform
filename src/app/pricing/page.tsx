export const dynamic = "force-dynamic";

import { ArrowLeft, Check, Crown, Sparkles, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Membership & Pricing",
  description:
    "Claude Code Community Australia membership tiers and pricing. Join to access community events, workshops, and meetups across Sydney, Melbourne, Brisbane & Perth.",
  alternates: {
    canonical: "https://claudecommunity.com.au/pricing",
  },
};

async function getTiers() {
  const db = await getPrisma();
  const tiers = await db.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });

  return tiers.map((tier) => ({
    ...tier,
    features: tier.features ? JSON.parse(tier.features) : [],
  }));
}

async function getUserSubscription(userId: string) {
  const db = await getPrisma();
  return await db.subscription.findFirst({
    where: {
      userId,
      status: "active",
    },
    include: { tier: true },
  });
}

export default async function PricingPage() {
  const user = await getCurrentUser();
  // Pricing page is public - no redirect for unauthenticated users

  const userId = user?.id;
  const [tiers, currentSubscription] = await Promise.all([
    getTiers(),
    userId ? getUserSubscription(userId) : Promise.resolve(null),
  ]);

  // If no tiers exist, show default pricing
  const displayTiers =
    tiers.length > 0
      ? tiers
      : [
          {
            id: "free",
            name: "Free",
            slug: "free",
            description: "Get started with the community",
            price: 0,
            yearlyPrice: null,
            features: [
              "Access to community feed",
              "Join discussions",
              "Attend free events",
              "Basic profile",
            ],
            color: "#A8A29E",
          },
          {
            id: "pro",
            name: "Pro",
            slug: "pro",
            description: "For serious Claude Code practitioners",
            price: 19,
            yearlyPrice: 190,
            features: [
              "Everything in Free",
              "Access to all courses",
              "Private Pro spaces",
              "Priority event access",
              "Pro badge on profile",
              "Direct messaging",
            ],
            color: "#D4836A",
          },
          {
            id: "team",
            name: "Team",
            slug: "team",
            description: "For teams building with Claude Code",
            price: 49,
            yearlyPrice: 490,
            features: [
              "Everything in Pro",
              "Team workspace",
              "Custom training users",
              "Dedicated support",
              "API access",
              "Analytics dashboard",
            ],
            color: "#8B5CF6",
          },
        ];

  const getTierIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "pro":
        return <Crown className="w-6 h-6" />;
      case "team":
        return <Zap className="w-6 h-6" />;
      default:
        return <Sparkles className="w-6 h-6" />;
    }
  };

  const renderCta = (isCurrentPlan: boolean, isFree: boolean, isPro: boolean) => {
    if (isCurrentPlan) {
      return (
        <div className="w-full py-3 px-4 rounded-xl bg-white/[0.05] text-[#A8A29E] text-center font-medium">
          Current Plan
        </div>
      );
    }
    if (isFree && user) {
      return (
        <div className="w-full py-3 px-4 rounded-xl bg-white/[0.05] text-[#A8A29E] text-center font-medium">
          Your Current Plan
        </div>
      );
    }
    if (isFree) {
      return (
        <Link
          href="/login"
          className="block w-full py-3 px-4 rounded-xl font-semibold transition-colors bg-white/[0.1] text-white hover:bg-white/[0.15] text-center"
        >
          Join Free
        </Link>
      );
    }
    return (
      <Link
        href={user ? "#" : "/login"}
        className={`block w-full py-3 px-4 rounded-xl font-semibold transition-colors text-center ${
          isPro
            ? "bg-[#D4836A] text-white hover:bg-[#c4775f]"
            : "bg-white/[0.1] text-white hover:bg-white/[0.15]"
        }`}
      >
        Get Started
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#1C1917] pt-14">
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <Link
            href="/community"
            className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to community
          </Link>
          <h1 className="text-4xl font-bold text-white mb-4">Choose Your Plan</h1>
          <p className="text-xl text-[#A8A29E] max-w-2xl mx-auto">
            Unlock exclusive content, courses, and community features with a premium membership.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {displayTiers.map((tier) => {
            const isCurrentPlan = currentSubscription?.tier.id === tier.id;
            const isPro = tier.name.toLowerCase() === "pro";
            const isFree = tier.price === 0;

            return (
              <div
                key={tier.id}
                className={`relative bg-[#2D2926] rounded-2xl border overflow-hidden ${
                  isPro ? "border-[#D4836A] ring-1 ring-[#D4836A]/50" : "border-white/[0.06]"
                }`}
              >
                {isPro && (
                  <div className="absolute top-0 left-0 right-0 bg-[#D4836A] text-white text-center py-1.5 text-sm font-medium">
                    Most Popular
                  </div>
                )}

                <div className={`p-8 ${isPro ? "pt-12" : ""}`}>
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      backgroundColor: `${tier.color || "#D4836A"}20`,
                      color: tier.color || "#D4836A",
                    }}
                  >
                    {getTierIcon(tier.name)}
                  </div>

                  {/* Name & Description */}
                  <h2 className="text-2xl font-bold text-white mb-2">{tier.name}</h2>
                  <p className="text-[#A8A29E] mb-6">{tier.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    {isFree ? (
                      <div className="text-4xl font-bold text-white">Free</div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-white">${tier.price}</span>
                          <span className="text-[#78716C]">/month</span>
                        </div>
                        {tier.yearlyPrice && (
                          <p className="text-sm text-[#78716C] mt-1">
                            or ${tier.yearlyPrice}/year (save ${tier.price * 12 - tier.yearlyPrice})
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* CTA Button */}
                  {renderCta(isCurrentPlan, isFree, isPro)}

                  {/* Features */}
                  <ul className="mt-8 space-y-3">
                    {tier.features.map((feature: string) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check
                          className="w-5 h-5 shrink-0 mt-0.5"
                          style={{ color: tier.color || "#D4836A" }}
                        />
                        <span className="text-[#E7E5E4]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 max-w-3xl mx-auto text-center">
          <h3 className="text-xl font-semibold text-white mb-4">Frequently Asked Questions</h3>
          <div className="space-y-6 text-left">
            <div className="bg-[#2D2926] rounded-xl p-6 border border-white/[0.06]">
              <h4 className="font-medium text-white mb-2">Can I cancel anytime?</h4>
              <p className="text-[#A8A29E]">
                Yes! You can cancel your subscription at any time. You&apos;ll continue to have
                access until the end of your billing period.
              </p>
            </div>
            <div className="bg-[#2D2926] rounded-xl p-6 border border-white/[0.06]">
              <h4 className="font-medium text-white mb-2">What payment methods do you accept?</h4>
              <p className="text-[#A8A29E]">
                We accept all major credit cards, debit cards, and PayPal through our secure payment
                processor Stripe.
              </p>
            </div>
            <div className="bg-[#2D2926] rounded-xl p-6 border border-white/[0.06]">
              <h4 className="font-medium text-white mb-2">Do you offer refunds?</h4>
              <p className="text-[#A8A29E]">
                We offer a 7-day money-back guarantee. If you&apos;re not satisfied within the first
                week, contact us for a full refund.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
