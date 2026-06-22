import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isPublicConsultPage = request.nextUrl.pathname === "/consultar";
      const isLoginPage = request.nextUrl.pathname === "/login";

      if (isLoggedIn || isPublicConsultPage || isLoginPage) return true;
      return false;
    },
  },
};