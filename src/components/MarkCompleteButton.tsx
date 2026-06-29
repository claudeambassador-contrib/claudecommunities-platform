"use client";

import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import { useToast } from "./ui/Toast";

interface MarkCompleteButtonProps {
  lessonId: string;
  isCompleted: boolean;
}

export default function MarkCompleteButton({ lessonId, isCompleted }: MarkCompleteButtonProps) {
  const toast = useToast();
  const [completed, setCompleted] = useState(isCompleted);
  const [loading, setLoading] = useState(false);
  const router = useTenantRouter();

  const toggleComplete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          completed: !completed,
        }),
      });

      if (res.ok) {
        setCompleted(!completed);
        router.refresh();
      } else {
        toast.error("Failed to update progress");
      }
    } catch (error) {
      console.error("Failed to update progress:", error);
      toast.error("Failed to update progress");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleComplete}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        completed
          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
          : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1] hover:text-white"
      }`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : completed ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <Circle className="w-4 h-4" />
      )}
      {completed ? "Completed" : "Mark as Complete"}
    </button>
  );
}
