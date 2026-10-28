import {notFound} from "next/navigation";
import {validLang} from "@/lib/i18n";
import LoginForm from "@/components/LoginForm";
export default async function LoginPage({params}:{params:Promise<{lang:string}>}) {
  const { lang }=await params; if(!validLang(lang))notFound();
  return <div className="shell"><section><LoginForm lang={lang}/></section></div>;
}
