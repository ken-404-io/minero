"use client";

import { IconCheck, IconLock } from "@/components/icons";

type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
};

type Props = { achievements: Achievement[] };

export default function AchievementsClient({ achievements }: Props) {
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const total = achievements.length;

  return (
    <div className="w-full" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-[860px] px-4 py-6 lg:px-8 lg:py-10">

        {/* Header */}
        <div className="mb-6">
          <span className="section-title">Account</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Achievements</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {unlocked} of {total} unlocked
          </p>
        </div>

        {/* Overall progress */}
        <div className="mb-6">
          <div className="progress" style={{ height: 8 }}
            role="progressbar"
            aria-valuenow={Math.round((unlocked / total) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="progress-bar"
              style={{ width: `${(unlocked / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Grid */}
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {achievements.map((a) => (
            <li
              key={a.id}
              className="card flex flex-col items-center text-center gap-2 py-5 px-3"
              style={{
                opacity: a.unlocked ? 1 : 0.55,
                position: "relative",
                transition: "opacity 200ms",
              }}
            >
              {/* Lock / check overlay */}
              <div
                className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full"
                style={{
                  width: 20, height: 20,
                  background: a.unlocked ? "var(--success-weak)" : "var(--surface-3)",
                  color: a.unlocked ? "var(--success-fg)" : "var(--text-muted)",
                }}
              >
                {a.unlocked
                  ? <IconCheck size={11} />
                  : <IconLock size={10} />}
              </div>

              {/* Emoji icon */}
              <span
                className="text-4xl leading-none"
                style={{ filter: a.unlocked ? "none" : "grayscale(1)" }}
                aria-hidden
              >
                {a.emoji}
              </span>

              <div>
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {a.description}
                </div>
              </div>

              {/* Progress bar (for locked achievements) */}
              {!a.unlocked && a.progress && a.progress.target > 1 && (
                <div className="w-full mt-1">
                  <div
                    className="progress"
                    style={{ height: 4 }}
                    role="progressbar"
                    aria-valuenow={Math.round((a.progress.current / a.progress.target) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-bar"
                      style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {a.progress.current} / {a.progress.target}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
