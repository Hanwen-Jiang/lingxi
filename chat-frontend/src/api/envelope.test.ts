// Regression test for the P9 expand→contract: `200` must NO LONGER count as a
// success code (S3 flipped every service to chat-common `code:0` in P8). Runs on
// the built-in node:test runner via `node --experimental-strip-types` — no extra
// dev dependency, no install (see the `test` script). Import uses the `.ts`
// extension so node's type-stripping loader can resolve it directly.
import assert from "node:assert/strict";
import {test} from "node:test";

import {isSuccessCode, SUCCESS_CODES} from "./envelope.ts";

test("code 0 is success", () => {
  assert.equal(isSuccessCode(0), true);
});

test("a success payload may omit code (treated as success)", () => {
  assert.equal(isSuccessCode(undefined), true);
});

test("P9 contraction: legacy 200 is NO LONGER a success code", () => {
  assert.equal(SUCCESS_CODES.has(200), false);
  assert.equal(isSuccessCode(200), false);
});

test("a non-success business code (e.g. 40100 unauthenticated) is not success", () => {
  assert.equal(isSuccessCode(40100), false);
});
