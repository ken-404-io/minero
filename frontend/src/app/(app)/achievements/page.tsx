import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AchievementsClient from "./AchievementsClient";

type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
};

export default async function AchievementsPage() {
  const data = await apiJson<{ achievements: Achievement[] }>("/achievements");
  if (!data) redirect("/login");

  return <AchievementsClient achievements={data.achievements} />;
}
