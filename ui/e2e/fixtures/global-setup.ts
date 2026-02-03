import { request } from "@playwright/test";

const API_URL = process.env.API_URL || "http://api:8000";

async function globalSetup() {
  const apiContext = await request.newContext({
    baseURL: API_URL,
  });

  // Wait for API to be ready
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await apiContext.get("/api/healthcheck");
      if (response.ok()) {
        console.log("API is ready");
        break;
      }
    } catch {
      // API not ready yet
    }
    retries--;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (retries === 0) {
    throw new Error("API failed to become ready");
  }

  // Verify database has test data by checking for references
  const refsResponse = await apiContext.get("/api/refs");
  if (!refsResponse.ok()) {
    throw new Error("Failed to fetch references - ensure database is seeded with 'make seed-db'");
  }

  const data = await refsResponse.json();
  if (!data.items || data.items.length === 0) {
    console.warn("Warning: No references found in database. Run 'make seed-db' to populate test data.");
  } else {
    console.log(`Found ${data.items.length} references in database`);
  }

  await apiContext.dispose();
}

export default globalSetup;
