import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { SITE_OG_ALT, SITE_OG_LINE } from "@/lib/site-metadata"

export const alt = SITE_OG_ALT
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function Image() {
  const markData = await readFile(
    join(process.cwd(), "public/icon-192.png"),
    "base64"
  )
  const markSrc = `data:image/png;base64,${markData}`

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 96px",
        backgroundColor: "#000000",
        color: "#f7f7f7",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 96,
            height: 96,
            borderRadius: 22,
            overflow: "hidden",
            border: "1px solid #2e2e2e",
          }}
        >
          <img src={markSrc} alt="" width={96} height={96} />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 600,
            letterSpacing: "-0.03em",
          }}
        >
          Statussy
        </div>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 48,
          fontSize: 68,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.15,
        }}
      >
        {SITE_OG_LINE}
      </div>
    </div>,
    {
      ...size,
    }
  )
}
