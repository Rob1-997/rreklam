import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validLang } from "@/lib/i18n";
import { notFound, redirect } from "next/navigation";
import AdminPortal from "@/components/AdminPortal";
export const dynamic="force-dynamic";
export default async function AdminPage({params}:{params:Promise<{lang:string}>}){
  const {lang}=await params;
  if(!validLang(lang))notFound();
  const session=await auth();
  if(!session?.user?.id)redirect(`/${lang}/login`);
  const roles=await prisma.userRole.findMany({where:{userId:session.user.id,activatedAt:{not:null},role:{in:["OWNER","MANAGER"]}},select:{role:true}});
  if(!roles.length)return <div className="shell"><section><h1>Access denied</h1><p className="muted">Manager approval is required.</p></section></div>;
  return <div className="shell"><section><AdminPortal isOwner={roles.some(r=>r.role==="OWNER")}/></section></div>;
}
