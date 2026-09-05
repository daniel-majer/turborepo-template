import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("forwards native props and applies its variant", () => {
    render(
      <Button variant="destructive" disabled>
        Delete
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.getAttribute("data-slot")).toBe("button");
    expect(button.className).toContain("bg-destructive/10");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("handles user clicks", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Save</Button>);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
