import GameLaunchOverlay from "@/components/GameLaunchOverlay";

export default function GameSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <GameLaunchOverlay />
    </>
  );
}
