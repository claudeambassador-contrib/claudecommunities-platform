"use client";

import { Loader2, Play } from "lucide-react";
import { useState } from "react";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import { useToast } from "./ui/Toast";

interface EnrollButtonProps {
  courseId: string;
}

export default function EnrollButton({ courseId }: EnrollButtonProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const router = useTenantRouter();

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to enroll");
      }
    } catch (error) {
      console.error("Failed to enroll:", error);
      toast.error("Failed to enroll");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleEnroll}
      disabled={loading}
      className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] text-white font-semibold rounded-xl hover:bg-[#c4775f] disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
      Start Learning
    </button>
  );
}
