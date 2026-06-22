import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main>
      <h1>Login</h1>
      <form
        action={async (formData) => {
          "use server";
          await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirectTo: "/",
          });
        }}
      >
        <input type="email" name="email" placeholder="E-mail" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}