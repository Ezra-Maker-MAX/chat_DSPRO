"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Loader2 } from "lucide-react";

interface NewSpaceModalProps {
  onClose: () => void;
}

export default function NewSpaceModal({ onClose }: NewSpaceModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (name.trim().length < 2) {
      setError("Give your space a name (2-40 characters)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create space");
        return;
      }
      // Redirect into the new space (the tenant page auto-redirects to default channel)
      router.push(`/${data.tenant.slug}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-[fade-in_0.2s_ease]">
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-[var(--color-teal)] to-[var(--color-accent)]" />

        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-teal-muted)] flex items-center justify-center text-[var(--color-teal)]">
                <Plus size={20} />
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--color-text-primary)]">
                  Create a new space
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  A private, anonymous room with its own invite code
                </p>
              </div>
            </div>
            <button
              onClick={loading ? undefined : onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Space name
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                maxLength={40}
                placeholder="e.g. Weekend Squad"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Description <span className="text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={120}
                placeholder="What is this space for?"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
              />
            </div>

            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

            <button
              onClick={create}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-glow)] hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create space
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
