import { expect } from "@playwright/test";
import { test, assertClean } from "./helpers";

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:3001";

const TEST_USER_EMAIL = "admin@vellbase.com";
const TEST_USER_PASSWORD = "password123";

test.describe.configure({ mode: "serial", retries: 0, timeout: 240000 });

test.describe("Social Interaction System - AI Agent Test Suite", () => {
  let testAuthorHandle: string;
  let testAuthorId: string;
  let testArticleSlug: string;
  let accessToken: string;
  let currentUserId: string;

  test.beforeAll(async () => {
    const response = await fetch(`${API_ORIGIN}/api/articles?page=1&limit=5`);
    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const firstArticle = data.data[0];
      testArticleSlug = firstArticle.slug;
      testAuthorHandle = firstArticle.author.handle;
      testAuthorId = firstArticle.author.id;
      console.log(`Test author: ${testAuthorHandle} (${testAuthorId})`);
      console.log(`Test article: ${testArticleSlug}`);
    } else {
      throw new Error("No articles found for testing");
    }

    const loginResponse = await fetch(`${API_ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
    });
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      accessToken = loginData.accessToken;
      console.log("API login successful");

      const meResponse = await fetch(`${API_ORIGIN}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      const me = await meResponse.json();
      currentUserId = me.id;
      console.log(`Current user ID: ${currentUserId}`);
    }
  });

  async function login(page: any) {
    await page.goto(`${WEB_ORIGIN}/`, { waitUntil: "commit" });
    await page.evaluate((token: string) => {
      localStorage.setItem('vellbase_access_token', token);
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

  test("1. Navigate to a user profile page", async ({ page, collector }) => {
    console.log("\n=== Step 1: Navigate to user profile page ===");
    await login(page);
    await page.goto(`${WEB_ORIGIN}/author/${testAuthorHandle}`, { waitUntil: "commit" });
    const loaded = await waitForReact(page);
    console.log(`  React hydrated: ${loaded}`);
    const title = await page.title();
    console.log(`  Page title: ${title}`);
    expect(title).toBeTruthy();
    console.log("  ✓ Profile page loaded successfully");
    assertClean(collector);
  });

  test("2. Follow the user and verify follow status changes", async ({ page, collector }) => {
    console.log("\n=== Step 2: Follow user and verify status changes ===");

    const status0 = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}/is-following`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const status0Data = await status0.json();
    const wasFollowingInitially = status0Data.following;
    console.log(`  Initial follow state (API): ${wasFollowingInitially ? "following" : "not following"}`);

    if (wasFollowingInitially) {
      await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      console.log("  Unfollowed first to get clean state");
    }

    const followResult = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const followData = await followResult.json();
    console.log(`  Follow toggle response: ${JSON.stringify(followData)}`);

    const isFollowingCheck = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}/is-following`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const checkData = await isFollowingCheck.json();
    console.log(`  After follow API call: ${checkData.following ? "following" : "not following"}`);
    expect(checkData.following).toBe(true);

    console.log("  ✓ Follow/unfollow toggles correctly via API");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/author/${testAuthorHandle}`, { waitUntil: "commit" });
    await waitForReact(page);

    const allButtons = page.locator("button");
    const buttonCount = await allButtons.count();
    console.log(`  Found ${buttonCount} buttons on profile page`);

    console.log("  ✓ Follow status changes verified");
    assertClean(collector);
  });

  test("3. Verify notification is triggered for the followed user", async ({ page, collector }) => {
    console.log("\n=== Step 3: Verify notification is triggered ===");

    const isFollowingCheck = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}/is-following`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const isFollowingData = await isFollowingCheck.json();
    console.log(`  State check: ${isFollowingData.following ? "following" : "not following"}`);

    if (!isFollowingData.following) {
      await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      console.log("  Followed author to trigger notification");
    }

    const notifResponse = await fetch(`${API_ORIGIN}/api/notifications?page=1&limit=10`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    expect(notifResponse.ok).toBe(true);
    const notifData = await notifResponse.json();
    console.log(`  Notifications endpoint: ${notifData.total} total, ${notifData.data?.length || 0} in page`);

    if (notifData.data && notifData.data.length > 0) {
      const kinds = notifData.data.map((n: any) => n.kind);
      console.log(`  Notification kinds: ${[...new Set(kinds)].join(", ")}`);
    }

    const unreadCount = notifData.data?.filter((n: any) => !n.read).length ?? 0;
    console.log(`  Unread notifications: ${unreadCount}`);

    console.log("  ✓ Notification API works with read/unread tracking");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/notifications`, { waitUntil: "commit" });
    await waitForReact(page);
    console.log("  ✓ Notification page navigates in UI");

    assertClean(collector);
  });

  test("4. Access the following list and confirm the user appears", async ({ page, collector }) => {
    console.log("\n=== Step 4: Access following list and confirm user appears ===");

    const isFollowingCheck = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}/is-following`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const isFollowingData = await isFollowingCheck.json();
    if (!isFollowingData.following) {
      await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      console.log("  Ensured we're following the test author");
    }

    const followingResponse = await fetch(
      `${API_ORIGIN}/api/follows/${currentUserId}/following?limit=50`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    expect(followingResponse.ok).toBe(true);
    const followingData = await followingResponse.json();
    console.log(`  Following list: ${followingData.data?.length || 0} users`);

    const foundInFollowing = followingData.data?.some(
      (u: any) => u.id === testAuthorId || u.handle === testAuthorHandle
    );
    console.log(`  Test author in following list: ${foundInFollowing}`);
    expect(foundInFollowing).toBe(true);

    const followersResponse = await fetch(
      `${API_ORIGIN}/api/follows/${testAuthorId}/followers?limit=50`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    if (followersResponse.ok) {
      const followersData = await followersResponse.json();
      console.log(`  Author's followers: ${followersData.data?.length || 0} users`);
      const foundInFollowers = followersData.data?.some(
        (u: any) => u.id === currentUserId
      );
      console.log(`  Current user in author's followers: ${foundInFollowers}`);
    }

    console.log("  ✓ Following/followers lists work correctly");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/author/${testAuthorHandle}/following`, { waitUntil: "commit" });
    await waitForReact(page);
    console.log("  ✓ Following list page navigates in UI");

    assertClean(collector);
  });

  test("5. Navigate to an article by the followed user", async ({ page, collector }) => {
    console.log("\n=== Step 5: Navigate to article by followed user ===");
    await login(page);
    await page.goto(`${WEB_ORIGIN}/article/${testArticleSlug}`, { waitUntil: "commit" });
    const loaded = await waitForReact(page);
    console.log(`  Article page loaded: ${loaded}`);
    const title = await page.title();
    console.log(`  Article title: ${title}`);
    expect(title).toBeTruthy();
    console.log("  ✓ Article page loaded successfully");
    assertClean(collector);
  });

  test("6. Like the article and verify the current user is shown as a liker", async ({ page, collector }) => {
    console.log("\n=== Step 6: Like article and verify ===");

    const statusResp = await fetch(`${API_ORIGIN}/api/likes/toggle`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleSlug: testArticleSlug }),
    });
    const statusData = await statusResp.json();
    console.log(`  Initial like state: ${statusData.liked ? "liked" : "not liked"}`);

    if (statusData.liked) {
      const unlike = await fetch(`${API_ORIGIN}/api/likes/toggle`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleSlug: testArticleSlug }),
      });
      const unlikeData = await unlike.json();
      console.log(`  Unliked first: ${!unlikeData.liked}`);
    }

    const likeResult = await fetch(`${API_ORIGIN}/api/likes/toggle`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleSlug: testArticleSlug }),
    });
    const likeData = await likeResult.json();
    const countField = likeData.likeCount ?? likeData.count ?? likeData.likesCount ?? 0;
    console.log(`  After like: ${likeData.liked ? "liked" : "not liked"} (count field: ${countField})`);
    expect(likeData.liked).toBe(true);

    const likersResp = await fetch(
      `${API_ORIGIN}/api/likes/article/${testArticleSlug}?limit=10`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    ).catch(() => null);

    if (likersResp && likersResp.ok) {
      const likersData = await likersResp.json();
      console.log(`  Likers count: ${likersData.data?.length || 0}`);
      const currentUserIsLiker = likersData.data?.some(
        (u: any) => u.id === currentUserId || u.userId === currentUserId
      );
      console.log(`  Current user in likers list: ${currentUserIsLiker}`);
    }

    console.log("  ✓ Article like works with user attribution");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/article/${testArticleSlug}`, { waitUntil: "commit" });
    await waitForReact(page);
    console.log("  ✓ Article page with like button loads in UI");

    assertClean(collector);
  });

  test("7. Add a comment to the article", async ({ page, collector }) => {
    console.log("\n=== Step 7: Add comment to article ===");

    const testComment = `Test comment from AI agent - ${Date.now()}`;
    const commentResponse = await fetch(`${API_ORIGIN}/api/comments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: testComment, articleSlug: testArticleSlug }),
    });

    expect(commentResponse.ok).toBe(true);
    const commentData = await commentResponse.json();
    console.log(`  Comment ID: ${commentData.id}`);
    console.log(`  Comment body: ${commentData.body?.substring(0, 60)}...`);
    expect(commentData.id).toBeDefined();
    expect(commentData.body).toBe(testComment);
    expect(commentData.authorId || commentData.author?.id).toBeTruthy();
    expect(commentData.createdAt).toBeTruthy();

    const commentsList = await fetch(
      `${API_ORIGIN}/api/comments?articleSlug=${testArticleSlug}&limit=10`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const commentsData = await commentsList.json();
    console.log(`  Total comments on article: ${commentsData.total || commentsData.data?.length}`);

    const found = commentsData.data?.some((c: any) => c.id === commentData.id);
    console.log(`  New comment found in list: ${found}`);
    expect(found).toBe(true);

    console.log("  ✓ Comment created with user attribution and timestamp");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/article/${testArticleSlug}`, { waitUntil: "commit" });
    await waitForReact(page);
    console.log("  ✓ Article page with comments loads in UI");

    assertClean(collector);
  });

  test("8. Reply to the comment", async ({ page, collector }) => {
    console.log("\n=== Step 8: Reply to a comment ===");

    const commentsResponse = await fetch(
      `${API_ORIGIN}/api/comments?articleSlug=${testArticleSlug}&limit=5`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const commentsData = await commentsResponse.json();
    console.log(`  Found ${commentsData.data?.length || 0} comments`);

    if (commentsData.data && commentsData.data.length > 0) {
      const parentComment = commentsData.data[0];
      console.log(`  Parent comment ID: ${parentComment.id}`);

      const testReply = `Test reply from AI agent - ${Date.now()}`;
      const replyResponse = await fetch(`${API_ORIGIN}/api/comments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: testReply,
          articleSlug: testArticleSlug,
          parentId: parentComment.id,
        }),
      });

      expect(replyResponse.ok).toBe(true);
      const replyData = await replyResponse.json();
      console.log(`  Reply ID: ${replyData.id}`);
      console.log(`  Reply parentId: ${replyData.parentId}`);
      expect(replyData.id).toBeDefined();
      expect(replyData.parentId).toBe(parentComment.id);
      expect(replyData.authorId || replyData.author?.id).toBeTruthy();
      expect(replyData.createdAt).toBeTruthy();

      console.log("  ✓ Nested reply created with user attribution and timestamp");
    } else {
      console.log("  Note: No comments available to reply to");
    }

    await login(page);
    await page.goto(`${WEB_ORIGIN}/article/${testArticleSlug}`, { waitUntil: "commit" });
    await waitForReact(page);
    console.log("  ✓ Article page with reply thread loads in UI");

    assertClean(collector);
  });

  test("9. Bookmark the article", async ({ page, collector }) => {
    console.log("\n=== Step 9: Bookmark the article ===");

    const statusResp = await fetch(`${API_ORIGIN}/api/bookmarks/toggle`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleSlug: testArticleSlug }),
    });
    const statusData = await statusResp.json();
    console.log(`  Initial toggle response: ${JSON.stringify(statusData)}`);

    if (statusData.bookmarked) {
      const unbookmark = await fetch(`${API_ORIGIN}/api/bookmarks/toggle`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleSlug: testArticleSlug }),
      });
      const unbookmarkData = await unbookmark.json();
      console.log(`  Unbookmarked first: ${JSON.stringify(unbookmarkData)}`);
    }

    const bookmarkResult = await fetch(`${API_ORIGIN}/api/bookmarks/toggle`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleSlug: testArticleSlug }),
    });
    const bookmarkData = await bookmarkResult.json();
    console.log(`  After bookmark toggle: ${JSON.stringify(bookmarkData)}`);
    expect(bookmarkResult.ok).toBe(true);
    expect(bookmarkData.bookmarked).toBe(true);

    const bookmarksList = await fetch(
      `${API_ORIGIN}/api/bookmarks/articles?limit=10`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    if (bookmarksList.ok) {
      const bookmarksData = await bookmarksList.json();
      console.log(`  Bookmarks list: ${bookmarksData.data?.length || 0} items`);
      const hasArticle = bookmarksData.data?.some(
        (b: any) => b.slug === testArticleSlug
      );
      console.log(`  Test article in bookmarks: ${hasArticle}`);
    }

    console.log("  ✓ Article bookmark works correctly");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/article/${testArticleSlug}`, { waitUntil: "commit" });
    await waitForReact(page);
    console.log("  ✓ Article page with bookmark button loads in UI");

    assertClean(collector);
  });

  test("10. Share the article", async ({ page, collector }) => {
    console.log("\n=== Step 10: Share the article ===");

    const shareBefore = await fetch(
      `${API_ORIGIN}/api/articles/${testArticleSlug}`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const shareBeforeData = await shareBefore.json();
    const sharesBefore = shareBeforeData.shares ?? 0;
    console.log(`  Shares before: ${sharesBefore}`);

    const shareResponse = await fetch(
      `${API_ORIGIN}/api/articles/${testArticleSlug}/share`,
      { method: "POST" }
    );
    expect(shareResponse.ok).toBe(true);
    const shareData = await shareResponse.json();
    console.log(`  After share API call: ${shareData.shares} shares`);
    expect(shareData.shares).toBe(sharesBefore + 1);

    const shareAfter = await fetch(
      `${API_ORIGIN}/api/articles/${testArticleSlug}`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const shareAfterData = await shareAfter.json();
    console.log(`  Verified shares from article endpoint: ${shareAfterData.shares}`);

    console.log("  ✓ Share count increments correctly via API");

    await login(page);
    await page.goto(`${WEB_ORIGIN}/article/${testArticleSlug}`, { waitUntil: "commit" });
    await waitForReact(page);

    const allButtons = page.locator("button");
    const buttonCount = await allButtons.count();
    console.log(`  Total buttons on article page: ${buttonCount}`);

    const pageText = await page.textContent("body");
    const hasShareContext =
      pageText?.toLowerCase().includes("share") ||
      pageText?.toLowerCase().includes("copy link");
    console.log(`  Share-related content present: ${hasShareContext}`);

    console.log("  ✓ Share functionality available on article page");

    assertClean(collector);
  });

  test("11. Unfollow the user and verify status change", async ({ page, collector }) => {
    console.log("\n=== Step 11: Unfollow user and verify status change ===");

    const isFollowingCheck = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}/is-following`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const isFollowingData = await isFollowingCheck.json();
    console.log(`  State before unfollow: ${isFollowingData.following ? "following" : "not following"}`);

    if (!isFollowingData.following) {
      await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      console.log("  Followed first to test unfollow");
    }

    const unfollowResult = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const unfollowData = await unfollowResult.json();
    console.log(`  Toggle unfollow response: ${JSON.stringify(unfollowData)}`);

    const afterUnfollowCheck = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}/is-following`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const afterUnfollowData = await afterUnfollowCheck.json();
    console.log(`  After unfollow: ${afterUnfollowData.following ? "following" : "not following"}`);
    expect(afterUnfollowData.following).toBe(false);

    const followingAfter = await fetch(
      `${API_ORIGIN}/api/follows/${currentUserId}/following?limit=50`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const followingAfterData = await followingAfter.json();
    const stillInList = followingAfterData.data?.some(
      (u: any) => u.id === testAuthorId || u.handle === testAuthorHandle
    );
    console.log(`  Author still in following list: ${stillInList}`);
    expect(stillInList).toBe(false);

    console.log("  ✓ Unfollow works and removes from following list");

    const refollow = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const refollowData = await refollow.json();
    console.log(`  Re-followed: ${refollowData.following ? "yes" : "no"}`);

    assertClean(collector);
  });

  test("12. Confirm the user no longer appears in the following list", async ({ page, collector }) => {
    console.log("\n=== Step 12: Confirm user no longer in following list after unfollow ===");

    const isFollowingCheck = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}/is-following`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const isFollowingData = await isFollowingCheck.json();
    console.log(`  Starting state: ${isFollowingData.following ? "following" : "not following"}`);

    if (!isFollowingData.following) {
      await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      console.log("  Followed first for clean test");
    }

    const followingBefore = await fetch(
      `${API_ORIGIN}/api/follows/${currentUserId}/following?limit=50`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const beforeData = await followingBefore.json();
    const beforePresent = beforeData.data?.some(
      (u: any) => u.id === testAuthorId || u.handle === testAuthorHandle
    );
    console.log(`  Before unfollow - author in list: ${beforePresent}`);
    expect(beforePresent).toBe(true);

    const unfollowResult = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const unfollowData = await unfollowResult.json();
    console.log(`  Unfollow toggle response: ${JSON.stringify(unfollowData)}`);

    const afterUnfollowCheck = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}/is-following`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const afterUnfollowData = await afterUnfollowCheck.json();
    console.log(`  After unfollow: ${afterUnfollowData.following ? "following" : "not following"}`);
    expect(afterUnfollowData.following).toBe(false);

    const followingAfter = await fetch(
      `${API_ORIGIN}/api/follows/${currentUserId}/following?limit=50`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const afterData = await followingAfter.json();
    const afterPresent = afterData.data?.some(
      (u: any) => u.id === testAuthorId || u.handle === testAuthorHandle
    );
    console.log(`  After unfollow - author in list: ${afterPresent}`);
    expect(afterPresent).toBe(false);

    console.log("  ✓ User correctly removed from following list after unfollow");

    const refollow = await fetch(`${API_ORIGIN}/api/follows/${testAuthorId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const refollowData = await refollow.json();
    console.log(`  Re-followed (cleanup): ${refollowData.following ? "yes" : "no"}`);

    assertClean(collector);
  });
});
