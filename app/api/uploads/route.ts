import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  type ImageMetadataRecord,
  upsertImageMetadataRecord,
} from "../../../lib/image-metadata-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadDirectoryPath = path.join(process.cwd(), "data", "uploads");

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function parsePositiveNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const userIdValue = formData.get("userId");
    const widthPx = parsePositiveNumber(formData.get("widthPx"));
    const heightPx = parsePositiveNumber(formData.get("heightPx"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing uploaded file." }, { status: 400 });
    }

    if (!widthPx || !heightPx) {
      return NextResponse.json(
        { error: "Missing image dimensions for uploaded file." },
        { status: 400 },
      );
    }

    const userId =
      typeof userIdValue === "string" && userIdValue.length > 0 ? userIdValue : "user_123";
    const imageId = crypto.randomUUID();
    const safeFileName = sanitizeFileName(file.name);
    const storedFileName = `${imageId}-${safeFileName}`;
    const storageUrl = `/api/uploads/${storedFileName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await mkdir(uploadDirectoryPath, { recursive: true });
    await writeFile(path.join(uploadDirectoryPath, storedFileName), fileBuffer);

    const record: ImageMetadataRecord = {
      image_id: imageId,
      user_id: userId,
      original_file_name: file.name,
      storage_url: storageUrl,
      file_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      width_px: widthPx,
      height_px: heightPx,
      aspect_ratio: Number((widthPx / heightPx).toFixed(4)),
      uploaded_at: Date.now(),
      status: "uploaded",
    };

    await upsertImageMetadataRecord(record);

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload request failed." },
      { status: 500 },
    );
  }
}
