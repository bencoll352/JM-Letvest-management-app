import Workspace from '@/components/workspace';
const views:Record<string,string> = {ai:'AI Team',properties:'Properties',pipeline:'CRM Pipeline',maintenance:'Maintenance',finances:'Finances',contacts:'Contacts',compliance:'Compliance',portal:'Tenant Portal',settings:'Settings'};
export function generateStaticParams(){return Object.keys(views).map(view=>({view}))}
export default async function Page({params}:{params:Promise<{view:string}>}){const {view}=await params;return <Workspace initialView={views[view]||'Dashboard'}/>}
