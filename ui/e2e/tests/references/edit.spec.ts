import { test, expect } from "../../fixtures/base";

test.describe("Edit Reference", () => {
  test.beforeEach(async ({ referenceTable }) => {
    await referenceTable.goto();
  });

  test("can open edit modal for existing reference", async ({ referenceTable, page }) => {
    // Get first reference name
    const firstRowName = await referenceTable.getCellText(0, 0);

    // Click edit on first row
    const row = referenceTable.tableRows.first();
    await row.locator("button").filter({ has: page.locator(".anticon-edit") }).click();

    // Modal should open with "Edit Reference" title
    await expect(page.getByText("Edit Reference")).toBeVisible();
  });

  test("edit modal is pre-filled with reference data", async ({ referenceTable, referenceForm, page }) => {
    const firstRowName = await referenceTable.getCellText(0, 0);

    const row = referenceTable.tableRows.first();
    await row.locator("button").filter({ has: page.locator(".anticon-edit") }).click();

    // Wait for form to load
    await page.waitForLoadState("networkidle");

    // Name should be pre-filled
    const nameValue = await referenceForm.nameInput.inputValue();
    expect(nameValue).toBe(firstRowName);
  });

  test("can update reference name", async ({ referenceTable, referenceForm, page }) => {
    // First create a test reference
    const originalName = `Edit Test ${Date.now()}`;
    const updatedName = `Updated ${originalName}`;

    await referenceTable.clickNew();
    await referenceForm.fillName(originalName);
    await referenceForm.submit();
    await expect(referenceForm.modal).not.toBeVisible();

    // Search and edit the reference
    await referenceTable.search(originalName);
    await referenceTable.editReference(originalName);

    // Update the name
    await referenceForm.nameInput.clear();
    await referenceForm.fillName(updatedName);
    await referenceForm.submit();

    await expect(referenceForm.modal).not.toBeVisible();

    // Search for updated name
    await referenceTable.search(updatedName);
    await expect(await referenceTable.getRowByName(updatedName)).toBeVisible();
  });

  test("can update reference domain", async ({ referenceTable, referenceForm, page }) => {
    const testName = `Domain Edit Test ${Date.now()}`;
    const newDomain = "Updated Domain";

    // Create reference
    await referenceTable.clickNew();
    await referenceForm.fillName(testName);
    await referenceForm.fillDomain("Original Domain");
    await referenceForm.submit();

    // Edit reference
    await referenceTable.search(testName);
    await referenceTable.editReference(testName);
    await page.waitForLoadState("networkidle");

    await referenceForm.domainInput.clear();
    await referenceForm.fillDomain(newDomain);
    await referenceForm.submit();

    // Verify domain was updated
    await referenceTable.search(testName);
    const row = await referenceTable.getRowByName(testName);
    const rowText = await row.textContent();
    expect(rowText).toContain(newDomain);
  });

  test("cancel edit preserves original data", async ({ referenceTable, referenceForm, page }) => {
    const firstRowName = await referenceTable.getCellText(0, 0);

    const row = referenceTable.tableRows.first();
    await row.locator("button").filter({ has: page.locator(".anticon-edit") }).click();
    await page.waitForLoadState("networkidle");

    // Change the name
    await referenceForm.nameInput.clear();
    await referenceForm.fillName("Changed Name That Should Not Save");

    // Cancel
    await referenceForm.cancel();

    // Original name should still be in the table
    const currentFirstRowName = await referenceTable.getCellText(0, 0);
    expect(currentFirstRowName).toBe(firstRowName);
  });
});
