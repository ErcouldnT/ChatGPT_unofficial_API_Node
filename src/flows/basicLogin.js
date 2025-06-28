import process from "node:process";
import dotenv from "dotenv";
import { waitForTimeout } from "../utils/helpers.js";

dotenv.config();

const { OPENAI_EMAIL, OPENAI_PASSWORD } = process.env;

/**
 * Performs the ChatGPT login flow using email/password credentials.
 * - Waits for page redirects to settle
 * - Clicks through the OpenAI login prompts
 * - Fills in email and password from environment variables
 *
 * @param {import('puppeteer').Page} page - The Puppeteer Page instance
 */
export async function performLoginWithBasicAuth(page) {
  // ensure we’re on chatgpt.com for correct session context
  if (!page.url().includes("chatgpt.com")) {
    await page.goto("https://chatgpt.com");
  }

  console.warn("Waiting for page load and potential redirects...");
  // Give time for any automatic redirects or network idle
  await waitForTimeout(5000);

  // Locate and click the main "Log in" button by its accessible name
  console.warn("Locating and clicking the Log in button...");
  const loginButton = page.locator("::-p-aria(Log in)");
  await loginButton.click();
  await waitForTimeout(5000);

  // Fill in the email field
  console.warn("Filling in email address...");
  const emailField = page.locator("input[name=\"email\"]");
  await emailField.fill(OPENAI_EMAIL);

  // Submit email to proceed to the password prompt
  console.warn("Submitting email...");
  await page.locator("button[type=\"submit\"]").click();

  // Fill in the password field
  console.warn("Filling in password...");
  const passwordField = page.locator("input[name=\"password\"]");
  await passwordField.fill(OPENAI_PASSWORD);

  // Finalize login by clicking the continue button
  console.warn("Submitting login form...");
  const continueButton = page.locator("div ::-p-aria(Continue)");
  await continueButton.click();

  // wait for page to load and redirect correctly
  await waitForTimeout(5000);
  await page.waitForSelector("#prompt-textarea");
  console.warn("Login flow complete.");
}
