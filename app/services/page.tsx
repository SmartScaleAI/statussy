// `/services` is an alias of the board. Route segment config does not travel
// through a re-export, so keep `revalidate` in sync with `app/page.tsx`.
// The selected tab is request-specific (SMA-143), same as `/`.
export const revalidate = 60

export { default } from "../page"
