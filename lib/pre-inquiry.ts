import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildDraftWorkbookData } from "@/lib/draft-builder";
import { masterWorkbookStore } from "@/lib/master-workbook-store";

type WorkbookSection = "Rule Master" | "Note Master" | "Rule-Note Map" | "Change Log";

export type InquiryEvidence = {
  id: string;
  section: WorkbookSection;
  title: string;
  summary: string;
  score: number;
  sourceFileName?: string;
  sheetName?: string;
  sourceLocation?: string;
};

export type InquiryAnswerResult = {
  answer: string;
  source: "bizrouter" | "local";
  evidence: InquiryEvidence[];
  generatedAt: string;
  masterCreatedAt: string;
};

export type InquiryAdoptionEntry = {
  id: string;
  question: string;
  answer: string;
  source: "bizrouter" | "local";
  evidence: InquiryEvidence[];
  adoptedAt: string;
};

type SearchRow = {
  id: string;
  section: WorkbookSection;
  title: string;
  summary: string;
  searchText: string;
  sourceFileName?: string;
  sheetName?: string;
  sourceLocation?: string;
};

type SourceContext = {
  sourceFileName?: string;
  sheetName?: string;
  sourceLocation?: string;
};

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^0-9a-zA-Z가-힣]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function uniqueTokens(tokens: string[]) {
  return Array.from(new Set(tokens));
}

function scoreRow(questionTokens: string[], row: SearchRow) {
  const searchTokens = tokenize(row.searchText);
  let score = 0;

  for (const token of uniqueTokens(questionTokens)) {
    if (searchTokens.includes(token)) {
      score += token.length >= 4 ? 3 : 1;
    } else if (row.searchText.toLowerCase().includes(token)) {
      score += 1;
    }
  }

  return score;
}

function stringValue(value: string | number | undefined) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function createSheetNameResolver(
  masterProducts: Array<{
    productName?: string;
    productCode?: string;
    sourceFileName?: string;
    sheetName?: string;
  }>
) {
  const exactKeyMap = new Map<string, string>();
  const fileOnlyMap = new Map<string, string>();

  masterProducts.forEach((product) => {
    const sourceFileName = stringValue(product.sourceFileName);
    const sheetName = stringValue(product.sheetName);
    const productCode = stringValue(product.productCode);
    const productName = stringValue(product.productName);

    if (!sourceFileName || !sheetName) {
      return;
    }

    fileOnlyMap.set(sourceFileName, sheetName);
    exactKeyMap.set(`${sourceFileName}::${productCode}::${productName}`, sheetName);
    exactKeyMap.set(`${sourceFileName}::${productCode}::`, sheetName);
    exactKeyMap.set(`${sourceFileName}::::${productName}`, sheetName);
  });

  return ({
    sourceFileName,
    productCode,
    productName
  }: {
    sourceFileName?: string;
    productCode?: string;
    productName?: string;
  }) => {
    const normalizedFileName = stringValue(sourceFileName);
    const normalizedProductCode = stringValue(productCode);
    const normalizedProductName = stringValue(productName);

    if (!normalizedFileName) {
      return "";
    }

    return (
      exactKeyMap.get(`${normalizedFileName}::${normalizedProductCode}::${normalizedProductName}`) ||
      exactKeyMap.get(`${normalizedFileName}::${normalizedProductCode}::`) ||
      exactKeyMap.get(`${normalizedFileName}::::${normalizedProductName}`) ||
      fileOnlyMap.get(normalizedFileName) ||
      ""
    );
  };
}

function buildSourceContext({
  sourceFileName,
  sheetName,
  productName,
  specialName,
  insuranceCode,
  sourceLocation
}: {
  sourceFileName?: string;
  sheetName?: string;
  productName?: string;
  specialName?: string;
  insuranceCode?: string;
  sourceLocation?: string;
}): SourceContext {
  const normalizedFileName = stringValue(sourceFileName);
  const normalizedSheetName = stringValue(sheetName);
  const normalizedProductName = stringValue(productName);
  const normalizedSpecialName = stringValue(specialName);
  const normalizedInsuranceCode = stringValue(insuranceCode);
  const normalizedSourceLocation = stringValue(sourceLocation);

  const sourceParts = [
    normalizedFileName,
    normalizedSheetName,
    normalizedProductName,
    normalizedSpecialName,
    normalizedInsuranceCode ? `보험코드 ${normalizedInsuranceCode}` : ""
  ].filter(Boolean);

  return {
    sourceFileName: normalizedFileName || undefined,
    sheetName: normalizedSheetName || undefined,
    sourceLocation:
      normalizedSourceLocation ||
      (sourceParts.length > 0 ? sourceParts.join(" / ") : undefined)
  };
}

function buildRuleRows(
  ruleMaster: Record<string, string | number | undefined>[],
  resolveSheetName: ReturnType<typeof createSheetNameResolver>
): SearchRow[] {
  return ruleMaster.map((row, index) => {
    const ruleId = stringValue(row["Rule ID"]) || `R-${index + 1}`;
    const specialName = stringValue(row["특약명"]);
    const insuranceCode = stringValue(row["보험코드"]);
    const productName = stringValue(row["상품명"]);
    const productCode = stringValue(row["상품코드"]);
    const saleDate = stringValue(row["판매일자"]);
    const asIsNormal = stringValue(row["as-is 일반/건강 단일건"]);
    const asIsSimple = stringValue(row["as-is 간편 단일건"]);
    const noteId = stringValue(row["주석ID"]);
    const sourceFileName = stringValue(row["출처위치"]);
    const sheetName = resolveSheetName({ sourceFileName, productCode, productName });
    const summary = [
      productName,
      specialName,
      insuranceCode ? `보험코드 ${insuranceCode}` : "",
      saleDate ? `판매일자 ${saleDate}` : "",
      asIsNormal ? `일반/건강 단일건 ${asIsNormal}` : "",
      asIsSimple ? `간편 단일건 ${asIsSimple}` : "",
      noteId ? `주석ID ${noteId}` : ""
    ]
      .filter(Boolean)
      .join(" / ");

    return {
      id: ruleId,
      section: "Rule Master" as const,
      title: `${specialName || productName} (${ruleId})`,
      summary,
      searchText: `${summary} ${stringValue(row["비고"])} ${stringValue(row["검토메모"])} ${sourceFileName} ${sheetName}`,
      ...buildSourceContext({
        sourceFileName,
        sheetName,
        productName,
        specialName,
        insuranceCode
      })
    };
  });
}

function buildNoteRows(
  noteMaster: Record<string, string | number | undefined>[],
  resolveSheetName: ReturnType<typeof createSheetNameResolver>
): SearchRow[] {
  return noteMaster.map((row, index) => {
    const noteId = stringValue(row["Note ID"]) || `N-${index + 1}`;
    const title = stringValue(row["주석명"]) || noteId;
    const originalText = stringValue(row["주석 원문"]);
    const productName = stringValue(row["상품명"]);
    const productCode = stringValue(row["상품코드"]);
    const specialName = stringValue(row["특약명"]);
    const insuranceCode = stringValue(row["보험코드"]);
    const sourceFileName = stringValue(row["출처파일"]).split("/")[0]?.trim();
    const sheetName = resolveSheetName({ sourceFileName, productCode, productName });
    const sourceLocation = stringValue(row["출처위치"]);
    const summary = [
      title,
      productName,
      specialName,
      insuranceCode
    ]
      .filter(Boolean)
      .join(" / ");

    return {
      id: noteId,
      section: "Note Master" as const,
      title,
      summary: originalText || summary,
      searchText: `${summary} ${originalText} ${stringValue(row["적용대상"])} ${sourceFileName} ${sheetName} ${sourceLocation}`,
      ...buildSourceContext({
        sourceFileName,
        sheetName,
        productName,
        specialName,
        insuranceCode,
        sourceLocation
      })
    };
  });
}

function buildMapRows(
  ruleNoteMap: Record<string, string | number | undefined>[],
  resolveSheetName: ReturnType<typeof createSheetNameResolver>
): SearchRow[] {
  return ruleNoteMap.map((row, index) => {
    const ruleId = stringValue(row["Rule ID"]);
    const noteId = stringValue(row["Note ID"]);
    const id = `${ruleId || "R"}-${noteId || index + 1}`;
    const productName = stringValue(row["상품명"]);
    const productCode = stringValue(row["상품코드"]);
    const specialName = stringValue(row["특약명"]);
    const insuranceCode = stringValue(row["보험코드"]);
    const sourceFileName = stringValue(row["출처위치"]).split("/")[0]?.trim();
    const sheetName = resolveSheetName({ sourceFileName, productCode, productName });
    const sourceLocation = stringValue(row["출처위치"]);
    const summary = [
      productName,
      specialName,
      insuranceCode,
      ruleId ? `Rule ${ruleId}` : "",
      noteId ? `Note ${noteId}` : "",
      stringValue(row["적용방식"])
    ]
      .filter(Boolean)
      .join(" / ");

    return {
      id,
      section: "Rule-Note Map" as const,
      title: `${specialName || productName} 연결관계`,
      summary,
      searchText: `${summary} ${stringValue(row["비고"])} ${stringValue(row["주석명"])} ${sourceFileName} ${sheetName} ${sourceLocation}`,
      ...buildSourceContext({
        sourceFileName,
        sheetName,
        productName,
        specialName,
        insuranceCode,
        sourceLocation
      })
    };
  });
}

function buildChangeRows(
  changeLog: Record<string, string | number | undefined>[],
  resolveSheetName: ReturnType<typeof createSheetNameResolver>
): SearchRow[] {
  return changeLog.map((row, index) => {
    const changeId = stringValue(row["Change ID"]) || `C-${index + 1}`;
    const title = stringValue(row["특약명"]) || stringValue(row["상품명"]) || changeId;
    const productName = stringValue(row["상품명"]);
    const productCode = stringValue(row["상품코드"]);
    const specialName = stringValue(row["특약명"]);
    const insuranceCode = stringValue(row["보험코드"]);
    const sourceFileName = stringValue(row["현행값"]);
    const sheetName = resolveSheetName({ sourceFileName, productCode, productName });
    const summary = [
      title,
      insuranceCode,
      stringValue(row["상태변경"]),
      stringValue(row["현행값"]),
      stringValue(row["변경값"])
    ]
      .filter(Boolean)
      .join(" / ");

    return {
      id: changeId,
      section: "Change Log" as const,
      title,
      summary,
      searchText: `${summary} ${stringValue(row["사유"])} ${stringValue(row["비고"])} ${sourceFileName} ${sheetName}`,
      ...buildSourceContext({
        sourceFileName,
        sheetName,
        productName,
        specialName,
        insuranceCode
      })
    };
  });
}

function buildFallbackAnswer(question: string, evidence: InquiryEvidence[]) {
  if (evidence.length === 0) {
    return `통합 마스터에서 "${question}"와 직접 연결되는 근거를 아직 찾지 못했습니다. 상품명, 특약명, 보험코드, 주석ID 중 하나를 더 넣어 질문해 주세요.`;
  }

  const firstEvidence = evidence[0];
  const evidenceList = evidence
    .slice(0, 3)
    .map((item) => `- ${item.section}: ${item.title} / ${item.summary}`)
    .join("\n");

  return [
    `통합 마스터 기준으로 가장 가까운 근거는 ${firstEvidence.section}의 "${firstEvidence.title}"입니다.`,
    "관련 근거 요약:",
    evidenceList,
    "위 근거를 바탕으로 답변 초안을 검토해 주세요. BizRouter 키가 설정되면 이 근거를 기반으로 자연어 답변을 더 정교하게 생성할 수 있습니다."
  ].join("\n");
}

async function generateBizRouterAnswer(question: string, evidence: InquiryEvidence[]) {
  const apiKey = process.env.BIZROUTER_API_KEY?.trim();
  const baseUrl = process.env.BIZROUTER_BASE_URL?.trim();
  const model = process.env.BIZROUTER_MODEL?.trim();

  if (!apiKey || !baseUrl || !model) {
    return null;
  }

  const evidenceBlock = evidence
    .map(
      (item) =>
        `[${item.section}] ${item.title}\n근거요약: ${item.summary}\n원본파일: ${item.sourceFileName ?? "-"}\n시트명: ${item.sheetName ?? "-"}\n출처위치: ${item.sourceLocation ?? "-"}`
    )
    .join("\n\n");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "너는 보험 신계약 통합 마스터를 읽고 답변하는 사전문의 에이전트다. 근거에 없는 내용은 추정하지 말고, 한국어로 짧고 명확하게 답하라."
        },
        {
          role: "user",
          content: `질문:\n${question}\n\n통합 마스터 근거:\n${evidenceBlock}\n\n요구사항:\n1. 질문에 대한 답변을 한국어로 작성\n2. 근거가 불충분하면 불충분하다고 명시\n3. 마지막에 "근거:" 한 줄로 어떤 Rule/Note를 썼는지 간단히 적기`
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function buildEvidence(question: string) {
  const snapshot = await masterWorkbookStore.load();

  if (!snapshot) {
    throw new Error("MASTER_NOT_FOUND");
  }

  const workbook = buildDraftWorkbookData(snapshot.request, { mode: "master" });
  const resolveSheetName = createSheetNameResolver(snapshot.request.masterProducts ?? []);
  const searchRows = [
    ...buildRuleRows(workbook.ruleMaster, resolveSheetName),
    ...buildNoteRows(workbook.noteMaster, resolveSheetName),
    ...buildMapRows(workbook.ruleNoteMap, resolveSheetName),
    ...buildChangeRows(workbook.changeLog, resolveSheetName)
  ];

  const questionTokens = tokenize(question);
  const evidence = searchRows
    .map((row) => ({
      ...row,
      score: scoreRow(questionTokens, row)
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      section: row.section,
      title: row.title,
      summary: row.summary,
      score: row.score,
      sourceFileName: row.sourceFileName,
      sheetName: row.sheetName,
      sourceLocation: row.sourceLocation
    }));

  return {
    evidence,
    masterCreatedAt: snapshot.createdAt
  };
}

export async function answerPreInquiry(question: string): Promise<InquiryAnswerResult> {
  const normalizedQuestion = question.trim();

  if (!normalizedQuestion) {
    throw new Error("QUESTION_REQUIRED");
  }

  const { evidence, masterCreatedAt } = await buildEvidence(normalizedQuestion);
  const bizRouterAnswer = await generateBizRouterAnswer(normalizedQuestion, evidence);
  const answer = bizRouterAnswer || buildFallbackAnswer(normalizedQuestion, evidence);

  return {
    answer,
    source: bizRouterAnswer ? "bizrouter" : "local",
    evidence,
    generatedAt: new Date().toISOString(),
    masterCreatedAt
  };
}

function createHistoryStorePath() {
  return join(process.cwd(), "data", "outputs", "pre-inquiry-history.json");
}

export async function saveAdoptedInquiry(entry: InquiryAdoptionEntry) {
  const filePath = createHistoryStorePath();
  await mkdir(dirname(filePath), { recursive: true });

  let existing: InquiryAdoptionEntry[] = [];
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as InquiryAdoptionEntry[];
    existing = Array.isArray(parsed) ? parsed : [];
  } catch {
    existing = [];
  }

  existing.unshift(entry);
  await writeFile(filePath, JSON.stringify(existing, null, 2), "utf8");

  return entry;
}
