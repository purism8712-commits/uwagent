import styles from "./components.module.css";

export function StepProgressBar({
  step,
  isDraftReady
}: {
  step: "input" | "review";
  isDraftReady: boolean;
}) {
  const isReviewStep = step === "review";
  const isDraftStep = isDraftReady;

  return (
    <section className={styles.stepCard} aria-label="단계 진행 상태">
      <div className={`${styles.stepItem} ${styles.stepActive}`}>
        <span className={styles.stepBullet}>1</span>
        <span>통합 마스터 파일 만들기</span>
      </div>
      <div className={styles.stepDivider} />
      <div className={`${styles.stepItem} ${styles.stepActive}`}>
        <span className={styles.stepBullet}>2</span>
        <span>변경내용 입력</span>
      </div>
      <div className={styles.stepDivider} />
      <div className={`${styles.stepItem} ${isReviewStep ? styles.stepActive : ""}`}>
        <span className={styles.stepBullet}>3</span>
        <span>검토메모 및 질문 확인</span>
      </div>
      <div className={styles.stepDivider} />
      <div className={`${styles.stepItem} ${isDraftStep ? styles.stepActive : ""}`}>
        <span className={styles.stepBullet}>4</span>
        <span>초안생성</span>
      </div>
      <div className={styles.stepDivider} />
      <div className={`${styles.stepItem} ${isDraftStep ? styles.stepActive : ""}`}>
        <span className={styles.stepBullet}>5</span>
        <span>통합 마스터와 상품 추출 다운로드</span>
      </div>
    </section>
  );
}
