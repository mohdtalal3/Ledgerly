import {Navigation} from "@/components/navigation";import {requireSession} from "@/lib/auth/session";
export const dynamic="force-dynamic";
export default async function DashboardLayout({children}:{children:React.ReactNode}){await requireSession();return <div className="app-shell"><Navigation/><main className="main-content">{children}</main></div>}
