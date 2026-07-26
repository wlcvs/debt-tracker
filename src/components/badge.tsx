export function Badge({ children, className = "px-1.5" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`text-[10px] tracking-widest uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 py-0.5 ${className}`}
    >
      {children}
    </span>
  );
}
