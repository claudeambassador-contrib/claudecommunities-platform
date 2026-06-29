"use client";

import {
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle,
  Database,
  FileSpreadsheet,
  Linkedin,
  Mail,
  MapPin,
  RotateCcw,
  User,
  X,
} from "lucide-react";
import { useState } from "react";

interface Props {
  headers: string[];
  mapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
  sampleRow: Record<string, string>;
}

const FIELD_CONFIG = [
  {
    key: "email",
    label: "Email",
    icon: Mail,
    required: true,
    description: "User email address (required)",
  },
  {
    key: "name",
    label: "Full Name",
    icon: User,
    required: false,
    description: "User's full name",
  },
  {
    key: "first_name",
    label: "First Name",
    icon: User,
    required: false,
    description: "First name (combined with last name)",
  },
  {
    key: "last_name",
    label: "Last Name",
    icon: User,
    required: false,
    description: "Last name (combined with first name)",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    required: false,
    description: "LinkedIn profile URL or username",
  },
  {
    key: "work_study",
    label: "Work/Study",
    icon: Briefcase,
    required: false,
    description: "Where they work or study (maps to bio)",
  },
  {
    key: "experience_level",
    label: "Experience Level",
    icon: Award,
    required: false,
    description: "Experience with Claude",
  },
  {
    key: "city",
    label: "City",
    icon: MapPin,
    required: false,
    description: "User's city",
  },
  {
    key: "approval_status",
    label: "Approval Status",
    icon: CheckCircle,
    required: false,
    description: "Filter by approval (Luma format)",
  },
];

type ViewMode = "fields" | "columns" | "visual";

export default function ColumnMapper({ headers, mapping, onChange, sampleRow }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("visual");

  const handleFieldChange = (fieldKey: string, headerValue: string) => {
    const newMapping = { ...mapping };
    if (headerValue === "") {
      delete newMapping[fieldKey];
    } else {
      // Remove any existing mapping for this header
      Object.keys(newMapping).forEach((key) => {
        if (newMapping[key] === headerValue && key !== fieldKey) {
          delete newMapping[key];
        }
      });
      newMapping[fieldKey] = headerValue;
    }
    onChange(newMapping);
  };

  const handleColumnChange = (header: string, fieldKey: string) => {
    const newMapping = { ...mapping };
    // Remove the header from any existing field
    Object.keys(newMapping).forEach((key) => {
      if (newMapping[key] === header) {
        delete newMapping[key];
      }
    });
    // Set new mapping if a field was selected
    if (fieldKey !== "") {
      newMapping[fieldKey] = header;
    }
    onChange(newMapping);
  };

  const removeMapping = (fieldKey: string) => {
    const newMapping = { ...mapping };
    delete newMapping[fieldKey];
    onChange(newMapping);
  };

  const clearAllMappings = () => {
    onChange({});
  };

  const getFieldValue = (fieldKey: string): string => {
    return mapping[fieldKey] || "";
  };

  const getFieldForHeader = (header: string): string => {
    return Object.keys(mapping).find((key) => mapping[key] === header) || "";
  };

  const getSampleValue = (header: string): string => {
    if (!header || !sampleRow) return "";
    return sampleRow[header] || "";
  };

  const getMappedHeaders = (): string[] => {
    return Object.values(mapping).filter(Boolean);
  };

  const getUnmappedHeaders = (): string[] => {
    return headers.filter((h) => !getMappedHeaders().includes(h));
  };

  const getMappedFields = (): string[] => {
    return Object.keys(mapping).filter((key) => mapping[key]);
  };

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 bg-[#1C1917] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode("visual")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "visual" ? "bg-[#D4836A] text-white" : "text-[#A8A29E] hover:text-white"
            }`}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => setViewMode("fields")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "fields" ? "bg-[#D4836A] text-white" : "text-[#A8A29E] hover:text-white"
            }`}
          >
            By Field
          </button>
          <button
            type="button"
            onClick={() => setViewMode("columns")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "columns" ? "bg-[#D4836A] text-white" : "text-[#A8A29E] hover:text-white"
            }`}
          >
            By Column
          </button>
        </div>
        <button
          type="button"
          onClick={clearAllMappings}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#A8A29E] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Clear All
        </button>
      </div>

      {/* Visual Mode - Two Panel View */}
      {viewMode === "visual" && (
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
          {/* CSV Columns Panel */}
          <div className="bg-[#1C1917] rounded-xl p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
              <FileSpreadsheet className="w-5 h-5 text-[#D4836A]" />
              <h3 className="font-medium text-white">CSV Columns</h3>
              <span className="text-xs text-[#78716C] ml-auto">{headers.length} columns</span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {headers.map((header) => {
                const mappedTo = getFieldForHeader(header);
                const field = FIELD_CONFIG.find((f) => f.key === mappedTo);
                return (
                  <div
                    key={header}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      mappedTo
                        ? "bg-[#D4836A]/10 border-[#D4836A]/30"
                        : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{header}</p>
                      <p className="text-xs text-[#78716C] truncate">
                        {getSampleValue(header) || "No sample"}
                      </p>
                    </div>
                    {mappedTo && field && (
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-[#D4836A] font-medium">→ {field.label}</span>
                        <button
                          type="button"
                          onClick={() => removeMapping(mappedTo)}
                          className="p-1 text-[#78716C] hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Arrow Indicator */}
          <div className="hidden md:flex items-center justify-center px-2">
            <ArrowRight className="w-6 h-6 text-[#78716C]" />
          </div>

          {/* Target Fields Panel */}
          <div className="bg-[#1C1917] rounded-xl p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
              <Database className="w-5 h-5 text-[#D4836A]" />
              <h3 className="font-medium text-white">Target Fields</h3>
              <span className="text-xs text-[#78716C] ml-auto">
                {getMappedFields().length} mapped
              </span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {FIELD_CONFIG.map((field) => {
                const Icon = field.icon;
                const isMapped = !!mapping[field.key];
                return (
                  <div
                    key={field.key}
                    className={`p-3 rounded-lg border transition-colors ${
                      isMapped
                        ? "bg-[#D4836A]/10 border-[#D4836A]/30"
                        : field.required
                          ? "bg-red-500/5 border-red-500/20"
                          : "bg-white/[0.02] border-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon
                        className={`w-4 h-4 ${isMapped ? "text-[#D4836A]" : "text-[#78716C]"}`}
                      />
                      <span className="text-sm font-medium text-white">{field.label}</span>
                      {field.required && <span className="text-xs text-red-400">*</span>}
                    </div>
                    <select
                      value={getFieldValue(field.key)}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="w-full bg-[#2D2926] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4836A]/50"
                    >
                      <option value="">-- Not mapped --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fields View - List of target fields */}
      {viewMode === "fields" && (
        <div className="space-y-3">
          {FIELD_CONFIG.map((field) => {
            const Icon = field.icon;
            const isMapped = !!mapping[field.key];
            const sampleValue = isMapped ? getSampleValue(mapping[field.key]) : "";

            return (
              <div
                key={field.key}
                className={`bg-[#1C1917] rounded-xl p-4 border transition-colors ${
                  isMapped
                    ? "border-[#D4836A]/30"
                    : field.required
                      ? "border-red-500/20"
                      : "border-white/[0.06]"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      isMapped ? "bg-[#D4836A]/10 text-[#D4836A]" : "bg-white/[0.05] text-[#78716C]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{field.label}</span>
                      {field.required && <span className="text-xs text-red-400">Required</span>}
                    </div>
                    <p className="text-sm text-[#78716C] mb-3">{field.description}</p>

                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1 flex items-center gap-2">
                        <select
                          value={getFieldValue(field.key)}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="flex-1 bg-[#2D2926] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4836A]/50"
                        >
                          <option value="">-- Select column --</option>
                          {headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                        {isMapped && (
                          <button
                            type="button"
                            onClick={() => removeMapping(field.key)}
                            className="p-2 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remove mapping"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {isMapped && sampleValue && (
                        <div className="flex-1 bg-[#2D2926]/50 rounded-lg px-3 py-2">
                          <p className="text-xs text-[#78716C] mb-0.5">Sample:</p>
                          <p className="text-sm text-[#A8A29E] truncate">{sampleValue}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Columns View - List of CSV columns */}
      {viewMode === "columns" && (
        <div className="space-y-3">
          {headers.map((header) => {
            const mappedTo = getFieldForHeader(header);
            const sampleValue = getSampleValue(header);

            return (
              <div
                key={header}
                className={`bg-[#1C1917] rounded-xl p-4 border transition-colors ${
                  mappedTo ? "border-[#D4836A]/30" : "border-white/[0.06]"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      mappedTo ? "bg-[#D4836A]/10 text-[#D4836A]" : "bg-white/[0.05] text-[#78716C]"
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white truncate">{header}</span>
                    </div>
                    {sampleValue && (
                      <p className="text-sm text-[#78716C] mb-3 truncate">Sample: {sampleValue}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <select
                        value={mappedTo}
                        onChange={(e) => handleColumnChange(header, e.target.value)}
                        className="flex-1 bg-[#2D2926] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4836A]/50"
                      >
                        <option value="">-- Don't import --</option>
                        {FIELD_CONFIG.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label}
                            {field.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                      {mappedTo && (
                        <button
                          type="button"
                          onClick={() => handleColumnChange(header, "")}
                          className="p-2 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove mapping"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-[#78716C]">Mapped:</span>{" "}
            <span className="text-[#D4836A] font-medium">{getMappedFields().length} fields</span>
          </div>
          <div>
            <span className="text-[#78716C]">Unmapped columns:</span>{" "}
            <span className="text-[#A8A29E]">
              {getUnmappedHeaders().length} of {headers.length}
            </span>
          </div>
          {!mapping.email && <div className="text-red-400">⚠ Email field is required</div>}
        </div>
        {getUnmappedHeaders().length > 0 && (
          <p className="text-xs text-[#78716C] mt-2">
            Unmapped: {getUnmappedHeaders().slice(0, 5).join(", ")}
            {getUnmappedHeaders().length > 5 && "..."}
          </p>
        )}
      </div>
    </div>
  );
}
