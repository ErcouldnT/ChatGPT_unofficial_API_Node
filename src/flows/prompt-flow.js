// src/flows/prompt-flow.js
// Contains the logic for sending prompts to ChatGPT with optional modes
const { HtmlToText } = require('html-to-text-conv');
const { waitForTimeout, extractParagraphContent, htmlResponseToText } = require("../utils/helpers");

const converter = new HtmlToText();

/**
 * Sends a prompt to ChatGPT (with “Reason”/“Search” modes), waits for the reply,
 * polls the streaming response until it stabilizes, and returns the final text.
 *
 * @param {import('puppeteer').Page} page    - Puppeteer Page instance
 * @param {{ reason: boolean, search: boolean, threadId: string | null  }}  options - Configuration flags: 1) `reason` to enable Reason mode, 2) `search` to enable Search mode, and 3) optional `threadId` to reuse an existing conversation thread
 * @param {string} prompt                    - The user’s prompt
 * @returns {Promise<string|null>}           - The completed response text, or null if none received
 */
async function promptWithOptions(page, options, prompt) {
    const { reason, search, threadId } = options;

    // Navigate: reuse existing thread or start fresh
    const base = 'https://chatgpt.com';
    const url = threadId ? `${base}/c/${threadId}` : base;
    console.log(`🌐 Loading URL: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000  }); //wait for DOM to load for a 120sec

    // Toggle modes if requested
    if (reason) {
        console.log('🔍 Enabling Reason mode...');
        await page.locator('button::-p-aria(Reason)').click();
    }
    if (search) {
        console.log('🔍 Enabling Search mode...');
        await page.locator('button::-p-aria(Search)').click();
    }

    // Prepare and clear editor
    console.log('✏️ Clearing editor...');
    const editor = await page.waitForSelector('#prompt-textarea');
    await editor.click();
    await editor.evaluate(el => {
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
    });

    // Type and submit prompt
    console.log('✏️ Typing and submitting prompt...');
    const promptContext = `return the response to the below prompt excluding all the sources with links mentioned in the response anywhere. Prompt as follows: `;
    await editor.type(promptContext + prompt);
    await editor.press('Enter');

    // Grab the latest article ID
    console.log('⏳ Waiting briefly for response container to appear…');
    await waitForTimeout(1000);
    const ids = await page.$$eval('article', els => els.map(a => a.dataset.testid));
    const latestId = ids.pop();
    const mdSelector = `article[data-testid="${latestId}"] div.markdown`;

    // Ensure the .markdown div exists
    await page.waitForSelector(mdSelector, { timeout: 30_000 }); //wait to response container for 30 sec

    // Poll until the text stops changing
    console.log('🕒 Polling response until stable…');
    let previous = '';
    let finalText = null;

    const POLL_LIMIT = reason ? 600 : 300; // if reason mode poll for 10min else poll for 5min

    for (let i = 0; i < POLL_LIMIT; i++) { //polls up to POLL_LIMIT to account for streaming response

        //get text content from the response container
        const handle = await page.$(mdSelector);
        const text = handle
            ? await handle.evaluate(el => el.innerText.trim())
            : '';

        console.log(`🕒 Poll #${i + 1}:`, text ? `${text.slice(0, 50)}…` : '[empty]');

        if (text && text === previous) { //break the polling if the entire response is returned
            finalText = text;
            break;
        }
        previous = text;
        await waitForTimeout(1000); // wait for 1sec before polling the next time
    }

    if (finalText === null) {
        console.warn('⚠️ Response never stabilized; returning last received text (if any).');
        finalText = previous || null;  // empty string becomes null
    }

    // parse text from html content
    const cleaned = converter.convert(finalText);
    console.log({cleaned});

    if (cleaned === null) {
        console.error('⚠️ Failed to extract <p> content.');
    } else {
        console.log('🎯 Cleaned response:', cleaned);
    }

    // After the prompt, re-capture the actual thread from the URL
    const match = page.url().match(/\/c\/([0-9a-f\-]+)/);
    const newThreadId = match ? match[1] : null;
    console.log('Resolved threadId:', newThreadId);

    return {
        threadId: newThreadId,
        response: cleaned
    };
}

module.exports = { promptWithOptions };
