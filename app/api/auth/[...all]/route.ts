import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"
import { publicAuthFailureMessage } from "@/lib/magic-link-email"

export const runtime = "nodejs"

const { GET: handleGet, POST: handlePost } = toNextJsHandler(auth)

async function withAuthErrors(
  method: "GET" | "POST",
  request: Request
): Promise<Response> {
  try {
    const response = await (method === "GET"
      ? handleGet(request)
      : handlePost(request))
    if (response.status < 500) {
      return response
    }
    const text = await response.clone().text()
    if (text) {
      return response
    }
    console.error(
      `[statussy] auth ${method} ${new URL(request.url).pathname} returned empty ${response.status}`
    )
    return Response.json(
      { message: "Could not send a sign-in link. Check Vercel function logs." },
      { status: response.status }
    )
  } catch (err) {
    console.error(
      `[statussy] auth ${method} ${new URL(request.url).pathname} threw`,
      err
    )
    return Response.json(
      { message: publicAuthFailureMessage(err) },
      { status: 500 }
    )
  }
}

export function GET(request: Request) {
  return withAuthErrors("GET", request)
}

export function POST(request: Request) {
  return withAuthErrors("POST", request)
}
