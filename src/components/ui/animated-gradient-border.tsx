import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AnimationMode = "auto-rotate" | "rotate-on-hover" | "stop-rotate-on-hover";

type BorderRotateProps = Omit<HTMLAttributes<HTMLDivElement>, "className"> & {
  children: ReactNode;
  className?: string;
  animationMode?: AnimationMode;
  animationSpeed?: number;
  gradientColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  backgroundColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  style?: CSSProperties;
};

const defaultGradientColors = {
  primary: "var(--primary)",
  secondary: "var(--info)",
  accent: "var(--warning)",
};

export function BorderRotate({
  children,
  className,
  animationMode = "auto-rotate",
  animationSpeed = 8,
  gradientColors = defaultGradientColors,
  backgroundColor = "var(--card)",
  borderWidth = 1,
  borderRadius = 10,
  style,
  ...props
}: BorderRotateProps) {
  const animationClass = {
    "auto-rotate": "gradient-border-auto",
    "rotate-on-hover": "gradient-border-hover",
    "stop-rotate-on-hover": "gradient-border-stop-hover",
  }[animationMode];

  const combinedStyle = {
    "--gradient-primary": gradientColors.primary,
    "--gradient-secondary": gradientColors.secondary,
    "--gradient-accent": gradientColors.accent,
    "--bg-color": backgroundColor,
    "--border-width": `${borderWidth}px`,
    "--border-radius": `${borderRadius}px`,
    "--animation-duration": `${animationSpeed}s`,
    border: `${borderWidth}px solid transparent`,
    borderRadius: `${borderRadius}px`,
    backgroundImage: `
      linear-gradient(${backgroundColor}, ${backgroundColor}),
      conic-gradient(
        from var(--gradient-angle),
        ${gradientColors.primary} 0%,
        ${gradientColors.secondary} 28%,
        ${gradientColors.accent} 36%,
        ${gradientColors.secondary} 43%,
        ${gradientColors.primary} 55%,
        ${gradientColors.secondary} 76%,
        ${gradientColors.accent} 84%,
        ${gradientColors.primary} 100%
      )
    `,
    backgroundClip: "padding-box, border-box",
    backgroundOrigin: "padding-box, border-box",
    ...style,
  } as CSSProperties;

  return (
    <div
      className={cn("gradient-border-component shadow-sm", animationClass, className)}
      style={combinedStyle}
      {...props}
    >
      {children}
    </div>
  );
}
