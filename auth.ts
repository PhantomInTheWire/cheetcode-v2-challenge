import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Auth.js v5 config — GitHub OAuth only.
 * Requires AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, and AUTH_SECRET env vars.
 */
export const { handlers, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    // Expose the GitHub username in the session so the client can use it
    async session({ session, token }) {
      if (token.githubUsername) {
        session.user.githubUsername = token.githubUsername as string;
      }
      return session;
    },
    async jwt({ token, profile }) {
      // On initial sign-in, persist the GitHub login (username) in the JWT
      if (profile?.login) {
        token.githubUsername = profile.login;
      }
      return token;
    },
  },
});
