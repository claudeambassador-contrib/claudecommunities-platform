"use client";

import { Activity, Briefcase, Calendar, Linkedin, MapPin, Tag, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

interface FilterOptions {
  cities: string[];
  experienceLevels: string[];
  events: Array<{ id: string; title: string; city: string | null; startTime: string }>;
  tags: Array<{ id: string; name: string; category: string | null }>;
  importSources: string[];
  roles: string[];
  activityLevels: string[];
}

interface Props {
  filters: Record<string, unknown>;
  onSave: (filters: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function SegmentBuilder({ filters, onSave, onCancel }: Props) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [localFilters, setLocalFilters] = useState<Record<string, unknown>>(filters);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewUsers, setPreviewUsers] = useState<
    Array<{ id: string; name: string | null; email: string | null; city: string | null }>
  >([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchOptions is a stable inline loader; run once on mount only.
  useEffect(() => {
    fetchOptions();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: updatePreview reads localFilters; re-run is intentionally keyed on localFilters changes only, not the function identity.
  useEffect(() => {
    updatePreview();
  }, [localFilters]);

  const fetchOptions = async () => {
    try {
      const res = await fetch("/api/admin/email/segments/query");
      if (res.ok) {
        const data = await res.json();
        setOptions(data);
      }
    } catch (error) {
      console.error("Failed to fetch options:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreview = async () => {
    try {
      const res = await fetch("/api/admin/email/segments/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: localFilters, includePreview: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewCount(data.count);
        setPreviewUsers(data.preview);
      }
    } catch (error) {
      console.error("Failed to update preview:", error);
    }
  };

  const toggleArrayFilter = (key: string, value: string) => {
    const current = (localFilters[key] as string[]) || [];
    if (current.includes(value)) {
      setLocalFilters({
        ...localFilters,
        [key]: current.filter((v) => v !== value),
      });
    } else {
      setLocalFilters({
        ...localFilters,
        [key]: [...current, value],
      });
    }
  };

  const setFilter = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      const { [key]: _, ...rest } = localFilters;
      setLocalFilters(rest);
    } else {
      setLocalFilters({ ...localFilters, [key]: value });
    }
  };

  const clearAllFilters = () => {
    setLocalFilters({});
  };

  const isSelected = (key: string, value: string) => {
    const current = (localFilters[key] as string[]) || [];
    return current.includes(value);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2D2926] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-white">Build Audience Segment</h2>
            <p className="text-sm text-[#78716C]">
              {previewCount !== null ? `${previewCount} users match` : "Loading..."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Cities */}
          {options?.cities && options.cities.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[#A8A29E] mb-3">
                <MapPin className="w-4 h-4" />
                Cities
              </div>
              <div className="flex flex-wrap gap-2">
                {options.cities.map((city) => (
                  <button
                    type="button"
                    key={city}
                    onClick={() => toggleArrayFilter("cities", city)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isSelected("cities", city)
                        ? "bg-[#D4836A] text-white"
                        : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Roles */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#A8A29E] mb-3">
              <Users className="w-4 h-4" />
              User Role
            </div>
            <div className="flex flex-wrap gap-2">
              {options?.roles.map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => toggleArrayFilter("roles", role)}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                    isSelected("roles", role)
                      ? "bg-[#D4836A] text-white"
                      : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Level */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#A8A29E] mb-3">
              <Activity className="w-4 h-4" />
              Activity Level
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setFilter(
                    "activityLevel",
                    localFilters.activityLevel === "active" ? null : "active",
                  )
                }
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  localFilters.activityLevel === "active"
                    ? "bg-[#D4836A] text-white"
                    : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
                }`}
              >
                Active (last 30 days)
              </button>
              <button
                type="button"
                onClick={() =>
                  setFilter(
                    "activityLevel",
                    localFilters.activityLevel === "inactive" ? null : "inactive",
                  )
                }
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  localFilters.activityLevel === "inactive"
                    ? "bg-[#D4836A] text-white"
                    : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
                }`}
              >
                Inactive (30+ days)
              </button>
            </div>
          </div>

          {/* Experience Level */}
          {options?.experienceLevels && options.experienceLevels.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[#A8A29E] mb-3">
                <Briefcase className="w-4 h-4" />
                Experience Level
              </div>
              <div className="flex flex-wrap gap-2">
                {options.experienceLevels.map((level) => (
                  <button
                    type="button"
                    key={level}
                    onClick={() => toggleArrayFilter("experienceLevels", level)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isSelected("experienceLevels", level)
                        ? "bg-[#D4836A] text-white"
                        : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Has LinkedIn */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#A8A29E] mb-3">
              <Linkedin className="w-4 h-4" />
              LinkedIn Profile
            </div>
            <button
              type="button"
              onClick={() => setFilter("hasLinkedIn", localFilters.hasLinkedIn ? null : true)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                localFilters.hasLinkedIn
                  ? "bg-[#D4836A] text-white"
                  : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
              }`}
            >
              Has LinkedIn profile
            </button>
          </div>

          {/* Signup Date Range */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#A8A29E] mb-3">
              <Calendar className="w-4 h-4" />
              Signup Date Range
            </div>
            <div className="flex gap-3">
              <input
                type="date"
                value={(localFilters.signupAfter as string) || ""}
                onChange={(e) => setFilter("signupAfter", e.target.value || null)}
                className="flex-1 bg-[#1C1917] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4836A]/50"
              />
              <span className="text-[#78716C] self-center">to</span>
              <input
                type="date"
                value={(localFilters.signupBefore as string) || ""}
                onChange={(e) => setFilter("signupBefore", e.target.value || null)}
                className="flex-1 bg-[#1C1917] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4836A]/50"
              />
            </div>
          </div>

          {/* Events */}
          {options?.events && options.events.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[#A8A29E] mb-3">
                <Calendar className="w-4 h-4" />
                Event Attendance
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {options.events.map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => toggleArrayFilter("eventIds", event.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      isSelected("eventIds", event.id)
                        ? "bg-[#D4836A] text-white"
                        : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
                    }`}
                  >
                    <span className="truncate">{event.title}</span>
                    {event.city && <span className="text-xs opacity-70 ml-2">{event.city}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {options?.tags && options.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[#A8A29E] mb-3">
                <Tag className="w-4 h-4" />
                User Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {options.tags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => toggleArrayFilter("tagIds", tag.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isSelected("tagIds", tag.id)
                        ? "bg-[#D4836A] text-white"
                        : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {previewUsers.length > 0 && (
            <div>
              <div className="text-sm font-medium text-[#A8A29E] mb-3 block">
                Preview (first 10)
              </div>
              <div className="bg-[#1C1917] rounded-xl p-3 space-y-2">
                {previewUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{user.name || "Unnamed"}</span>
                    <span className="text-[#78716C]">{user.email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm text-[#78716C] hover:text-white transition-colors"
          >
            Clear all filters
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(localFilters)}
              className="px-4 py-2 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
