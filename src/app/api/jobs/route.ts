import {loadCase} from '@/lib/investigation/case';
import {apiError,readJson,guardLocal} from '@/lib/investigation/api';
import {getStore} from '@/lib/investigation/store';
import {kickJobs,validateJobInput} from '@/lib/investigation/jobs';
import {z} from 'zod';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  try {
    const body=z.object({investigationId:z.string().uuid(),inputRevision:z.number().int().positive(),type:z.enum(['comparison','baseline']),input:z.unknown()}).strict().parse(await readJson(request));
    const manifest=await loadCase(),store=await getStore(),saved=await store.get(body.investigationId);
    const input=validateJobInput(body.type,body.input,manifest,saved);
    const job=await store.enqueue({...body,input,inputHashes:manifest.assets.map(a=>a.sha256).sort()});
    void kickJobs().catch(()=>{});
    return Response.json(job,{status:202});
  } catch(error){return apiError(error);}
}
export async function GET(request:Request) {
  try {guardLocal(request);await kickJobs();return Response.json({status:'idle'});}catch(error){return apiError(error);}
}
