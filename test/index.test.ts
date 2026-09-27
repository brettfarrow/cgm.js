import { describe, test, expect } from "vitest";
import * as root from "../src/index.js";
import * as cgm from "../src/cgm.js";
import * as constants from "../src/constants.js";
import * as errors from "../src/errors.js";

describe("package root", () => {
  test.each([
    ["cgm", cgm],
    ["constants", constants],
    ["errors", errors],
  ])("re-exports every %s export", (_name, module) => {
    for (const [key, value] of Object.entries(module)) {
      expect(root).toHaveProperty(key, value);
    }
  });
});
