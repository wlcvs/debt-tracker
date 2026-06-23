import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string } | undefined)?.role;

      // Admin dashboard routes
      if (pathname === "/" || pathname.startsWith("/pessoa")) {
        if (role === "admin") return true;
        if (role === "debtor") {
          return Response.redirect(new URL("/minha-conta", request.url));
        }
        return false; // → redirects to /login
      }

      // Debtor account
      if (pathname === "/minha-conta") {
        if (role === "debtor") return true;
        if (role === "admin") return Response.redirect(new URL("/", request.url));
        return Response.redirect(new URL("/debtor/login", request.url));
      }

      // Admin-only preview of debtor view
      if (pathname.startsWith("/consultar/")) {
        if (role === "admin") return true;
        return Response.redirect(new URL("/debtor/login", request.url));
      }

      // Public routes
      const isPublic =
        pathname === "/consultar" ||
        pathname === "/login" ||
        pathname === "/debtor/login" ||
        pathname === "/debtor/register" ||
        pathname === "/forgot-password" ||
        pathname.startsWith("/reset-password/");

      return isPublic || isLoggedIn;
    },
  },
};
