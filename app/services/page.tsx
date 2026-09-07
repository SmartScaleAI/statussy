// `/services` is an alias of the board. Route segment config does not travel
// through a re-export, so the 60s ISR window (SMA-97) is declared here too —
// keep it in sync with `app/page.tsx`.
export const revalidate = 60

export { default } from "../page"
