import styles from "./components.module.css";
import type { DraftWorkbookData } from "@/lib/draft-builder";

type InputStageProps = {
  rawInput: string;
  masterFileNames: string[];
  changeFileNames: string[];
  masterPreview: DraftWorkbookData | null;
  isActionDisabled: boolean;
  isMasterCreated: boolean;
  isCreatingMaster: boolean;
  isPreviewLoading: boolean;
  previewError: string;
  onRawInputChange: (value: string) => void;
  onMasterFileChange: (files: File[]) => void;
  onChangeFileChange: (files: File[]) => void;
  onCreateMasterWorkbook: () => void;
  onPreviewMasterWorkbook: () => void;
  onComplete: () => void;
};

const previewSections: Array<{
  key: keyof DraftWorkbookData;
  label: string;
  note: string;
}> = [
  { key: "overview", label: "Overview", note: "상품명과 판매일자를 먼저 확인" },
  { key: "ruleMaster", label: "Rule Master", note: "규칙 본문이 행 단위로 정리됨" },
  { key: "noteMaster", label: "Note Master", note: "주석/예외를 별도 엔터티로 분리" },
  { key: "ruleNoteMap", label: "Rule-Note Map", note: "규칙과 주석 연결 관계" },
  { key: "changeLog", label: "Change Log", note: "변경 전후 이력과 상태 전환" }
];

function renderPreviewRows(rows: Record<string, string | number>[]) {
  if (rows.length === 0) {
    return <p className={styles.currentGuidelinesPreviewEmpty}>표시할 데이터가 없습니다.</p>;
  }

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  return (
    <div className={styles.currentGuidelinesPreviewTableWrap}>
      <table className={styles.currentGuidelinesPreviewTable}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${columns.join("-")}`}>
              {columns.map((column) => (
                <td key={column}>{String(row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InputStage({
  rawInput,
  masterFileNames,
  changeFileNames,
  masterPreview,
  isActionDisabled,
  isMasterCreated,
  isCreatingMaster,
  isPreviewLoading,
  previewError,
  onRawInputChange,
  onMasterFileChange,
  onChangeFileChange,
  onCreateMasterWorkbook,
  onPreviewMasterWorkbook,
  onComplete
}: InputStageProps) {
  return (
    <section className={styles.stepFlowStack}>
      <div className={styles.currentGuidelinesCard}>
        <div className={styles.currentGuidelinesTop}>
          <div className={styles.currentGuidelinesCopy}>
            <span className={styles.panelLabel}>STEP 1</span>
            <h3 className={styles.currentGuidelinesTitle}>전체 통합 마스터 파일 만들기</h3>
            <p className={styles.currentGuidelinesText}>
              여러 상품의 가이드라인 엑셀을 한 번에 올리면, 공통 코어가 이를 표준
              템플릿으로 바꾼 뒤 하나의 통합 마스터 파일로 묶어 줍니다.
            </p>
          </div>
          <div className={styles.currentGuidelinesControls}>
            <div className={styles.currentGuidelinesActionRow}>
              <label className={styles.uploadButton} htmlFor="master-excel-upload">
                파일 여러 개 선택
              </label>
              <input
                id="master-excel-upload"
                aria-label="가이드라인 엑셀 업로드"
                className={styles.fileInput}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={(event) =>
                  onMasterFileChange(Array.from(event.target.files ?? []))
                }
              />
              <button
                className={styles.primaryButton}
                type="button"
                onClick={onCreateMasterWorkbook}
                disabled={isActionDisabled || isCreatingMaster || masterFileNames.length === 0}
              >
                {isCreatingMaster ? "통합 마스터 생성 중..." : "전체 통합 마스터 파일 만들기"}
              </button>
              {masterFileNames.length === 0 ? (
                <span className={styles.currentGuidelinesInlineWarning}>
                  <span className={styles.currentGuidelinesWarningIcon} aria-hidden="true">
                    !
                  </span>
                  <span>아직 가이드라인 파일이 선택되지 않았습니다.</span>
                </span>
              ) : null}
            </div>
            {masterFileNames.length > 0 ? (
              <div className={styles.fileName}>{`${masterFileNames.length}개 기준 파일 선택됨`}</div>
            ) : null}
            {masterFileNames.length > 0 ? (
              <ul className={styles.uploadedFileList}>
                {masterFileNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : null}
            <p className={styles.currentGuidelinesFootnote}>
              선택한 파일을 표준 템플릿으로 정리해 내부 저장소에 먼저 보관한 뒤,
              이후 변경 내용은 이 저장본을 기준으로 반영합니다.
            </p>
            {isMasterCreated ? (
              <p className={styles.currentGuidelinesSuccess}>통합 마스터 파일이 저장되었습니다.</p>
            ) : null}
            {previewError ? <p className={styles.currentGuidelinesError}>{previewError}</p> : null}
          </div>
        </div>

        <div className={styles.currentGuidelinesPreviewCard}>
          <div className={styles.currentGuidelinesPreviewHeader}>
            <div>
              <span className={styles.currentGuidelinesPreviewEyebrow}>
                <span className={styles.currentGuidelinesPreviewEyebrowIcon} aria-hidden="true">
                  i
                </span>
                <span>저장된 테이블 미리보기</span>
              </span>
              <h3 className={styles.currentGuidelinesPreviewTitle}>전체 통합 마스터 파일 구조</h3>
            </div>
            <div className={styles.currentGuidelinesPreviewHeaderActions}>
              <p className={styles.currentGuidelinesPreviewText}>
                저장된 통합 마스터를 불러와 시트별 표를 바로 확인할 수 있습니다.
              </p>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={onPreviewMasterWorkbook}
                disabled={isActionDisabled || isPreviewLoading || masterFileNames.length === 0}
              >
                {isPreviewLoading ? "미리보기 불러오는 중..." : "미리보기"}
              </button>
            </div>
          </div>

          {masterPreview ? (
            <div className={styles.currentGuidelinesPreviewGrid}>
              {previewSections.map((section) => {
                const rows = masterPreview[section.key] as Record<string, string | number>[];

                return (
                  <article className={styles.currentGuidelinesPreviewSection} key={section.key}>
                    <div className={styles.currentGuidelinesPreviewSectionTop}>
                      <div>
                        <h4 className={styles.currentGuidelinesPreviewSectionTitle}>{section.label}</h4>
                        <p className={styles.currentGuidelinesPreviewSectionNote}>{section.note}</p>
                      </div>
                      <span className={styles.currentGuidelinesPreviewBadge}>{rows.length} rows</span>
                    </div>
                    {renderPreviewRows(rows)}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.currentGuidelinesPreviewEmptyPanel}>
              <p className={styles.currentGuidelinesPreviewEmptyTitle}>미리보기를 준비해 주세요</p>
              <p className={styles.currentGuidelinesPreviewEmptyText}>
                STEP 1에서 가이드라인 엑셀을 업로드한 뒤 미리보기 버튼을 누르면,
                저장된 통합 마스터 시트를 이 영역에서 바로 볼 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.inputPanel}>
        <span className={styles.panelLabel}>STEP 2</span>
        <h2 className={styles.panelTitle}>변경내용 입력</h2>
        <p className={styles.panelText}>
          변경된 엑셀 파일을 올리거나, 표 또는 자연어로 바뀐 기준을 입력해 주세요.
          입력이 완료되면 공통 코어 초안 검토 화면으로 이동합니다.
        </p>

        <div className={styles.splitUpload}>
          <div className={styles.uploadBox}>
            <h3 className={styles.sectionTitle}>변경된 엑셀 업로드</h3>
            <p className={styles.sectionText}>
              저장된 통합 마스터를 기준으로 수정할 파일이 있다면 함께 올려 주세요.
            </p>
            <label className={styles.uploadButton} htmlFor="excel-upload">
              파일 여러 개 선택
            </label>
            <input
              id="excel-upload"
              aria-label="변경된 엑셀 업로드"
              className={styles.fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={(event) =>
                onChangeFileChange(Array.from(event.target.files ?? []))
              }
            />
            <div className={styles.fileName}>
              {changeFileNames.length > 0
                ? `${changeFileNames.length}개 변경 파일 업로드 준비 완료`
                : "아직 업로드된 파일이 없습니다."}
            </div>
            {changeFileNames.length > 0 ? (
              <ul className={styles.uploadedFileList}>
                {changeFileNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={styles.textBox}>
            <h3 className={styles.sectionTitle}>표 또는 자연어 직접 입력</h3>
            <p className={styles.sectionText}>
              예: `소액암진단 단일건 한도를 1000에서 2000으로 변경`
            </p>
            <textarea
              aria-label="표 또는 자연어 입력"
              className={styles.textArea}
              placeholder="변경된 기준을 붙여넣거나 자연어로 입력해 주세요."
              value={rawInput}
              onChange={(event) => onRawInputChange(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.ctaRow}>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onComplete}
            disabled={isActionDisabled || !isMasterCreated}
          >
            입력완료
          </button>
        </div>
      </div>
    </section>
  );
}
