import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { consumePhoneCode, normalizePhone } from "@/lib/phone";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({ allowDangerousEmailAccountLinking: false }),
    Credentials({
      id: "sms", name: "SMS",
      credentials: { phone: { label: "Phone", type: "tel" }, code: { label: "Code", type: "text" } },
      async authorize(credentials) {
        try {
          const phone = normalizePhone(credentials?.phone);
          if (!await consumePhoneCode(phone, String(credentials?.code ?? ""))) return null;
          return await prisma.user.upsert({
            where: { phone },
            update: { phoneVerifiedAt: new Date() },
            create: { name: phone, phone, phoneVerifiedAt: new Date(), status: "PENDING" }
          });
        } catch { return null; }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) { if (user?.id) token.sub = user.id; return token; },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    }
  },
  pages: { signIn: "/ru/login" }
});
