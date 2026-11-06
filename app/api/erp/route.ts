import { env } from 'cloudflare:workers';
import { applyAction, emptyState } from '../../../lib/erp';
export const dynamic='force-dynamic';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function read(){const db=env.DB!;await db.prepare('INSERT OR IGNORE INTO erp_workspace (id,data,version) VALUES (?,?,0)').bind('main',JSON.stringify(emptyState())).run();return await db.prepare('SELECT data,version FROM erp_workspace WHERE id=?').bind('main').first<{data:string;version:number}>();}
export async function GET(){try{const row=await read();return json({state:JSON.parse(row!.data),version:row!.version});}catch{return json({error:'数据服务暂不可用，请稍后重试'},503)}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return json({error:'请求来源不受支持'},403);
 if(Number(req.headers.get('content-length')||0)>2_000_000)return json({error:'文件过大'},413);
 const raw=await req.text();if(raw.length>2_000_000)return json({error:'文件过大'},413);const p=JSON.parse(raw);const row=await read();
 if(p.version!==row!.version)return json({error:'数据已被其他窗口更新，请刷新后重试'},409);
 const state=applyAction(JSON.parse(row!.data),p.action,p.payload);const data=JSON.stringify(state);if(data.length>4_000_000)return json({error:'当前工作区已达容量上限，请导出并归档'},413);
 const r=await env.DB!.prepare('UPDATE erp_workspace SET data=?,version=version+1 WHERE id=? AND version=?').bind(data,'main',row!.version).run();
 if(!r.meta.changes)return json({error:'数据已更新，请刷新后重试'},409);return json({state,version:row!.version+1});
 }catch(e){return json({error:e instanceof Error?e.message:'保存失败'},400)}}
