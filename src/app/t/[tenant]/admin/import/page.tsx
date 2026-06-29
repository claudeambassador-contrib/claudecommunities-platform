"use client";

import { AlertCircle, CheckCircle, FileText, Tag, Upload, Users } from "lucide-react";
import { useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import ColumnMapper from "./ColumnMapper";

interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
}

interface PreviewResult {
  total: number;
  valid: number;
  invalid: number;
  existing: number;
  new: number;
  preview: Array<{
    email: string;
    name?: string;
    linkedin?: string;
    exists: boolean;
  }>;
  invalidEmails: string[];
}

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ email: string; error: string }>;
  total: number;
}

export default function AdminImportPage() {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [eventTag, setEventTag] = useState("");
  const [cityTag, setCityTag] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const text = await file.text();
      const { parseCSV } = await import("@/lib/csv-parser");
      const parsed = parseCSV(text);

      if (parsed.rows.length === 0) {
        setError("No data found in CSV file");
        return;
      }

      setParsedData(parsed);
      setColumnMapping(parsed.suggestedMapping);
      setStep("map");
    } catch (err) {
      setError("Failed to parse CSV file");
      console.error(err);
    }
  };

  const handleMappingComplete = async () => {
    if (!parsedData || !columnMapping.email) {
      setError("Email column mapping is required");
      return;
    }

    setError(null);

    try {
      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsedData.rows,
          columnMapping,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to preview import");
        return;
      }

      const result = await res.json();
      setPreviewResult(result);
      setStep("preview");
    } catch (err) {
      setError("Failed to preview import");
      console.error(err);
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setStep("importing");
    setError(null);

    try {
      const { mapRowsToUsers, filterApprovedRows } = await import("@/lib/csv-parser");

      // Filter by approval status if column is mapped
      let rows = parsedData.rows;
      if (columnMapping.approval_status) {
        rows = filterApprovedRows(rows, columnMapping.approval_status);
      }

      const users = mapRowsToUsers(rows, columnMapping);

      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          users,
          eventTag: eventTag || undefined,
          cityTag: cityTag || undefined,
          importSource: "luma_import",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Import failed");
        setStep("preview");
        return;
      }

      const result = await res.json();
      setImportResult(result);
      setStep("done");
    } catch (err) {
      setError("Import failed");
      setStep("preview");
      console.error(err);
    }
  };

  const resetImport = () => {
    setStep("upload");
    setParsedData(null);
    setColumnMapping({});
    setPreviewResult(null);
    setImportResult(null);
    setEventTag("");
    setCityTag("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center gap-3 mb-8">
          {["Upload", "Map Columns", "Preview", "Done"].map((label, i) => {
            const stepIndex = ["upload", "map", "preview", "done"].indexOf(step);
            const isActive = i <= stepIndex;
            const isCurrent = i === stepIndex;
            return (
              <div key={label} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCurrent
                      ? "bg-[#D4836A] text-white"
                      : isActive
                        ? "bg-[#D4836A]/20 text-[#D4836A]"
                        : "bg-white/[0.05] text-[#78716C]"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-sm ${
                    isCurrent ? "text-white" : isActive ? "text-[#A8A29E]" : "text-[#78716C]"
                  }`}
                >
                  {label}
                </span>
                {i < 3 && <div className="w-8 h-px bg-white/[0.06]" />}
              </div>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Step Content */}
        {step === "upload" && (
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#D4836A]/10 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-[#D4836A]" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Upload CSV File</h2>
              <p className="text-[#A8A29E] mb-6">
                Upload a CSV file exported from Luma or any other source.
                <br />
                We'll auto-detect common column formats.
              </p>
              <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors cursor-pointer">
                <FileText className="w-5 h-5" />
                Select CSV File
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {step === "map" && parsedData && (
          <div className="space-y-6">
            <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Map Columns</h2>
              <p className="text-[#A8A29E] text-sm mb-6">
                Found {parsedData.rows.length} rows. Map CSV columns to user fields.
              </p>
              <ColumnMapper
                headers={parsedData.headers}
                mapping={columnMapping}
                onChange={setColumnMapping}
                sampleRow={parsedData.rows[0]}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetImport}
                className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMappingComplete}
                disabled={!columnMapping.email}
                className="px-4 py-2.5 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors disabled:opacity-50"
              >
                Preview Import
              </button>
            </div>
          </div>
        )}

        {step === "preview" && previewResult && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#2D2926] rounded-xl p-4">
                <p className="text-sm text-[#A8A29E] mb-1">Total Rows</p>
                <p className="text-2xl font-bold text-white">{previewResult.total}</p>
              </div>
              <div className="bg-[#2D2926] rounded-xl p-4">
                <p className="text-sm text-[#A8A29E] mb-1">Valid Emails</p>
                <p className="text-2xl font-bold text-green-400">{previewResult.valid}</p>
              </div>
              <div className="bg-[#2D2926] rounded-xl p-4">
                <p className="text-sm text-[#A8A29E] mb-1">New Users</p>
                <p className="text-2xl font-bold text-[#D4836A]">{previewResult.new}</p>
              </div>
              <div className="bg-[#2D2926] rounded-xl p-4">
                <p className="text-sm text-[#A8A29E] mb-1">Existing Users</p>
                <p className="text-2xl font-bold text-blue-400">{previewResult.existing}</p>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Apply Tags (Optional)
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="import-event-tag" className="block text-sm text-[#A8A29E] mb-2">
                    Event Tag
                  </label>
                  <input
                    id="import-event-tag"
                    type="text"
                    value={eventTag}
                    onChange={(e) => setEventTag(e.target.value)}
                    placeholder="e.g., Sydney Meetup Jan 2024"
                    className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                  />
                </div>
                <div>
                  <label htmlFor="import-city-tag" className="block text-sm text-[#A8A29E] mb-2">
                    City Tag
                  </label>
                  <input
                    id="import-city-tag"
                    type="text"
                    value={cityTag}
                    onChange={(e) => setCityTag(e.target.value)}
                    placeholder="e.g., Sydney"
                    className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                  />
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-lg font-semibold text-white">Preview (first 20)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-4 py-3 text-sm font-medium text-[#A8A29E]">
                        Email
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-[#A8A29E]">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-[#A8A29E]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.preview.map((user) => (
                      <tr key={user.email} className="border-b border-white/[0.06] last:border-0">
                        <td className="px-4 py-3 text-sm text-white">{user.email}</td>
                        <td className="px-4 py-3 text-sm text-[#A8A29E]">{user.name || "-"}</td>
                        <td className="px-4 py-3">
                          {user.exists ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                              <Users className="w-3 h-3" />
                              Exists
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invalid Emails */}
            {previewResult.invalidEmails.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <h4 className="text-sm font-medium text-red-400 mb-2">
                  {previewResult.invalid} Invalid Emails (will be skipped)
                </h4>
                <p className="text-sm text-red-400/70">
                  {previewResult.invalidEmails.slice(0, 5).join(", ")}
                  {previewResult.invalidEmails.length > 5 && "..."}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep("map")}
                className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="px-4 py-2.5 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors"
              >
                Import {previewResult.valid} Users
              </button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-8 text-center">
            <div className="w-12 h-12 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">Importing Users...</h2>
            <p className="text-[#A8A29E]">This may take a moment</p>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-6">
            <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Import Complete!</h2>
              <p className="text-[#A8A29E]">
                {importResult.created} created, {importResult.updated} updated,{" "}
                {importResult.skipped} skipped
              </p>
            </div>

            {/* Results Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#2D2926] rounded-xl p-4">
                <p className="text-sm text-[#A8A29E] mb-1">Created</p>
                <p className="text-2xl font-bold text-green-400">{importResult.created}</p>
              </div>
              <div className="bg-[#2D2926] rounded-xl p-4">
                <p className="text-sm text-[#A8A29E] mb-1">Updated</p>
                <p className="text-2xl font-bold text-blue-400">{importResult.updated}</p>
              </div>
              <div className="bg-[#2D2926] rounded-xl p-4">
                <p className="text-sm text-[#A8A29E] mb-1">Skipped</p>
                <p className="text-2xl font-bold text-[#A8A29E]">{importResult.skipped}</p>
              </div>
              <div className="bg-[#2D2926] rounded-xl p-4">
                <p className="text-sm text-[#A8A29E] mb-1">Errors</p>
                <p className="text-2xl font-bold text-red-400">{importResult.errors.length}</p>
              </div>
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <h4 className="text-sm font-medium text-red-400 mb-2">Errors</h4>
                <ul className="text-sm text-red-400/70 space-y-1">
                  {importResult.errors.slice(0, 10).map((err, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static sliced error list, never reordered or filtered; emails may repeat across error rows
                    <li key={i}>
                      {err.email}: {err.error}
                    </li>
                  ))}
                  {importResult.errors.length > 10 && (
                    <li>...and {importResult.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={resetImport}
                className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
              >
                Import More
              </button>
              <TenantLink
                href="/admin"
                className="px-4 py-2.5 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors"
              >
                Back to Admin
              </TenantLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
