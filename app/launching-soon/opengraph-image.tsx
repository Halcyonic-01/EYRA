import { ImageResponse } from "next/og";

export const alt = "EYRA | Launching 08/11/2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#020202",
          color: "#f9f9f9",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 150, letterSpacing: 40, paddingLeft: 40 }}>EYRA</div>
        <div style={{ marginTop: 16, fontSize: 26, letterSpacing: 10, color: "#bcbcbc" }}>
          FINE 925 STERLING SILVER
        </div>
        <div style={{ marginTop: 56, width: 80, height: 1, background: "#909090" }} />
        <div style={{ marginTop: 56, fontSize: 40, letterSpacing: 14, color: "#e2e2e2" }}>
          LAUNCHING 08 / 11 / 2026
        </div>
      </div>
    ),
    size,
  );
}
