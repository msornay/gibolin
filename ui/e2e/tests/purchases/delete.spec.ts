import { test, expect } from "../../fixtures/base";

test.describe("Delete Purchase", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("can delete a purchase", async ({ referenceTable, referenceForm, page }) => {
    const testName = `Delete Purchase ${Date.now()}`;

    // Create reference with purchase
    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.submit();
    await page.waitForLoadState("networkidle");

    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    // Add a purchase
    await referenceForm.clickAddPurchase();
    await referenceForm.fillPurchaseForm("2024-03-01", 5, 15.00);
    await referenceForm.submitPurchase();
    await page.waitForLoadState("networkidle");

    // Verify purchase was added
    let purchaseCount = await referenceForm.getPurchaseCount();
    expect(purchaseCount).toBe(1);

    // Delete the purchase
    await referenceForm.deletePurchase(0);
    await page.waitForLoadState("networkidle");

    // Verify purchase was deleted
    purchaseCount = await referenceForm.getPurchaseCount();
    expect(purchaseCount).toBe(0);
  });

  test("delete shows confirmation dialog", async ({ referenceTable, referenceForm, page }) => {
    const testName = `Delete Confirm ${Date.now()}`;

    // Create reference with purchase
    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.submit();
    await page.waitForLoadState("networkidle");

    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    await referenceForm.clickAddPurchase();
    await referenceForm.fillPurchaseForm("2024-03-01", 5, 15.00);
    await referenceForm.submitPurchase();
    await page.waitForLoadState("networkidle");

    // Click delete button
    const row = referenceForm.purchaseTable.locator(".ant-table-tbody tr").first();
    await row.locator("button").filter({ has: page.locator(".anticon-delete") }).click();

    // Confirmation dialog should appear
    await expect(page.getByText("Are you sure you want to delete this purchase?")).toBeVisible();

    // Cancel
    await page.getByRole("button", { name: "No" }).click();

    // Purchase should still exist
    const purchaseCount = await referenceForm.getPurchaseCount();
    expect(purchaseCount).toBe(1);
  });
});
