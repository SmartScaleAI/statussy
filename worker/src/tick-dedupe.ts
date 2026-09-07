/**
 * Per-tick fetch dedupe (SMA-96).
 *
 * Several services share one upstream status feed: the HashiCorp products
 * (Terraform / Vault / Consul / Nomad / Packer) all read status.hashicorp.com,
 * and the Google Cloud + Gemini cards both read status.cloud.google.com's
 * incidents.json / products.json. Create one TickDedupe per tick and thread it
 * through the shared payload fetchers so each URL is fetched once per tick and
 * every sharer reuses the identical bytes. A rejected fetch is shared too:
 * every service on that feed fails and is marked stale, same as before.
 */
export type TickDedupe = {
  /** Run `fetcher` once per `key` this tick; concurrent callers share the promise. */
  fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T>
}

export function createTickDedupe(): TickDedupe {
  const inflight = new Map<string, Promise<unknown>>()
  return {
    fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
      let promise = inflight.get(key)
      if (!promise) {
        promise = fetcher()
        inflight.set(key, promise)
      }
      return promise as Promise<T>
    },
  }
}
