/**
 * Spec: Minimal UI to exercise triage by patient.
 * Feature: Follow-up question UI
 */
import { expect, test } from "@playwright/test";

test.describe("Feature: Follow-up question UI", () => {
  test("Scenario: Ask as a patient and see the routed response", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Patient").selectOption({ label: "Daniel K." });
    await page.getByLabel("Question").fill("When can I go back to work?");
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(page.getByTestId("action")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("urgency")).toBeVisible();
    await expect(page.getByTestId("reply")).toBeVisible();
    await expect(page.getByTestId("evidence")).toBeVisible();
    await expect(page.getByTestId("reason")).toBeVisible();
  });

  test("Scenario: Emergency responses are visually prominent", async ({
    page,
  }) => {
    await page.route("**/api/ask", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "e2e-emergency",
          instanceId: "stub",
          durationMs: 1,
          result: {
            action: "escalate",
            urgency: "emergency",
            reply:
              "Call 911 or go to the nearest emergency department right away.",
            evidence: [],
            reason: "Emergency symptoms described.",
          },
        }),
      });
    });

    await page.goto("/");
    await page.getByLabel("Patient").selectOption({ label: "Alex R." });
    await page
      .getByLabel("Question")
      .fill("My inhaler isn't helping and I can't finish a sentence");
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(page.getByTestId("urgency")).toHaveText(/emergency/i);
    await expect(page.getByTestId("reply")).toContainText(/911/);
  });
});
