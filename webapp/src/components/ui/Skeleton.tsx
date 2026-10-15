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

  const variantClasses = {
    text: "h-4 rounded",
    rect: "rounded",
    circle: "rounded-full",
    rounded: "rounded-lg",
  }[variant];

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
            className={cn(baseClasses, variantClasses, "w-full")}
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
      className={cn(baseClasses, variantClasses, className)}
      style={styleValue}
      {...props}
    />
  );
}

export default Skeleton;
