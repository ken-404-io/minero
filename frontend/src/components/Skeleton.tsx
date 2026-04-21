import type { CSSProperties } from "react";

type Props = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Thin wrapper over the global .skeleton pulse class so loading states
 * can be composed without repeating the pulse animation or sizing styles.
 */
export default function Skeleton({
  width = "100%",
  height = 16,
  radius,
  className,
  style,
}: Props) {
  return (
    <span
      aria-hidden
      className={["skeleton", className].filter(Boolean).join(" ")}
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}
