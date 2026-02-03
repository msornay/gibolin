import { test, expect } from "../../fixtures/base";

test.describe("Reference List", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("displays table with references", async ({ referenceTable }) => {
    await expect(referenceTable.table).toBeVisible();
    const rowCount = await referenceTable.getRowCount();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("displays page title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "References" })).toBeVisible();
  });

  test("shows pagination info", async ({ page }) => {
    await expect(page.getByText(/of \d+ references/)).toBeVisible();
  });

  test("displays all expected columns", async ({ page }) => {
    const expectedColumns = ["Name", "Category", "Region", "Domain", "Vintage", "Appellation", "Actions"];
    for (const column of expectedColumns) {
      await expect(page.locator(".ant-table-thead th").filter({ hasText: column })).toBeVisible();
    }
  });

  test("can navigate to second page", async ({ page, referenceTable }) => {
    // First check if there are enough items for pagination
    const totalText = await page.getByText(/of \d+ references/).textContent();
    const totalMatch = totalText?.match(/of (\d+) references/);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    if (total > 20) {
      await page.locator(".ant-pagination-item").filter({ hasText: "2" }).click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator(".ant-pagination-item-active")).toHaveText("2");
    }
  });

  test("can change page size", async ({ page }) => {
    await page.locator(".ant-pagination-options .ant-select-selector").click();
    await page.locator(".ant-select-item-option").filter({ hasText: "50 / page" }).click();
    await page.waitForLoadState("networkidle");
    // Verify page size changed
    await expect(page.locator(".ant-pagination-options .ant-select-selection-item")).toHaveText("50 / page");
  });
});
