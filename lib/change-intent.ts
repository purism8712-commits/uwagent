function normalizeText(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value: string) {
  return normalizeText(value).replace(/,/g, "");
}

function parseKoreanAmount(rawValue: string) {
  const normalized = normalizeText(rawValue).replace(/,/g, "");
  const directNumber = normalized.match(/^(\d+)$/);
  if (directNumber) {
    return directNumber[1];
  }

  const unitMatch = normalized.match(/^(\d+(?:\.\d+)?)(천|만|억)(?:원)?$/);
  if (!unitMatch) {
    return null;
  }

  const amount = Number(unitMatch[1]);
  if (Number.isNaN(amount)) {
    return null;
  }

  const multiplier =
    unitMatch[2] === "천" ? 1_000 :
    unitMatch[2] === "만" ? 10_000 :
    100_000_000;

  return String(Math.round(amount * multiplier));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeSearchText(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s,/_-]+/g, "");
}

export function matchesDelimitedTerm(haystack: string, term: string) {
  const normalizedHaystack = normalizeText(haystack).toLowerCase();
  const normalizedTerm = normalizeText(term).toLowerCase();

  if (!normalizedHaystack || !normalizedTerm) {
    return false;
  }

  const escapedTerm = normalizedTerm
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => escapeRegExp(part))
    .join("\\s*");
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapedTerm}(?=$|[^\\p{L}\\p{N}])`,
    "u"
  );

  return pattern.test(normalizedHaystack);
}

export function extractRequestedLimitValue(rawInput: string) {
  const normalized = normalizeText(rawInput);

  if (!normalized) {
    return null;
  }

  const rangeMatch = normalized.match(/(\d[\d,]*)\s*(?:->|→|~|에서)\s*(\d[\d,]*)/);
  if (rangeMatch) {
    return normalizeNumber(rangeMatch[2]);
  }

  const targetMatch = normalized.match(/(?:to-be|변경값|변경 후|목표)\s*[:=]?\s*(\d[\d,]*)/i);
  if (targetMatch) {
    return normalizeNumber(targetMatch[1]);
  }

  const normalizedKoreanAmount = parseKoreanAmount(normalized);
  if (normalizedKoreanAmount) {
    const amountMatch = normalized.match(/(?:한도|금액|기준|변경|목표|to-be)\s*[:=]?\s*(\d+(?:\.\d+)?(?:천|만|억)?(?:원)?)/i);
    if (amountMatch) {
      const parsed = parseKoreanAmount(amountMatch[1]);
      if (parsed) {
        return parsed;
      }
    }
  }

  const changeMatch = normalized.match(/(\d[\d,]*)\s*(?:으로|로)\s*변경/);
  if (changeMatch) {
    return normalizeNumber(changeMatch[1]);
  }

  const koreanChangeMatch = normalized.match(/(\d+(?:\.\d+)?(?:천|만|억)?(?:원)?)\s*(?:으로|로)\s*변경/);
  if (koreanChangeMatch) {
    const parsed = parseKoreanAmount(koreanChangeMatch[1]);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function isNoopLimitChange(baseLimitValue: string, rawInput: string) {
  const requestedLimitValue = extractRequestedLimitValue(rawInput);

  if (!requestedLimitValue) {
    return false;
  }

  return normalizeNumber(baseLimitValue) === requestedLimitValue;
}
