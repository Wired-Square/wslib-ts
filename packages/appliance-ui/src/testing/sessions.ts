/** Sessions for a test to mount a screen in: the control socket, store accounts and a console's caller. */
import type { Session } from "../shell/session";

/** An Admin over the control socket, who has no account. */
export const admin = {
  branding: () => undefined,
  me: () => null,
  local: () => ({ username: "control-socket:admin", role: "admin" as const, local: true as const }),
  refresh: () => {},
} satisfies Session;

/** An Admin account the host's own store holds. */
export const signedIn = {
  ...admin,
  me: () => ({
    id: "1",
    username: "admin",
    role: "admin" as const,
    enabled: true,
    created_at: "2026-09-27T00:00:00Z",
    last_login_at: null,
  }),
  local: () => undefined,
} satisfies Session;

/** A Viewer account the host's own store holds. */
export const viewerSignedIn = {
  ...signedIn,
  me: () => ({ ...signedIn.me(), id: "2", username: "viewer", role: "viewer" as const }),
} satisfies Session;

/** An Admin a console asserts. */
export const behindConsole = {
  ...signedIn,
  me: () => ({ id: "c-1", username: "admin", role: "admin" as const }),
} satisfies Session;
