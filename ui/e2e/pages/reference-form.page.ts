import { Page, Locator, expect } from "@playwright/test";

export class ReferenceFormPage {
  readonly page: Page;
  readonly modal: Locator;
  readonly nameInput: Locator;
  readonly categorySelect: Locator;
  readonly regionSelect: Locator;
  readonly appellationSelect: Locator;
  readonly domainInput: Locator;
  readonly vintageInput: Locator;
  readonly quantityInput: Locator;
  readonly hiddenFromMenuCheckbox: Locator;
  readonly priceMultiplierInput: Locator;
  readonly retailPriceOverrideInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly addPurchaseButton: Locator;
  readonly purchaseTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator(".ant-modal").filter({ has: page.getByText(/Reference/) });
    this.nameInput = this.modal.locator("#name, input[id='name']");
    this.categorySelect = this.modal.locator("#category").locator(".ant-select-selector");
    this.regionSelect = this.modal.locator("#region").locator(".ant-select-selector");
    this.appellationSelect = this.modal.locator("#appellation").locator(".ant-select-selector");
    this.domainInput = this.modal.locator("#domain, input[id='domain']");
    this.vintageInput = this.modal.locator("#vintage input, input[id='vintage']");
    this.quantityInput = this.modal.locator("#current_quantity input, input[id='current_quantity']");
    this.hiddenFromMenuCheckbox = this.modal.locator("input[type='checkbox']").first();
    this.priceMultiplierInput = this.modal.locator("#price_multiplier input");
    this.retailPriceOverrideInput = this.modal.locator("#retail_price_override input");
    this.submitButton = this.modal.getByRole("button", { name: /Create|Update/ }).first();
    this.cancelButton = this.modal.getByRole("button", { name: "Cancel" }).first();
    this.addPurchaseButton = this.modal.getByRole("button", { name: "Add Purchase" });
    this.purchaseTable = this.modal.locator(".ant-table").last();
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async selectCategory(category: string) {
    await this.categorySelect.click();
    await this.page.locator(".ant-select-dropdown:visible").getByText(category, { exact: true }).click();
  }

  async addNewCategory(categoryName: string) {
    await this.categorySelect.click();
    // Click "Add new category" button in dropdown
    await this.page.getByRole("button", { name: "Add new category" }).click();
    // Fill in the new category name
    await this.page.locator("input[placeholder='Category name']").fill(categoryName);
    // Click Add button
    await this.page.getByRole("button", { name: "Add" }).first().click();
    await this.page.waitForLoadState("networkidle");
  }

  async selectRegion(region: string) {
    await this.regionSelect.click();
    await this.page.locator(".ant-select-dropdown:visible").getByText(region, { exact: true }).click();
  }

  async addNewRegion(regionName: string) {
    await this.regionSelect.click();
    await this.page.getByRole("button", { name: "Add new region" }).click();
    await this.page.locator("input[placeholder='Region name']").fill(regionName);
    await this.page.getByRole("button", { name: "Add" }).first().click();
    await this.page.waitForLoadState("networkidle");
  }

  async selectAppellation(appellation: string) {
    await this.appellationSelect.click();
    await this.page.locator(".ant-select-dropdown:visible").getByText(appellation, { exact: true }).click();
  }

  async addNewAppellation(appellationName: string) {
    await this.appellationSelect.click();
    await this.page.getByRole("button", { name: "Add new appellation" }).click();
    await this.page.locator("input[placeholder='Appellation name']").fill(appellationName);
    await this.page.getByRole("button", { name: "Add" }).first().click();
    await this.page.waitForLoadState("networkidle");
  }

  async fillDomain(domain: string) {
    await this.domainInput.fill(domain);
  }

  async fillVintage(vintage: number) {
    await this.vintageInput.fill(vintage.toString());
  }

  async fillQuantity(quantity: number) {
    await this.quantityInput.fill(quantity.toString());
  }

  async toggleHiddenFromMenu() {
    await this.hiddenFromMenuCheckbox.click();
  }

  async fillPriceMultiplier(multiplier: number) {
    await this.priceMultiplierInput.fill(multiplier.toString());
  }

  async fillRetailPriceOverride(price: number) {
    await this.retailPriceOverrideInput.fill(price.toString());
  }

  async submit() {
    await this.submitButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  async cancel() {
    await this.cancelButton.click();
    await this.modal.waitFor({ state: "hidden" });
  }

  // Purchase form methods
  async clickAddPurchase() {
    await this.addPurchaseButton.click();
  }

  async fillPurchaseForm(date: string, quantity: number, price: number) {
    // Fill date picker
    await this.modal.locator(".ant-picker").click();
    await this.page.locator(".ant-picker-dropdown:visible input").fill(date);
    await this.page.keyboard.press("Enter");

    // Fill quantity
    await this.modal.locator("input[placeholder='Quantity']").fill(quantity.toString());

    // Fill price
    await this.modal.locator("input[placeholder='Price']").fill(price.toString());
  }

  async submitPurchase() {
    await this.modal.locator("form").last().getByRole("button", { name: /Add|Update/ }).click();
    await this.page.waitForLoadState("networkidle");
  }

  async cancelPurchase() {
    await this.modal.locator("form").last().getByRole("button", { name: "Cancel" }).click();
  }

  async editPurchase(rowIndex: number) {
    const row = this.purchaseTable.locator(".ant-table-tbody tr").nth(rowIndex);
    await row.locator("button").filter({ has: this.page.locator(".anticon-edit") }).click();
  }

  async deletePurchase(rowIndex: number) {
    const row = this.purchaseTable.locator(".ant-table-tbody tr").nth(rowIndex);
    await row.locator("button").filter({ has: this.page.locator(".anticon-delete") }).click();
    // Confirm deletion
    await this.page.getByRole("button", { name: "Yes" }).click();
    await this.page.waitForLoadState("networkidle");
  }

  async getPurchaseCount() {
    return await this.purchaseTable.locator(".ant-table-tbody tr").count();
  }

  async getPurchaseRowText(rowIndex: number) {
    const row = this.purchaseTable.locator(".ant-table-tbody tr").nth(rowIndex);
    return await row.textContent();
  }

  async getComputedRetailPrice() {
    const priceField = this.modal.locator("label").filter({ hasText: "Computed Retail Price" }).locator("..").locator("input");
    return await priceField.inputValue();
  }
}
