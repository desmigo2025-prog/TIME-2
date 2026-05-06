import app from '../server';

export default function handler(req: any, res: any) {
  console.log("Vercel Serverless Function Hit!", req.method, req.url);
  return app(req, res);
}
