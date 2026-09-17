const EDGE_STATUS_SELECTOR_IMAGE = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}images/edge-status-selector.png`;

export function EdgeStatusSelector() {
  return (
    <figure
      aria-label="ไอคอนตัวเลือกขอบงานทั้งสี่ด้าน"
      style={{
        width: "248px",
        margin: 0,
        background: "#f7fbfd",
      }}
    >
      <img
        src={EDGE_STATUS_SELECTOR_IMAGE}
        alt="ตัวเลือกขอบงานด้านบน ขวา ล่าง และซ้าย พร้อมคำแนะนำให้เลือกขอบที่ต้องการปิด"
        width={248}
        height={105}
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
        }}
      />
    </figure>
  );
}

export default EdgeStatusSelector;