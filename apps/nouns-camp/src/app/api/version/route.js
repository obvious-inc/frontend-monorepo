export const runtime = "edge";

export async function GET() {
  return Response.json({ GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA });
}
