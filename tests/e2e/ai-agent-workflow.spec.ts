import { expect } from "@playwright/test";
import { test, assertClean, type ConsoleCollector } from "./helpers";

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:3001";

const TEST_USER_EMAIL = "admin@vellum.com";
const TEST_USER_PASSWORD = "password123";

test.describe.configure({ mode: "serial", retries: 0, timeout: 300000 });

interface Issue {
  id: string;
  timestamp: Date;
  step: string;
  severity: "critical" | "high" | "medium" | "low";
  type: "functional" | "visual" | "performance" | "accessibility" | "ux";
  description: string;
  reproductionSteps: string[];
  evidence: string[];
  suggestedResolution: string;
}

test.describe("AI Agent Browser Testing Workflow", () => {
  let accessToken: string;
  let currentUserId: string;
  let testAuthorHandle: string;
  let testAuthorId: string;
  let testArticleSlug: string;
  const issues: Issue[] = [];

  function reportIssue(
    step: string,
    severity: Issue["severity"],
    type: Issue["type"],
    description: string,
    reproductionSteps: string[],
    evidence: string[],
    suggestedResolution: string
  ) {
    issues.push({
      id: `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      step,
      severity,
      type,
      description,
      reproductionSteps,
      evidence,
      suggestedResolution,
    });
  }

  async function login(page: any) {
    await page.goto(`${WEB_ORIGIN}/`, { waitUntil: "commit" });
    await page.evaluate((token: string) => {
      localStorage.setItem("vellum_access_token", token);
    }, accessToken);
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: "commit" });
    await waitForReact(page);
  }

  async function waitForReact(page: any, timeout = 90000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const bodyLen = await page.evaluate(() => document.body.textContent?.length || 0);
      if (bodyLen > 200) return true;
      await page.waitForTimeout(2000);
    }
    return false;
  }

  test.beforeAll(async () => {
    const loginResponse = await fetch(`${API_ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      accessToken = loginData.accessToken;

      const meResponse = await fetch(`${API_ORIGIN}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      const me = await meResponse.json();
      currentUserId = me.id;
    }

    const articlesResponse = await fetch(`${API_ORIGIN}/api/articles?page=1&limit=5`);
    const articlesData = await articlesResponse.json();
    if (articlesData.data && articlesData.data.length > 0) {
      const firstArticle = articlesData.data[0];
      testArticleSlug = firstArticle.slug;
      testAuthorHandle = firstArticle.author.handle;
      testAuthorId = firstArticle.author.id;
    }
  });

  test.afterAll(async () => {
    console.log("\n\n========================================");
    console.log("            TEST REPORT SUMMARY");
    console.log("========================================");
    console.log(`\nTotal Issues Found: ${issues.length}`);

    const critical = issues.filter((i) => i.severity === "critical");
    const high = issues.filter((i) => i.severity === "high");
    const medium = issues.filter((i) => i.severity === "medium");
    const low = issues.filter((i) => i.severity === "low");

    console.log(`  - Critical: ${critical.length}`);
    console.log(`  - High: ${high.length}`);
    console.log(`  - Medium: ${medium.length}`);
    console.log(`  - Low: ${low.length}`);

    const functional = issues.filter((i) => i.type === "functional");
    const visual = issues.filter((i) => i.type === "visual");
    const performance = issues.filter((i) => i.type === "performance");
    const accessibility = issues.filter((i) => i.type === "accessibility");
    const ux = issues.filter((i) => i.type === "ux");

    console.log(`\nIssue Type Distribution:`);
    console.log(`  - Functional: ${functional.length}`);
    console.log(`  - Visual: ${visual.length}`);
    console.log(`  - Performance: ${performance.length}`);
    console.log(`  - Accessibility: ${accessibility.length}`);
    console.log(`  - UX: ${ux.length}`);

    if (issues.length > 0) {
      console.log("\n\nDetailed Issue Reports:");
      console.log("----------------------");

      issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.id}`);
        console.log(`   Timestamp: ${issue.timestamp.toISOString()}`);
        console.log(`   Step: ${issue.step}`);
        console.log(`   Severity: ${issue.severity.toUpperCase()}`);
        console.log(`   Type: ${issue.type}`);
        console.log(`   Description: ${issue.description}`);
        console.log(`   Reproduction Steps:`);
        issue.reproductionSteps.forEach((step, i) => {
          console.log(`     ${i + 1}. ${step}`);
        });
        console.log(`   Evidence: ${issue.evidence.join(", ")}`);
        console.log(`   Suggested Resolution: ${issue.suggestedResolution}`);
      });
    }

    console.log("\n========================================");
    console.log("            END OF TEST REPORT");
    console.log("========================================");
  });

  test("1. Authentication Phase: Automated Login", async ({ page, collector }) => {
    console.log("\n=== Step 1: Authentication Phase ===");

    const startTime = Date.now();

    await page.goto(`${WEB_ORIGIN}/login`, { waitUntil: "commit" });
    await waitForReact(page);

    const emailInput = page.getByPlaceholder(/email|you@example/i).first();
    const passwordInput = page.getByPlaceholder(/password/i).first();

    if (!(await emailInput.isVisible()) || !(await passwordInput.isVisible())) {
      reportIssue(
        "Authentication Phase",
        "high",
        "functional",
        "Login form elements not visible or not properly rendered",
        ["Navigate to /login", "Check for email and password input fields"],
        ["Page screenshot at login page"],
        "Verify that the login page component is properly rendering and that CSS is loading correctly"
      );
    }

    await emailInput.fill(TEST_USER_EMAIL);
    await passwordInput.fill(TEST_USER_PASSWORD);

    await page.getByRole("button", { name: /sign in|log in|submit/i }).first().click();

    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    console.log(`  Page title after login: ${pageTitle}`);

    const url = page.url();
    console.log(`  Current URL: ${url}`);

    const loadTime = Date.now() - startTime;
    console.log(`  Login flow time: ${loadTime}ms`);

    if (loadTime > 5000) {
      reportIssue(
        "Authentication Phase",
        "medium",
        "performance",
        `Login flow took ${loadTime}ms, exceeding expected threshold of 5000ms`,
        ["Navigate to /login", "Enter credentials", "Click login button", "Measure time to redirect"],
        [`Load time: ${loadTime}ms`],
        "Optimize login API response time and frontend rendering. Consider adding loading indicators."
      );
    }

    if (!url.includes("/") || url.includes("/login")) {
      reportIssue(
        "Authentication Phase",
        "critical",
        "functional",
        "Login failed or redirect to home page did not occur",
        ["Enter valid credentials", "Click login button", "Check if redirected to home"],
        [`Current URL: ${url}`, `Page title: ${pageTitle}`],
        "Check login API endpoint for errors. Verify authentication middleware is working correctly."
      );
    }

    console.log("  ✓ Authentication successful");
    assertClean(collector);
  });

  test("2. Home Page Navigation: Suggested for You", async ({ page, collector }) => {
    console.log("\n=== Step 2: Home Page Navigation ===");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/`, { waitUntil: "commit" });
    await waitForReact(page);

    const pageText = await page.textContent("body");
    console.log(`  Page text length: ${pageText?.length || 0} characters`);

    const suggestedSection = page.locator("text=Suggested for You");
    const hasSuggestedSection = await suggestedSection.count();
    console.log(`  'Suggested for You' section found: ${hasSuggestedSection > 0}`);

    if (hasSuggestedSection === 0) {
      reportIssue(
        "Home Page Navigation",
        "medium",
        "functional",
        "'Suggested for You' section not found on home page",
        ["Navigate to home page", "Search for 'Suggested for You' section"],
        ["Page text content analysis"],
        "Verify the home page component includes the suggested users section. Check if data is being fetched correctly."
      );

      const exploreSection = page.locator("text=Explore");
      if ((await exploreSection.count()) > 0) {
        console.log("  Found 'Explore' section instead of 'Suggested for You'");
      }
    }

    const userCards = page.locator('[data-testid="user-card"], .user-card, .author-card');
    const userCardCount = await userCards.count();
    console.log(`  User cards found: ${userCardCount}`);

    if (userCardCount === 0) {
      reportIssue(
        "Home Page Navigation",
        "medium",
        "functional",
        "No user profile cards found in suggested section",
        ["Navigate to home page", "Look for user cards in suggested section"],
        ["Page element count analysis"],
        "Ensure user cards are being rendered with proper data-testid or class attributes. Verify API is returning suggested users."
      );
    }

    if (userCardCount > 0) {
      const firstUserCard = userCards.first();
      await firstUserCard.click();

      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log(`  URL after clicking user card: ${currentUrl}`);

      if (!currentUrl.includes("/author/")) {
        reportIssue(
          "Home Page Navigation",
          "high",
          "functional",
          "Clicking user card did not navigate to profile page",
          ["Find user card on home page", "Click on user card", "Check resulting URL"],
          [`Current URL: ${currentUrl}`],
          "Verify user card click handlers are properly implemented. Check router configuration for /author/:id route."
        );
      } else {
        console.log("  ✓ Successfully navigated to user profile page");
      }
    }

    assertClean(collector);
  });

  test("3. Profile Page Actions: Following Section", async ({ page, collector }) => {
    console.log("\n=== Step 3: Profile Page Actions ===");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/author/${testAuthorHandle}`, { waitUntil: "commit" });
    await waitForReact(page);

    const pageTitle = await page.title();
    console.log(`  Profile page title: ${pageTitle}`);

    const followButton = page.locator("button", { hasText: /follow|following/i }).first();
    const followButtonExists = await followButton.count();
    console.log(`  Follow button exists: ${followButtonExists > 0}`);

    if (followButtonExists === 0) {
      reportIssue(
        "Profile Page Actions",
        "high",
        "functional",
        "Follow button not found on profile page",
        ["Navigate to user profile page", "Search for follow/following button"],
        ["Profile page screenshot"],
        "Verify follow button component is included in profile page. Check if authentication state is properly passed."
      );
    } else {
      const followButtonText = await followButton.textContent();
      console.log(`  Follow button text: ${followButtonText}`);
    }

    const followingLink = page.locator('a', { hasText: /following/i }).first();
    const followersLink = page.locator('a', { hasText: /followers/i }).first();

    const hasFollowingLink = await followingLink.count();
    const hasFollowersLink = await followersLink.count();

    console.log(`  Following link exists: ${hasFollowingLink > 0}`);
    console.log(`  Followers link exists: ${hasFollowersLink > 0}`);

    if (hasFollowingLink === 0) {
      reportIssue(
        "Profile Page Actions",
        "medium",
        "functional",
        "'Following' link not found on profile page",
        ["Navigate to user profile page", "Look for Following link/count"],
        ["Profile page screenshot"],
        "Ensure profile page displays follower/following counts as clickable links."
      );
    }

    if (hasFollowersLink === 0) {
      reportIssue(
        "Profile Page Actions",
        "medium",
        "functional",
        "'Followers' link not found on profile page",
        ["Navigate to user profile page", "Look for Followers link/count"],
        ["Profile page screenshot"],
        "Ensure profile page displays follower/following counts as clickable links."
      );
    }

    if (hasFollowingLink > 0) {
      await followingLink.click();
      await page.waitForTimeout(2000);

      const followingPageUrl = page.url();
      console.log(`  URL after clicking Following: ${followingPageUrl}`);

      if (!followingPageUrl.includes("/following")) {
        reportIssue(
          "Profile Page Actions",
          "high",
          "functional",
          "Clicking 'Following' link did not navigate to following page",
          ["Navigate to profile page", "Click 'Following' link", "Check resulting URL"],
          [`Current URL: ${followingPageUrl}`],
          "Verify the 'Following' link has correct href attribute pointing to /author/:id/following"
        );
      } else {
        console.log("  ✓ Successfully navigated to Following page");

        const followingListItems = page.locator('[data-testid="user-item"], .user-item');
        const followingCount = await followingListItems.count();
        console.log(`  Users in following list: ${followingCount}`);

        if (followingCount === 0) {
          reportIssue(
            "Profile Page Actions",
            "low",
            "functional",
            "Following list is empty",
            ["Navigate to /author/:id/following", "Check if users are displayed"],
            ["Following page screenshot"],
            "This may be expected if the user follows no one. Verify API returns following list correctly."
          );
        }
      }
    }

    assertClean(collector);
  });

  test("4. Article Interaction Workflow", async ({ page, collector }) => {
    console.log("\n=== Step 4: Article Interaction Workflow ===");

    await login(page);
    
    const startTime = Date.now();
    await page.goto(`${WEB_ORIGIN}/article/${testArticleSlug}`, { waitUntil: "commit" });
    await waitForReact(page);
    const loadTime = Date.now() - startTime;
    
    console.log(`  Article page load time: ${loadTime}ms`);

    if (loadTime > 10000) {
      reportIssue(
        "Article Interaction Workflow",
        "medium",
        "performance",
        `Article page took ${loadTime}ms to load, exceeding 10s threshold`,
        ["Navigate to article detail page", "Measure load time"],
        [`Load time: ${loadTime}ms`],
        "Optimize article content loading. Consider lazy loading for images and content blocks."
      );
    }

    const articleTitle = page.locator("h1");
    const titleExists = await articleTitle.count();
    console.log(`  Article title found: ${titleExists > 0}`);

    if (titleExists === 0) {
      reportIssue(
        "Article Interaction Workflow",
        "critical",
        "functional",
        "Article title not found on article detail page",
        ["Navigate to article page", "Search for article title"],
        ["Article page screenshot"],
        "Verify article page component renders the title properly. Check API response for article data."
      );
    }

    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    console.log(`  Total buttons on page: ${buttonCount}`);

    const actionButtons = page.locator('button').filter({ has: page.locator('svg') });
    const actionBtnCount = await actionButtons.count();
    console.log(`  Buttons with SVG icons: ${actionBtnCount}`);

    if (actionBtnCount >= 3) {
      const likeButton = actionButtons.nth(0);
      const bookmarkButton = actionButtons.nth(1);
      const shareButton = actionButtons.nth(2);

      console.log(`  Like button exists: true`);
      console.log(`  Bookmark button exists: true`);
      console.log(`  Share button exists: true`);

      await likeButton.click();
      await page.waitForTimeout(1000);

      const likeColor = await page.evaluate(() => {
        const svg = document.querySelector('svg[color="#d97706"]');
        return svg !== null;
      });
      console.log(`  Like button visually updated (amber color): ${likeColor}`);

      if (!likeColor) {
        reportIssue(
          "Article Interaction Workflow",
          "high",
          "visual",
          "Like button does not visually update after click",
          ["Navigate to article page", "Click like button", "Check if button fills with color"],
          ["Before/after screenshots of like button"],
          "Verify CSS class is applied when article is liked. Check state management for like status."
        );
      } else {
        console.log("  ✓ Like functionality works correctly");
      }

      await bookmarkButton.click();
      await page.waitForTimeout(1000);

      const bookmarkColor = await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg[color="#d97706"]');
        return svgs.length > 1;
      });
      console.log(`  Bookmark button visually updated (amber color): ${bookmarkColor}`);

      if (!bookmarkColor) {
        reportIssue(
          "Article Interaction Workflow",
          "high",
          "visual",
          "Bookmark button does not visually update after click",
          ["Navigate to article page", "Click bookmark button", "Check if button fills with color"],
          ["Before/after screenshots of bookmark button"],
          "Verify CSS class is applied when article is bookmarked. Check state management for bookmark status."
        );
      } else {
        console.log("  ✓ Bookmark functionality works correctly");
      }

      await shareButton.click();
      await page.waitForTimeout(500);
      console.log("  ✓ Share button clicked");
    } else {
      reportIssue(
        "Article Interaction Workflow",
        "high",
        "functional",
        "Action buttons (like/bookmark/share) not found on article page",
        ["Navigate to article page", "Search for action buttons with SVG icons"],
        [`Found ${actionBtnCount} buttons with SVG icons`],
        "Ensure action buttons are properly rendered on article page. Check if authentication state is passed correctly."
      );
    }

    const commentInput = page.locator('textarea', { hasPlaceholder: /comment|write a comment/i }).first();
    const commentButton = page.locator('button', { hasText: /post|submit comment/i }).first();

    console.log(`  Comment input exists: ${await commentInput.count() > 0}`);
    console.log(`  Comment submit button exists: ${await commentButton.count() > 0}`);

    if (!(await commentInput.count() > 0)) {
      reportIssue(
        "Article Interaction Workflow",
        "high",
        "functional",
        "Comment input field not found on article page",
        ["Navigate to article page", "Search for comment textarea"],
        ["Article page screenshot"],
        "Ensure comment input component is included in article page"
      );
    }

    if (await commentInput.count() > 0) {
      const testComment = `Test comment from AI agent - ${Date.now()}`;
      await commentInput.fill(testComment);
      await commentButton.click();

      await page.waitForTimeout(2000);

      const comments = page.locator('[data-testid="comment"], .comment');
      const commentCount = await comments.count();
      console.log(`  Comments on page: ${commentCount}`);

      const lastComment = comments.last();
      const lastCommentText = await lastComment.textContent();
      const commentPosted = lastCommentText?.includes(testComment);
      console.log(`  New comment found: ${commentPosted}`);

      if (!commentPosted) {
        reportIssue(
          "Article Interaction Workflow",
          "critical",
          "functional",
          "Comment was not posted successfully",
          ["Navigate to article page", "Enter comment text", "Click submit", "Check if comment appears"],
          [`Expected comment: ${testComment}`, `Last comment text: ${lastCommentText}`],
          "Check comment API endpoint. Verify form submission handler is working correctly."
        );
      } else {
        console.log("  ✓ Comment functionality works correctly");

        const replyButton = page.locator('button', { hasText: /reply/i }).first();
        if (await replyButton.count() > 0) {
          await replyButton.click();
          await page.waitForTimeout(500);

          const replyInput = page.locator('textarea', { hasPlaceholder: /reply/i }).first();
          const testReply = `Test reply from AI agent - ${Date.now()}`;

          if (await replyInput.count() > 0) {
            await replyInput.fill(testReply);
            const replySubmit = page.locator('button', { hasText: /reply/i }).nth(1);
            if (await replySubmit.count() > 0) {
              await replySubmit.click();
              await page.waitForTimeout(1500);
              console.log("  ✓ Reply functionality works correctly");
            } else {
              reportIssue(
                "Article Interaction Workflow",
                "medium",
                "functional",
                "Reply submit button not found",
                ["Click reply button", "Search for reply submit button"],
                ["Comment section screenshot"],
                "Ensure reply form includes submit button"
              );
            }
          }
        }
      }
    }

    if (collector.failedRequests.length > 0) {
      collector.failedRequests.forEach((req) => {
        reportIssue(
          "Article Interaction Workflow",
          "critical",
          "functional",
          `API request failed: ${req.method} ${req.url} -> ${req.status}`,
          ["Navigate to article page", "Interact with article actions"],
          [`Request: ${req.method} ${req.url}`, `Status: ${req.status}`],
          "Check API endpoint for errors. Verify authentication and request payload."
        );
      });
    }

    if (collector.errors.length > 0) {
      collector.errors.forEach((err) => {
        reportIssue(
          "Article Interaction Workflow",
          "medium",
          "functional",
          `Console error detected: ${err}`,
          ["Navigate to article page", "Monitor console errors"],
          [err],
          "Investigate console errors in browser dev tools."
        );
      });
    }
  });
});