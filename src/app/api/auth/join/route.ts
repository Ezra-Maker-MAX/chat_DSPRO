import { NextRequest, NextResponse } from "next/server";
import { joinTenant, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inviteCode, nickname } = body;

    if (!inviteCode || !nickname) {
      return NextResponse.json({ error: "Invite code and nickname are required" }, { status: 400 });
    }

    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json({ error: "Nickname must be 2-20 characters" }, { status: 400 });
    }

    const result = await joinTenant(inviteCode, nickname);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await setSessionCookie(result.token);

    return NextResponse.json({
      success: true,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
    });
  } catch (error) {
    console.error("Join error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
