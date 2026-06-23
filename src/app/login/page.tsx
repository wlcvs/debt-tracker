import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="text-xs tracking-[0.3em] text-zinc-400 dark:text-zinc-500 uppercase mb-2">
            Sistema
          </p>
          <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
            Debt Tracker
          </h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
