"use client";

import { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, Loader2, KeyRound, X, Save } from "lucide-react";

interface WorldBook {
  id: string;
  name: string;
  description: string;
}

interface Entry {
  id: string;
  keys: string;
  content: string;
  insertionOrder: number;
  enabled: boolean;
  priority: number;
  position: string;
}

export default function WorldBooksManager() {
  const [books, setBooks] = useState<WorldBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bookLoading, setBookLoading] = useState(false);

  // New book form
  const [newBookName, setNewBookName] = useState("");
  const [newBookDesc, setNewBookDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // New entry form
  const [entryKeys, setEntryKeys] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [entryPriority, setEntryPriority] = useState(10);
  const [entryPosition, setEntryPosition] = useState("before_char");

  const fetchBooks = async () => {
    try {
      const res = await fetch("/api/worldbooks");
      const data = await res.json();
      setBooks(data.books || []);
    } catch {
      setError("Failed to load world books");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const openBook = async (id: string) => {
    setActiveBookId(id);
    setBookLoading(true);
    try {
      const res = await fetch(`/api/worldbooks/${id}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setError("Failed to load book");
    } finally {
      setBookLoading(false);
    }
  };

  const createBook = async () => {
    if (!newBookName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/worldbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBookName.trim(), description: newBookDesc.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewBookName("");
        setNewBookDesc("");
        await fetchBooks();
      }
    } catch {
      setError("Failed to create book");
    } finally {
      setCreating(false);
    }
  };

  const deleteBook = async (id: string) => {
    if (!confirm("Delete this world book and all its entries?")) return;
    try {
      await fetch(`/api/worldbooks?id=${id}`, { method: "DELETE" });
      if (activeBookId === id) {
        setActiveBookId(null);
        setEntries([]);
      }
      await fetchBooks();
    } catch {
      setError("Failed to delete book");
    }
  };

  const addEntry = async () => {
    if (!activeBookId || !entryContent.trim()) return;
    try {
      const keys = entryKeys
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch(`/api/worldbooks/${activeBookId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys, content: entryContent.trim(), priority: entryPriority, position: entryPosition }),
      });
      const data = await res.json();
      if (data.success) {
        setEntryKeys("");
        setEntryContent("");
        setEntryPriority(10);
        await openBook(activeBookId);
      }
    } catch {
      setError("Failed to add entry");
    }
  };

  const removeEntry = async (entryId: string) => {
    if (!activeBookId) return;
    try {
      await fetch(`/api/worldbooks/${activeBookId}?entryId=${entryId}`, { method: "DELETE" });
      await openBook(activeBookId);
    } catch {
      setError("Failed to delete entry");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={18} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* New book form */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[var(--color-accent-glow)]" />
          <h3 className="font-semibold text-sm">Create world book</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newBookName}
            onChange={(e) => setNewBookName(e.target.value)}
            placeholder="Book name (e.g. 'Aetherian Empire Lore')"
            className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={newBookDesc}
            onChange={(e) => setNewBookDesc(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={createBook}
            disabled={creating || !newBookName.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors disabled:opacity-40"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Create
          </button>
        </div>
      </div>

      {/* Book list */}
      {books.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <BookOpen size={20} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
          <p className="text-xs text-[var(--color-text-muted)]">
            No world books yet. Books hold lore entries that inject background knowledge
            when keywords appear in roleplay.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {books.map((book) => (
            <div key={book.id} className="glass-card overflow-hidden">
              <button
                onClick={() => openBook(book.id)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-muted)] flex items-center justify-center shrink-0">
                  <BookOpen size={14} className="text-[var(--color-accent-glow)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{book.name}</span>
                  {book.description && (
                    <span className="block text-[11px] text-[var(--color-text-muted)] truncate">
                      {book.description}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBook(book.id);
                  }}
                  className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </button>

              {/* Entries for active book */}
              {activeBookId === book.id && (
                <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-bg-base)]/50">
                  {bookLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={14} className="animate-spin text-[var(--color-text-muted)]" />
                    </div>
                  ) : (
                    <>
                      {/* Entry list */}
                      <div className="space-y-2 mb-3">
                        {entries.length === 0 && (
                          <p className="text-[11px] text-[var(--color-text-muted)] py-2">
                            No entries yet. Add lore with keywords below.
                          </p>
                        )}
                        {entries.map((e) => {
                          let keys: string[] = [];
                          try {
                            keys = JSON.parse(e.keys || "[]");
                          } catch {}
                          return (
                            <div key={e.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)]">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {keys.slice(0, 4).map((k, i) => (
                                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-teal-muted)] text-[var(--color-teal)] font-mono">
                                      {k}
                                    </span>
                                  ))}
                                  <span className="text-[9px] text-[var(--color-text-muted)]">
                                    priority {e.priority} · {e.position}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2">
                                  {e.content}
                                </p>
                              </div>
                              <button
                                onClick={() => removeEntry(e.id)}
                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] shrink-0"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add entry form */}
                      <div className="space-y-2">
                        <input
                          value={entryKeys}
                          onChange={(e) => setEntryKeys(e.target.value)}
                          placeholder="Trigger keywords, comma-separated (e.g. aether, empire, mage)"
                          className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <textarea
                          value={entryContent}
                          onChange={(e) => setEntryContent(e.target.value)}
                          placeholder="Lore content injected when keywords appear…"
                          rows={2}
                          className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={entryPriority}
                            onChange={(e) => setEntryPriority(Number(e.target.value))}
                            className="w-20 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                            title="Priority (higher = injected first)"
                          />
                          <select
                            value={entryPosition}
                            onChange={(e) => setEntryPosition(e.target.value)}
                            className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                          >
                            <option value="before_char">Before character</option>
                            <option value="after_char">After character</option>
                          </select>
                          <button
                            onClick={addEntry}
                            disabled={!entryContent.trim()}
                            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-teal-muted)] text-[var(--color-teal)] text-[11px] font-medium hover:bg-[var(--color-teal)] hover:text-[var(--color-bg-deep)] transition-colors disabled:opacity-40"
                          >
                            <Save size={11} />
                            Add entry
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
