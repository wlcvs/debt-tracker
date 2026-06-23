import { signIn } from "@/auth";
import Link from "next/link";

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

        <form
          className="flex flex-col gap-4"
          action={async (formData) => {
            "use server";
            await signIn("credentials", {
              email: formData.get("email"),
              password: formData.get("password"),
              redirectTo: "/",
            });
          }}
        >
          <input
            type="email"
            name="email"
            placeholder="E-MAIL"
            required
            className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
          />
          <input
            type="password"
            name="password"
            placeholder="SENHA"
            required
            className="bg-transparent border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
          />
          <button
            type="submit"
            className="border border-zinc-400 dark:border-zinc-600 px-4 py-3 text-sm tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400 hover:border-zinc-900 dark:hover:border-white hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer mt-2"
          >
            Entrar
          </button>
        </form>

        <Link
          href="/forgot-password"
          className="block text-center text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors mt-6"
        >
          Esqueceu a senha?
        </Link>
      </div>
    </main>
  );
}
