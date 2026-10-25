import { ErrorBoundary, createEffect, on } from "solid-js";
import type { JSX } from "solid-js";

import { Button } from "./Button";
import { Notice } from "./Notice";
import { refusalMessage, unanswered } from "./refusal";

export interface ScreenBoundaryProps {
  /** Anything that changes when somebody navigates, which clears the failure. */
  pathname: () => string;
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
        createEffect(on(props.pathname, () => reset(), { defer: true }));
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
