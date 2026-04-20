import { IconPickaxe } from "@/components/icons";

/**
 * Decorative-but-branded animation used on the auth pages: a pickaxe
 * swings back and forth against an ore block, a spark flashes at each
 * impact, and a peso symbol occasionally drops and fades. Pure CSS,
 * respects prefers-reduced-motion via keyframes on the body element.
 *
 * The animation is purposely subtle — no glow orbs, no shimmer, no
 * particle soup. It lives in a fixed 280×280 box so the brand panel
 * layout stays predictable.
 */
export default function MiningAnimation() {
  return (
    <div
      className="mine-anim"
      aria-hidden
      role="presentation"
    >
      <div className="mine-anim__ground" />

      {/* The ore */}
      <div className="mine-anim__ore">
        <span className="mine-anim__ore-face" />
        <span className="mine-anim__ore-top" />
        <span className="mine-anim__ore-crack mine-anim__ore-crack--1" />
        <span className="mine-anim__ore-crack mine-anim__ore-crack--2" />
      </div>

      {/* Spark that flashes on impact */}
      <div className="mine-anim__spark">
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* Swinging pickaxe */}
      <div className="mine-anim__pickaxe">
        <IconPickaxe size={56} />
      </div>

      {/* Coins that drop from the strike */}
      <div className="mine-anim__coins" aria-hidden>
        <span className="mine-anim__coin mine-anim__coin--a">₱</span>
        <span className="mine-anim__coin mine-anim__coin--b">₱</span>
        <span className="mine-anim__coin mine-anim__coin--c">₱</span>
      </div>
    </div>
  );
}
