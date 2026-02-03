import { test, expect } from "../../fixtures/base";

test.describe("Reference Sorting", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("can sort by name ascending", async ({ referenceTable, page }) => {
    await referenceTable.sortByColumn("Name");
    await page.waitForLoadState("networkidle");

    const names = await referenceTable.getColumnValues(0);
    const sortedNames = [...names].sort((a, b) =>
      (a || "").toLowerCase().localeCompare((b || "").toLowerCase())
    );
    expect(names).toEqual(sortedNames);
  });

  test("can sort by name descending", async ({ referenceTable, page }) => {
    // Click twice for descending
    await referenceTable.sortByColumn("Name");
    await page.waitForLoadState("networkidle");
    await referenceTable.sortByColumn("Name");
    await page.waitForLoadState("networkidle");

    const names = await referenceTable.getColumnValues(0);
    const sortedNames = [...names].sort((a, b) =>
      (b || "").toLowerCase().localeCompare((a || "").toLowerCase())
    );
    expect(names).toEqual(sortedNames);
  });

  test("can sort by category", async ({ referenceTable, page }) => {
    await referenceTable.sortByColumn("Category");
    await page.waitForLoadState("networkidle");

    const categories = await referenceTable.getColumnValues(1);
    const sortedCategories = [...categories].sort((a, b) => {
      const aVal = a === "-" ? "" : (a || "");
      const bVal = b === "-" ? "" : (b || "");
      return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
    });
    expect(categories).toEqual(sortedCategories);
  });

  test("can sort by region", async ({ referenceTable, page }) => {
    await referenceTable.sortByColumn("Region");
    await page.waitForLoadState("networkidle");

    const regions = await referenceTable.getColumnValues(2);
    const sortedRegions = [...regions].sort((a, b) => {
      const aVal = a === "-" ? "" : (a || "");
      const bVal = b === "-" ? "" : (b || "");
      return aVal.toLowerCase().localeCompare(bVal.toLowerCase());
    });
    expect(regions).toEqual(sortedRegions);
  });

  test("can sort by vintage", async ({ referenceTable, page }) => {
    await referenceTable.sortByColumn("Vintage");
    await page.waitForLoadState("networkidle");

    const vintages = await referenceTable.getColumnValues(4);
    const numericVintages = vintages.map(v => v === "-" ? 0 : parseInt(v || "0"));
    const sortedVintages = [...numericVintages].sort((a, b) => a - b);
    expect(numericVintages).toEqual(sortedVintages);
  });

  test("sort indicator is shown", async ({ referenceTable, page }) => {
    await referenceTable.sortByColumn("Name");
    await page.waitForLoadState("networkidle");

    // Check for sort indicator
    const sortedHeader = page.locator(".ant-table-thead th").filter({ hasText: "Name" });
    await expect(sortedHeader.locator(".ant-table-column-sorter")).toBeVisible();
  });
});
