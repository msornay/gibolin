import { test as base } from "@playwright/test";
import { ReferenceTablePage } from "../pages/reference-table.page";
import { ReferenceFormPage } from "../pages/reference-form.page";

type Fixtures = {
  referenceTable: ReferenceTablePage;
  referenceForm: ReferenceFormPage;
};

export const test = base.extend<Fixtures>({
  referenceTable: async ({ page }, use) => {
    const referenceTable = new ReferenceTablePage(page);
    await use(referenceTable);
  },
  referenceForm: async ({ page }, use) => {
    const referenceForm = new ReferenceFormPage(page);
    await use(referenceForm);
  },
});

export { expect } from "@playwright/test";
