"use client";

import { useEffect, useState } from "react";
import OnboardingModal from "./OnboardingModal";

interface OnboardingCheckProps {
  userName: string;
  userId: string;
  isOnboarded: boolean;
}

export default function OnboardingCheck({ userName, userId, isOnboarded }: OnboardingCheckProps) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Show modal if user is not onboarded
    if (!isOnboarded) {
      setShowModal(true);
    }
  }, [isOnboarded]);

  const handleComplete = () => {
    setShowModal(false);
  };

  if (!showModal) return null;

  return <OnboardingModal userName={userName} userId={userId} onComplete={handleComplete} />;
}
