import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rect" | "circle" | "rounded";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = "rect",
  width,
  height,
  lines,
  style,
  ...props
}: SkeletonProps) {
  const baseClasses =
    "bg-surface-alt animate-pulse rounded";

  const variantClasses: Record<NonNullable<SkeletonProps["variant"]>, string> = {
    text: "h-4 rounded",
    rect: "rounded",
    circle: "rounded-full",
    rounded: "rounded-lg",
  };
  const selectedVariant = variantClasses[variant];

  const styleValue = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...style,
  };

  if (lines && variant === "text") {
    return (
      <div
        className={cn("flex flex-col gap-2", className)}
        style={style}
        {...props}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseClasses, selectedVariant, "w-full")}
            style={{
              width: i === lines - 1 ? "60%" : "100%",
              height: "1rem",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClasses, selectedVariant, className)}
      style={styleValue}
      {...props}
    />
  );
}

export default Skeleton;
