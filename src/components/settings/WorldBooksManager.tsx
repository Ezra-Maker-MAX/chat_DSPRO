"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  BookOpen, Plus, Trash2, Loader2, KeyRound, X, Save, Sparkles,
  Edit3, ToggleLeft, ToggleRight, Zap, Eye, EyeOff,
  ChevronDown, ChevronUp, Copy, Check,
} from "lucide-react";

interface WorldBook {
  id: string;
  name: string;
  description: string;
  scanDepth?: number;
}

interface Entry {
  id: string;
  keys: string;
  secondaryKeys?: string;
  selectiveLogic?: string | null;
  content: string;
  constant: boolean;
  caseSensitive: boolean;
  insertionOrder: number;
  enabled: boolean;
  priority: number;
  position: string;
  tokenBudget: number;
}

const EMPTY_ENTRY = {
  keys: "",
  secondaryKeys: "",
  selectiveLogic: null as string | null,
  content: "",
  constant: false,
  caseSensitive: false,
  priority: 10,
  position: "before_char",
  tokenBudget: -1,
};

export default function WorldBooksManager() {
  const { t, locale } = useI18n();
  const [books, setBooks] = useState<WorldBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // AI-assisted world book creation
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState<{
    book: { name: string; description: string };
    entries: { keys: string[]; secondaryKeys?: string[]; content: string }[];
  } | null>(null);

  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bookLoading, setBookLoading] = useState(false);

  // New book form
  const [newBookName, setNewBookName] = useState("");
  const [newBookDesc, setNewBookDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Entry form (create or edit)
  const [entryForm, setEntryForm] = useState({ ...EMPTY_ENTRY });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true); // 前端偏好：默认展开，CONST / token 预算等常用开关露在外面，少一次点击
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Per-book scan depth
  const [bookScanDepth, setBookScanDepth] = useState(6000);

  const fetchBooks = async () => {
    try {
      const res = await fetch("/api/worldbooks");
      const data = await res.json();
      setBooks(data.books || []);
    } catch {
      setError(t("wb.error.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openBook = async (id: string) => {
    setActiveBookId(id);
    setBookLoading(true);
    try {
      const res = await fetch(`/api/worldbooks/${id}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setBookScanDepth(data.scanDepth || 6000);
    } catch {
      setError(t("wb.error.load"));
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
      setError(t("wb.error.create"));
    } finally {
      setCreating(false);
    }
  };

  const deleteBook = async (id: string) => {
    if (!confirm(t("wb.delete.confirm"))) return;
    try {
      await fetch(`/api/worldbooks?id=${id}`, { method: "DELETE" });
      if (activeBookId === id) {
        setActiveBookId(null);
        setEntries([]);
      }
      await fetchBooks();
    } catch {
      setError(t("wb.error.delete"));
    }
  };

  const generateBook = async () => {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError("");
    setAiResult(null);
    try {
      const res = await fetch("/api/worldbooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim(), locale }),
      });
      const data = await res.json();
      if (!res.ok || !data.book) {
        setAiError(data.error || t("aigen.error"));
        return;
      }
      setAiResult({ book: data.book, entries: Array.isArray(data.entries) ? data.entries : [] });
    } catch {
      setAiError(t("aigen.error"));
    } finally {
      setAiBusy(false);
    }
  };

  const commitAiBook = async () => {
    if (!aiResult || aiBusy) return;
    setAiBusy(true);
    setAiError("");
    try {
      // 1) Create the book container
      const res = await fetch("/api/worldbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: aiResult.book.name,
          description: aiResult.book.description,
        }),
      });
      const data = await res.json();
      const bookId = data.success ? data.id : null;
      if (!bookId) {
        setAiError(t("wb.error.create"));
        return;
      }
      // 2) Create each generated entry
      for (const e of aiResult.entries) {
        await fetch(`/api/worldbooks/${bookId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...e }),
        }).catch(() => {});
      }
      setAiOpen(false);
      setAiResult(null);
      setAiPrompt("");
      await fetchBooks();
      await openBook(bookId);
    } catch {
      setAiError(t("wb.error.create"));
    } finally {
      setAiBusy(false);
    }
  };

  const resetForm = () => {
    setEntryForm({ ...EMPTY_ENTRY });
    setEditingEntryId(null);
    setShowAdvanced(true); // 保持展开，避免每次保存后又折叠
  };

  const saveEntry = async () => {
    if (!activeBookId || !entryForm.content.trim()) return;
    setSaving(true);
    try {
      const keys = entryForm.keys
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const secKeys = entryForm.secondaryKeys
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        keys,
        content: entryForm.content.trim(),
        priority: entryForm.priority,
        position: entryForm.position,
        constant: entryForm.constant,
        caseSensitive: entryForm.caseSensitive,
        tokenBudget: entryForm.tokenBudget,
      };
      if (secKeys.length > 0) body.secondaryKeys = secKeys;
      if (entryForm.selectiveLogic) body.selectiveLogic = entryForm.selectiveLogic;

      const url = editingEntryId
        ? `/api/worldbooks/${activeBookId}`
        : `/api/worldbooks/${activeBookId}`;

      // For edit, we pass entryId in the body; the backend's saveWorldBookEntry handles it
      if (editingEntryId) body.entryId = editingEntryId;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        resetForm();
        await openBook(activeBookId);
      }
    } catch {
      setError(t("wb.error.add"));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (e: Entry) => {
    let keysArr: string[] = [];
    try { keysArr = JSON.parse(e.keys || "[]"); } catch {}
    let secArr: string[] = [];
    try { secArr = JSON.parse((e.secondaryKeys as string) || "[]"); } catch {}

    setEntryForm({
      keys: keysArr.join(", "),
      secondaryKeys: secArr.join(", "),
      selectiveLogic: e.selectiveLogic || null,
      content: e.content,
      constant: e.constant,
      caseSensitive: e.caseSensitive,
      priority: e.priority,
      position: e.position || "before_char",
      tokenBudget: e.tokenBudget ?? -1,
    });
    setEditingEntryId(e.id);
    setExpandedEntryId(e.id);
    setShowAdvanced(true);
  };

  const removeEntry = async (entryId: string) => {
    if (!activeBookId) return;
    try {
      await fetch(`/api/worldbooks/${activeBookId}?entryId=${entryId}`, { method: "DELETE" });
      if (editingEntryId === entryId) resetForm();
      if (expandedEntryId === entryId) setExpandedEntryId(null);
      await openBook(activeBookId);
    } catch {
      setError(t("wb.error.deleteEntry"));
    }
  };

  const copyContent = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }, []);

  // ── Render helpers ──

  const parseKeys = (raw: string): string[] => {
    try { return JSON.parse(raw || "[]"); } catch { return []; }
  };

  const EntryBadge = ({ children, color = "default" }: { children: React.ReactNode; color?: string }) => {
    const colors: Record<string, string> = {
      default: "bg-[var(--color-teal-muted)] text-[var(--color-teal)]",
      constant: "bg-blue-500/15 text-blue-400",
      secondary: "bg-amber-500/15 text-amber-400",
      and: "bg-emerald-500/15 text-emerald-400",
      not: "bg-red-500/15 text-red-400",
    };
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${colors[color] || colors.default}`}>
        {children}
      </span>
    );
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

      {/* ═══════ Create World Book ═══════ */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[var(--color-accent-glow)]" />
            <h3 className="font-semibold text-sm">{t("wb.create")}</h3>
          </div>
          <button
            onClick={() => { setAiOpen(true); setAiError(""); setAiResult(null); }}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-accent-glow)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
            title={t("aigen.title")}
          >
            <Sparkles size={12} />
            {t("aigen.title")}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newBookName}
            onChange={(e) => setNewBookName(e.target.value)}
            placeholder={t("wb.name.ph")}
            className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={newBookDesc}
            onChange={(e) => setNewBookDesc(e.target.value)}
            placeholder={t("wb.desc.ph")}
            className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={createBook}
            disabled={creating || !newBookName.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors disabled:opacity-40"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {t("wb.createBtn")}
          </button>
        </div>
      </div>

      {/* ═══════ Book List ═══════ */}
      {books.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <BookOpen size={20} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("wb.empty.title")} {t("wb.empty.hint")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {books.map((book) => {
            const isActive = activeBookId === book.id;
            return (
              <div key={book.id} className="glass-card overflow-hidden">
                {/* Book header row */}
                <button
                  onClick={() => isActive ? setActiveBookId(null) : openBook(book.id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-[var(--color-accent)]" : "bg-[var(--color-accent-muted)]"}`}>
                    <BookOpen size={14} className={isActive ? "text-white" : "text-[var(--color-accent-glow)]"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{book.name}</span>
                    {book.description && (
                      <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{book.description}</span>
                    )}
                  </div>
                  {/* Entry count badge */}
                  {isActive && entries.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-teal-muted)] text-[var(--color-teal)] font-medium">
                      {entries.filter(e => e.enabled).length}/{entries.length} {t("wb.entries")}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </button>

                {/* ═══ Entries panel ═══ */}
                {isActive && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-base)]/50">
                    {bookLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={14} className="animate-spin text-[var(--color-text-muted)]" />
                      </div>
                    ) : (
                      <>
                        {/* Scan depth setting */}
                        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
                          <label className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">
                            {t("wb.scanDepth", { n: bookScanDepth })}
                          </label>
                          <input
                            type="range"
                            min={500}
                            max={20000}
                            step={500}
                            value={bookScanDepth}
                            onChange={(e) => setBookScanDepth(Number(e.target.value))}
                            className="flex-1 h-1 accent-[var(--color-accent)]"
                          />
                        </div>

                        {/* Entry list */}
                        <div className="space-y-1.5 px-4 pb-2 max-h-[360px] overflow-y-auto">
                          {entries.length === 0 && (
                            <p className="text-[11px] text-[var(--color-text-muted)] py-3 text-center">
                              {t("wb.noEntries")}
                            </p>
                          )}
                          {entries.map((e) => {
                            const keys = parseKeys(e.keys);
                            const secKeys = parseKeys((e.secondaryKeys as string) || "");
                            const isExpanded = expandedEntryId === e.id;
                            const isEditing = editingEntryId === e.id;

                            return (
                              <div
                                key={e.id}
                                className={`rounded-lg border transition-all ${
                                  e.enabled
                                    ? "bg-[var(--color-bg-input)] border-[var(--color-border)]"
                                    : "bg-[var(--color-bg-input)]/40 border-[var(--color-border)]/50 opacity-50"
                                } ${isExpanded ? "ring-1 ring-[var(--color-accent)]/30" : ""}`}
                              >
                                {/* Entry summary bar */}
                                <div
                                  className="flex items-start gap-2 p-2.5 cursor-pointer"
                                  onClick={() => setExpandedEntryId(isExpanded ? null : e.id)}
                                >
                                  {/* Status icon */}
                                  <div className="mt-0.5 shrink-0">
                                    {e.constant ? (
                                      <Zap size={12} className="text-blue-400" />
                                    ) : e.enabled ? (
                                      <KeyRound size={12} className="text-[var(--color-teal)]" />
                                    ) : (
                                      <EyeOff size={11} className="text-[var(--color-text-muted)]" />
                                    )}
                                  </div>

                                  {/* Content preview + badges */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      {e.constant && <EntryBadge color="constant">CONST</EntryBadge>}
                                      {keys.slice(0, 3).map((k, i) => (
                                        <EntryBadge key={i}>{k}</EntryBadge>
                                      ))}
                                      {keys.length > 3 && (
                                        <EntryBadge>+{keys.length - 3}</EntryBadge>
                                      )}
                                      {secKeys.length > 0 && (
                                        <EntryBadge color="secondary">AND:{secKeys[0]}</EntryBadge>
                                      )}
                                      {e.selectiveLogic === "AND" && <EntryBadge color="and">AND</EntryBadge>}
                                      {e.selectiveLogic === "NOT" && <EntryBadge color="not">NOT</EntryBadge>}
                                      {!e.caseSensitive && <EntryBadge>ci</EntryBadge>}
                                    </div>
                                    <p className={`text-[11px] text-[var(--color-text-secondary)] ${isExpanded ? "" : "line-clamp-1"}`}>
                                      {e.content || "(empty)"}
                                    </p>
                                  </div>

                                  {/* Action buttons */}
                                  <div className="flex items-center gap-0.5 shrink-0" onClick={(ev) => ev.stopPropagation()}>
                                    <button
                                      onClick={() => copyContent(e.id, e.content)}
                                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                                      title={t("wb.copy") || "Copy"}
                                    >
                                      {copiedId === e.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                                    </button>
                                    <button
                                      onClick={() => startEdit(e)}
                                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent-glow)] hover:bg-[var(--color-bg-hover)]"
                                      title={t("wb.edit") || "Edit"}
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      onClick={() => removeEntry(e.id)}
                                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)]"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded editor (when editing this entry) */}
                                {isExpanded && isEditing && (
                                  <div className="border-t border-[var(--color-border)] p-3 space-y-2 bg-[var(--color-bg-deep)]/30">
                                    {/* Primary keys */}
                                    <div>
                                      <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">
                                        <KeyRound size={10} className="inline mr-1" />
                                        {t("wb.keys.ph")}
                                      </label>
                                      <input
                                        value={entryForm.keys}
                                        onChange={(e) => setEntryForm(f => ({ ...f, keys: e.target.value }))}
                                        placeholder="magic, spell, 魔法 (comma separated)"
                                        className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                                      />
                                    </div>

                                    {/* Content */}
                                    <textarea
                                      value={entryForm.content}
                                      onChange={(e) => setEntryForm(f => ({ ...f, content: e.target.value }))}
                                      placeholder={t("wb.content.ph")}
                                      rows={3}
                                      className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-[var(--color-accent)]"
                                    />

                                    {/* Basic options row */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={entryForm.priority}
                                        onChange={(e) => setEntryForm(f => ({ ...f, priority: Number(e.target.value) }))}
                                        className="w-16 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                        title={t("wb.priorityPh") || "Priority (higher = first)"}
                                      />
                                      <select
                                        value={entryForm.position}
                                        onChange={(e) => setEntryForm(f => ({ ...f, position: e.target.value }))}
                                        className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                      >
                                        <option value="before_char">{t("wb.before")}</option>
                                        <option value="after_char">{t("wb.after")}</option>
                                      </select>

                                      {/* Constant toggle */}
                                      <button
                                        onClick={() => setEntryForm(f => ({ ...f, constant: !f.constant }))}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                          entryForm.constant
                                            ? "bg-blue-500/15 text-blue-400"
                                            : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
                                        }`}
                                        title={t("wb.constantPh") || "Always inject (blue light)"}
                                      >
                                        {entryForm.constant ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                        CONST
                                      </button>

                                      {/* Case sensitivity toggle */}
                                      <button
                                        onClick={() => setEntryForm(f => ({ ...f, caseSensitive: !f.caseSensitive }))}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                          entryForm.caseSensitive
                                            ? "bg-amber-500/15 text-amber-400"
                                            : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
                                        }`}
                                        title={t("wb.casePh") || "Case sensitive match"}
                                      >
                                        {entryForm.caseSensitive ? <Eye size={12} /> : <EyeOff size={12} />}
                                        Aa
                                      </button>

                                      {/* Advanced toggle */}
                                      <button
                                        onClick={() => setShowAdvanced(s => !s)}
                                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                                      >
                                        {showAdvanced ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                        {t("wb.advanced") || "Advanced"}
                                      </button>
                                    </div>

                                    {/* Advanced options */}
                                    {showAdvanced && (
                                      <div className="space-y-2 pl-2 border-l-2 border-[var(--color-border)]">
                                        {/* Secondary keys */}
                                        <div>
                                          <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">
                                            {t("wb.secKeysPh") || "Secondary keys (for AND / NOT logic)"}
                                          </label>
                                          <input
                                            value={entryForm.secondaryKeys}
                                            onChange={(e) => setEntryForm(f => ({ ...f, secondaryKeys: e.target.value }))}
                                            placeholder="dragon, enemy (must also appear)"
                                            className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                                          />
                                        </div>

                                        {/* Selective logic */}
                                        <div className="flex items-center gap-2">
                                          <label className="text-[10px] text-[var(--color-text-muted)]">
                                            {t("wb.logicPh") || "Selective logic:"}
                                          </label>
                                          <select
                                            value={entryForm.selectiveLogic || ""}
                                            onChange={(e) => setEntryForm(f => ({
                                              ...f,
                                              selectiveLogic: e.target.value || null,
                                            }))}
                                            className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                          >
                                            <option value="">OR (any key)</option>
                                            <option value="AND">AND (all sec. keys)</option>
                                            <option value="NOT">NOT (no sec. key)</option>
                                          </select>
                                        </div>

                                        {/* Token budget */}
                                        <div className="flex items-center gap-2">
                                          <label className="text-[10px] text-[var(--color-text-muted)]">
                                            {t("wb.budgetPh") || "Token budget (-1=unlimited):"}
                                          </label>
                                          <input
                                            type="number"
                                            min={-1}
                                            max={8000}
                                            value={entryForm.tokenBudget}
                                            onChange={(e) => setEntryForm(f => ({ ...f, tokenBudget: Number(e.target.value) }))}
                                            className="w-20 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Save / Cancel */}
                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        onClick={resetForm}
                                        className="px-3 py-1.5 rounded-lg text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                      >
                                        {t("wb.cancel") || "Cancel"}
                                      </button>
                                      <button
                                        onClick={saveEntry}
                                        disabled={saving || !entryForm.content.trim()}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-teal-muted)] text-[var(--color-teal)] text-[11px] font-medium hover:bg-[var(--color-teal)] hover:text-[var(--color-bg-deep)] transition-colors disabled:opacity-40"
                                      >
                                        {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                        {editingEntryId ? (t("wb.updateBtn") || "Update") : t("wb.addEntry")}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Add new entry form (when not editing) */}
                        {editingEntryId === null && (
                          <div className="border-t border-[var(--color-border)] p-3 space-y-2 bg-[var(--color-bg-deep)]/20">
                            <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                              <Plus size={11} />
                              {t("wb.newEntry") || "Add new entry"}
                            </div>
                            <input
                              value={entryForm.keys}
                              onChange={(e) => setEntryForm(f => ({ ...f, keys: e.target.value }))}
                              placeholder={t("wb.keys.ph")}
                              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <textarea
                              value={entryForm.content}
                              onChange={(e) => setEntryForm(f => ({ ...f, content: e.target.value }))}
                              placeholder={t("wb.content.ph")}
                              rows={2}
                              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={entryForm.priority}
                                onChange={(e) => setEntryForm(f => ({ ...f, priority: Number(e.target.value) }))}
                                className="w-16 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                              />
                              <select
                                value={entryForm.position}
                                onChange={(e) => setEntryForm(f => ({ ...f, position: e.target.value }))}
                                className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                              >
                                <option value="before_char">{t("wb.before")}</option>
                                <option value="after_char">{t("wb.after")}</option>
                              </select>
                              <button
                                onClick={() => setShowAdvanced(s => !s)}
                                className="ml-auto text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] flex items-center gap-1"
                              >
                                {showAdvanced ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                {t("wb.advanced") || "Advanced"}
                              </button>
                            </div>
                            {showAdvanced && (
                              <div className="flex items-center gap-2 flex-wrap pl-2 border-l-2 border-[var(--color-border)]">
                                <input
                                  value={entryForm.secondaryKeys}
                                  onChange={(e) => setEntryForm(f => ({ ...f, secondaryKeys: e.target.value }))}
                                  placeholder={t("wb.secKeysPh") || "Secondary keys"}
                                  className="flex-1 min-w-[120px] bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none"
                                />
                                <select
                                  value={entryForm.selectiveLogic || ""}
                                  onChange={(e) => setEntryForm(f => ({ ...f, selectiveLogic: e.target.value || null }))}
                                  className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                >
                                  <option value="">OR</option>
                                  <option value="AND">AND</option>
                                  <option value="NOT">NOT</option>
                                </select>
                                <button
                                  onClick={() => setEntryForm(f => ({ ...f, constant: !f.constant }))}
                                  className={`px-2 py-1 rounded text-[10px] ${entryForm.constant ? "bg-blue-500/15 text-blue-400" : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"}`}
                                >CONST</button>
                                <input
                                  type="number"
                                  min={-1}
                                  max={8000}
                                  value={entryForm.tokenBudget}
                                  onChange={(e) => setEntryForm(f => ({ ...f, tokenBudget: Number(e.target.value) }))}
                                  placeholder="budget"
                                  className="w-16 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                />
                              </div>
                            )}
                            <button
                              onClick={saveEntry}
                              disabled={saving || !entryForm.content.trim()}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors disabled:opacity-40"
                            >
                              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                              {t("wb.addEntry")}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ AI World Book Generator ═══════ */}
      {aiOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[86vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--color-border)]">
              <Sparkles size={16} className="text-[var(--color-accent)]" />
              <h3 className="flex-1 font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-text-primary)]">
                {t("aigen.title")}
              </h3>
              <button
                onClick={() => setAiOpen(false)}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                {t("aigen.bookHint")}
              </p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t("aigen.bookPh")}
                rows={3}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:border-[var(--color-accent)] outline-none transition-colors"
              />
              {aiError && (
                <div className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
                  {aiError}
                </div>
              )}

              {aiResult ? (
                <div className="space-y-2">
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2.5">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">{aiResult.book.name}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{aiResult.book.description}</div>
                  </div>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {aiResult.entries.map((e, i) => (
                      <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {e.keys.slice(0, 4).map((k) => (
                            <span key={k} className="rounded bg-[var(--color-accent-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent-glow)]">
                              {k}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">
                          {e.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setAiOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t("aigen.cancel")}
                </button>
                {aiResult ? (
                  <button
                    onClick={commitAiBook}
                    disabled={aiBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-accent-glow)] disabled:opacity-50 transition-colors"
                  >
                    {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {aiBusy ? t("aigen.creating") : t("aigen.createBook")}
                  </button>
                ) : (
                  <button
                    onClick={generateBook}
                    disabled={aiBusy || !aiPrompt.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-accent-glow)] disabled:opacity-50 transition-colors"
                  >
                    {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {aiBusy ? t("aigen.generating") : t("aigen.generate")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
