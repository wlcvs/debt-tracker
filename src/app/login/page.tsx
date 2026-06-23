import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-start justify-between">
          <h1 className="text-2xl tracking-widest uppercase text-zinc-900 dark:text-white">
            Debt Tracker
          </h1>
          <ThemeToggle />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
