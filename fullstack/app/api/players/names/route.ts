import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("addresses") ?? "";
    const addresses = raw
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter((a) => /^0x[0-9a-f]{40}$/.test(a));

    if (addresses.length === 0) {
      return NextResponse.json({ names: {} });
    }

    const { data } = await supabaseAdmin
      .from("players")
      .select("wallet_address, display_name")
      .in("wallet_address", addresses);

    const names: Record<string, string | null> = {};
    for (const a of addresses) names[a] = null;
    for (const row of data ?? []) {
      if (row.wallet_address) {
        names[row.wallet_address as string] =
          (row.display_name as string) ?? null;
      }
    }

    return NextResponse.json({ names });
  } catch (err: any) {
    console.error("players/names error:", err);
    return NextResponse.json(
      { names: {}, error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
