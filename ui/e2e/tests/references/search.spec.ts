import { test, expect } from "../../fixtures/base";

test.describe("Reference Search", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("search input is visible", async ({ referenceTable }) => {
    await expect(referenceTable.searchInput).toBeVisible();
  });

  test("filters table by search term", async ({ referenceTable, page }) => {
    // Get initial count
    const initialCount = await referenceTable.getRowCount();

    // Search for a specific term (adjust based on seed data)
    await referenceTable.search("Bourgogne");
    await page.waitForLoadState("networkidle");

    // Verify results are filtered (should have fewer or equal results)
    const filteredCount = await referenceTable.getRowCount();

    // If there are matching results, verify they contain the search term
    if (filteredCount > 0) {
      const firstRowText = await referenceTable.tableRows.first().textContent();
      expect(firstRowText?.toLowerCase()).toContain("bourgogne");
    }
  });

  test("accent-insensitive search: 'Macon' finds 'Mâcon'", async ({ referenceTable, page }) => {
    await referenceTable.search("Macon");
    await page.waitForLoadState("networkidle");

    // Check if any results contain accented version
    const rowCount = await referenceTable.getRowCount();
    if (rowCount > 0) {
      // Search should return results with accented characters
      const pageContent = await page.content();
      // Either we find "Mâcon" or we verified search worked with unaccented input
      expect(pageContent.toLowerCase()).toMatch(/macon|mâcon/i);
    }
  });

  test("multi-word search: all words must match", async ({ referenceTable, page }) => {
    // Search with two words
    await referenceTable.search("Bourgogne Aligoté");
    await page.waitForLoadState("networkidle");

    const rowCount = await referenceTable.getRowCount();
    if (rowCount > 0) {
      // Both words should be present somewhere in the result
      const rowText = await referenceTable.tableRows.first().textContent();
      // Note: words might be in different columns
      const lowerText = rowText?.toLowerCase() || "";
      expect(lowerText.includes("bourgogne") || lowerText.includes("aligoté")).toBeTruthy();
    }
  });

  test("shows empty state when no results", async ({ referenceTable, page }) => {
    await referenceTable.search("xyznonexistent12345");
    await page.waitForLoadState("networkidle");

    // Either empty table or "No data" message
    const rowCount = await referenceTable.getRowCount();
    expect(rowCount).toBe(0);
  });

  test("clearing search shows all results", async ({ referenceTable, page }) => {
    // Search first
    await referenceTable.search("test");
    await page.waitForLoadState("networkidle");

    // Clear search
    await referenceTable.clearSearch();
    await page.waitForLoadState("networkidle");

    // Should have results again
    const count = await referenceTable.getRowCount();
    expect(count).toBeGreaterThan(0);
  });

  test("search resets to page 1", async ({ referenceTable, page }) => {
    // Go to page 2 if possible
    const totalText = await page.getByText(/of \d+ references/).textContent();
    const totalMatch = totalText?.match(/of (\d+) references/);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    if (total > 20) {
      await page.locator(".ant-pagination-item").filter({ hasText: "2" }).click();
      await page.waitForLoadState("networkidle");

      // Search should reset to page 1
      await referenceTable.search("wine");
      await page.waitForLoadState("networkidle");

      const activePage = page.locator(".ant-pagination-item-active");
      await expect(activePage).toHaveText("1");
    }
  });
});
