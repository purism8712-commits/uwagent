import type { ParsedProductCandidate } from "@/lib/product-candidate-parser";
import { matchesDelimitedTerm, normalizeSearchText } from "@/lib/change-intent";

type CandidateMatchKind =
  | "보험코드 일치"
  | "특약명 일치"
  | "상품코드 일치"
  | "상품명 일치"
  | "유사";

export type TargetCandidate = {
  id: string;
  productName: string;
  specialName: string;
  insuranceCode: string;
  productCode: string;
  saleDate: string;
  sourceFileName: string;
  limitValue: string;
  noteText: string;
  summary: string;
  matchKind: CandidateMatchKind;
  matchReason: string;
  score: number;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeId(text: string) {
  return text.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function buildCandidateSummary(candidate: Pick<TargetCandidate, "productCode" | "insuranceCode" | "saleDate">) {
  const saleDateText = candidate.saleDate ? `판매일자 ${candidate.saleDate}` : "판매일자 미기재";
  const codeText = candidate.productCode ? `상품코드 ${candidate.productCode}` : "상품코드 미기재";
  const insuranceText = candidate.insuranceCode ? ` / 보험코드 ${candidate.insuranceCode}` : "";

  return `${codeText}${insuranceText} 기준 / ${saleDateText}`;
}

function buildMatchReason(parts: string[]) {
  const uniqueParts = uniqueText(parts);
  if (uniqueParts.length === 0) {
    return "유사 후보";
  }

  return uniqueParts.join(" · ");
}

function scoreCandidate(rawInput: string, candidate: {
  productName: string;
  specialName: string;
  insuranceCode: string;
  productCode: string;
}) {
  const normalizedInput = normalizeSearchText(rawInput);
  const normalizedSpecial = normalizeSearchText(candidate.specialName);
  const normalizedInsurance = normalizeSearchText(candidate.insuranceCode);
  const normalizedProduct = normalizeSearchText(candidate.productName);
  const normalizedProductCode = normalizeSearchText(candidate.productCode);

  let score = 0;
  let matchKind: CandidateMatchKind = "유사";
  const matchReasons: string[] = [];

  const registerMatch = (kind: CandidateMatchKind, value: number) => {
    score += value;
    if (matchKind === "유사") {
      matchKind = kind;
    }
    matchReasons.push(kind);
  };

  if (candidate.insuranceCode && matchesDelimitedTerm(rawInput, candidate.insuranceCode)) {
    registerMatch("보험코드 일치", 500);
  } else if (
    normalizedInput &&
    normalizedInsurance &&
    (normalizedInput === normalizedInsurance || normalizedInsurance.includes(normalizedInput))
  ) {
    registerMatch("보험코드 일치", 420);
  }

  if (candidate.specialName && matchesDelimitedTerm(rawInput, candidate.specialName)) {
    registerMatch("특약명 일치", 400);
  } else if (
    normalizedInput &&
    normalizedSpecial &&
    (normalizedInput === normalizedSpecial || normalizedSpecial.includes(normalizedInput))
  ) {
    registerMatch("특약명 일치", 320);
  }

  if (candidate.productCode && matchesDelimitedTerm(rawInput, candidate.productCode)) {
    registerMatch("상품코드 일치", 260);
  } else if (
    normalizedInput &&
    normalizedProductCode &&
    (normalizedInput === normalizedProductCode || normalizedProductCode.includes(normalizedInput))
  ) {
    registerMatch("상품코드 일치", 200);
  }

  if (candidate.productName && matchesDelimitedTerm(rawInput, candidate.productName)) {
    registerMatch("상품명 일치", 180);
  } else if (
    normalizedInput &&
    normalizedProduct &&
    (normalizedInput === normalizedProduct || normalizedProduct.includes(normalizedInput))
  ) {
    registerMatch("상품명 일치", 120);
  }

  const looseOverlap =
    normalizedInput &&
    [normalizedSpecial, normalizedInsurance, normalizedProduct, normalizedProductCode].some(
      (term) => Boolean(term) && Boolean(normalizedInput) && term.slice(0, 3) && normalizedInput.includes(term.slice(0, 3))
    );

  if (score === 0 && looseOverlap) {
    score = 40;
    matchKind = "유사";
    matchReasons.push("유사");
  }

  return {
    score,
    matchKind,
    matchReason: buildMatchReason(matchReasons)
  };
}

function dedupeTargetCandidates(candidates: TargetCandidate[]) {
  const seen = new Set<string>();
  const result: TargetCandidate[] = [];

  for (const candidate of candidates) {
    const dedupeKey = [
      candidate.sourceFileName,
      candidate.productCode,
      candidate.productName,
      candidate.specialName,
      candidate.insuranceCode
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .join("|");

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(candidate);
  }

  return result;
}

export function buildTargetCandidates(
  rawInput: string,
  masterProducts: ParsedProductCandidate[] = []
) {
  const normalizedInput = normalizeSearchText(rawInput);

  if (!normalizedInput) {
    return [] as TargetCandidate[];
  }

  const candidates: TargetCandidate[] = [];

  for (const product of masterProducts) {
    const productName = normalizeText(product.productName);
    const productCode = normalizeText(product.productCode ?? "");
    const saleDate = normalizeText(product.saleDate);
    const sourceFileName = normalizeText(product.sourceFileName);

    for (const item of product.specialItems ?? []) {
      const specialName = normalizeText(item.specialName);
      const insuranceCode = normalizeText(item.insuranceCode);
      const limitValue = normalizeText(item.limitValue ?? "");
      const noteText = normalizeText(item.noteText ?? "");

      if (!specialName && !insuranceCode && !productName) {
        continue;
      }

      const { score, matchKind, matchReason } = scoreCandidate(rawInput, {
        productName,
        specialName,
        insuranceCode,
        productCode
      });

      if (score <= 0) {
        continue;
      }

      candidates.push({
        id: sanitizeId(
          `target-${sourceFileName}-${productCode || "no-product-code"}-${specialName || productName}-${insuranceCode || "no-insurance-code"}`
        ),
        productName,
        specialName: specialName || productName,
        insuranceCode,
        productCode,
        saleDate,
        sourceFileName,
        limitValue,
        noteText,
        summary: buildCandidateSummary({
          productCode,
          insuranceCode,
          saleDate
        }),
        matchKind,
        matchReason,
        score
      });
    }
  }

  return dedupeTargetCandidates(
    candidates.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftSpecialLength = normalizeSearchText(left.specialName).length;
      const rightSpecialLength = normalizeSearchText(right.specialName).length;

      if (rightSpecialLength !== leftSpecialLength) {
        return rightSpecialLength - leftSpecialLength;
      }

      const leftPriority = left.matchKind === "보험코드 일치" ? 4 : left.matchKind === "특약명 일치" ? 3 : left.matchKind === "상품코드 일치" ? 2 : left.matchKind === "상품명 일치" ? 1 : 0;
      const rightPriority = right.matchKind === "보험코드 일치" ? 4 : right.matchKind === "특약명 일치" ? 3 : right.matchKind === "상품코드 일치" ? 2 : right.matchKind === "상품명 일치" ? 1 : 0;

      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority;
      }

      return left.id.localeCompare(right.id);
    })
  ).slice(0, 3);
}

export function findSelectedTargetCandidate(
  candidates: TargetCandidate[],
  selectedCandidateId: string
) {
  const normalizedId = normalizeText(selectedCandidateId);

  if (!normalizedId) {
    return null;
  }

  return candidates.find((candidate) => candidate.id === normalizedId) ?? null;
}

export function matchesTargetCandidate(
  row: Pick<Record<string, string | number>, "상품명" | "특약명" | "상품코드" | "보험코드">,
  candidate: TargetCandidate
) {
  const rowInsuranceCode = normalizeSearchText(String(row.보험코드 ?? ""));
  const rowSpecialName = normalizeSearchText(String(row.특약명 ?? ""));
  const rowProductName = normalizeSearchText(String(row.상품명 ?? ""));
  const rowProductCode = normalizeSearchText(String(row.상품코드 ?? ""));

  const targetInsuranceCode = normalizeSearchText(candidate.insuranceCode);
  const targetSpecialName = normalizeSearchText(candidate.specialName);
  const targetProductName = normalizeSearchText(candidate.productName);
  const targetProductCode = normalizeSearchText(candidate.productCode);

  const hasSpecialOrCodeTarget = Boolean(targetSpecialName || targetInsuranceCode);

  if (targetInsuranceCode && rowInsuranceCode && rowInsuranceCode === targetInsuranceCode) {
    return true;
  }

  if (targetSpecialName && rowSpecialName && rowSpecialName === targetSpecialName) {
    if (!targetProductName || rowProductName === targetProductName) {
      return true;
    }
  }

  if (!hasSpecialOrCodeTarget && targetProductCode && rowProductCode && rowProductCode === targetProductCode) {
    return true;
  }

  if (!hasSpecialOrCodeTarget && targetProductName && rowProductName && rowProductName === targetProductName) {
    return true;
  }

  return false;
}

export function summarizeTargetCandidate(candidate: TargetCandidate) {
  const specialName = candidate.specialName || "대상 특약";
  const insuranceCode = candidate.insuranceCode ? ` / 보험코드 ${candidate.insuranceCode}` : "";
  const productName = candidate.productName ? ` (${candidate.productName})` : "";

  return `${specialName}${insuranceCode}${productName}`;
}
