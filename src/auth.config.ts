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
        token.role = (user as { role: "admin" | "debtor" }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as "admin" | "debtor";
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = (auth?.user as { role?: string } | undefined)?.role;

      if (pathname === "/" || pathname.startsWith("/pessoa")) {
        if (role === "admin") return true;
        if (role === "debtor") return Response.redirect(new URL("/minha-conta", request.url));
        return false;
      }

      if (pathname === "/minha-conta") {
        if (role === "debtor") return true;
        if (role === "admin") return Response.redirect(new URL("/", request.url));
        return Response.redirect(new URL("/debtor/login", request.url));
      }

      if (pathname.startsWith("/consultar/")) {
        if (role === "admin") return true;
        return Response.redirect(new URL("/debtor/login", request.url));
      }

      const isPublic =
        pathname === "/consultar" ||
        pathname === "/login" ||
        pathname === "/debtor/login" ||
        pathname === "/debtor/register" ||
        pathname === "/forgot-password" ||
        pathname.startsWith("/reset-password/");

      return isPublic || !!auth?.user;
    },
  },
};
