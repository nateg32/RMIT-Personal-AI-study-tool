import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-primary text-primary-foreground shadow-md hover:brightness-95",
  secondary: "border-2 border-border bg-surface-container text-foreground hover:bg-primary-container/50",
  ghost: "text-foreground hover:bg-surface-container",
  danger: "bg-danger text-white shadow-md hover:brightness-95",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "hover-squish inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: keyof typeof variants;
};

export function ButtonLink({ className, variant = "primary", href, ...props }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "hover-squish inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
