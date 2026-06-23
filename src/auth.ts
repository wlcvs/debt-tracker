import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "admin",
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return null;

        return { id: user.id, email: user.email, role: "admin" } as {
          id: string;
          email: string;
          role: "admin";
        };
      },
    }),
    Credentials({
      id: "debtor",
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const person = await prisma.person.findUnique({ where: { email } });
        if (!person?.passwordHash) return null;

        const match = await bcrypt.compare(password, person.passwordHash);
        if (!match) return null;

        return { id: person.id, email: person.email!, name: person.name, role: "debtor" } as {
          id: string;
          email: string;
          name: string;
          role: "debtor";
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      if ((user as { role?: string })?.role) {
        token.role = (user as { role: "admin" | "debtor" }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as "admin" | "debtor";
      return session;
    },
  },
});
