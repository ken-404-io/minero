import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import GameClient from "./GameClient";

type Me = {
  user: { id: string; name: string };
};

export default async function GamePage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  return <GameClient playerName={me.user.name} />;
}
