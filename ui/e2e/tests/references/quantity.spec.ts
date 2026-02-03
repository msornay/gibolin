import { test, expect } from "../../fixtures/base";

test.describe("Quantity Updates", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("can see quantity button on each row", async ({ referenceTable }) => {
    const rowCount = await referenceTable.getRowCount();
    expect(rowCount).toBeGreaterThan(0);

    // First row should have a quantity button
    const firstRow = referenceTable.tableRows.first();
    const quantityButton = firstRow.locator("button").first();
    await expect(quantityButton).toBeVisible();
  });

  test("clicking quantity button shows edit controls", async ({ referenceTable, page }) => {
    const firstRow = referenceTable.tableRows.first();
    const quantityButton = firstRow.locator("button").first();

    await quantityButton.click();

    // Should show input field and Save/Cancel buttons
    await expect(firstRow.locator("input")).toBeVisible();
    await expect(firstRow.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(firstRow.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("can update quantity inline", async ({ referenceTable, page }) => {
    // Create a test reference first
    const testName = `Quantity Test ${Date.now()}`;

    await referenceTable.clickNew();
    await page.locator("#name").fill(testName);
    await page.getByRole("button", { name: "Create Reference" }).click();
    await page.waitForLoadState("networkidle");

    // Search for it
    await referenceTable.search(testName);

    // Edit quantity
    const newQuantity = 42;
    await referenceTable.editQuantity(testName, newQuantity);

    // Verify quantity was updated
    await page.waitForLoadState("networkidle");
    const quantity = await referenceTable.getQuantity(testName);
    expect(quantity).toBe(newQuantity.toString());
  });

  test("cancel quantity edit reverts to original value", async ({ referenceTable, page }) => {
    const firstRow = referenceTable.tableRows.first();
    const quantityButton = firstRow.locator("button").first();
    const originalQuantity = await quantityButton.textContent();

    // Start editing
    await quantityButton.click();

    // Change value
    const input = firstRow.locator("input");
    await input.fill("999");

    // Cancel
    await firstRow.getByRole("button", { name: "Cancel" }).click();

    // Original quantity should be restored
    const restoredQuantity = await quantityButton.textContent();
    expect(restoredQuantity).toBe(originalQuantity);
  });

  test("quantity persists after page reload", async ({ referenceTable, page }) => {
    // Create test reference
    const testName = `Persist Quantity ${Date.now()}`;

    await referenceTable.clickNew();
    await page.locator("#name").fill(testName);
    await page.getByRole("button", { name: "Create Reference" }).click();
    await page.waitForLoadState("networkidle");

    // Update quantity
    await referenceTable.search(testName);
    const newQuantity = 25;
    await referenceTable.editQuantity(testName, newQuantity);

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Search again and verify quantity
    await referenceTable.search(testName);
    const quantity = await referenceTable.getQuantity(testName);
    expect(quantity).toBe(newQuantity.toString());
  });

  test("pressing Enter saves quantity", async ({ referenceTable, page }) => {
    const testName = `Enter Key Test ${Date.now()}`;

    await referenceTable.clickNew();
    await page.locator("#name").fill(testName);
    await page.getByRole("button", { name: "Create Reference" }).click();
    await page.waitForLoadState("networkidle");

    await referenceTable.search(testName);

    // Start editing
    const row = await referenceTable.getRowByName(testName);
    await row.locator("button").first().click();

    // Type new quantity and press Enter
    const input = row.locator("input");
    await input.fill("33");
    await input.press("Enter");
    await page.waitForLoadState("networkidle");

    // Verify saved
    const quantity = await referenceTable.getQuantity(testName);
    expect(quantity).toBe("33");
  });

  test("pressing Escape cancels quantity edit", async ({ referenceTable, page }) => {
    const firstRow = referenceTable.tableRows.first();
    const quantityButton = firstRow.locator("button").first();
    const originalQuantity = await quantityButton.textContent();

    // Start editing
    await quantityButton.click();

    // Change value and press Escape
    const input = firstRow.locator("input");
    await input.fill("999");
    await input.press("Escape");

    // Original quantity should be restored
    const restoredQuantity = await quantityButton.textContent();
    expect(restoredQuantity).toBe(originalQuantity);
  });
});
