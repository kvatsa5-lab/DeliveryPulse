import { currentMember } from "@/lib/access";
import { accessDenied, withErrorHandling } from "@/lib/api-response";
import { canApprove } from "@/lib/authorization";

export const GET = withErrorHandling(async (request: Request) => {
  const member = await currentMember(request);
  if (!member) return accessDenied();

  return Response.json({
    member: {
      email: member.email,
      role: member.role,
      // Surfaced so the client can hide approval controls it cannot use. Shares
      // the predicate with the PATCH handler that actually enforces it.
      canApprove: canApprove(member),
    },
  });
});
