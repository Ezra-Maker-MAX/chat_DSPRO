"use client";

import { useState, useRef, useCallback } from "react";
import { Send, ImagePlus, Mic, X, Play, Square } from "lucide-react";

interface Props {
  channelId: string;
  onSend: (content: string, mediaIds: string[]) => Promise<void>;
  allowMedia: boolean;
  allowVoice: boolean;
}

export default function MessageInput({ channelId, onSend, allowMedia, allowVoice }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<{ id: string; url: string; type: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = content.trim();
    const mediaIds = uploadedMedia.map((m) => m.id);

    if (!trimmed && mediaIds.length === 0) return;

    setSending(true);
    try {
      await onSend(trimmed, mediaIds);
      setContent("");
      setUploadedMedia([]);
      setAudioBlob(null);
      setAudioUrl(null);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          setUploadedMedia((prev) => [
            ...prev,
            { id: data.id, url: data.url, type: data.type, name: data.fileName },
          ]);
        }
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const uploadAudio = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "voice-message.webm");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setUploadedMedia((prev) => [
          ...prev,
          { id: data.id, url: data.url, type: "audio", name: "Voice message" },
        ]);
        setAudioBlob(null);
        setAudioUrl(null);
      }
    } catch (err) {
      console.error("Voice upload failed:", err);
    }
    setUploading(false);
  };

  const removeMedia = (id: string) => {
    setUploadedMedia((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-3">
      {/* Uploaded media previews */}
      {uploadedMedia.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {uploadedMedia.map((m) => (
            <div
              key={m.id}
              className="relative group rounded-lg overflow-hidden border border-[var(--color-border)]"
            >
              {m.type === "image" && (
                <img src={m.url} alt={m.name} className="h-16 w-16 object-cover" />
              )}
              {m.type === "audio" && (
                <div className="h-16 w-40 flex items-center px-3 bg-[var(--color-bg-elevated)]">
                  <audio controls src={m.url} className="h-8 w-full" />
                </div>
              )}
              {m.type === "video" && (
                <video src={m.url} className="h-16 w-24 object-cover" />
              )}
              <button
                onClick={() => removeMedia(m.id)}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Audio preview (not yet uploaded) */}
      {audioUrl && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-[var(--color-bg-elevated)]">
          <audio controls src={audioUrl} className="h-8 flex-1" />
          <button
            onClick={uploadAudio}
            disabled={uploading}
            className="px-3 py-1 text-xs rounded-md bg-[var(--color-accent)] text-white"
          >
            {uploading ? "Uploading..." : "Attach"}
          </button>
          <button
            onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
            className="p-1 rounded hover:bg-[var(--color-bg-hover)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2">
        {/* File upload button */}
        {allowMedia && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] shrink-0"
            title="Upload image or video"
          >
            <ImagePlus size={20} />
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Voice recording button */}
        {allowVoice && (
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`p-2 rounded-lg transition-all shrink-0 ${
              recording
                ? "bg-[var(--color-danger)] text-white animate-pulse"
                : "hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
            title={recording ? "Stop recording" : "Record voice"}
          >
            {recording ? <Square size={20} /> : <Mic size={20} />}
          </button>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (links are not allowed)"
          rows={1}
          className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors max-h-32"
          style={{ fontFamily: "var(--font-body)" }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || (!content.trim() && uploadedMedia.length === 0)}
          className="p-2.5 rounded-xl bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-glow)] disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
