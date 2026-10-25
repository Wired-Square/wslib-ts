import { existsSync, readFileSync } from "node:fs";

import { fail, repoFiles } from "./files.mjs";

const LIST = "scripts/forbidden-names.txt";
const names = new RegExp(readFileSync(LIST, "utf8").trim().split("\n").join("|"), "i");

const hits = repoFiles()
  .filter((file) => file !== LIST && existsSync(file))
  .flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) => (names.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
  );

fail("another repository is named — say 'a prior appliance' instead", hits);
