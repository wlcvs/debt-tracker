import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase mb-2">
            Sistema
          </p>
          <h1 className="text-2xl tracking-widest uppercase text-white">
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
            className="bg-transparent border border-zinc-700 px-4 py-3 text-sm tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors"
          />
          <input
            type="password"
            name="password"
            placeholder="SENHA"
            required
            className="bg-transparent border border-zinc-700 px-4 py-3 text-sm tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 transition-colors"
          />
          <button
            type="submit"
            className="border border-zinc-600 px-4 py-3 text-sm tracking-[0.2em] uppercase text-zinc-400 hover:border-white hover:text-white transition-colors cursor-pointer mt-2"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
