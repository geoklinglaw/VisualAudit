import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ImageMetadataRecord = {
  image_id: string;
  user_id: string;
  original_file_name: string;
  storage_url: string;
  file_type: string;
  file_size_bytes: number;
  width_px: number;
  height_px: number;
  aspect_ratio: number;
  uploaded_at: number;
  status: "uploaded" | "failed" | "processing";
};

const dataDirectoryPath = path.join(process.cwd(), "data");
const metadataFilePath = path.join(dataDirectoryPath, "image-metadata.json");

async function ensureMetadataFile() {
  await mkdir(dataDirectoryPath, { recursive: true });

  try {
    await readFile(metadataFilePath, "utf8");
  } catch {
    await writeFile(metadataFilePath, "[]\n", "utf8");
  }
}

export function isImageMetadataRecord(value: unknown): value is ImageMetadataRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<ImageMetadataRecord>;

  return (
    typeof record.image_id === "string" &&
    typeof record.user_id === "string" &&
    typeof record.original_file_name === "string" &&
    typeof record.storage_url === "string" &&
    typeof record.file_type === "string" &&
    typeof record.file_size_bytes === "number" &&
    typeof record.width_px === "number" &&
    typeof record.height_px === "number" &&
    typeof record.aspect_ratio === "number" &&
    typeof record.uploaded_at === "number" &&
    typeof record.status === "string"
  );
}

export async function readImageMetadataRecords() {
  await ensureMetadataFile();

  const contents = await readFile(metadataFilePath, "utf8");
  const parsed = JSON.parse(contents) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Image metadata store must contain a JSON array.");
  }

  return parsed.filter(isImageMetadataRecord);
}

export async function upsertImageMetadataRecord(record: ImageMetadataRecord) {
  const records = await readImageMetadataRecords();
  const nextRecords = records.filter(
    (existingRecord) => existingRecord.image_id !== record.image_id,
  );

  nextRecords.push(record);
  nextRecords.sort((left, right) => right.uploaded_at - left.uploaded_at);

  await writeFile(metadataFilePath, `${JSON.stringify(nextRecords, null, 2)}\n`, "utf8");

  return record;
}

export { metadataFilePath };
