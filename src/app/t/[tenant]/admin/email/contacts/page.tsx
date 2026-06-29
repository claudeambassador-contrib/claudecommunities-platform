"use client";

import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Search,
  Tag,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Can } from "@/components/admin/Can";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  city: string | null;
  createdAt: string;
  lists: ContactList[];
}

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  _count?: { contacts: number };
}

interface ContactsResponse {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
}

export default function ContactsPage() {
  const config = useTenantConfig();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [updatingLists, setUpdatingLists] = useState(false);
  const pageSize = 25;

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(search && { search }),
        ...(activeListId && { listId: activeListId }),
      });
      const res = await fetch(`/api/admin/email/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const data: ContactsResponse = await res.json();
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [page, search, activeListId]);

  const fetchLists = async () => {
    try {
      const res = await fetch("/api/admin/email/contacts/lists");
      if (res.ok) {
        const data = await res.json();
        setLists(data);
      }
    } catch (err) {
      console.error("Failed to fetch lists:", err);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchLists is intentionally run once on mount; it has no reactive inputs that should re-trigger the fetch
  useEffect(() => {
    fetchLists();
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: search and activeListId are intentional triggers to reset pagination to page 1 when the filter changes, even though the effect body does not read them.
  useEffect(() => {
    setPage(1);
  }, [search, activeListId]);

  const totalPages = Math.ceil(total / pageSize);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const res = await fetch("/api/admin/email/contacts/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newListName.trim(),
          description: newListDescription.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create list");
      setShowNewListModal(false);
      setNewListName("");
      setNewListDescription("");
      fetchLists();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create list");
    } finally {
      setCreatingList(false);
    }
  };

  const handleListAction = async (listId: string, action: "add" | "remove", userId: string) => {
    setUpdatingLists(true);
    try {
      const res = await fetch(`/api/admin/email/contacts/lists/${listId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userIds: [userId] }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} contact`);
      // Refresh the selected contact's data
      await fetchContacts();
      if (selectedContact) {
        const updated = contacts.find((c) => c.id === selectedContact.id);
        if (updated) setSelectedContact(updated);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setUpdatingLists(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(config.lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#E7E5E4]">Contacts</h1>
            <p className="text-sm text-[#78716C] mt-1">
              {total.toLocaleString()} member{total !== 1 ? "s" : ""}
            </p>
          </div>
          <Can permission="email.edit">
            <button
              type="button"
              onClick={() => setShowNewListModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-xl hover:bg-[#c4775f] transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New List
            </button>
          </Can>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#2D2926] border border-white/[0.06] rounded-xl text-[#E7E5E4] placeholder-[#78716C] text-sm focus:outline-none focus:border-[#D4836A]/50"
          />
        </div>

        {/* List filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveListId(null)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              activeListId === null
                ? "bg-[#D4836A] text-white"
                : "bg-[#2D2926] text-[#78716C] hover:text-[#E7E5E4] border border-white/[0.06]"
            }`}
          >
            All Contacts
          </button>
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => setActiveListId(activeListId === list.id ? null : list.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-1.5 ${
                activeListId === list.id
                  ? "bg-[#D4836A] text-white"
                  : "bg-[#2D2926] text-[#78716C] hover:text-[#E7E5E4] border border-white/[0.06]"
              }`}
            >
              <Tag className="w-3 h-3" />
              {list.name}
              {list._count && <span className="text-xs opacity-70">({list._count.contacts})</span>}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Content area */}
        <div className="flex gap-6">
          {/* Table */}
          <div
            className={`flex-1 rounded-2xl border border-white/[0.06] bg-[#2D2926] overflow-hidden ${
              selectedContact ? "lg:max-w-[calc(100%-360px)]" : ""
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-[#D4836A] animate-spin" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#78716C]">
                <Users className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">No contacts found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-xs font-medium text-[#78716C] uppercase tracking-wider px-4 py-3">
                          Name
                        </th>
                        <th className="text-left text-xs font-medium text-[#78716C] uppercase tracking-wider px-4 py-3">
                          Email
                        </th>
                        <th className="text-left text-xs font-medium text-[#78716C] uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                          City
                        </th>
                        <th className="text-left text-xs font-medium text-[#78716C] uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                          Lists
                        </th>
                        <th className="text-left text-xs font-medium text-[#78716C] uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr
                          key={contact.id}
                          onClick={() =>
                            setSelectedContact(selectedContact?.id === contact.id ? null : contact)
                          }
                          className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition cursor-pointer ${
                            selectedContact?.id === contact.id ? "bg-white/[0.05]" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-sm text-[#E7E5E4]">
                            {contact.name || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#78716C]">
                            {contact.email || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#78716C] hidden md:table-cell">
                            {contact.city || "—"}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {contact.lists.length > 0 ? (
                                contact.lists.map((list) => (
                                  <span
                                    key={list.id}
                                    className="px-2 py-0.5 text-xs rounded-full bg-[#D4836A]/15 text-[#D4836A]"
                                  >
                                    {list.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-[#78716C]">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#78716C] hidden sm:table-cell">
                            {formatDate(contact.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                  <p className="text-xs text-[#78716C]">
                    Page {page} of {totalPages || 1}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition text-[#78716C]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-[#E7E5E4] min-w-[2rem] text-center">{page}</span>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition text-[#78716C]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Detail Panel */}
          {selectedContact && (
            <div className="hidden lg:block w-[340px] flex-shrink-0">
              <div className="rounded-2xl border border-white/[0.06] bg-[#2D2926] p-5 sticky top-[90px]">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setSelectedContact(null)}
                  className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/[0.05] text-[#78716C] transition"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* User info */}
                <div className="mb-5">
                  <div className="w-12 h-12 rounded-full bg-[#D4836A]/20 flex items-center justify-center mb-3">
                    <Users className="w-6 h-6 text-[#D4836A]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#E7E5E4]">
                    {selectedContact.name || "Unnamed Contact"}
                  </h3>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-[#78716C]" />
                    <span className="text-[#78716C]">{selectedContact.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-[#78716C]" />
                    <span className="text-[#78716C]">{selectedContact.city || "No city"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-[#78716C]" />
                    <span className="text-[#78716C]">
                      Joined {formatDate(selectedContact.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Lists section */}
                <div className="border-t border-white/[0.06] pt-4">
                  <h4 className="text-xs font-medium text-[#78716C] uppercase tracking-wider mb-3">
                    Lists
                  </h4>

                  {/* Current lists */}
                  {selectedContact.lists.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {selectedContact.lists.map((list) => (
                        <div
                          key={list.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]"
                        >
                          <span className="text-sm text-[#E7E5E4]">{list.name}</span>
                          <Can permission="email.edit">
                            <button
                              type="button"
                              onClick={() =>
                                handleListAction(list.id, "remove", selectedContact.id)
                              }
                              disabled={updatingLists}
                              className="p-1 rounded hover:bg-red-500/10 text-[#78716C] hover:text-red-400 transition"
                              title="Remove from list"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </Can>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#78716C] mb-4">Not in any lists</p>
                  )}

                  {/* Add to list */}
                  {lists.filter((l) => !selectedContact.lists.some((cl) => cl.id === l.id)).length >
                    0 && (
                    <Can permission="email.edit">
                      <h5 className="text-xs text-[#78716C] mb-2">Add to list</h5>
                      <div className="space-y-1">
                        {lists
                          .filter((l) => !selectedContact.lists.some((cl) => cl.id === l.id))
                          .map((list) => (
                            <button
                              key={list.id}
                              type="button"
                              onClick={() => handleListAction(list.id, "add", selectedContact.id)}
                              disabled={updatingLists}
                              className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-white/[0.03] transition text-left group"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-[#78716C] group-hover:text-[#D4836A] transition" />
                              <span className="text-sm text-[#78716C] group-hover:text-[#E7E5E4] transition">
                                {list.name}
                              </span>
                            </button>
                          ))}
                      </div>
                    </Can>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-white/[0.06] bg-[#2D2926] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#E7E5E4]">Create New List</h2>
              <button
                type="button"
                onClick={() => setShowNewListModal(false)}
                className="p-1 rounded-lg hover:bg-white/[0.05] text-[#78716C] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="new-list-name" className="block text-sm text-[#78716C] mb-1.5">
                  List Name
                </label>
                <input
                  id="new-list-name"
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Newsletter Subscribers"
                  className="w-full px-3 py-2.5 bg-[#1C1917] border border-white/[0.06] rounded-xl text-[#E7E5E4] placeholder-[#78716C] text-sm focus:outline-none focus:border-[#D4836A]/50"
                />
              </div>
              <div>
                <label
                  htmlFor="new-list-description"
                  className="block text-sm text-[#78716C] mb-1.5"
                >
                  Description
                </label>
                <input
                  id="new-list-description"
                  type="text"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2.5 bg-[#1C1917] border border-white/[0.06] rounded-xl text-[#E7E5E4] placeholder-[#78716C] text-sm focus:outline-none focus:border-[#D4836A]/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowNewListModal(false)}
                className="px-4 py-2 text-sm text-[#78716C] hover:text-[#E7E5E4] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateList}
                disabled={!newListName.trim() || creatingList}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-xl hover:bg-[#c4775f] transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingList && <Loader2 className="w-4 h-4 animate-spin" />}
                Create List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
