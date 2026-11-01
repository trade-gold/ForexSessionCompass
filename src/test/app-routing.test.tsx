import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as AcademyRoute } from "@/routes/academy";
import { Route as ProfileRoute } from "@/routes/profile";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("registers protected dashboard routes (/academy and /profile) with noindex metadata", async () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/academy").at(-1)?.routeId).not.toBe(rootRouteId);
    expect(router.matchRoutes("/profile").at(-1)?.routeId).not.toBe(rootRouteId);

    const academyHead = await AcademyRoute.options.head?.({} as never);
    const profileHead = await ProfileRoute.options.head?.({} as never);
    expect(academyHead?.meta).toContainEqual({ name: "robots", content: "noindex" });
    expect(profileHead?.meta).toContainEqual({ name: "robots", content: "noindex" });
  });
});
