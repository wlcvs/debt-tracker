import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      if ((user as { role?: string })?.role) {
        token.role = (user as { role: "admin" }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as "admin";
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = (auth?.user as { role?: string } | undefined)?.role;

      if (pathname === "/" || pathname.startsWith("/person")) {
        return role === "admin";
      }

      const isPublic =
        pathname.startsWith("/public/") ||
        pathname === "/login";

      return isPublic || !!auth?.user;
    },
  },
};
