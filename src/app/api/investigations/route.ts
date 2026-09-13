import {loadCase} from '@/lib/investigation/case';
import {apiError,guardLocal,readJson} from '@/lib/investigation/api';
import {getStore} from '@/lib/investigation/store';
import {initialState,validateState} from '@/lib/investigation/schema';
import {kickJobs} from '@/lib/investigation/jobs';
import {z} from 'zod';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {guardLocal(request);const store=await getStore();void kickJobs().catch(()=>{});return Response.json({investigations:await store.list()});} catch(error){return apiError(error);}
}
export async function POST(request:Request) {
  try {const body=z.object({state:z.unknown().optional()}).strict().parse(await readJson(request));const manifest=await loadCase();return Response.json(await (await getStore()).create(validateState(body.state??initialState(manifest),manifest)),{status:201});} catch(error){return apiError(error);}
}
