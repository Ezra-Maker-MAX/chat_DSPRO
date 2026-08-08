"use client";

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
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
} from "lucide-react";

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
  avatarUrl: "",
};

export default function RoleplayHub() {
  const { t } = useI18n();
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [books, setBooks] = useState<WorldBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  // Chat state
  const [activeCard, setActiveCard] = useState<CharacterCard | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    let cardsOk = false;
    let booksOk = false;
    const errors: string[] = [];

    // Load characters — never let world-book failure block this.
    try {
      const cardsRes = await fetch("/api/characters");
      const cardsData = await cardsRes.json();
      setCards(cardsData.cards || []);
      cardsOk = true;
    } catch {
      errors.push("characters");
    }

    // Load world books — independent failure, don't kill character list.
    try {
      const booksRes = await fetch("/api/worldbooks");
      const booksData = await booksRes.json();
      setBooks(booksData.books || []);
      booksOk = true;
    } catch {
      errors.push("worldbooks");
    }

    if (!cardsOk) setError(t("rp.error.load"));
    else if (errors.length > 0) console.warn("[RoleplayHub] Partial load failed:", errors.join(", "));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length]);

  const openChat = async (card: CharacterCard) => {
    setActiveCard(card);
    setChat([]);
    setSending(true);
    try {
      const res = await fetch(`/api/roleplay/chat?characterId=${card.id}`);
      const data = await res.json();
      if (data.history) {
        setChat(data.history);
      }
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

  const sendMessage = async () => {
    if (!activeCard || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
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
      } else if (data.error) {
        setChat((prev) => [...prev, { role: "assistant", content: `⚠️ ${data.error}` }]);
      }
    } catch {
      setChat((prev) => [...prev, { role: "assistant", content: t("rp.error.network") }]);
    } finally {
      setSending(false);
    }
  };

  const generateAvatar = async () => {
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
        }),
      });
      const data = await res.json();
      if (data.error) {
        setAvatarError(data.error);
        return;
      }
      setForm((f) => ({ ...f, avatarUrl: data.url }));
    } catch {
      setAvatarError(t("rp.error.avatar"));
    } finally {
      setAvatarLoading(false);
    }
  };

  const onUploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
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
      const data = await res.json();
      if (data.error) {
        setAvatarError(data.error);
        return;
      }
      setForm((f) => ({ ...f, avatarUrl: data.url }));
    } catch {
      setAvatarError(t("rp.error.avatar"));
    } finally {
      setAvatarLoading(false);
    }
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
      <div className="flex flex-col h-full">
        {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <AvatarBox url={activeCard.avatarUrl} className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-[family-name:var(--font-display)] font-bold text-sm truncate">
              {activeCard.name}
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate">
              {activeCard.description?.slice(0, 60) || t("rp.empty")}
            </p>
          </div>
          <button
            onClick={() => setActiveCard(null)}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

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
    );
  }

  // ----- Card list / editor view -----
  return (
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
                        onClick={generateAvatar}
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
                        onChange={onUploadFile}
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
        {cards.length === 0 && !editing ? (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => (
              <div key={card.id} className="glass-card p-4 group flex flex-col">
                <div className="flex items-start gap-3 mb-2">
                  <AvatarBox url={card.avatarUrl} className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{card.name}</h3>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                      {card.worldBookId ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-teal)]">
                          <BookOpen size={10} /> {t("rp.worldBookAttached")}
                        </span>
                      ) : (
                        t("rp.noWorldBook")
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => startEdit(card)}
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-teal)] hover:bg-[var(--color-bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
                      title={t("rp.edit")}
                    >
                      <Pencil size={14} />
                    </button>
                    <a
                      href={`/api/characters/${card.id}/export`}
                      download
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-teal)] hover:bg-[var(--color-bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
                      title={t("rp.export.png")}
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 flex-1 mb-3">
                  {card.description || t("rp.empty")}
                </p>
                <button
                  onClick={() => openChat(card)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-teal-muted)] text-[var(--color-teal)] text-xs font-medium hover:bg-[var(--color-teal)] hover:text-[var(--color-bg-deep)] transition-colors"
                >
                  <KeyRound size={12} />
                  {t("rp.talkTo", { name: card.name })}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
