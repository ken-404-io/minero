import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import WordClient from "./WordClient";

type Me = {
  user: { id: string; name: string };
};

// The word game owns the full viewport — no surrounding back-link strip
// here, since that strip pushed the wheel off-screen on short phones. The
// in-game UI renders its own compact back overlay.
export default async function WordPage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  return <WordClient playerName={me.user.name} />;
}
