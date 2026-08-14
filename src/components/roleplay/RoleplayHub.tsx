"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Bot,
  Plus,
  Trash2,
  BookOpen,
  Loader2,
  Send,
  Sparkles,
  X,
  KeyRound,
  Pencil,
  Download,
  Upload,
  Smile,
  Bookmark,
  Check,
  Heart,
} from "lucide-react";
import RechargeModal from "@/components/billing/RechargeModal";
import { VIBE_TAGS, parseTags } from "@/lib/tags";

interface CharacterCard {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  mesExample: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  worldBookId: string | null;
  avatarUrl: string | null;
  emotes: (string | null)[];
  visibility?: "public" | "admin_only";
  adult?: boolean;
  tags?: string | null;
  createdAt?: string | null;
}

/** Avatar thumbnail that falls back to the gradient Bot icon on missing/broken URL. */
function AvatarBox({ url, className }: { url: string | null | undefined; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        className={`${className} object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={`${className} bg-gradient-to-br from-[var(--color-teal)] to-[var(--color-accent)] flex items-center justify-center overflow-hidden`}
    >
      <Bot size={18} className="text-white" />
    </div>
  );
}

/**
 * Card-game cover: the portrait fills the card face. Without a portrait it
 * falls back to a big initial on a glowing gradient — reads like a real card.
 * Must be placed inside a `relative overflow-hidden` container with a fixed ratio.
 */
function CardCover({ url, name }: { url: string | null | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--color-bg-elevated)] via-[var(--color-bg-card)] to-[var(--color-bg-deep)]">
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[var(--color-accent-muted)] blur-2xl" />
      <div className="absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-[var(--color-teal-muted)] blur-2xl" />
      <span className="relative select-none font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--color-text-secondary)]">
        {initial}
      </span>
    </div>
  );
}

interface WorldBook {
  id: string;
  name: string;
  description: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_FIELDS = {
  description: "",
  personality: "",
  scenario: "",
  firstMes: "",
  mesExample: "",
  systemPrompt: "",
  postHistoryInstructions: "",
  worldBookId: null as string | null,
  avatarUrl: "",
  emotes: [null, null, null, null] as (string | null)[],
  visibility: "public" as "public" | "admin_only",
  adult: false,
  tags: [] as string[],
};

export default function RoleplayHub({
  adultOnly = false,
  sortBy,
  tagFilter,
}: {
  adultOnly?: boolean;
  sortBy?: "newest" | "name";
  tagFilter?: string | null;
}) {
  const { t } = useI18n();
  // Loose i18n lookup for dynamic keys (bond stages, vibe tags).
  const tr = (key: string) => (t as unknown as (k: string) => string)(key);
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [books, setBooks] = useState<WorldBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentRole, setCurrentRole] = useState<"admin" | "member">("member");

  // Bond (affection) — relationship stage shown in the chat header.
  const [affection, setAffection] = useState(0);
  const [bond, setBond] = useState<{ index: number; key: string; progress: number; toNext: number | null } | null>(null);
  const [stageUpNotice, setStageUpNotice] = useState<{ index: number; key: string } | null>(null);

  // Adult-zone ordering: newest first or alphabetical, applied purely client-side.
  const sortedCards = useMemo(() => {
    let list = cards;
    if (tagFilter) {
      list = list.filter((c) => parseTags(c.tags).includes(tagFilter));
    }
    if (!sortBy) return list;
    const copy = [...list];
    if (sortBy === "newest") {
      copy.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    } else {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    }
    return copy;
  }, [cards, sortBy, tagFilter]);

  // Card editor state
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = create mode
  const [form, setForm] = useState<{ name: string } & typeof DEFAULT_FIELDS>({
    name: "",
    ...DEFAULT_FIELDS,
  });
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emoteFileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  // Chat state
  const [activeCard, setActiveCard] = useState<CharacterCard | null>(null);
  const [activeEmoteIdx, setActiveEmoteIdx] = useState(0);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Author's Note (SillyTavern 全局指令微调) — per-session
  const [authorNote, setAuthorNote] = useState("");
  const [authorNoteDepth, setAuthorNoteDepth] = useState(3);
  const [authorNoteOpen, setAuthorNoteOpen] = useState(false);
  const [authorNoteSaving, setAuthorNoteSaving] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /** Parse the API's JSON-encoded `emotes` column into a 4-slot array. */
  function parseEmotes(raw: unknown): (string | null)[] {
    if (!Array.isArray(raw)) return [null, null, null, null];
    const out: (string | null)[] = [null, null, null, null];
    for (let i = 0; i < 4; i++) {
      const v = (raw as unknown[])[i];
      out[i] = typeof v === "string" && v.length > 0 ? v : null;
    }
    return out;
  }

  const fetchAll = useCallback(async () => {
    let cardsOk = false;
    let booksOk = false;
    const errors: string[] = [];

    // Load characters — never let world-book failure block this.
    try {
      const cardsRes = await fetch(adultOnly ? "/api/characters?adult=1" : "/api/characters?adult=0");
      const cardsData = await cardsRes.json().catch(() => ({} as any));
      if (!cardsRes.ok || cardsData.error) {
        throw new Error(cardsData.error || `HTTP ${cardsRes.status}`);
      }
      const rawCards = (cardsData.cards || []) as any[];
      if (cardsData.role === "admin" || cardsData.role === "member") {
        setCurrentRole(cardsData.role);
      }
      setCards(
        rawCards.map((c) => ({
          ...c,
          emotes: parseEmotes(c.emotes),
        }))
      );
      cardsOk = true;
    } catch (e) {
      errors.push(`characters: ${e instanceof Error ? e.message : "unknown"}`);
    }

    // Load world books — independent failure, don't kill character list.
    try {
      const booksRes = await fetch("/api/worldbooks");
      const booksData = await booksRes.json().catch(() => ({} as any));
      if (!booksRes.ok || booksData.error) {
        throw new Error(booksData.error || `HTTP ${booksRes.status}`);
      }
      setBooks(booksData.cards || booksData.books || []);
      booksOk = true;
    } catch (e) {
      errors.push(`worldbooks: ${e instanceof Error ? e.message : "unknown"}`);
    }

    if (!cardsOk) {
      const detail = errors.find((e) => e.startsWith("characters:")) || "";
      const isSchema = /no such column|no such table|database/i.test(detail);
      setError(
        isSchema
          ? `${t("rp.error.load")} (${detail}) — ${t("rp.error.migrateHint")}`
          : `${t("rp.error.load")}${detail ? " — " + detail : ""}`
      );
    } else if (errors.length > 0) console.warn("[RoleplayHub] Partial load failed:", errors.join(", "));
    setLoading(false);
  }, [adultOnly, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length]);

  const openChat = async (card: CharacterCard) => {
    setActiveCard(card);
    setActiveEmoteIdx(0);
    setChat([]);
    setSending(true);
    try {
      const res = await fetch(`/api/roleplay/chat?characterId=${card.id}`);
      const data = await res.json();
      if (data.history) {
        setChat(data.history);
      }
      // Author's Note (SillyTavern 全局指令微调) — per-session
      setAuthorNote(data.authorNote || "");
      setAuthorNoteDepth(data.authorNoteDepth ?? 3);
      // Bond (affection) — relationship stage for this character
      setAffection(data.affection ?? 0);
      setBond(data.bond || null);
      setStageUpNotice(null);
      // Seed first message if fresh session
      if (data.card?.firstMes && (!data.history || data.history.length === 0)) {
        setChat([{ role: "assistant", content: data.card.firstMes }]);
      }
    } catch {
      setError(t("rp.error.session"));
    } finally {
      setSending(false);
    }
  };

  const saveAuthorNote = async () => {
    if (!activeCard) return;
    setAuthorNoteSaving(true);
    try {
      await fetch("/api/roleplay/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: activeCard.id,
          authorNote,
          authorNoteDepth,
        }),
      });
    } catch {
      /* non-fatal — note simply won't persist */
    } finally {
      setAuthorNoteSaving(false);
    }
  };

  const postMessage = async (text: string) => {
    if (!activeCard || sending) return;
    setChat((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch("/api/roleplay/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: activeCard.id, message: text }),
      });
      const data = await res.json();
      if (typeof data.reply === "string" && data.reply) {
        setChat((prev) => [...prev, { role: "assistant", content: data.reply }]);
        // Bond bookkeeping — update affection & stage, celebrate upgrades.
        if (typeof data.affection === "number") setAffection(data.affection);
        if (data.bond) {
          setBond(data.bond);
          if (data.stageUp) {
            setStageUpNotice(data.stageUp);
            setTimeout(() => setStageUpNotice(null), 6000);
          }
        }
        // Auto-switch the expression when the model's reply carries an emotion cue
        // (slot convention: 0=neutral 1=happy 2=angry 3=dazed). Only switch if that
        // slot actually has an image; otherwise keep the current expression.
        const slotByEmotion: Record<string, number> = {
          happy: 1,
          angry: 2,
          dazed: 3,
          neutral: 0,
        };
        const target = slotByEmotion[data.emotion as string];
        if (typeof target === "number" && activeCard.emotes?.[target]) {
          setActiveEmoteIdx(target);
        }
      } else if (data.error) {
        setChat((prev) => [...prev, { role: "assistant", content: `⚠️ ${data.error}` }]);
        if (data.code === "insufficient_credit" || String(data.error).includes("INSUFFICIENT_CREDIT")) {
          setRechargeOpen(true);
        }
      }
    } catch {
      setChat((prev) => [...prev, { role: "assistant", content: t("rp.error.network") }]);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = () => {
    if (!activeCard || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    postMessage(text);
  };

  // Daily-bond quick greetings — +2 affection and the character replies warmly.
  const sendGreeting = (greeting: string) => {
    if (!activeCard || sending) return;
    postMessage(greeting);
  };

  const generateAvatar = async (slot: "avatar" | "0" | "1" | "2" | "3" = "avatar") => {
    if (!form.name.trim()) {
      setAvatarError(t("rp.name"));
      return;
    }
    setAvatarLoading(true);
    setAvatarError("");
    try {
      const res = await fetch("/api/characters/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          personality: form.personality,
          scenario: form.scenario,
          firstMes: form.firstMes,
          mesExample: form.mesExample,
          systemPrompt: form.systemPrompt,
          postHistoryInstructions: form.postHistoryInstructions,
          worldBookId: form.worldBookId,
          prompt: avatarPrompt,
          cardId: editingId || undefined,
          slot,
        }),
      });
      // Read raw text first so non-JSON errors (Vercel cold-start page,
      // gateway HTML error, etc.) surface to the user instead of being
      // swallowed by a JSON.parse throw.
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* leave data empty; fall through to status-based message */
      }
      if (!res.ok || data.error) {
        const raw = data.error || text || `HTTP ${res.status}`;
        const policyHit = /content[- ]?policy|safety|moderation|\bblocked\b/i.test(String(raw));
        setAvatarError(
          (data.hint ? `${raw} — ${data.hint}` : raw) +
            (policyHit ? `（${t("rp.error.policyHint")}）` : "")
        );
        return;
      }
      if (slot === "avatar") {
        setForm((f) => ({ ...f, avatarUrl: data.url }));
      } else {
        const i = Number(slot);
        setForm((f) => ({
          ...f,
          emotes: f.emotes.map((u, idx) => (idx === i ? data.url : u)),
        }));
      }
    } catch (e: any) {
      // Last-resort: network failure or non-text response. Surface whatever
      // we can so the user can tell "no internet" from "API rejected prompt".
      const msg = e?.message || String(e);
      setAvatarError(t("rp.error.avatar") + (msg ? ` — ${msg}` : ""));
    } finally {
      setAvatarLoading(false);
    }
  };

  const onUploadFile = async (
    e: ChangeEvent<HTMLInputElement>,
    slot: "avatar" | "0" | "1" | "2" | "3" = "avatar"
  ) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!form.name.trim()) {
      setAvatarError(t("rp.name"));
      return;
    }
    setAvatarLoading(true);
    setAvatarError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("cardId", editingId || "");
      fd.append("slot", slot);
      fd.append(
        "card",
        JSON.stringify({
          name: form.name,
          description: form.description,
          personality: form.personality,
          scenario: form.scenario,
          firstMes: form.firstMes,
          mesExample: form.mesExample,
          systemPrompt: form.systemPrompt,
          postHistoryInstructions: form.postHistoryInstructions,
          worldBookId: form.worldBookId,
        })
      );
      const res = await fetch("/api/characters/avatar/upload", { method: "POST", body: fd });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* leave data empty; fall through to status-based message */
      }
      if (!res.ok || data.error) {
        const raw = data.error || text || `HTTP ${res.status}`;
        const policyHit = /content[- ]?policy|safety|moderation|\bblocked\b/i.test(String(raw));
        setAvatarError(
          (data.hint ? `${raw} — ${data.hint}` : raw) +
            (policyHit ? `（${t("rp.error.policyHint")}）` : "")
        );
        return;
      }
      if (slot === "avatar") {
        setForm((f) => ({ ...f, avatarUrl: data.url }));
      } else {
        const i = Number(slot);
        setForm((f) => ({
          ...f,
          emotes: f.emotes.map((u, idx) => (idx === i ? data.url : u)),
        }));
      }
    } catch (e: any) {
      // Last-resort: network failure or non-text response. Surface whatever
      // we can so the user can tell "no internet" from "API rejected prompt".
      const msg = e?.message || String(e);
      setAvatarError(t("rp.error.avatar") + (msg ? ` — ${msg}` : ""));
    } finally {
      setAvatarLoading(false);
    }
  };

  const removeEmote = (i: number) => {
    setForm((f) => ({
      ...f,
      emotes: f.emotes.map((u, idx) => (idx === i ? null : u)),
    }));
  };

  const saveCard = async () => {
    if (!form.name.trim()) {
      setError(t("rp.name"));
      return;
    }
    setError("");
    try {
      const isUpdate = !!editingId;
      const res = await fetch("/api/characters", {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUpdate ? { ...form, id: editingId } : form),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setEditing(false);
      setEditingId(null);
      setForm({ name: "", ...DEFAULT_FIELDS });
      await fetchAll();
    } catch {
      setError(t("rp.error.save"));
    }
  };

  const startEdit = (card: CharacterCard) => {
    setEditingId(card.id);
    setForm({
      name: card.name,
      description: card.description || "",
      personality: card.personality || "",
      scenario: card.scenario || "",
      firstMes: card.firstMes || "",
      mesExample: card.mesExample || "",
      systemPrompt: card.systemPrompt || "",
      postHistoryInstructions: card.postHistoryInstructions || "",
      worldBookId: card.worldBookId,
      avatarUrl: card.avatarUrl || "",
      emotes: card.emotes && card.emotes.length === 4
        ? card.emotes
        : parseEmotes(card.emotes),
      visibility: card.visibility === "admin_only" ? "admin_only" : "public",
      adult: !!card.adult,
      tags: parseTags(card.tags),
    });
    setAvatarPrompt("");
    setAvatarError("");
    setError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditingId(null);
    setForm({ name: "", ...DEFAULT_FIELDS });
    setAvatarPrompt("");
    setAvatarError("");
    setError("");
  };

  const deleteCard = async (id: string) => {
    if (!confirm(t("rp.delete.confirm"))) return;
    try {
      await fetch(`/api/characters?id=${id}`, { method: "DELETE" });
      if (activeCard?.id === id) setActiveCard(null);
      await fetchAll();
    } catch {
      setError(t("rp.error.delete"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  // ----- Chat view -----
  if (activeCard) {
    return (
      <>
      <div className="flex flex-col h-full">
        {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <AvatarBox
              url={activeCard.emotes?.[activeEmoteIdx] || activeCard.avatarUrl}
              className="w-9 h-9 rounded-full shrink-0"
            />
          <div className="flex-1 min-w-0">
            <h2 className="font-[family-name:var(--font-display)] font-bold text-sm truncate" title={activeCard.description || ""}>
              {activeCard.name}
            </h2>
            {bond ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[var(--color-accent)]">
                  <Heart size={11} fill="currentColor" />
                </span>
                <div className="h-1 w-20 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-glow)] transition-all duration-500"
                    style={{ width: `${bond.progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-[var(--color-accent-glow)]">
                  {tr(`bond.stage.${bond.key}`)}
                </span>
                <span className="text-[9px] text-[var(--color-text-muted)]">
                  {bond.toNext != null ? `${affection}·${t("bond.toNext", { n: bond.toNext })}` : `♥ ${affection}`}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                {activeCard.description?.slice(0, 60) || t("rp.empty")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAuthorNoteOpen((v) => !v)}
            title={t("rp.authorNote.title")}
            className={`p-2 rounded-lg transition-colors ${
              authorNoteOpen || authorNote
                ? "text-[var(--color-accent-glow)] bg-[var(--color-bg-hover)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Bookmark size={16} />
          </button>
          <button
            onClick={() => setActiveCard(null)}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Author's Note panel (SillyTavern 全局指令微调) */}
        {authorNoteOpen && (
          <div className="border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg-deep)]/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                {t("rp.authorNote.title")}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {t("rp.authorNote.hint")}
              </span>
            </div>
            <textarea
              value={authorNote}
              onChange={(e) => setAuthorNote(e.target.value)}
              rows={3}
              placeholder={t("rp.authorNote.ph")}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-[var(--color-accent)]"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                {t("rp.authorNote.depth")}
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={authorNoteDepth}
                  onChange={(e) => setAuthorNoteDepth(Number(e.target.value))}
                  className="accent-[var(--color-accent)] w-28"
                />
                <span className="text-[var(--color-accent-glow)] font-mono">{authorNoteDepth}</span>
              </label>
              <button
                type="button"
                onClick={saveAuthorNote}
                disabled={authorNoteSaving}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] disabled:opacity-40 transition-colors"
              >
                {authorNoteSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {authorNoteSaving ? t("rp.saving") : t("rp.save")}
              </button>
            </div>
          </div>
        )}

        {/* Expression emote strip — click to swap the avatar above */}
        {activeCard.emotes && activeCard.emotes.some(Boolean) && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/40">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              {t("rp.emotes")}
            </span>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => {
                const url = activeCard.emotes[i];
                const active = i === activeEmoteIdx;
                return (
                  <button
                    key={i}
                    onClick={() => url && setActiveEmoteIdx(i)}
                    disabled={!url}
                    title={t(`rp.emotes.slot${i + 1}`)}
                    className={`relative h-8 w-8 overflow-hidden rounded-md border-2 transition-all ${
                      active
                        ? "border-[var(--color-accent)] shadow-[0_0_10px_rgba(108,92,231,0.45)] scale-105"
                        : url
                          ? "border-transparent opacity-60 hover:opacity-100"
                          : "border-transparent opacity-30 cursor-not-allowed"
                    }`}
                  >
                    {url ? (
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg-input)] text-[10px] text-[var(--color-text-muted)]">
                        {i + 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3">
          {chat.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2 text-center px-6">
              <Sparkles size={20} className="text-[var(--color-teal)]" />
              <p className="text-sm">{t("rp.startHint", { name: activeCard.name })}</p>
            </div>
          )}
          {chat.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[var(--color-accent)] text-white rounded-tr-md"
                    : "bg-[var(--color-bg-elevated)] border border-[var(--color-teal)]/15 text-[var(--color-text-primary)] rounded-tl-md"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-teal)]/15 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-[var(--color-teal)]" />
                <span className="text-xs text-[var(--color-text-muted)]">{t("rp.typing", { name: activeCard.name })}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          {stageUpNotice && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-muted)] px-3 py-2 text-xs text-[var(--color-accent-glow)] animate-fade-in">
              <Heart size={13} fill="currentColor" className="shrink-0" />
              <span className="font-medium">
                {t("bond.upgraded", { name: activeCard.name })}
              </span>
              <span className="text-[var(--color-text-muted)]">
                {tr(`bond.stage.${stageUpNotice.key}`)}
              </span>
            </div>
          )}
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => sendGreeting("早安")}
              disabled={sending}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors"
              title={t("bond.greetingHint")}
            >
              🌅 {t("bond.greeting.morning")}
            </button>
            <button
              onClick={() => sendGreeting("晚安")}
              disabled={sending}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors"
              title={t("bond.greetingHint")}
            >
              🌙 {t("bond.greeting.night")}
            </button>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {t("bond.greetingBonus")}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={t("rp.talkTo", { name: activeCard.name })}
              rows={1}
              className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors max-h-32"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="p-2.5 rounded-xl bg-[var(--color-teal)] text-[var(--color-bg-deep)] hover:bg-[var(--color-accent-glow)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
      {rechargeOpen && <RechargeModal onClose={() => setRechargeOpen(false)} />}
      </>
    );
  }

  // ----- Card list / editor view -----
  return (
    <>
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-teal-muted)] flex items-center justify-center">
                <Bot size={16} className="text-[var(--color-teal)]" />
              </div>
              <h1 className="font-[family-name:var(--font-display)] font-bold text-lg">
                {t("rp.title")}
              </h1>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("rp.subtitle")}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setEditing(true);
              setForm({ name: "", ...DEFAULT_FIELDS });
              setAvatarPrompt("");
              setAvatarError("");
              setError("");
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
          >
            <Plus size={14} />
            {t("rp.new")}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* Editor */}
        {editing && (
          <div className="glass-card p-5 mb-6 animate-fade-in">
            <h3 className="font-medium text-sm mb-4">{editingId ? t("rp.edit.title") : t("rp.create.title")}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.name")}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("rp.name.ph")}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.description")}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("rp.description.ph")}
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.personality")}</label>
                <textarea
                  value={form.personality}
                  onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))}
                  placeholder={t("rp.personality.ph")}
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.scenario")}</label>
                <textarea
                  value={form.scenario}
                  onChange={(e) => setForm((f) => ({ ...f, scenario: e.target.value }))}
                  placeholder={t("rp.scenario.ph")}
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.firstMes")}</label>
                <textarea
                  value={form.firstMes}
                  onChange={(e) => setForm((f) => ({ ...f, firstMes: e.target.value }))}
                  placeholder={t("rp.firstMes.ph")}
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.mesExample")}</label>
                <textarea
                  value={form.mesExample}
                  onChange={(e) => setForm((f) => ({ ...f, mesExample: e.target.value }))}
                  placeholder="<START>\n{{user}}: Hi\n{{char}}: Hey, long time no see."
                  rows={3}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none font-mono text-xs focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.systemPrompt")}</label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  placeholder={t("rp.systemPrompt.ph")}
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  {t("rp.systemPrompt.hint")}
                </p>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.worldBook")}</label>
                <select
                  value={form.worldBookId || ""}
                  onChange={(e) => setForm((f) => ({ ...f, worldBookId: e.target.value || null }))}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">{t("rp.worldBook.none")}</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  {t("rp.worldBook.hint")}
                </p>
              </div>
              {/* Visibility — admin only. Hidden cards are invisible to non-admins. */}
              {currentRole === "admin" && (
                <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5 bg-[var(--color-bg-input)]">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs text-[var(--color-text-secondary)]">
                      {t("rp.visibility.title")}
                    </label>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {t("rp.visibility.hint")}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.visibility === "admin_only"}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        visibility: f.visibility === "admin_only" ? "public" : "admin_only",
                      }))
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      form.visibility === "admin_only"
                        ? "bg-[var(--color-accent)]"
                        : "bg-[var(--color-bg-hover)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        form.visibility === "admin_only" ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              )}
              {/* Adult content — admin only. Adult cards only appear in the 18+ area. */}
              {currentRole === "admin" && (
                <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5 bg-[var(--color-bg-input)]">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs text-[var(--color-text-secondary)]">
                      {t("rp.adult.title")}
                    </label>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {t("rp.adult.hint")}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!form.adult}
                    onClick={() =>
                      setForm((f) => ({ ...f, adult: !f.adult }))
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      form.adult
                        ? "bg-[var(--color-danger)]"
                        : "bg-[var(--color-bg-hover)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        form.adult ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              )}
              {/* Vibe tags — female-friendly archetypes (multi-select) */}
              <div className="rounded-lg border border-[var(--color-border)] px-3 py-2.5 bg-[var(--color-bg-input)]">
                <label className="block text-xs text-[var(--color-text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <Heart size={11} className="text-[var(--color-accent)]" fill="currentColor" />
                    {t("rp.tags.title")}
                  </span>
                </label>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 mb-2">
                  {t("rp.tags.hint")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {VIBE_TAGS.map((tag) => {
                    const on = form.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            tags: on
                              ? f.tags.filter((x) => x !== tag)
                              : [...f.tags, tag].slice(0, 5),
                          }))
                        }
                        className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                          on
                            ? "bg-[var(--color-accent)] text-white shadow-[0_0_10px_rgba(255,45,85,0.35)]"
                            : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        {tr(`rp.tags.${tag}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("rp.avatar")}</label>
                <div className="flex items-start gap-3">
                  <AvatarBox url={form.avatarUrl} className="w-16 h-16 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <textarea
                      value={avatarPrompt}
                      onChange={(e) => setAvatarPrompt(e.target.value)}
                      placeholder={t("rp.avatar.prompt")}
                      rows={2}
                      className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => generateAvatar("avatar")}
                        disabled={avatarLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-teal)] text-[var(--color-bg-deep)] text-xs font-medium hover:bg-[var(--color-accent-glow)] hover:text-white disabled:opacity-40 transition-colors"
                      >
                        {avatarLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {avatarLoading ? t("rp.avatar.generating") : t("rp.avatar.generate")}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <Upload size={13} />
                        {t("rp.avatar.upload")}
                      </button>
                      {form.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, avatarUrl: "" }));
                            setAvatarPrompt("");
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                        >
                          <X size={13} />
                          {t("rp.avatar.remove")}
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => onUploadFile(e, "avatar")}
                      />
                    </div>
                    {avatarError && (
                      <p className="text-[11px] text-[var(--color-danger)]">{avatarError}</p>
                    )}
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {t("rp.avatar.hint")}
                    </p>
                  </div>
                </div>
              </div>
              {/* Expression Emotes — 4-panel square thumbnails */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Smile size={12} className="text-[var(--color-teal)]" />
                    {t("rp.emotes")}
                  </span>
                  <span className="text-[10px]">{t("rp.emotes.hint")}</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((i) => {
                    const url = form.emotes[i];
                    const slot = String(i) as "0" | "1" | "2" | "3";
                    return (
                      <div
                        key={i}
                        className="group/emote relative aspect-square overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)]"
                      >
                        {url ? (
                          <img
                            src={url}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-[var(--color-text-muted)]">
                            <span className="font-[family-name:var(--font-display)] text-base">
                              {i + 1}
                            </span>
                            <span className="text-[9px]">{t(`rp.emotes.slot${i + 1}`)}</span>
                          </div>
                        )}

                        {/* Overlay actions — appear on hover */}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity duration-150 group-hover/emote:opacity-100">
                          <button
                            type="button"
                            onClick={() => generateAvatar(slot)}
                            disabled={avatarLoading}
                            title={t("rp.emotes.generate")}
                            className="rounded bg-white/10 p-1.5 text-white backdrop-blur transition-colors hover:bg-[var(--color-accent)] disabled:opacity-40"
                          >
                            {avatarLoading ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Sparkles size={12} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => emoteFileRefs.current[i]?.click()}
                            disabled={avatarLoading}
                            title={t("rp.emotes.upload")}
                            className="rounded bg-white/10 p-1.5 text-white backdrop-blur transition-colors hover:bg-[var(--color-accent)] disabled:opacity-40"
                          >
                            <Upload size={12} />
                          </button>
                          {url && (
                            <button
                              type="button"
                              onClick={() => removeEmote(i)}
                              title={t("rp.emotes.remove")}
                              className="rounded bg-white/10 p-1.5 text-white backdrop-blur transition-colors hover:bg-[var(--color-danger)]"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        <input
                          ref={(el) => {
                            emoteFileRefs.current[i] = el;
                          }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => onUploadFile(e, slot)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={saveCard}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
              >
                {t("rp.save")}
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                {t("rp.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Card grid */}
        {sortedCards.length === 0 && !editing ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-teal-muted)] flex items-center justify-center">
              <Sparkles size={24} className="text-[var(--color-teal)]" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">{t("rp.noCards.title")}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t("rp.noCards.hint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {sortedCards.map((card) => (
              <div
                key={card.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--color-accent)]/50 hover:shadow-[0_18px_44px_-14px_rgba(108,92,231,0.45)]"
              >
                {/* Cover — the portrait is the card face */}
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <CardCover url={card.avatarUrl} name={card.name} />

                  {/* Lore badge — top-left chip */}
                  <span
                    className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur ${
                      card.worldBookId
                        ? "bg-black/50 text-[var(--color-teal)]"
                        : "bg-black/40 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {card.worldBookId ? (
                      <>
                        <BookOpen size={10} /> {t("rp.worldBookAttached")}
                      </>
                    ) : (
                      t("rp.noWorldBook")
                    )}
                  </span>

                  {/* Admin-only badge — top-left, below the lore chip */}
                  {card.visibility === "admin_only" && (
                    <span className="absolute left-2.5 top-9 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      <KeyRound size={10} /> {t("rp.visibility.adminOnly")}
                    </span>
                  )}

                  {/* Adult badge — top-left, stacked below other chips */}
                  {card.adult && (
                    <span
                      className={`absolute left-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--color-danger)]/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur ${
                        card.visibility === "admin_only" ? "top-[52px]" : "top-9"
                      }`}
                    >
                      {t("rp.adult.badge")}
                    </span>
                  )}

                  {/* Actions — top-right, fade in on hover */}
                  <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(card)}
                      className="rounded-lg bg-black/50 p-1.5 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
                      title={t("rp.edit")}
                    >
                      <Pencil size={13} />
                    </button>
                    <a
                      href={`/api/characters/${card.id}/export`}
                      download
                      className="rounded-lg bg-black/50 p-1.5 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
                      title={t("rp.export.png")}
                    >
                      <Download size={13} />
                    </a>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="rounded-lg bg-black/50 p-1.5 text-white/80 backdrop-blur transition-colors hover:bg-[var(--color-danger)] hover:text-white"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-col gap-1 p-3">
                  <h3 className="truncate font-[family-name:var(--font-display)] text-sm font-bold leading-tight">
                    {card.name}
                  </h3>
                  {parseTags(card.tags).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {parseTags(card.tags).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-muted)] px-1.5 py-0.5 text-[9px] text-[var(--color-accent-glow)]"
                        >
                          ♥ {tr(`rp.tags.${tag}`)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="line-clamp-1 text-[11px] text-[var(--color-text-secondary)]">
                    {card.description || t("rp.empty")}
                  </p>
                  <button
                    onClick={() => openChat(card)}
                    className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-teal-muted)] px-3 py-2 text-xs font-medium text-[var(--color-teal)] transition-colors hover:bg-[var(--color-teal)] hover:text-[var(--color-bg-deep)]"
                  >
                    <KeyRound size={12} />
                    {t("rp.talkTo", { name: card.name })}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {rechargeOpen && <RechargeModal onClose={() => setRechargeOpen(false)} />}
    </>
  );
}
