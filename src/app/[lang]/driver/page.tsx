import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { validLang } from "@/lib/i18n";
import DriverPortal from "@/components/DriverPortal";
export default async function DriverPage({params}:{params:Promise<{lang:string}>}){
  const {lang}=await params;
  if(!validLang(lang))notFound();
  const session=await auth();
  if(!session?.user?.id)redirect(`/${lang}/login`);
  return <div className="shell"><section><DriverPortal lang={lang}/></section></div>;
}
