import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import NeonAdapter from '@auth/neon-adapter';
import { Pool } from '@neondatabase/serverless';

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return {
    adapter: NeonAdapter(pool),
    // Use JWT strategy to avoid table name collision with the app's "sessions" table.
    // The adapter still persists users and accounts, but auth sessions live in JWT cookies.
    session: { strategy: 'jwt' },
    providers: [Google],
    pages: {
      signIn: '/auth/signin',
    },
    callbacks: {
      async jwt({ token, user }) {
        // On first sign-in, attach the database user ID to the JWT
        if (user?.id) {
          token.userId = user.id;
        }
        return token;
      },
      session({ session, token }) {
        if (session.user && token.userId) {
          session.user.id = token.userId as string;
        }
        return session;
      },
    },
  };
});
