import { Page, Locator, expect } from "@playwright/test";

export class ReferenceTablePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly newButton: Locator;
  readonly exportButton: Locator;
  readonly statsButton: Locator;
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly statsModal: Locator;
  readonly exportModal: Locator;
  readonly referenceModal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder("Filter references...");
    this.newButton = page.getByRole("button", { name: "New" });
    this.exportButton = page.getByRole("button", { name: "Export" });
    this.statsButton = page.getByRole("button", { name: "Stats" });
    this.table = page.locator(".ant-table");
    this.tableRows = page.locator(".ant-table-tbody tr.ant-table-row");
    this.statsModal = page.locator(".ant-modal").filter({ hasText: "Cellar Statistics" });
    this.exportModal = page.locator(".ant-modal").filter({ hasText: "Export Settings" });
    this.referenceModal = page.locator(".ant-modal").filter({ has: page.getByText(/Reference/) });
  }

  async goto() {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce
    await this.page.waitForTimeout(400);
    await this.page.waitForLoadState("networkidle");
  }

  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(400);
    await this.page.waitForLoadState("networkidle");
  }

  async clickNew() {
    await this.newButton.click();
    await this.referenceModal.waitFor({ state: "visible" });
  }

  async clickExport() {
    await this.exportButton.click();
    await this.exportModal.waitFor({ state: "visible" });
  }

  async clickStats() {
    await this.statsButton.click();
    await this.statsModal.waitFor({ state: "visible" });
  }

  async getRowCount() {
    return await this.tableRows.count();
  }

  async getRowByName(name: string) {
    return this.tableRows.filter({ hasText: name });
  }

  async editReference(name: string) {
    const row = await this.getRowByName(name);
    await row.getByRole("button").filter({ has: this.page.locator(".anticon-edit") }).click();
    await this.referenceModal.waitFor({ state: "visible" });
  }

  async toggleMenuVisibility(name: string) {
    const row = await this.getRowByName(name);
    // Click the eye icon button
    const eyeButton = row.locator("button").filter({
      has: this.page.locator(".anticon-eye, .anticon-eye-invisible"),
    });
    await eyeButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  async isRowHidden(name: string) {
    const row = await this.getRowByName(name);
    const className = await row.getAttribute("class");
    return className?.includes("row-hidden") || false;
  }

  async editQuantity(name: string, quantity: number) {
    const row = await this.getRowByName(name);
    // Click the quantity button to start editing
    const quantityButton = row.locator("button").first();
    await quantityButton.click();

    // Wait for input to appear and fill it
    const input = row.locator("input[type='number'], .ant-input-number input");
    await input.fill(quantity.toString());

    // Save
    await row.getByRole("button", { name: "Save" }).click();
    await this.page.waitForLoadState("networkidle");
  }

  async cancelQuantityEdit(name: string) {
    const row = await this.getRowByName(name);
    await row.getByRole("button", { name: "Cancel" }).click();
  }

  async getQuantity(name: string) {
    const row = await this.getRowByName(name);
    const quantityButton = row.locator("button").first();
    return await quantityButton.textContent();
  }

  async sortByColumn(columnName: string) {
    const header = this.page.locator(".ant-table-thead th").filter({ hasText: columnName });
    await header.click();
    await this.page.waitForLoadState("networkidle");
  }

  async getCellText(rowIndex: number, columnIndex: number) {
    const cell = this.tableRows.nth(rowIndex).locator("td").nth(columnIndex);
    return await cell.textContent();
  }

  async getColumnValues(columnIndex: number) {
    const cells = this.tableRows.locator(`td:nth-child(${columnIndex + 1})`);
    return await cells.allTextContents();
  }

  // Stats modal methods
  async getStatsValue(statName: string) {
    const statistic = this.statsModal.locator(".ant-statistic").filter({ hasText: statName });
    const value = statistic.locator(".ant-statistic-content-value");
    return await value.textContent();
  }

  async closeStatsModal() {
    await this.statsModal.getByRole("button", { name: "Close" }).click();
    await this.statsModal.waitFor({ state: "hidden" });
  }

  // Export modal methods
  async printMenu() {
    await this.exportModal.getByRole("button", { name: "Print Menu" }).click();
  }

  async closeExportModal() {
    await this.exportModal.getByRole("button", { name: "Cancel" }).click();
    await this.exportModal.waitFor({ state: "hidden" });
  }
}
