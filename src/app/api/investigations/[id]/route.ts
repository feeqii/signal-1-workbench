import {loadCase} from '@/lib/investigation/case';
import {apiError,guardLocal,readJson,uuid} from '@/lib/investigation/api';
import {getStore,StoreError} from '@/lib/investigation/store';
import {validateState} from '@/lib/investigation/schema';
import {z} from 'zod';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) {
  try {guardLocal(request);return Response.json(await (await getStore()).get(uuid.parse((await context.params).id)));} catch(error){return apiError(error);}
}
export async function PUT(request:Request,context:Context) {
  try {
    const id=uuid.parse((await context.params).id),body=z.object({expectedRevision:z.number().int().positive(),state:z.unknown()}).strict().parse(await readJson(request));
    const state=validateState(body.state,await loadCase()),store=await getStore();
    for(const [jobId,type] of [[state.comparisonJobId,'comparison'],[state.baselineJobId,'baseline']]) if(jobId){const job=await store.getJob(jobId);if(job.investigationId!==id||job.type!==type)throw new StoreError('This calculation belongs to another investigation.',400);}
    return Response.json(await store.save(id,body.expectedRevision,state));
  } catch(error){return apiError(error);}
}
