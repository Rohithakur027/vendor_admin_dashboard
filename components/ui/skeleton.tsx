import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200", className)}
      {...props}
    />
  );
}

function SkeletonInline({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("animate-pulse rounded-md bg-slate-200 inline-block align-middle", className)}
      {...props}
    />
  );
}

export { Skeleton, SkeletonInline };
