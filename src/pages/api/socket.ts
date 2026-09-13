import type {NextApiRequest,NextApiResponse} from 'next';
export default function handler(_request:NextApiRequest,response:NextApiResponse) {
  response.status(410).json({error:'This local investigation workspace does not enable public collaboration rooms.'});
}
