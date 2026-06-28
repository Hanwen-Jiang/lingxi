import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";

import {ToolConfirmation} from "./ToolConfirmation";

describe("ToolConfirmation (M4)", () => {
  it("defaults every tool to approved and confirms the chosen subset", async () => {
    const onConfirm = vi.fn();
    render(
      <ToolConfirmation
        isConfirming={false}
        tools={[{name: "web_search", description: "搜索网络"}, {name: "delete_file"}]}
        onConfirm={onConfirm}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((box) => box.checked)).toBe(true);

    // Withhold the second tool, then confirm.
    await userEvent.click(checkboxes[1]);
    await userEvent.click(screen.getByRole("button", {name: /确认并继续/}));

    expect(onConfirm).toHaveBeenCalledWith(["web_search"]);
  });

  it("lets the user skip all tools", async () => {
    const onConfirm = vi.fn();
    render(<ToolConfirmation isConfirming={false} tools={[{name: "a"}]} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", {name: "全部跳过"}));
    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it("locks the controls while a confirmation is in flight", () => {
    render(<ToolConfirmation isConfirming tools={[{name: "a"}]} onConfirm={vi.fn()} />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
    // The primary button reflects the in-flight state.
    expect(screen.getByRole("button", {name: /执行中/})).toBeTruthy();
  });
});
