import {loadCase} from '@/lib/investigation/case';
import {apiError,readJson} from '@/lib/investigation/api';
import {getStore} from '@/lib/investigation/store';
import {verifyBundle} from '@/lib/investigation/export';
import {runScientificRequest,validateJobInput} from '@/lib/investigation/jobs';
import {canonicalJson} from '@/lib/investigation/hash';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  try {
    const manifest=await loadCase(),bundle=verifyBundle(await readJson(request,64_000_000),manifest);
    for(const job of bundle.jobs) {
      const input=validateJobInput(job.type,job.input,manifest,bundle.investigation);
      const verified=await runScientificRequest(job.type,input);
      if(canonicalJson(verified)!==canonicalJson(job.result)) throw new Error('A saved calculation does not reproduce from its frozen inputs.');
    }
    return Response.json(await (await getStore()).restore(bundle.investigation.state,bundle.jobs),{status:201});
  }catch(error){return apiError(error);}
}
