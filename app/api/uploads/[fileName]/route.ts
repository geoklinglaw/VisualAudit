import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadDirectoryPath = path.join(process.cwd(), "data", "uploads");

const contentTypeByExtension = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webp", "image/webp"],
]);

export async function GET(
  _: Request,
  context: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await context.params;
  const filePath = path.join(uploadDirectoryPath, fileName);

  try {
    const fileBuffer = await readFile(filePath);
    const extension = path.extname(fileName).toLowerCase();
    const contentType =
      contentTypeByExtension.get(extension) ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Uploaded file not found." }, { status: 404 });
  }
}
