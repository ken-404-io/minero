import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import GameHubClient from "./GameHubClient";

type Me = {
  user: { id: string; name: string };
};

export default async function GameHubPage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  return <GameHubClient playerName={me.user.name} />;
}
