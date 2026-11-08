/**
 * The shell: what every appliance's browser half has around its screens.
 *
 * `Shell` is the gate and the session; `Chrome` is the masthead and main
 * column the product mounts inside it, around its own navigation — **the
 * package ships no router**, and `Chrome` sits wherever a router's root
 * puts it; `useSession` is how any screen reads who is signed in and what the
 * appliance is called. `SignIn` is the sign-in card a product that serves its
 * own HTTPS passes as `Shell`'s `signIn`; `CodeStep`, `EnrolStep` and
 * `PasskeySignIn` are its pieces, for a console's own sign-in. `SessionProvider` provides a session the product builds
 * itself, for a client with no `Shell`; `useParting` hands `Shell` a factory
 * reset's report to outlast the session.
 */
export { Chrome } from "./Chrome";
export type { ChromeProps } from "./Chrome";
export { Shell } from "./Shell";
export type { ShellProps, Wordmark } from "./Shell";
export { SignIn } from "./SignIn";
export { CodeStep, EnrolStep, PasskeySignIn } from "./SecondStep";
export type { StepProps } from "./SecondStep";
export { SessionProvider, isStoreAccount, useParting, useSession } from "./session";
export type { Me, Parting, Session } from "./session";
