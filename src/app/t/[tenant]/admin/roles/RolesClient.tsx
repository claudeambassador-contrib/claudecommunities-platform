"use client";

import { Check, Lock, Plus, Shield, Trash2, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { Permission } from "@/lib/permissions";

interface RoleSummary {
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  userCount: number;
}

interface Props {
  initialRoles: RoleSummary[];
  canEdit: boolean;
  canDelete: boolean;
  permissionCatalog: Record<Permission, string>;
  permissionGroups: { label: string; permissions: Permission[] }[];
  currentRoleName: string;
}

type EditorState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; role: RoleSummary };

export default function RolesClient({
  initialRoles,
  canEdit,
  canDelete,
  permissionCatalog,
  permissionGroups,
  currentRoleName,
}: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RoleSummary | null>(null);

  async function handleSave(payload: {
    name?: string;
    description: string;
    permissions: Permission[];
    existing?: RoleSummary;
  }) {
    setBusy(true);
    setError(null);
    try {
      const isEdit = !!payload.existing;
      const url = isEdit
        ? `/api/admin/roles/${encodeURIComponent(payload.existing?.name ?? "")}`
        : "/api/admin/roles";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { description: payload.description, permissions: payload.permissions }
            : {
                name: payload.name,
                description: payload.description,
                permissions: payload.permissions,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save role");
        return;
      }
      setRoles((prev) => {
        if (isEdit) {
          return prev.map((r) => (r.name === data.name ? data : r));
        }
        return [...prev, data].sort((a, b) => {
          if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      });
      setEditor({ mode: "closed" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(role: RoleSummary) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(role.name)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete role");
        return;
      }
      setRoles((prev) => prev.filter((r) => r.name !== role.name));
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Roles & Permissions</h1>
            <p className="text-sm text-[#A8A29E] mt-1">
              Define what each role can do, then assign roles to users from the Users page.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditor({ mode: "create" })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Role
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {roles.map((role) => (
            <div
              key={role.name}
              className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-5"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D4836A]/10 text-[#D4836A] flex items-center justify-center">
                    {role.isSystem ? <Lock className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{role.name}</h2>
                      {role.isSystem && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full bg-white/5 text-[#A8A29E]">
                          System
                        </span>
                      )}
                      {role.name === currentRoleName && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full bg-[#D4836A]/20 text-[#D4836A]">
                          Your role
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-sm text-[#A8A29E] mt-1">{role.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-[#78716C]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {role.userCount} {role.userCount === 1 ? "user" : "users"}
                      </span>
                      <span>•</span>
                      <span>
                        {role.permissions.length}{" "}
                        {role.permissions.length === 1 ? "permission" : "permissions"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditor({ mode: "edit", role })}
                      className="px-3 py-1.5 text-sm rounded-lg border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && !role.isSystem && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(role)}
                      disabled={busy || role.userCount > 0}
                      title={
                        role.userCount > 0 ? "Cannot delete: users still assigned" : "Delete role"
                      }
                      className="p-1.5 text-red-400 rounded-lg hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <PermissionSummary
                permissions={role.permissions}
                groups={permissionGroups}
                catalog={permissionCatalog}
              />
            </div>
          ))}
        </div>
      </div>

      {editor.mode !== "closed" && (
        <RoleEditor
          mode={editor.mode}
          existing={editor.mode === "edit" ? editor.role : undefined}
          groups={permissionGroups}
          catalog={permissionCatalog}
          busy={busy}
          onCancel={() => {
            setEditor({ mode: "closed" });
            setError(null);
          }}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete role "${pendingDelete?.name ?? ""}"?`}
        description="This cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={async () => {
          if (pendingDelete) await handleDelete(pendingDelete);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function PermissionSummary({
  permissions,
  groups,
  catalog,
}: {
  permissions: Permission[];
  groups: { label: string; permissions: Permission[] }[];
  catalog: Record<Permission, string>;
}) {
  const set = useMemo(() => new Set(permissions), [permissions]);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
      {groups.map((group) => {
        const granted = group.permissions.filter((p) => set.has(p));
        if (granted.length === 0) return null;
        return (
          <div key={group.label} className="text-xs">
            <div className="text-[#78716C] font-medium mb-1">{group.label}</div>
            <div className="flex flex-wrap gap-1">
              {granted.map((p) => (
                <span
                  key={p}
                  className="px-1.5 py-0.5 rounded bg-white/5 text-[#D4D4D8]"
                  title={catalog[p]}
                >
                  {p.split(".")[1]}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoleEditor({
  mode,
  existing,
  groups,
  catalog,
  busy,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  existing?: RoleSummary;
  groups: { label: string; permissions: Permission[] }[];
  catalog: Record<Permission, string>;
  busy: boolean;
  onCancel: () => void;
  onSave: (payload: {
    name?: string;
    description: string;
    permissions: Permission[];
    existing?: RoleSummary;
  }) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [permissions, setPermissions] = useState<Set<Permission>>(
    new Set(existing?.permissions ?? []),
  );

  const isLocked = existing?.name === "super_admin";

  function toggle(p: Permission) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function toggleGroup(group: { label: string; permissions: Permission[] }) {
    const all = group.permissions.every((p) => permissions.has(p));
    setPermissions((prev) => {
      const next = new Set(prev);
      for (const p of group.permissions) {
        if (all) next.delete(p);
        else next.add(p);
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2D2926] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">
            {mode === "create" ? "New Role" : `Edit role: ${existing?.name}`}
          </h2>
          <button type="button" onClick={onCancel} className="text-[#A8A29E] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {mode === "create" && (
            <div>
              <label htmlFor="role-name" className="block text-sm text-[#A8A29E] mb-1">
                Name
              </label>
              <input
                id="role-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ambassador, moderator"
                className="w-full bg-[#1C1917] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-[#57534E] focus:outline-none focus:border-[#D4836A]/50"
              />
              <p className="text-xs text-[#78716C] mt-1">
                Lowercase letters, digits, underscores. 2-32 characters.
              </p>
            </div>
          )}
          <div>
            <label htmlFor="role-description" className="block text-sm text-[#A8A29E] mb-1">
              Description
            </label>
            <textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[#1C1917] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-[#57534E] focus:outline-none focus:border-[#D4836A]/50 resize-none"
            />
          </div>

          {isLocked && (
            <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-[#A8A29E]">
              <Lock className="inline w-3.5 h-3.5 mr-1.5" />
              super_admin's permissions are locked and grant all access.
            </div>
          )}

          <div>
            <div className="text-sm text-[#A8A29E] mb-2">Permissions</div>
            <div className="space-y-3">
              {groups.map((group) => {
                const allSelected = group.permissions.every((p) => permissions.has(p));
                const someSelected = group.permissions.some((p) => permissions.has(p));
                return (
                  <div
                    key={group.label}
                    className="bg-[#1C1917] border border-white/[0.06] rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-white">{group.label}</div>
                      <button
                        type="button"
                        onClick={() => !isLocked && toggleGroup(group)}
                        disabled={isLocked}
                        className="text-xs text-[#D4836A] hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {allSelected ? "Clear all" : someSelected ? "Select all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {group.permissions.map((p) => {
                        const checked = permissions.has(p);
                        return (
                          <label
                            key={p}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                              isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center ${
                                checked ? "bg-[#D4836A] border-[#D4836A]" : "border-white/[0.15]"
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isLocked}
                              onChange={() => toggle(p)}
                              className="sr-only"
                            />
                            <span className="text-[#D4D4D8]">{p}</span>
                            <span className="text-xs text-[#78716C] truncate">— {catalog[p]}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-white/[0.06] flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-white/[0.1] text-white hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                name: mode === "create" ? name : undefined,
                description,
                permissions: Array.from(permissions),
                existing,
              })
            }
            disabled={busy || (mode === "create" && !name)}
            className="px-4 py-2 rounded-lg bg-[#D4836A] text-white hover:bg-[#c4775f] disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
