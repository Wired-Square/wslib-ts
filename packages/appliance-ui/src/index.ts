/**
 * The appliance's browser half: the request helper, the parts on top of
 * `@wired-square/kit`, the Settings screens and the shell around them.
 *
 * **Nothing in this package restates a fact the daemon owns.** Wire types, caps
 * and the role ladder are imported from `@wired-square/appliance-types` and not
 * re-exported: each name has that one home. A constant retyped here is a mirror
 * with nothing watching it.
 */

export {
  ApiError,
  SESSION_HEADER,
  SESSION_QUERY,
  api,
  carrySession,
  download,
  fromBase,
  saveText,
  slowAnswer,
  unansweredMeans,
  upload,
  withSession,
} from "./api";
export type { ApiInit, SessionStore, UploadInit } from "./api";
export { sharedFeed, useFeed } from "./feed";
export type { FeedHandlers } from "./feed";
export type { FeedListener, FeedTransport } from "./follow";
export { debounced, useRefresh } from "./live";
export { SerialConsole } from "./serial/SerialConsole";
export type { SerialConsoleProps } from "./serial/SerialConsole";
export type { ConsolePort } from "./serial/link";

export * from "./parts";
export * from "./screens";
export * from "./shell";

export { allows, useAllows, useOwnAccount } from "./access";
