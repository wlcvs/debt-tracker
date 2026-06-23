import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" ||
        pathname === "/consultar" ||
        pathname.startsWith("/consultar/") ||
        pathname === "/forgot-password" ||
        pathname.startsWith("/reset-password/");

      if (isLoggedIn || isPublic) return true;
      return false;
    },
  },
};