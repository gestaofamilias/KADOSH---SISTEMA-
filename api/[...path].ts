import type { VercelRequest, VercelResponse } from "@vercel/node";
import serverless from "serverless-http";
import { app } from "../server";

const handler = serverless(app);

export default async function (req: VercelRequest, res: VercelResponse) {
  await handler(req, res);
}
