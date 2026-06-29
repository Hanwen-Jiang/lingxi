// Cross-stack success envelope (03-contracts §2). Extracted as a pure module (no
// fetch / store / import.meta.env coupling) so the success rule is unit-testable.
//
// P9 expand→contract: after S3 flipped every service to chat-common Result in P8
// (item3 closeout — full-stack code=0 + real HTTP), `0` is the ONLY success code.
// The legacy `200` body-code tolerance is gone — a stray `code:200` now reads as
// an error, which is the regression `envelope.test.ts` locks in.
export const SUCCESS_CODES: ReadonlySet<number> = new Set([0]);

/** Whether an envelope's business `code` denotes success. A success payload may
 *  omit `code` entirely (treated as success); otherwise it must be in the set. */
export function isSuccessCode(code: number | undefined): boolean {
  return code === undefined || SUCCESS_CODES.has(code);
}
