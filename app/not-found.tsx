export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "40px",
        background: "#f5f8fc",
        color: "#0f172a"
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "14px", color: "#4b5563" }}>404</p>
        <h1 style={{ margin: "12px 0 10px", fontSize: "32px" }}>
          요청한 화면을 찾을 수 없습니다
        </h1>
        <p style={{ margin: 0, fontSize: "15px", color: "#64748b" }}>
          주소를 다시 확인하거나 메인 화면으로 돌아가 주세요.
        </p>
      </div>
    </main>
  );
}
