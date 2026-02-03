import { test, expect } from "../../fixtures/base";

test.describe("Edit Purchase", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("can edit an existing purchase", async ({ referenceTable, referenceForm, page }) => {
    const testName = `Edit Purchase ${Date.now()}`;

    // Create reference
    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.submit();
    await page.waitForLoadState("networkidle");

    // Edit reference and add a purchase
    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    await referenceForm.clickAddPurchase();
    await referenceForm.fillPurchaseForm("2024-01-15", 6, 12.50);
    await referenceForm.submitPurchase();
    await page.waitForLoadState("networkidle");

    // Edit the purchase
    await referenceForm.editPurchase(0);

    // Modify quantity
    await referenceForm.modal.locator("input[placeholder='Quantity']").clear();
    await referenceForm.modal.locator("input[placeholder='Quantity']").fill("12");

    await referenceForm.submitPurchase();
    await page.waitForLoadState("networkidle");

    // Verify purchase was updated
    const purchaseText = await referenceForm.getPurchaseRowText(0);
    expect(purchaseText).toContain("12");
  });

  test("edit purchase form is pre-filled with data", async ({ referenceTable, referenceForm, page }) => {
    const testName = `Prefilled Purchase ${Date.now()}`;

    // Create reference with purchase
    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.submit();
    await page.waitForLoadState("networkidle");

    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    await referenceForm.clickAddPurchase();
    await referenceForm.fillPurchaseForm("2024-06-01", 10, 25.00);
    await referenceForm.submitPurchase();
    await page.waitForLoadState("networkidle");

    // Edit purchase
    await referenceForm.editPurchase(0);

    // Quantity should be pre-filled
    const quantityValue = await referenceForm.modal.locator("input[placeholder='Quantity']").inputValue();
    expect(quantityValue).toBe("10");

    const priceValue = await referenceForm.modal.locator("input[placeholder='Price']").inputValue();
    expect(priceValue).toBe("25");
  });
});
