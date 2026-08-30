import { currentMember } from "@/lib/access";

export async function GET(request: Request) {
  const member = await currentMember(request);
  if (!member) return Response.json({ error: "You are not yet part of the Delivery Pulse pilot." }, { status: 403 });
  return Response.json({ member });
}
