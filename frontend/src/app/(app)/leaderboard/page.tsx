import { apiJson } from "@/lib/api";
import LeaderboardClient from "./LeaderboardClient";

type LeaderboardResp = {
  updatedAt: string;
  miners: { rank: number; name: string; amount: number }[];
  referrers: { rank: number; name: string; count: number }[];
};

export default async function LeaderboardPage() {
  const data = await apiJson<LeaderboardResp>("/leaderboard");

  return (
    <LeaderboardClient
      miners={data?.miners ?? []}
      referrers={data?.referrers ?? []}
      updatedAt={data?.updatedAt ?? null}
    />
  );
}
