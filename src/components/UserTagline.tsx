"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useState } from "react";

interface UserTaglineProps {
  tagline: string | null;
  isEditable?: boolean;
  userId?: string;
  className?: string;
  maxLength?: number;
  onUpdate?: (newTagline: string) => void;
}

export default function UserTagline({
  tagline,
  isEditable = false,
  userId,
  className = "",
  maxLength = 60,
  onUpdate,
}: UserTaglineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tagline || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${userId}/tagline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagline: editValue.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update tagline");
      }

      onUpdate?.(editValue.trim());
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(tagline || "");
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxLength}
            placeholder="Add a short tagline..."
            className="flex-1 bg-[#1C1917] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 focus:ring-1 focus:ring-[#D4836A]/20"
            // biome-ignore lint/a11y/noAutofocus: focus the input when entering inline edit mode
            autoFocus
            disabled={isSaving}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="p-1.5 rounded-lg bg-[#D4836A] text-white hover:bg-[#c4735a] transition-colors disabled:opacity-50"
            title="Save"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1.5 rounded-lg bg-white/[0.05] text-[#78716C] hover:text-white hover:bg-white/[0.1] transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between text-xs text-[#78716C]">
          <span>
            {editValue.length}/{maxLength}
          </span>
          {error && <span className="text-red-400">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      {tagline ? (
        <p className="text-[#A8A29E] text-sm">{tagline}</p>
      ) : isEditable ? (
        <p className="text-[#78716C] text-sm italic">Add a tagline...</p>
      ) : null}
      {isEditable && (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="p-1 rounded opacity-0 group-hover:opacity-100 text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-all"
          title="Edit tagline"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
