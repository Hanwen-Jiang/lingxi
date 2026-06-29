import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";

import {ToolConfirmation} from "./ToolConfirmation";

// Card behaviour under S1 F01 (live since P5): the user decides only to
// release or cancel the held turn — the tool list is informational because
// the server's challenge token already fingerprints which tools were
// requested. No checkboxes, no per-tool selection.
describe("ToolConfirmation (M4 / F01)", () => {
  it("lists the tools as information and emits a plain onConfirm()", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ToolConfirmation
        isConfirming={false}
        tools={[{name: "web_search", description: "搜索网络"}, {name: "delete_file"}]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // The list is rendered informationally; there are no checkboxes (F01
    // ignores client-supplied tool names so per-tool selection is meaningless).
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("搜索网络")).toBeInTheDocument();
    expect(screen.getByText("delete_file")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", {name: /确认并继续/}));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // The HeroUI Button's onPress passes a PressEvent — what matters for the
    // F01 regression is that no string[] of tool names is forwarded (legacy
    // confirmedTools shape). The parent looks up the challenge token by
    // assistantId on its side.
    expect(onConfirm.mock.calls[0]?.[0]).not.toEqual(expect.any(Array));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when the user dismisses the held turn", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ToolConfirmation isConfirming={false} tools={[{name: "a"}]} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", {name: "取消"}));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("locks both buttons while a confirmation is in flight", () => {
    render(<ToolConfirmation isConfirming tools={[{name: "a"}]} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", {name: /执行中/})).toBeDisabled();
    expect(screen.getByRole("button", {name: "取消"})).toBeDisabled();
  });

  it("renders without a tool list when the server only sent a challenge token", () => {
    // F01 may carry a token with no pendingTools — the card still shows so
    // the user can decide to release or cancel.
    render(<ToolConfirmation isConfirming={false} tools={[]} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("灵犀想调用以下工具,确认后继续")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.getByRole("button", {name: /确认并继续/})).toBeInTheDocument();
  });
});
