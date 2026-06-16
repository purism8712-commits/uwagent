import styles from "./components.module.css";

export function StepProgressBar({ step }: { step: "input" | "review" }) {
  return (
    <section className={styles.stepCard} aria-label="단계 진행 상태">
      <div className={styles.stepItem}>
        <span className={styles.stepBullet}>0</span>
        <span>통합 마스터 파일 만들기</span>
      </div>
      <div className={styles.stepDivider} />
      <div className={`${styles.stepItem} ${styles.stepActive}`}>
        <span className={styles.stepBullet}>1</span>
        <span>변경내용 입력</span>
      </div>
      <div className={styles.stepDivider} />
      <div className={`${styles.stepItem} ${step === "review" ? styles.stepActive : ""}`}>
        <span className={styles.stepBullet}>3</span>
        <span>검토메모 및 질문 확인</span>
      </div>
    </section>
  );
}
