import { ImageResponse } from "next/og";

export const alt = "NAV Dental Clinic, Somna Road, Pahasu — Dr. Ratan Raghav";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social sharing image in the brand palette (charcoal and silver), using the
 * provisional flat tracing of the logo mark. Generated at build time.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#131313", color: "#F1F1F1", padding: "0 96px", fontFamily: "serif" }}>
        <svg width="260" height="248" viewBox="150 195 770 735" fill="#D0D0D0">
          <path d="M163 392C160 300 215 232 320 228C420 224 470 290 540 298C610 290 660 222 765 222C870 222 915 300 905 392L852 392C858 322 830 268 765 268C690 268 640 322 540 336C440 322 400 272 320 272C250 272 214 322 210 392Z" />
          <path d="M200 382L398 392L200 402Z" />
          <path d="M245 210C345 196 445 238 488 326C430 262 345 226 245 210Z" />
          <path d="M210 660L266 660L352 862L560 666L596 666L368 914Q348 936 330 912Z" />
          <path d="M578 662L772 664L578 672Z" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 72 }}>
          <div style={{ fontSize: 96, letterSpacing: 12 }}>NAV</div>
          <div style={{ fontSize: 34, letterSpacing: 10, color: "#AAAAAA", fontFamily: "sans-serif" }}>DENTAL CLINIC</div>
          <div style={{ height: 2, width: 420, background: "#818181", margin: "36px 0" }} />
          <div style={{ fontSize: 36, color: "#D0D0D0", fontFamily: "sans-serif" }}>Dr. Ratan Raghav</div>
          <div style={{ fontSize: 30, color: "#AAAAAA", fontFamily: "sans-serif", marginTop: 8 }}>Somna Road, Pahasu, Uttar Pradesh</div>
        </div>
      </div>
    ),
    size,
  );
}
