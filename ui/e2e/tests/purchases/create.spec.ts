import { test, expect } from "../../fixtures/base";

test.describe("Create Purchase", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("add purchase button is shown for existing reference", async ({ referenceTable, referenceForm, page }) => {
    // Create a test reference first
    const testName = `Purchase Test ${Date.now()}`;

    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.submit();
    await page.waitForLoadState("networkidle");

    // Edit the reference
    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    // Add Purchase button should be visible
    await expect(referenceForm.addPurchaseButton).toBeVisible();
  });

  test("add purchase button is NOT shown for new reference", async ({ referenceTable, referenceForm }) => {
    await referenceTable.clickNew();

    // Add Purchase button should not be visible for new reference
    await expect(referenceForm.addPurchaseButton).not.toBeVisible();
  });

  test("can add a purchase to existing reference", async ({ referenceTable, referenceForm, page }) => {
    const testName = `Add Purchase ${Date.now()}`;

    // Create reference
    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.submit();
    await page.waitForLoadState("networkidle");

    // Edit reference
    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    // Add purchase
    await referenceForm.clickAddPurchase();

    // Fill purchase form
    await referenceForm.fillPurchaseForm("2024-01-15", 6, 12.50);
    await referenceForm.submitPurchase();

    // Verify purchase was added
    const purchaseCount = await referenceForm.getPurchaseCount();
    expect(purchaseCount).toBeGreaterThan(0);
  });

  test("purchase form validation requires all fields", async ({ referenceTable, referenceForm, page }) => {
    const testName = `Purchase Validation ${Date.now()}`;

    // Create reference
    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.submit();
    await page.waitForLoadState("networkidle");

    // Edit reference
    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    // Open purchase form
    await referenceForm.clickAddPurchase();

    // Try to submit empty form
    await referenceForm.modal.locator("form").last().getByRole("button", { name: /Add/ }).click();

    // Should show validation errors
    await expect(page.getByText("Please select date!")).toBeVisible();
  });

  test("can cancel adding purchase", async ({ referenceTable, referenceForm, page }) => {
    const testName = `Cancel Purchase ${Date.now()}`;

    // Create reference
    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.submit();
    await page.waitForLoadState("networkidle");

    // Edit reference
    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    // Open and cancel purchase form
    await referenceForm.clickAddPurchase();
    await referenceForm.cancelPurchase();

    // Form should be hidden, add button visible again
    await expect(referenceForm.addPurchaseButton).toBeVisible();
  });
});
