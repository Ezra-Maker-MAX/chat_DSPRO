import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getModelForTenant } from "@/lib/llm-gateway";
import { streamText } from "ai";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages, systemPrompt, temperature = 0.7, maxTokens } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    // Get the appropriate model for this tenant
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content;
    const routed = await getModelForTenant(session.tenantId, lastUserMessage);

    if (!routed) {
      // Fallback: use environment default
      return NextResponse.json({
        error: "No LLM provider configured for this workspace",
      }, { status: 400 });
    }

    // Build the prompt with system message
    const fullMessages = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;

    // Stream the response
    const result = streamText({
      model: routed.provider.model(routed.provider.modelId),
      messages: fullMessages,
      temperature,
      maxTokens,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("LLM error:", error);
    return NextResponse.json({ error: "LLM request failed" }, { status: 500 });
  }
}
