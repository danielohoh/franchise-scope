import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1F4E79",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 76,
              fontWeight: 900,
              letterSpacing: "-4px",
              lineHeight: 1,
              fontFamily: "sans-serif",
            }}
          >
            FS
          </span>
          <span
            style={{
              color: "#90C8F0",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "2px",
              lineHeight: 1,
              fontFamily: "sans-serif",
              marginTop: "4px",
            }}
          >
            SCOPE
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
