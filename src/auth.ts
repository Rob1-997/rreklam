import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { consumePhoneCode, normalizePhone } from "@/lib/phone";
import { LOCAL_DEMO_EMAIL, isLocalDemoEnabled, isLocalAuthRequest, demoPasswordMatches } from "@/lib/local-demo.mjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({ allowDangerousEmailAccountLinking: false }),
    Credentials({
      id: "local-owner", name: "Local owner (development only)",
      credentials: { password: { label: "Local demo password", type: "password" } },
      async authorize(credentials, request) {
        // Development-only hints: explain denial in the local server console;
        // never log passwords, OTPs, emails, tokens, or database connection strings.
        if (!isLocalDemoEnabled()) {
          if (process.env.NODE_ENV==="development") console.warn("[RReklam local login] DENIED: local demo disabled or .env/password configuration invalid.");
          return null;
        }
        if (!isLocalAuthRequest(request)) {
          console.warn("[RReklam local login] DENIED: request is not coming through localhost or 127.0.0.1.");
          return null;
        }
        if (!demoPasswordMatches(credentials?.password, process.env.RREKLAM_LOCAL_DEMO_PASSWORD)) {
          console.warn("[RReklam local login] DENIED: submitted password does not match RREKLAM_LOCAL_DEMO_PASSWORD in .env.");
          return null;
        }
        const user=await prisma.user.findUnique({
          where:{email:LOCAL_DEMO_EMAIL},
          include:{roles:{where:{role:"OWNER",activatedAt:{not:null}},select:{role:true}}}
        });
        if (!user) {
          console.warn("[RReklam local login] DENIED: local owner has not been created; run bootstrap-local-owner.ts.");
          return null;
        }
        if (user.status!=="ACTIVE" || !user.phoneVerifiedAt || !user.roles.length) {
          console.warn("[RReklam local login] DENIED: owner exists but account, phone verification, or OWNER role is not active.");
          return null;
        }
        return user;
      }
    }),
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
