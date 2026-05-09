import { NextResponse } from "next/server";

import {
  isImageMetadataRecord,
  readImageMetadataRecords,
  upsertImageMetadataRecord,
} from "../../../lib/image-metadata-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const records = await readImageMetadataRecords();

  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as unknown;

  if (!isImageMetadataRecord(payload)) {
    return NextResponse.json(
      { error: "Invalid image metadata payload." },
      { status: 400 },
    );
  }

  const record = await upsertImageMetadataRecord(payload);

  return NextResponse.json({ record }, { status: 201 });
}
