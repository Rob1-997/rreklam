import {notFound} from "next/navigation";
import {validLang} from "@/lib/i18n";
import LoginForm from "@/components/LoginForm";
import { isLocalDemoEnabled } from "@/lib/local-demo.mjs";
export default async function LoginPage({params,searchParams}:{params:Promise<{lang:string}>,searchParams:Promise<{next?:string}>}) {
  const {lang}=await params;if(!validLang(lang))notFound();
  const {next}=await searchParams;
  const returnTo=typeof next==="string"&&next.startsWith(`/${lang}/`)&&!next.startsWith("//")?next:`/${lang}/driver`;
  return <div className="shell"><section><LoginForm lang={lang} returnTo={returnTo} showLocalDemo={isLocalDemoEnabled()}/></section></div>;
}
