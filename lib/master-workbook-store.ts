import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DraftRequest } from "@/lib/draft-builder";
import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";

export type MasterWorkbookSnapshot = {
  uploadedFiles: string[];
  request: DraftRequest;
  createdAt: string;
};

export type MasterWorkbookStore = {
  load: () => Promise<MasterWorkbookSnapshot | null>;
  save: (snapshot: MasterWorkbookSnapshot) => Promise<MasterWorkbookSnapshot>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMasterProducts(value: unknown): ParsedProductCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is ParsedProductCandidate => {
    if (!isRecord(item)) {
      return false;
    }

    return typeof item.productName === "string" && typeof item.sourceFileName === "string";
  });
}

function normalizeSnapshot(value: unknown): MasterWorkbookSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const request = isRecord(value.request) ? value.request : null;
  const uploadedFiles = Array.isArray(value.uploadedFiles)
    ? value.uploadedFiles.filter((item): item is string => typeof item === "string")
    : [];

  if (!request) {
    return null;
  }

  return {
    uploadedFiles,
      request: {
      fileName: typeof request.fileName === "string" ? request.fileName : "",
      rawInput: typeof request.rawInput === "string" ? request.rawInput : "",
      answers: isRecord(request.answers)
        ? Object.fromEntries(
            Object.entries(request.answers).filter(
              (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
            )
          )
        : {},
      productName: typeof request.productName === "string" ? request.productName : "",
      uploadedFiles: Array.isArray(request.uploadedFiles)
        ? request.uploadedFiles.filter((item): item is string => typeof item === "string")
        : uploadedFiles,
      masterProducts: normalizeMasterProducts(request.masterProducts)
    },
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString()
  };
}

export function createMasterWorkbookStore(
  storePath = join(process.cwd(), "data", "outputs", "master-workbook-state.json")
): MasterWorkbookStore {
  return {
    async load() {
      try {
        const raw = await readFile(storePath, "utf8");
        return normalizeSnapshot(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    async save(snapshot) {
      await mkdir(dirname(storePath), { recursive: true });
      await writeFile(storePath, JSON.stringify(snapshot, null, 2), "utf8");
      return snapshot;
    }
  };
}

export const masterWorkbookStore = createMasterWorkbookStore();
