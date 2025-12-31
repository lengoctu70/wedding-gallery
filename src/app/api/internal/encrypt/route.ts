import { type NextRequest, NextResponse } from "next/server";

import { encryptionService } from "~/lib/utils.server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not available in production", { status: 404 });
  }

  try {
    const sp = new URL(request.nextUrl).searchParams;
    const query = sp.get("q");
    const key = sp.get("key");
    if (!query) return new NextResponse("Add query parameter 'q' with the value to encrypt", { status: 400 });

    const encrypted = encryptionService.encrypt(query, key ?? undefined);
    const decrypted = encryptionService.decrypt(encrypted, key ?? undefined);

    return NextResponse.json(
      {
        message: key ? "Encrypted with provided key" : "Encrypted with environment key",
        encryptedValue: encrypted,
        decryptedValue: decrypted,
        // SECURITY: Do not expose key, even in development
      },
      { status: 200 },
    );
  } catch (error) {
    const e = error as Error;
    console.error(e);
    return new Response(e.message, { status: 500 });
  }
}
