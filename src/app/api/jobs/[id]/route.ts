import {apiError,guardLocal,uuid} from '@/lib/investigation/api';
import {getStore} from '@/lib/investigation/store';
import {cancelRunningJob,kickJobs} from '@/lib/investigation/jobs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) {
  try {guardLocal(request);const job=await (await getStore()).getJob(uuid.parse((await context.params).id));if(job.status==='running'||job.status==='queued')void kickJobs().catch(()=>{});return Response.json(job);}catch(error){return apiError(error);}
}
export async function DELETE(request:Request,context:Context) {
  try {guardLocal(request);const id=uuid.parse((await context.params).id),job=await (await getStore()).cancel(id);cancelRunningJob(id);return Response.json(job);}catch(error){return apiError(error);}
}
