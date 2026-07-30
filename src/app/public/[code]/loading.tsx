export default function Loading() {
  return (
    <div className="min-h-dvh bg-[#f0f0f4] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-400 dark:border-zinc-800 px-6 py-3">
        <h1 className="text-sm tracking-widest uppercase text-zinc-900 dark:text-white">
          Debt Tracker
        </h1>
      </header>
      <main className="max-w-md mx-auto px-4 sm:px-8 py-8">
        <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase">
          Carregando...
        </p>
      </main>
    </div>
  );
}
