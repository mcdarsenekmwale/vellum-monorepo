import { test as baseTest, type Page } from "@playwright/test";

export type ConsoleCollector = {
  errors: string[];
  failedRequests: { url: string; status: number; method: string }[];
};

const KNOWN_NON_ERRORS = [
  "Download the React DevTools",
  "react-devtools",
  "Lit is in dev mode",
  "[webpack-dev-server]",
  "ERR_TIMED_OUT",
  "ERR_CONNECTION_REFUSED",
  "ERR_FAILED",
  "Failed to load resource",
];

export function attachListeners(page: Page, apiOrigin: string): ConsoleCollector {
  const collector: ConsoleCollector = { errors: [], failedRequests: [] };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      const isKnown = KNOWN_NON_ERRORS.some((pattern) => text.includes(pattern));
      if (!isKnown) {
        collector.errors.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    const text = err.message;
    const isKnown = KNOWN_NON_ERRORS.some((pattern) => text.includes(pattern));
    if (!isKnown) {
      collector.errors.push(text);
    }
  });

  page.on("response", (response) => {
    const url = response.url();
    const status = response.status();
    if (url.startsWith(apiOrigin) && status >= 400) {
      collector.failedRequests.push({
        url,
        status,
        method: response.request().method(),
      });
    }
    if (status === 404) {
      collector.errors.push(`404 response: ${response.request().method()} ${url}`);
    }
  });

  return collector;
}

export function assertClean(collector: ConsoleCollector): void {
  const errorMessages = collector.errors.filter(Boolean);
  const failedRequests = collector.failedRequests.filter(
    (r) => !r.url.includes("/api/health")
  );

  if (errorMessages.length > 0) {
    throw new Error(
      `Console errors detected:\n${errorMessages.join("\n")}`
    );
  }

  if (failedRequests.length > 0) {
    throw new Error(
      `Failed API requests detected:\n${failedRequests
        .map((r) => `${r.method} ${r.url} -> ${r.status}`)
        .join("\n")}`
    );
  }
}

type Fixtures = {
  collector: ConsoleCollector;
};

export const test = baseTest.extend<Fixtures>({
  collector: async ({ page }, use) => {
    const collector = attachListeners(page, "http://localhost:3001");
    await use(collector);
  },
});
