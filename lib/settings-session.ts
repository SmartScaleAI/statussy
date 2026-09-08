/**
 * SMA-112: /settings may only show account PII when a live session user
 * is present. Pending or signed-out → hide email, linked accounts, and
 * delete/sign-out controls.
 */
export function shouldRenderAccountSettings(state: {
  isPending: boolean
  hasUser: boolean
}): boolean {
  return !state.isPending && state.hasUser
}
