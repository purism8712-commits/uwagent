"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./components.module.css";
import { readAuthSession, writeAuthSession } from "@/lib/session";

const departmentOptions = ["", "신계약기획P", "신계약지원P", "신계약심사P"] as const;

export default function LoginPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState<(typeof departmentOptions)[number]>("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [hasSession, setHasSession] = useState(false);

  const canLogin = useMemo(() => {
    return employeeId.trim().length > 0 && name.trim().length > 0 && department.trim().length > 0;
  }, [department, employeeId, name]);

  useEffect(() => {
    const session = readAuthSession();
    if (session) {
      router.replace("/agent-tabs");
      return;
    }

    setHasSession(true);
  }, [router]);

  function handleLogin() {
    if (!canLogin) {
      setError("사번, 부서, 이름을 모두 입력해 주세요.");
      return;
    }

    writeAuthSession({
      employeeId: employeeId.trim(),
      department,
      name: name.trim(),
      loggedInAt: new Date().toISOString()
    });

    router.replace("/agent-tabs");
  }

  return (
    <main className={styles.pageShell}>
      <section className={`${styles.heroPanel} ${styles.authPanel}`}>
        <div className={styles.heroContent}>
          <span className={styles.heroEyebrow}>Common Core Wizard</span>
          <h1 className={styles.heroTitle}>신계약 인수기준 반영 Agent 로그인</h1>
          <p className={styles.heroDescription}>
            사번과 부서를 확인한 뒤 로그인하면, 현재까지 구현된 신계약 인수기준
            반영 에이전트 화면으로 이동합니다. 부서는 이후 버튼 활성화 범위를
            구분하는 데 사용됩니다.
          </p>
        </div>

        <form
          className={styles.authFormCard}
          onSubmit={(event) => {
            event.preventDefault();
            handleLogin();
          }}
        >
          <div className={styles.authFormHeader}>
            <span className={styles.authFormEyebrow}>로그인 정보 입력</span>
            <h2 className={styles.authFormTitle}>신계약 인수기준 반영 Agent 로그인</h2>
            <p className={styles.authFormText}>
              사번, 부서, 이름을 입력한 뒤 로그인 버튼을 누르면 됩니다. 로그인은
              모든 부서에서 가능하고, 이후 화면의 실행 버튼이 부서별로 달라집니다.
            </p>
          </div>

          <div className={styles.authFieldGroup}>
            <label className={styles.authLabel} htmlFor="employee-id">
              사번
            </label>
            <input
              id="employee-id"
              className={styles.authInput}
              type="text"
              inputMode="numeric"
              placeholder="사번을 입력해 주세요."
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            />
          </div>

          <div className={styles.authFieldGroup}>
            <label className={styles.authLabel} htmlFor="department">
              부서
            </label>
            <select
              id="department"
              className={styles.authSelect}
              value={department}
              onChange={(event) =>
                setDepartment(event.target.value as (typeof departmentOptions)[number])
              }
            >
              <option value="" disabled>
                부서를 선택해 주세요.
              </option>
              <option value="신계약기획P">신계약기획P</option>
              <option value="신계약지원P">신계약지원P</option>
              <option value="신계약심사P">신계약심사P</option>
            </select>
          </div>

          <div className={styles.authFieldGroup}>
            <label className={styles.authLabel} htmlFor="employee-name">
              이름
            </label>
            <input
              id="employee-name"
              className={styles.authInput}
              type="text"
              placeholder="이름을 입력해 주세요."
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className={styles.authButtonRow}>
            <button
              className={`${styles.primaryButton} ${styles.authButton}`}
              type="submit"
              disabled={!hasSession || !canLogin}
            >
              로그인
            </button>
            {error ? <p className={styles.authNotice}>{error}</p> : null}
            <p className={styles.authNotice}>
              로그인 후에는 기존의 변경내용 입력, 검토메모, 초안생성 화면이 그대로
              이어집니다.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
