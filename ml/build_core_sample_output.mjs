import fs from "node:fs/promises";
import path from "node:path";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "C:\\Users\\suhyang\\Desktop\\uwagent\\data\\outputs";
const outputPath = path.join(outputDir, "신계약가이드라인_공통코어_샘플결과.xlsx");

const workbook = Workbook.create();

const ruleMaster = workbook.worksheets.add("Rule Master");
const noteMaster = workbook.worksheets.add("Note Master");
const ruleNoteMap = workbook.worksheets.add("Rule-Note Map");
const changeLog = workbook.worksheets.add("Change Log");

const headerFill = "#1F4E78";
const headerFont = "#FFFFFF";
const subHeaderFill = "#D9EAF7";
const draftFill = "#FFF4CC";

const ruleHeaders = [[
  "Rule ID",
  "상태",
  "특약명",
  "세부구분",
  "보험코드",
  "일반/건강 단일건",
  "일반/건강 수술유의fc",
  "간편 단일건",
  "간편 수술유의fc",
  "인별합산",
  "적용조건",
  "주석ID",
  "종료사유",
  "출처위치",
  "검토메모",
  "초안상태",
]];

const ruleRows = [
  ["R-001", "현행", "주보험", "", "LI00111", 1000, "", 1000, "", 5000, "", "N-001", "", "Sheet1!B5:J5", "", "초안"],
  ["R-002", "현행", "암진단", "", "LI00112", 2000, "", 2000, "", 5000, "", "N-002", "", "Sheet1!B6:J6", "", "초안"],
  ["R-003", "현행", "소액암진단", "", "LI00113", 1000, "", 1000, "", 3000, "", "N-002,N-003", "", "Sheet1!B7:J7", "주3의 본문 수치와 하단 주석 수치가 달라 검토 필요", "초안"],
  ["R-004", "현행", "파워수술", "1종", "LI00115", 100, 50, 100, 50, 100, "1종*20배 < 5종가입금액", "N-004", "", "Sheet1!B9:J9", "비고란 조건과 하단 주4 문구를 함께 검토 필요", "초안"],
  ["R-005", "현행", "파워수술", "2종", "LI00116", 200, 100, 200, 100, 200, "", "N-004", "", "Sheet1!B10:J10", "", "초안"],
  ["R-006", "현행", "파워수술", "3종", "LI00117", 300, 150, 300, 150, 300, "", "N-004", "", "Sheet1!B11:J11", "", "초안"],
  ["R-007", "현행", "파워수술", "4종", "LI00118", 500, 250, 500, 250, 500, "", "N-004", "", "Sheet1!B12:J12", "", "초안"],
  ["R-008", "현행", "파워수술", "5종", "LI00119", 1000, 500, 1000, 500, 1000, "", "N-004", "", "Sheet1!B13:J13", "", "초안"],
  ["R-009", "현행", "신입원특약", "", "LI00120", 3000, "", 3000, "", 5000, "", "N-005", "", "Sheet1!B14:J14", "", "초안"],
  ["R-010", "현행", "입원간병인", "", "LI00121", 5000, "", 5000, "", 10000, "", "N-006", "", "Sheet1!B15:J15", "", "초안"],
];

const noteHeaders = [[
  "Note ID",
  "주석명",
  "주석 원문",
  "주석유형",
  "적용대상",
  "우선순위",
  "출처위치",
  "검토메모",
]];

const noteRows = [
  ["N-001", "주보험 설계 조건", "주보험 가입금액 3억 초과시 특약보험료 50만원이상 설계 필요", "가입조건", "R-001", 1, "Sheet1!B18", ""],
  ["N-002", "암진단-소액암 연계", "암진단 가입시 소액암 진단 가입필수", "연계조건", "R-002,R-003", 1, "Sheet1!B19", ""],
  ["N-003", "소액암 인별합산 예외", "소액암 진단 인별합산 한도 5천만원 (단, 66세 이상 3천만)", "예외/상향기준", "R-003", 1, "Sheet1!B20", "본문 인별합산 3000과 주석 5000/3000 조건의 관계 검토 필요"],
  ["N-004", "파워수술 인별합산", "파워수술 인별합산 1구좌 가입가능", "합산기준", "R-004,R-005,R-006,R-007,R-008", 1, "Sheet1!B21", "비고란의 1종*20배 < 5종가입금액 조건과 함께 해석 필요"],
  ["N-005", "신입원 위험등급별 한도", "신입원 특약 위험등급별 한도 : A등급 3만원, B등급 1만원", "위험등급 조건", "R-009", 1, "Sheet1!B22", ""],
  ["N-006", "입원간병인 타사 가입 제한", "입원 간병인은 타사 가입시 가입불가", "가입제한", "R-010", 1, "Sheet1!B23", ""],
];

const mapHeaders = [[
  "Rule ID",
  "Note ID",
  "적용범위",
  "적용방식",
  "출처위치",
  "검토필요",
]];

const mapRows = [
  ["R-001", "N-001", "단일행", "가입조건 적용", "Sheet1!E5 + Sheet1!B18", "N"],
  ["R-002", "N-002", "단일행", "연계조건 적용", "Sheet1!E6 + Sheet1!B19", "N"],
  ["R-003", "N-002", "단일행", "연계조건 적용", "Sheet1!E7 + Sheet1!B19", "N"],
  ["R-003", "N-003", "단일행", "예외 적용", "Sheet1!E7 + Sheet1!B20", "Y"],
  ["R-004", "N-004", "묶음특약 전체", "합산기준 적용", "Sheet1!E9 + Sheet1!B21", "Y"],
  ["R-005", "N-004", "묶음특약 전체", "합산기준 적용", "Sheet1!B10:J10 + Sheet1!B21", "N"],
  ["R-006", "N-004", "묶음특약 전체", "합산기준 적용", "Sheet1!B11:J11 + Sheet1!B21", "N"],
  ["R-007", "N-004", "묶음특약 전체", "합산기준 적용", "Sheet1!B12:J12 + Sheet1!B21", "N"],
  ["R-008", "N-004", "묶음특약 전체", "합산기준 적용", "Sheet1!B13:J13 + Sheet1!B21", "N"],
  ["R-009", "N-005", "단일행", "위험등급 조건 적용", "Sheet1!E14 + Sheet1!B22", "N"],
  ["R-010", "N-006", "단일행", "가입제한 적용", "Sheet1!E15 + Sheet1!B23", "N"],
];

const changeHeaders = [[
  "Change ID",
  "Rule ID",
  "상태변경",
  "현행값",
  "변경값",
  "사유",
  "적용일",
  "비고",
]];

const changeRows = [
  ["C-001", "ALL", "해당없음", "", "", "원본 파일에 변경 전후 이력이 없어 Change Log는 비워둠", "", "샘플 결과용 메모"],
];

function formatSheet(sheet, headerRange, bodyRange, widths) {
  sheet.getRange(headerRange).format = {
    fill: headerFill,
    font: { bold: true, color: headerFont },
    wrapText: true,
    horizontalAlignment: "Center",
    verticalAlignment: "Center",
    borders: { preset: "all", style: "thin", color: "#D9D9D9" },
  };
  sheet.getRange(bodyRange).format = {
    borders: { preset: "all", style: "thin", color: "#D9D9D9" },
    verticalAlignment: "Center",
    wrapText: true,
  };
  widths.forEach(([col, width]) => {
    sheet.getRange(`${col}:${col}`).format.columnWidth = width;
  });
  sheet.freezePanes.freezeRows(2);
}

ruleMaster.getRange("A1:P1").merge();
ruleMaster.getRange("A1").values = [["공통 코어 에이전트 샘플 결과 - Rule Master"]];
ruleMaster.getRange("A1").format = {
  fill: subHeaderFill,
  font: { bold: true },
  horizontalAlignment: "Left",
};
ruleMaster.getRange("A2:P2").values = ruleHeaders;
ruleMaster.getRange(`A3:P${ruleRows.length + 2}`).values = ruleRows;
formatSheet(
  ruleMaster,
  "A2:P2",
  `A3:P${ruleRows.length + 2}`,
  [["A", 12], ["B", 10], ["C", 16], ["D", 12], ["E", 12], ["F", 12], ["G", 14], ["H", 12], ["I", 14], ["J", 10], ["K", 26], ["L", 16], ["M", 12], ["N", 20], ["O", 28], ["P", 10]],
);
ruleMaster.getRange(`O3:O${ruleRows.length + 2}`).format.fill = draftFill;
ruleMaster.getRange(`P3:P${ruleRows.length + 2}`).format.fill = draftFill;

noteMaster.getRange("A1:H1").merge();
noteMaster.getRange("A1").values = [["공통 코어 에이전트 샘플 결과 - Note Master"]];
noteMaster.getRange("A1").format = { fill: subHeaderFill, font: { bold: true } };
noteMaster.getRange("A2:H2").values = noteHeaders;
noteMaster.getRange(`A3:H${noteRows.length + 2}`).values = noteRows;
formatSheet(
  noteMaster,
  "A2:H2",
  `A3:H${noteRows.length + 2}`,
  [["A", 12], ["B", 20], ["C", 42], ["D", 16], ["E", 18], ["F", 10], ["G", 18], ["H", 28]],
);
noteMaster.getRange(`H3:H${noteRows.length + 2}`).format.fill = draftFill;

ruleNoteMap.getRange("A1:F1").merge();
ruleNoteMap.getRange("A1").values = [["공통 코어 에이전트 샘플 결과 - Rule-Note Map"]];
ruleNoteMap.getRange("A1").format = { fill: subHeaderFill, font: { bold: true } };
ruleNoteMap.getRange("A2:F2").values = mapHeaders;
ruleNoteMap.getRange(`A3:F${mapRows.length + 2}`).values = mapRows;
formatSheet(
  ruleNoteMap,
  "A2:F2",
  `A3:F${mapRows.length + 2}`,
  [["A", 12], ["B", 12], ["C", 16], ["D", 18], ["E", 24], ["F", 10]],
);
ruleNoteMap.getRange(`F3:F${mapRows.length + 2}`).format.fill = draftFill;

changeLog.getRange("A1:H1").merge();
changeLog.getRange("A1").values = [["공통 코어 에이전트 샘플 결과 - Change Log"]];
changeLog.getRange("A1").format = { fill: subHeaderFill, font: { bold: true } };
changeLog.getRange("A2:H2").values = changeHeaders;
changeLog.getRange(`A3:H${changeRows.length + 2}`).values = changeRows;
formatSheet(
  changeLog,
  "A2:H2",
  `A3:H${changeRows.length + 2}`,
  [["A", 12], ["B", 10], ["C", 14], ["D", 16], ["E", 16], ["F", 34], ["G", 12], ["H", 20]],
);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(outputPath);
