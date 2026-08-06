"use client";

import ChatArea from "@/components/chat/ChatArea";

interface Props {
  channelId: string;
  channelName: string;
  currentUserId: string;
  allowMedia: boolean;
  allowVoice: boolean;
}

export default function ChatPageClient({
  channelId,
  channelName,
  currentUserId,
  allowMedia,
  allowVoice,
}: Props) {
  return (
    <ChatArea
      channelId={channelId}
      channelName={channelName}
      currentUserId={currentUserId}
      allowMedia={allowMedia}
      allowVoice={allowVoice}
    />
  );
}
