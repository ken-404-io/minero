import { redirect } from "next/navigation";
import Link from "next/link";
import { apiJson } from "@/lib/api";
import { IconArrowLeft } from "@/components/icons";
import GameLaunchComplete from "@/components/GameLaunchComplete";
import MemoryClient from "./MemoryClient";

type Me = {
  user: { id: string; name: string };
};

export default async function MemoryPage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  return (
    <div className="game-page-enter">
      <GameLaunchComplete href="/game/memory" />
      <div className="px-4 pt-4 lg:px-8 lg:pt-6">
        <Link
          href="/game"
          className="btn btn-ghost btn-sm"
          style={{ paddingLeft: "0.5rem" }}
        >
          <IconArrowLeft size={16} /> All games
        </Link>
      </div>
      <MemoryClient playerName={me.user.name} />
    </div>
  );
}
