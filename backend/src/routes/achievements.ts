import { Hono } from "hono";
import { requireAuth } from "../lib/session.js";
import { getUserAchievements } from "../lib/achievements.js";

export const achievementRoutes = new Hono();

achievementRoutes.get("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const achievements = await getUserAchievements(session.userId);
  return c.json({ achievements });
});
