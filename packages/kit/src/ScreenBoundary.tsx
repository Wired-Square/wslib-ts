import { ErrorBoundary, createEffect, on } from "solid-js";
import type { JSX } from "solid-js";
import { refusalMessage, unanswered } from "@wired-square/kit/core";

import { Button } from "./Button";
import { Notice } from "./Notice";

export interface ScreenBoundaryProps {
  /** Anything that changes when somebody navigates, which clears the failure. */
  pathname?: () => string;
  children: JSX.Element;
}

/**
 * A screen's failure in its place, with Try again. A request nothing answered
 * is the whole page's, and goes on to the boundary around the app.
 */
export function ScreenBoundary(props: ScreenBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => {
        if (unanswered(error)) throw error;
        if (props.pathname) createEffect(on(props.pathname, () => reset(), { defer: true }));
        return (
          <Notice tone="bad">
            {refusalMessage(error)}{" "}
            <Button tone="plain" onClick={reset}>
              Try again
            </Button>
          </Notice>
        );
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
