"use client";

import {
  Award,
  Ban,
  CheckCircle,
  MoreHorizontal,
  RefreshCw,
  Search,
  Shield,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isBanned: boolean;
  createdAt: string;
  _count: {
    posts: number;
    comments: number;
  };
  userBadges: {
    badge: {
      id: string;
      name: string;
      color: string | null;
    };
  }[];
}

interface RoleOption {
  name: string;
  description: string | null;
}

export default function AdminUsersPage() {
  const config = useTenantConfig();
  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingUnban, setPendingUnban] = useState<UserData | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<UserData | null>(null);
  const [pendingRoleName, setPendingRoleName] = useState<string>("");
  const [pageError, setPageError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchUsers/fetchRoles are stable mount-only fetchers; including them would re-fire on every render
  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/admin/roles/names");
      if (res.ok) {
        setRoles(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  };

  const handleSyncNames = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/admin/sync-users", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Synced ${data.synced} user names`);
        fetchUsers();
      } else {
        setSyncMessage(data.error || "Failed to sync");
      }
    } catch (error) {
      console.error("Failed to sync users:", error);
      setSyncMessage("Failed to sync users");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const submitRoleChange = async (user: UserData, newRole: string) => {
    if (newRole === user.role) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
        setRoleChangeTarget(null);
        setActionMenu(null);
        setMenuPosition(null);
      } else {
        setPageError(data.error || "Failed to update user role");
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      setPageError("Failed to update user role");
    }
  };

  const handleBanUser = async () => {
    if (!selectedUser) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.map((u) => (u.id === selectedUser.id ? { ...u, isBanned: true } : u)));
        setShowBanModal(false);
        setSelectedUser(null);
        setBanReason("");
      } else {
        setPageError(data.error || "Failed to ban user");
      }
    } catch (error) {
      console.error("Failed to ban user:", error);
      setPageError("Failed to ban user");
    }
  };

  const handleUnbanUser = async (user: UserData) => {
    setPageError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/unban`, {
        method: "POST",
      });
      if (res.ok) {
        setUsers(users.map((u) => (u.id === user.id ? { ...u, isBanned: false } : u)));
        setPendingUnban(null);
        setActionMenu(null);
        setMenuPosition(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setPageError(data.error || "Failed to unban user");
      }
    } catch (error) {
      console.error("Failed to unban user:", error);
      setPageError("Failed to unban user");
    }
  };

  const roleNamesInUse = useMemo(() => {
    const set = new Set<string>(users.map((u) => u.role));
    for (const r of roles) set.add(r.name);
    return Array.from(set).sort();
  }, [users, roles]);

  const filteredUsers = users.filter((user) => {
    if (search) {
      const s = search.toLowerCase();
      if (!user.name?.toLowerCase().includes(s) && !user.email?.toLowerCase().includes(s)) {
        return false;
      }
    }
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    if (statusFilter === "active" && user.isBanned) return false;
    if (statusFilter === "banned" && !user.isBanned) return false;
    return true;
  });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(config.lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mb-8">
          {syncMessage && <span className="text-sm text-[#A8A29E]">{syncMessage}</span>}
          <Can permission="users.sync">
            <button
              type="button"
              onClick={handleSyncNames}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D2926] border border-white/[0.06] rounded-lg text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Names from Clerk"}
            </button>
          </Can>
        </div>

        {pageError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
            {pageError}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#78716C]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-[#2D2926] border border-white/[0.06] rounded-xl pl-12 pr-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#2D2926] border border-white/[0.06] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D4836A]/50"
          >
            <option value="all">All Roles</option>
            {roleNamesInUse.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "banned")}
            className="bg-[#2D2926] border border-white/[0.06] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D4836A]/50"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
            <p className="text-[#78716C]">No users found.</p>
          </div>
        ) : (
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">User</th>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">Role</th>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">
                    Status
                  </th>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">
                    Activity
                  </th>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">
                    Joined
                  </th>
                  <th className="text-right px-5 py-4 text-sm font-semibold text-[#A8A29E]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] ${
                      user.isBanned ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#D4836A] flex items-center justify-center text-white font-bold">
                          {user.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-white">{user.name || "Unnamed"}</p>
                          <p className="text-sm text-[#78716C]">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                          user.role === "member"
                            ? "bg-white/[0.05] text-[#A8A29E]"
                            : "bg-[#D4836A]/20 text-[#D4836A]"
                        }`}
                      >
                        {user.role !== "member" && <Shield className="w-3 h-3" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {user.isBanned ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400">
                          <Ban className="w-3 h-3" />
                          Banned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[#A8A29E]">
                        {user._count.posts} posts, {user._count.comments} comments
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[#78716C]">{formatDate(user.createdAt)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-block">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (actionMenu === user.id) {
                              setActionMenu(null);
                              setMenuPosition(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPosition({
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                              });
                              setActionMenu(user.id);
                            }
                          }}
                          className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {actionMenu === user.id && menuPosition && (
                          <>
                            <button
                              type="button"
                              aria-label="Close menu"
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={() => {
                                setActionMenu(null);
                                setMenuPosition(null);
                              }}
                            />
                            <div
                              className="fixed w-52 bg-[#1C1917] rounded-lg border border-white/[0.1] shadow-xl z-50"
                              style={{ top: menuPosition.top, right: menuPosition.right }}
                            >
                              <TenantLink
                                href={`/community/profile/${user.id}`}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                              >
                                <User className="w-4 h-4" />
                                View Profile
                              </TenantLink>
                              <Can permission="users.assign_role">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRoleChangeTarget(user);
                                    setPendingRoleName(user.role);
                                    setActionMenu(null);
                                    setMenuPosition(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                                >
                                  <Shield className="w-4 h-4" />
                                  Change Role…
                                </button>
                              </Can>
                              <Can permission="badges.edit">
                                <TenantLink
                                  href={`/admin/badges?user=${user.id}`}
                                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                                >
                                  <Award className="w-4 h-4" />
                                  Manage Badges
                                </TenantLink>
                              </Can>
                              <Can permission="users.edit">
                                <hr className="border-white/[0.06] my-1" />
                                {user.isBanned ? (
                                  <button
                                    type="button"
                                    onClick={() => setPendingUnban(user)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-green-400 hover:bg-green-500/10 transition-colors"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Unban User
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setShowBanModal(true);
                                      setActionMenu(null);
                                      setMenuPosition(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                  >
                                    <Ban className="w-4 h-4" />
                                    Ban User
                                  </button>
                                )}
                              </Can>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ban Modal */}
        {showBanModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#2D2926] rounded-2xl max-w-md w-full overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Ban className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Ban User</h2>
                    <p className="text-sm text-[#78716C]">
                      {selectedUser.name || selectedUser.email}
                    </p>
                  </div>
                </div>

                <p className="text-[#A8A29E] text-sm mb-4">
                  This will prevent the user from logging in and accessing the community. Their
                  content will remain visible but they won&apos;t be able to create new posts or
                  comments.
                </p>

                <div className="mb-6">
                  <label htmlFor="ban-reason" className="block text-sm text-[#A8A29E] mb-2">
                    Reason for ban (optional)
                  </label>
                  <textarea
                    id="ban-reason"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Enter reason..."
                    rows={3}
                    className="w-full bg-[#1C1917] border border-white/[0.06] rounded-lg px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBanModal(false);
                      setSelectedUser(null);
                      setBanReason("");
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBanUser}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Ban User
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Change Role Modal */}
        {roleChangeTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#2D2926] rounded-2xl max-w-md w-full overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Change Role</h2>
                <p className="text-sm text-[#78716C] mb-4">
                  {roleChangeTarget.name || roleChangeTarget.email}
                </p>

                <label htmlFor="role-select" className="block text-sm text-[#A8A29E] mb-2">
                  Role
                </label>
                <select
                  id="role-select"
                  value={pendingRoleName}
                  onChange={(e) => setPendingRoleName(e.target.value)}
                  className="w-full bg-[#1C1917] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#D4836A]/50"
                >
                  {roles.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                      {r.description ? ` — ${r.description}` : ""}
                    </option>
                  ))}
                </select>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setRoleChangeTarget(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => submitRoleChange(roleChangeTarget, pendingRoleName)}
                    disabled={!pendingRoleName || pendingRoleName === roleChangeTarget.role}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!pendingUnban}
          title={`Unban "${pendingUnban?.name || pendingUnban?.email || ""}"?`}
          description="The user will regain access immediately."
          confirmLabel="Unban"
          onConfirm={async () => {
            if (pendingUnban) await handleUnbanUser(pendingUnban);
          }}
          onCancel={() => setPendingUnban(null)}
        />
      </div>
    </div>
  );
}
