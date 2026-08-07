"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Gamepad2, Download, Trash2, Loader2, Puzzle, Wrench, Brain, Heart, ExternalLink, Bot } from "lucide-react";
import RoleplayHub from "@/components/roleplay/RoleplayHub";

interface Plugin {
  id: string;
  name: string;
  category: string;
  description: string;
  endpoint: string;
  icon: string;
}

interface InstalledPlugin {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  isActive: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  game: <Gamepad2 size={16} />,
  utility: <Wrench size={16} />,
  ai: <Brain size={16} />,
  social: <Heart size={16} />,
};

const categoryColors: Record<string, string> = {
  game: "#6c5ce7",
  utility: "#00d2d2",
  ai: "#ffa502",
  social: "#ff6b6b",
};

export default function GamesPage() {
  const { tenant } = useParams();
  const { t } = useI18n();
  const [tab, setTab] = useState<"marketplace" | "characters">("marketplace");
  const [marketplace, setMarketplace] = useState<Plugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [endpointInput, setEndpointInput] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const fetchPlugins = async () => {
    const res = await fetch("/api/mcp/plugins");
    const data = await res.json();
    setMarketplace(data.marketplace || []);
    setInstalled(data.installed || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleInstall = async (pluginId: string) => {
    setError("");
    setInstalling(pluginId);
    try {
      const endpoint = endpointInput[pluginId] || "";
      const res = await fetch("/api/mcp/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, endpoint }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        await fetchPlugins();
      }
    } catch {
      setError(t("games.error.install"));
    }
    setInstalling(null);
  };

  const handleUninstall = async (pluginId: string) => {
    setError("");
    try {
      const res = await fetch(`/api/mcp/plugins?id=${pluginId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) await fetchPlugins();
    } catch {
      setError(t("games.error.uninstall"));
    }
  };

  const isInstalled = (pluginId: string) =>
    installed.some((p) => p.name === marketplace.find((m) => m.id === pluginId)?.name);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (tab === "characters") {
    return (
      <div className="h-dvh overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-4 shrink-0">
          <button
            onClick={() => setTab("marketplace")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <Puzzle size={12} />
            {t("games.tab.plugins")}
          </button>
          <button
            onClick={() => setTab("characters")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-teal-muted)] text-[var(--color-teal)]"
          >
            <Bot size={12} />
            {t("games.tab.characters")}
          </button>
        </div>
        <div className="flex-1 overflow-hidden mt-3">
          <RoleplayHub />
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-y-auto p-4 sm:p-6 pt-16 md:pt-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center">
              <Gamepad2 size={20} className="text-[var(--color-accent-glow)]" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-bold text-2xl">
              Game Plaza
            </h1>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("games.subtitle")}
          </p>

          {/* Tab switch */}
          <button
            onClick={() => setTab("characters")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-teal-muted)] text-[var(--color-teal)] text-sm font-medium hover:bg-[var(--color-teal)] hover:text-[var(--color-bg-deep)] transition-colors"
          >
            <Bot size={16} />
            {t("games.tryCharacters")}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* Installed plugins */}
        {installed.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              {t("games.installed", { count: installed.length })}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {installed.map((p) => (
                <div
                  key={p.id}
                  className="glass-card p-4 flex items-start gap-3 group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ background: `${categoryColors[p.category]}20` }}
                  >
                    {p.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{p.name}</span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium"
                        style={{
                          background: `${categoryColors[p.category]}20`,
                          color: categoryColors[p.category],
                        }}
                      >
                        {p.category}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUninstall(p.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Marketplace */}
        <h2 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          {t("games.marketplace")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {marketplace.map((p) => {
            const installed = isInstalled(p.id);
            return (
              <div key={p.id} className="glass-card p-4 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ background: `${categoryColors[p.category]}20` }}
                  >
                    {p.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{p.name}</span>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium inline-block mt-1"
                      style={{
                        background: `${categoryColors[p.category]}20`,
                        color: categoryColors[p.category],
                      }}
                    >
                      {p.category}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] mb-3 flex-1">
                  {p.description}
                </p>

                {/* Endpoint input (if not pre-configured) */}
                {!p.endpoint && !installed && (
                  <input
                    type="text"
                    placeholder={t("games.endpoint.placeholder")}
                    value={endpointInput[p.id] || ""}
                    onChange={(e) =>
                      setEndpointInput((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] mb-2"
                  />
                )}

                {/* Action button */}
                {installed ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-teal)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-teal)]" />
                    {t("games.installedLabel")}
                  </div>
                ) : (
                  <button
                    onClick={() => handleInstall(p.id)}
                    disabled={installing === p.id}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)] text-xs font-medium hover:bg-[var(--color-accent)]/20 transition-colors"
                  >
                    {installing === p.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    {installing === p.id ? t("games.installing") : t("games.install")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
