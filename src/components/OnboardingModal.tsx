"use client";

import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  MessageSquare,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface OnboardingModalProps {
  userName: string;
  userId: string;
  onComplete: () => void;
}

export default function OnboardingModal({
  userName,
  userId: _userId,
  onComplete,
}: OnboardingModalProps) {
  const { countryName } = useTenantConfig();
  const steps = [
    {
      id: "welcome",
      title: "Welcome to the Community!",
      description: `Join thousands of Claude Code enthusiasts across ${countryName}. Let us show you around.`,
      icon: Sparkles,
    },
    {
      id: "profile",
      title: "Complete Your Profile",
      description:
        "Add a bio, location, and social links so other members can learn more about you.",
      icon: User,
      action: "Edit Profile",
      actionLink: "/community/settings/profile",
    },
    {
      id: "spaces",
      title: "Explore Spaces",
      description:
        "Join different spaces to follow topics that interest you - from general discussions to city-specific meetups.",
      icon: MessageSquare,
    },
    {
      id: "events",
      title: "Join Local Events",
      description: "Find meetups in your city and connect with fellow Claude Code users in person.",
      icon: Calendar,
      action: "Browse Events",
      actionLink: "/events",
    },
    {
      id: "connect",
      title: "Connect with Members",
      description: "Follow members, send direct messages, and build your network in the community.",
      icon: Users,
      action: "View Members",
      actionLink: "/community/members",
    },
  ];
  const [currentStep, setCurrentStep] = useState(0);
  const router = useTenantRouter();

  const step = steps[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await fetch("/api/users/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
    } catch (e) {
      console.error("Failed to save onboarding status:", e);
    }
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleAction = () => {
    if (step.actionLink) {
      router.push(step.actionLink);
      handleComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close onboarding"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="relative bg-[#2D2926] rounded-2xl border border-white/[0.1] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          type="button"
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.06]">
          <div
            className="h-full bg-[#D4836A] transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 pt-12">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4836A]/20 to-[#D4836A]/5 flex items-center justify-center mb-6 mx-auto">
            <StepIcon className="w-8 h-8 text-[#D4836A]" />
          </div>

          {/* Welcome message (first step only) */}
          {currentStep === 0 && (
            <p className="text-[#D4836A] text-sm font-medium text-center mb-2">Hey {userName}!</p>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold text-white text-center mb-3">{step.title}</h2>

          {/* Description */}
          <p className="text-[#A8A29E] text-center leading-relaxed">{step.description}</p>

          {/* Action button (for specific steps) */}
          {step.action && (
            <button
              type="button"
              onClick={handleAction}
              className="mt-6 w-full py-3 bg-white/[0.05] hover:bg-white/[0.1] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {step.action}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 pb-4">
          {steps.map((s, index) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setCurrentStep(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentStep
                  ? "bg-[#D4836A]"
                  : index < currentStep
                    ? "bg-[#D4836A]/50"
                    : "bg-white/[0.1]"
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 pt-0">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[#78716C] hover:text-white disabled:opacity-0 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
          >
            {isLastStep ? (
              <>
                <Check className="w-4 h-4" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
