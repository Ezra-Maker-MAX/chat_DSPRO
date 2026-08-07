"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
};

export default function RoleplayHub() {
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [books, setBooks] = useState<WorldBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Card editor state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string } & typeof DEFAULT_FIELDS>({
    name: "",
    ...DEFAULT_FIELDS,
  });

  // Chat state
  const [activeCard, setActiveCard] = useState<CharacterCard | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [cardsRes, booksRes] = await Promise.all([
        fetch("/api/characters"),
        fetch("/api/worldbooks"),
      ]);
      const cardsData = await cardsRes.json();
      const booksData = await booksRes.json();
      setCards(cardsData.cards || []);
      setBooks(booksData.books || []);
    } catch {
      setError("Failed to load characters");
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError("Failed to load session");
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
      if (data.reply) {
        setChat((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else if (data.error) {
        setChat((prev) => [...prev, { role: "assistant", content: `⚠️ ${data.error}` }]);
      }
    } catch {
      setChat((prev) => [...prev, { role: "assistant", content: "⚠️ Network error — try again." }]);
    } finally {
      setSending(false);
    }
  };

  const saveCard = async () => {
    if (!form.name.trim()) {
      setError("Give the character a name");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setEditing(false);
      setForm({ name: "", ...DEFAULT_FIELDS });
      await fetchAll();
    } catch {
      setError("Failed to save character");
    }
  };

  const deleteCard = async (id: string) => {
    if (!confirm("Delete this character? Chat history will be lost.")) return;
    try {
      await fetch(`/api/characters?id=${id}`, { method: "DELETE" });
      if (activeCard?.id === id) setActiveCard(null);
      await fetchAll();
    } catch {
      setError("Failed to delete character");
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
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-teal)] to-[var(--color-accent)] flex items-center justify-center shrink-0">
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-[family-name:var(--font-display)] font-bold text-sm truncate">
              {activeCard.name}
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate">
              {activeCard.description?.slice(0, 60) || "No description"}
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
              <p className="text-sm">Say something to {activeCard.name} to begin.</p>
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
                <span className="text-xs text-[var(--color-text-muted)]">{activeCard.name} is typing…</span>
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
              placeholder={`Talk to ${activeCard.name}…`}
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
                Characters
              </h1>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Roleplay companions with world books. Pick one to start chatting.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(true);
              setForm({ name: "", ...DEFAULT_FIELDS });
              setError("");
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
          >
            <Plus size={14} />
            New character
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
            <h3 className="font-medium text-sm mb-4">Create character card</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kira the Starfarer"
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Who is this character? Appearance, role, vibe…"
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Personality</label>
                <textarea
                  value={form.personality}
                  onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))}
                  placeholder="Traits, quirks, speech style…"
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Scenario</label>
                <textarea
                  value={form.scenario}
                  onChange={(e) => setForm((f) => ({ ...f, scenario: e.target.value }))}
                  placeholder="Where does the conversation start? What's the setup?"
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">First message</label>
                <textarea
                  value={form.firstMes}
                  onChange={(e) => setForm((f) => ({ ...f, firstMes: e.target.value }))}
                  placeholder="The character's opening line when a new session starts…"
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Example dialogue</label>
                <textarea
                  value={form.mesExample}
                  onChange={(e) => setForm((f) => ({ ...f, mesExample: e.target.value }))}
                  placeholder="<START>\n{{user}}: Hi\n{{char}}: Hey, long time no see."
                  rows={3}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none font-mono text-xs focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">System prompt (optional)</label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  placeholder="Extra instructions for the model…"
                  rows={2}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">World book (lore)</label>
                <select
                  value={form.worldBookId || ""}
                  onChange={(e) => setForm((f) => ({ ...f, worldBookId: e.target.value || null }))}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">None</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Lore entries activate when their keywords appear in the conversation.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={saveCard}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
              >
                Save character
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                Cancel
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
            <p className="text-sm text-[var(--color-text-muted)]">No characters yet.</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Create your first companion with the button above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => (
              <div key={card.id} className="glass-card p-4 group flex flex-col">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-teal)] to-[var(--color-accent)] flex items-center justify-center shrink-0">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{card.name}</h3>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                      {card.worldBookId ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-teal)]">
                          <BookOpen size={10} /> world book attached
                        </span>
                      ) : (
                        "no world book"
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 flex-1 mb-3">
                  {card.description || "No description."}
                </p>
                <button
                  onClick={() => openChat(card)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-teal-muted)] text-[var(--color-teal)] text-xs font-medium hover:bg-[var(--color-teal)] hover:text-[var(--color-bg-deep)] transition-colors"
                >
                  <KeyRound size={12} />
                  Talk to {card.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
