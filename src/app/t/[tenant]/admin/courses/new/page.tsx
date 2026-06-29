"use client";

import { ArrowLeft, Loader2, Save, Upload, X } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CourseModuleForm, { type Lesson } from "@/components/admin/CourseModuleForm";
import { useCities } from "@/components/CitiesProvider";
import LessonContent from "@/components/LessonContent";
import { TenantLink, useTenantRouter } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import ToggleSwitch from "@/components/ToggleSwitch";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { type City, capitalCities, regionalCities, timezoneForCity } from "@/lib/cities";
import { uploadFile } from "@/lib/upload-client";
import { TIMEZONE_OPTIONS } from "../../events/eventFormHelpers";

function localToUTC(localStr: string, tz: string): string {
  const [datePart, timePart] = localStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, h, min));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(utcGuess);
  const g = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  let tzH = g("hour");
  if (tzH === 24) tzH = 0;
  const tzDate = new Date(Date.UTC(g("year"), g("month") - 1, g("day"), tzH, g("minute")));
  return new Date(utcGuess.getTime() - (tzDate.getTime() - utcGuess.getTime())).toISOString();
}

function utcToLocal(isoString: string, tz: string): string {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let h = g("hour");
  if (h === "24") h = "00";
  return `${g("year")}-${g("month")}-${g("day")}T${h}:${g("minute")}`;
}

function CitySelect({
  id,
  value,
  onChange,
  cities,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  cities: City[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-[#D4836A]"
    >
      <option value="">Select city</option>
      <optgroup label="Capital Cities">
        {capitalCities(cities).map((city) => (
          <option key={city.slug} value={city.name}>
            {city.name}, {city.state}
          </option>
        ))}
      </optgroup>
      <optgroup label="Regional Cities">
        {regionalCities(cities).map((city) => (
          <option key={city.slug} value={city.name}>
            {city.name}, {city.state}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

interface CommunityUser {
  id: string;
  name: string | null;
  image: string | null;
}

function InstructorSelect({
  id,
  value,
  onChange,
  allUsers,
  usersLoading,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  allUsers: CommunityUser[];
  usersLoading: boolean;
}) {
  const [isExternal, setIsExternal] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: seeds isExternal once on mount; re-running on value/allUsers changes would clobber the user's External toggle
  useEffect(() => {
    if (!value) return;
    const match = allUsers.find((u) => u.name === value);
    if (!match) setIsExternal(true);
  }, []);

  const filtered = search
    ? allUsers.filter((u) => u.name?.toLowerCase().includes(search.toLowerCase()))
    : allUsers;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {isExternal ? (
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Instructor name"
            className="flex-1 px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
          />
        ) : (
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={value ? value : "Search members..."}
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
            />
            {showDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-[#2D2926] border border-white/[0.06] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {usersLoading ? (
                  <div className="p-3 flex items-center justify-center gap-2 text-[#57534E] text-sm">
                    <div className="w-4 h-4 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin" />
                    Loading members...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-3 text-center text-[#57534E] text-sm">No members found</div>
                ) : (
                  filtered.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        onChange(user.name || "");
                        setSearch(user.name || "");
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                    >
                      {user.image ? (
                        <RemoteImage
                          src={user.image}
                          alt=""
                          loading="lazy"
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#D4836A]/20 flex items-center justify-center text-[#D4836A] text-xs font-medium">
                          {(user.name?.[0] || "?").toUpperCase()}
                        </div>
                      )}
                      <span className="text-white text-sm">{user.name || "Unknown"}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        <ToggleSwitch
          checked={isExternal}
          onChange={(v) => {
            setIsExternal(v);
            if (!v) onChange("");
          }}
          label="External"
        />
      </div>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large form component; decomposition of the 700-line form/JSX is risky and out of scope
export default function NewCoursePage() {
  const config = useTenantConfig();
  const cities = useCities();
  const router = useTenantRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [courseType, setCourseType] = useState<"module" | "scheduled">(
    searchParams.get("type") === "scheduled" ? "scheduled" : "module",
  );
  const editId = searchParams.get("edit");

  // Learning module state
  const [course, setCourse] = useState({
    title: "",
    slug: "",
    description: "",
    thumbnail: "",
    isPublished: false,
  });
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Scheduled course state
  const [scheduled, setScheduled] = useState({
    title: "",
    description: "",
    location: "",
    city: "",
    timezone: config.defaultTimezone,
    startTime: "",
    endTime: "",
    isOnline: false,
    meetingUrl: "",
    imageUrl: "",
    registrationUrl: "",
    courseType: "workshop",
    isPublished: false,
    price: "",
    instructor: "",
    maxAttendees: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showScheduledDescPreview, setShowScheduledDescPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allUsers, setAllUsers] = useState<CommunityUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Preload all community users
  useEffect(() => {
    fetch("/api/admin/users/names")
      .then((res) => res.json())
      .then((data) => setAllUsers(Array.isArray(data) ? data : data.users || []))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, []);

  // Load existing scheduled course for editing
  // biome-ignore lint/correctness/useExhaustiveDependencies: editId is the intentional trigger; config.defaultTimezone is read only as a fallback default and should not re-run the load
  useEffect(() => {
    if (editId) {
      setCourseType("scheduled");
      fetch(`/api/scheduled-courses/${editId}`)
        .then((res) => res.json())
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: inline mapper of a loosely-typed scheduled-course API response into form state; extraction is out of scope
        .then((data) => {
          if (data.error) return;
          const tz = data.timezone || config.defaultTimezone;
          setScheduled({
            title: data.title || "",
            description: data.description || "",
            location: data.location || "",
            city: data.city || "",
            timezone: tz,
            startTime: data.startTime ? utcToLocal(data.startTime, tz) : "",
            endTime: data.endTime ? utcToLocal(data.endTime, tz) : "",
            isOnline: data.isOnline || false,
            meetingUrl: data.meetingUrl || "",
            imageUrl: data.imageUrl || "",
            registrationUrl: data.registrationUrl || "",
            courseType: data.courseType || "workshop",
            isPublished: data.isPublished || false,
            price: data.price || "",
            instructor: data.instructor || "",
            maxAttendees: data.maxAttendees?.toString() || "",
          });
          if (data.imageUrl) setImagePreview(data.imageUrl);
        })
        .catch(() => {});
    }
  }, [editId]);

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...course,
          lessons: lessons.map((l, i) => ({
            title: l.title,
            description: l.description,
            content: l.content,
            videoUrl: l.videoUrl || null,
            order: i + 1,
          })),
        }),
      });

      if (res.ok) {
        router.push("/admin/courses");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create course");
      }
    } catch (error) {
      console.error("Failed to create course:", error);
      alert("Failed to create course");
    } finally {
      setSaving(false);
    }
  };

  const handleScheduledSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const tz = scheduled.timezone || config.defaultTimezone;
    let formattedPrice = scheduled.price;
    if (formattedPrice && formattedPrice !== "Free") {
      formattedPrice = `$${parseFloat(formattedPrice).toFixed(2)}`;
    }

    const payload = {
      ...scheduled,
      price: formattedPrice || null,
      maxAttendees: scheduled.maxAttendees ? parseInt(scheduled.maxAttendees, 10) : null,
      startTime: localToUTC(scheduled.startTime, tz),
      endTime: scheduled.endTime ? localToUTC(scheduled.endTime, tz) : null,
      timezone: tz,
    };

    try {
      const url = editId ? `/api/scheduled-courses/${editId}` : "/api/scheduled-courses";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/admin/courses");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save scheduled course");
      }
    } catch (error) {
      console.error("Failed to save scheduled course:", error);
      alert("Failed to save scheduled course");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB");
      return;
    }
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    try {
      const result = await uploadFile(file, { folder: "scheduled-courses" });
      setScheduled((prev) => ({ ...prev, imageUrl: result.url }));
    } catch {
      setImagePreview(null);
      alert("Upload failed. Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1C1917] pt-14">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <TenantLink
              href="/admin/courses"
              className="p-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </TenantLink>
            <h1 className="text-2xl font-bold text-white">
              {editId ? "Edit Scheduled Course" : "Create New Course"}
            </h1>
          </div>
        </div>

        {/* Type Selector (only when creating new) */}
        {!editId && (
          <div className="flex gap-1 bg-[#2D2926] rounded-lg p-1 w-fit mb-6">
            <button
              type="button"
              onClick={() => setCourseType("module")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                courseType === "module"
                  ? "bg-[#D4836A] text-white"
                  : "text-[#A8A29E] hover:text-white"
              }`}
            >
              Learning Module
            </button>
            <button
              type="button"
              onClick={() => setCourseType("scheduled")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                courseType === "scheduled"
                  ? "bg-[#D4836A] text-white"
                  : "text-[#A8A29E] hover:text-white"
              }`}
            >
              Scheduled Course
            </button>
          </div>
        )}

        {courseType === "module" ? (
          <CourseModuleForm
            course={course}
            onCourseChange={setCourse}
            lessons={lessons}
            onLessonsChange={setLessons}
            saving={saving}
            onSubmit={handleModuleSubmit}
            submitLabel="Save Course"
            autoSlug
          />
        ) : (
          /* Scheduled Course Form */
          <form onSubmit={handleScheduledSubmit}>
            <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6 space-y-4">
              <h2 className="font-semibold text-white">Scheduled Course Details</h2>

              <div>
                <label
                  htmlFor="course-title"
                  className="block text-sm font-medium text-[#A8A29E] mb-1"
                >
                  Title *
                </label>
                <input
                  id="course-title"
                  type="text"
                  required
                  value={scheduled.title}
                  onChange={(e) => setScheduled({ ...scheduled, title: e.target.value })}
                  placeholder="e.g., Claude Bootcamp"
                  className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
                />
              </div>

              <div>
                <label
                  htmlFor="course-description"
                  className="block text-sm font-medium text-[#A8A29E] mb-1"
                >
                  Description
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setShowScheduledDescPreview(false)}
                    className={`px-3 py-1 text-xs rounded-lg ${!showScheduledDescPreview ? "bg-[#D4836A] text-white" : "text-[#78716C] hover:text-white"}`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduledDescPreview(true)}
                    className={`px-3 py-1 text-xs rounded-lg ${showScheduledDescPreview ? "bg-[#D4836A] text-white" : "text-[#78716C] hover:text-white"}`}
                  >
                    Preview
                  </button>
                </div>
                {showScheduledDescPreview ? (
                  <div className="min-h-[120px] px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl">
                    {scheduled.description ? (
                      <LessonContent content={scheduled.description} />
                    ) : (
                      <p className="text-[#57534E] text-sm italic">Nothing to preview</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    id="course-description"
                    value={scheduled.description}
                    onChange={(e) => setScheduled({ ...scheduled, description: e.target.value })}
                    rows={5}
                    placeholder="What will attendees learn?"
                    className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A] resize-none font-mono text-sm"
                  />
                )}
                <p className="text-xs text-[#57534E] mt-1">
                  Supports markdown: **bold**, _italic_, - lists, ## headings, `code`, [links](url)
                </p>
              </div>

              {/* Image Upload */}
              <div>
                <label
                  htmlFor="course-image"
                  className="block text-sm font-medium text-[#A8A29E] mb-1"
                >
                  Course Image
                </label>
                {imagePreview ? (
                  <div className="relative w-full h-48 rounded-xl overflow-hidden border border-white/[0.06] bg-[#1C1917]">
                    <Image src={imagePreview} alt="Preview" fill className="object-contain" />
                    {imageUploading && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-white/80">Uploading...</span>
                      </div>
                    )}
                    {!imageUploading && (
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setScheduled({ ...scheduled, imageUrl: "" });
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                    className="w-full h-32 border-2 border-dashed border-white/[0.06] rounded-xl flex flex-col items-center justify-center gap-2 text-[#78716C] hover:border-[#D4836A] hover:text-[#D4836A] transition-colors disabled:opacity-50"
                  >
                    {imageUploading ? (
                      <div className="w-6 h-6 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                    <span className="text-sm">
                      {imageUploading ? "Uploading..." : "Click to upload image"}
                    </span>
                  </button>
                )}
                <input
                  id="course-image"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="course-course-type"
                    className="block text-sm font-medium text-[#A8A29E] mb-1"
                  >
                    Course Type
                  </label>
                  <select
                    id="course-course-type"
                    value={scheduled.courseType}
                    onChange={(e) => setScheduled({ ...scheduled, courseType: e.target.value })}
                    className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-[#D4836A]"
                  >
                    <option value="workshop">Workshop</option>
                    <option value="bootcamp">Bootcamp</option>
                    <option value="webinar">Webinar</option>
                    <option value="seminar">Seminar</option>
                    <option value="training">Training</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="course-instructor"
                    className="block text-sm font-medium text-[#A8A29E] mb-1"
                  >
                    Instructor
                  </label>
                  <InstructorSelect
                    id="course-instructor"
                    value={scheduled.instructor}
                    onChange={(v) => setScheduled({ ...scheduled, instructor: v })}
                    allUsers={allUsers}
                    usersLoading={usersLoading}
                  />
                </div>
              </div>

              <ToggleSwitch
                checked={scheduled.isOnline}
                onChange={(v) => setScheduled({ ...scheduled, isOnline: v })}
                label="Online course"
              />

              <div
                className={`grid grid-cols-2 gap-4 ${scheduled.isOnline ? "opacity-40 pointer-events-none" : ""}`}
              >
                <div>
                  <label
                    htmlFor="course-city"
                    className="block text-sm font-medium text-[#A8A29E] mb-1"
                  >
                    City
                  </label>
                  <CitySelect
                    id="course-city"
                    cities={cities}
                    value={scheduled.city}
                    onChange={(value) =>
                      setScheduled({
                        ...scheduled,
                        city: value,
                        timezone: timezoneForCity(cities, value, config.defaultTimezone),
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="course-location"
                    className="block text-sm font-medium text-[#A8A29E] mb-1"
                  >
                    Location
                  </label>
                  <input
                    id="course-location"
                    type="text"
                    value={scheduled.location}
                    onChange={(e) => setScheduled({ ...scheduled, location: e.target.value })}
                    placeholder="Venue name, address"
                    className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="course-start-time"
                    className="block text-sm font-medium text-[#A8A29E] mb-1"
                  >
                    Start Date & Time *
                  </label>
                  <input
                    id="course-start-time"
                    type="datetime-local"
                    required
                    value={scheduled.startTime}
                    onChange={(e) => setScheduled({ ...scheduled, startTime: e.target.value })}
                    className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-[#D4836A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="course-end-time"
                    className="block text-sm font-medium text-[#A8A29E] mb-1"
                  >
                    End Date & Time
                  </label>
                  <input
                    id="course-end-time"
                    type="datetime-local"
                    value={scheduled.endTime}
                    onChange={(e) => setScheduled({ ...scheduled, endTime: e.target.value })}
                    className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-[#D4836A]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="course-timezone"
                  className="block text-sm font-medium text-[#A8A29E] mb-1"
                >
                  Timezone
                </label>
                <select
                  id="course-timezone"
                  value={scheduled.timezone}
                  onChange={(e) => setScheduled({ ...scheduled, timezone: e.target.value })}
                  className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-[#D4836A]"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="course-price"
                    className="block text-sm font-medium text-[#A8A29E] mb-1"
                  >
                    Price
                  </label>
                  <div className="flex items-center gap-3">
                    <ToggleSwitch
                      checked={scheduled.price === "Free"}
                      onChange={(v) => setScheduled({ ...scheduled, price: v ? "Free" : "" })}
                      label="Free"
                    />
                    <div
                      className={`relative flex-1 ${scheduled.price === "Free" ? "opacity-40 pointer-events-none" : ""}`}
                    >
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#78716C]">
                        $
                      </span>
                      <input
                        id="course-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={scheduled.price === "Free" ? "" : scheduled.price}
                        onChange={(e) => setScheduled({ ...scheduled, price: e.target.value })}
                        placeholder="0.00"
                        className="w-full pl-8 pr-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="course-max-attendees"
                    className="block text-sm font-medium text-[#A8A29E] mb-1"
                  >
                    Max Attendees
                  </label>
                  <input
                    id="course-max-attendees"
                    type="number"
                    min="1"
                    value={scheduled.maxAttendees}
                    onChange={(e) => setScheduled({ ...scheduled, maxAttendees: e.target.value })}
                    placeholder="50"
                    className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="course-registration-url"
                  className="block text-sm font-medium text-[#A8A29E] mb-1"
                >
                  Registration URL
                </label>
                <input
                  id="course-registration-url"
                  type="url"
                  value={scheduled.registrationUrl}
                  onChange={(e) => setScheduled({ ...scheduled, registrationUrl: e.target.value })}
                  placeholder="https://eventbrite.com/..."
                  className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder:text-[#57534E] focus:outline-none focus:border-[#D4836A]"
                />
                <p className="text-xs text-[#57534E] mt-1">
                  External link where attendees register
                </p>
              </div>

              <div className="pt-2">
                <ToggleSwitch
                  checked={scheduled.isPublished}
                  onChange={(v) => setScheduled({ ...scheduled, isPublished: v })}
                  label="Publish immediately"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving || !scheduled.title || !scheduled.startTime}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editId ? "Save Changes" : "Create Scheduled Course"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
