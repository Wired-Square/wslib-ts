import type { Tokens } from "../src/tokens.ts";

export const theme = { "--app-accent": "navy", "--app-bg": "white" } satisfies Partial<Tokens>;

// @ts-expect-error a misspelt name is not a token
export const misspelt = { "--app-acent": "navy" } satisfies Partial<Tokens>;
