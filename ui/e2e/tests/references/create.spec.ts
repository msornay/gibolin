import { test, expect } from "../../fixtures/base";

test.describe("Create Reference", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("can open new reference modal", async ({ referenceTable, page }) => {
    await referenceTable.clickNew();
    await expect(page.getByText("New Reference")).toBeVisible();
  });

  test("can create a new reference with all fields", async ({ referenceTable, referenceForm, page }) => {
    const uniqueName = `Test Wine ${Date.now()}`;

    await referenceTable.clickNew();

    await referenceForm.fillName(uniqueName);
    await referenceForm.fillDomain("Test Domain");
    await referenceForm.fillVintage(2022);
    await referenceForm.fillQuantity(12);

    await referenceForm.submit();

    // Modal should close
    await expect(referenceForm.modal).not.toBeVisible();

    // Search for the created reference
    await referenceTable.search(uniqueName);
    const row = await referenceTable.getRowByName(uniqueName);
    await expect(row).toBeVisible();
  });

  test("shows validation error for missing name", async ({ referenceTable, referenceForm, page }) => {
    await referenceTable.clickNew();

    // Try to submit without name
    await referenceForm.submitButton.click();

    // Should show validation error
    await expect(page.getByText("Please input the name!")).toBeVisible();
  });

  test("can cancel reference creation", async ({ referenceTable, referenceForm }) => {
    await referenceTable.clickNew();
    await referenceForm.fillName("Test Wine to Cancel");
    await referenceForm.cancel();

    // Modal should close
    await expect(referenceForm.modal).not.toBeVisible();
  });

  test("can create reference with category selection", async ({ referenceTable, referenceForm, page }) => {
    const uniqueName = `Wine with Category ${Date.now()}`;

    await referenceTable.clickNew();
    await referenceForm.fillName(uniqueName);

    // Select a category (assuming one exists in seed data)
    await referenceForm.categorySelect.click();
    const firstOption = page.locator(".ant-select-dropdown:visible .ant-select-item-option").first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
    }

    await referenceForm.submit();
    await expect(referenceForm.modal).not.toBeVisible();

    // Verify created
    await referenceTable.search(uniqueName);
    await expect(await referenceTable.getRowByName(uniqueName)).toBeVisible();
  });
});
