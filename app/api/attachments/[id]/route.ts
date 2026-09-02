import { env } from "cloudflare:workers";
import { currentMember } from "@/lib/access";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await currentMember(request))return Response.json({error:"Access denied"},{status:403});
  const {id}=await params;
  const attachment=await env.DB.prepare("SELECT object_key AS objectKey, file_name AS fileName, content_type AS contentType FROM runbook_attachments WHERE id = ?").bind(Number(id)).first<{objectKey:string;fileName:string;contentType:string}>();
  if(!attachment)return Response.json({error:"Attachment not found"},{status:404});
  const object=await env.FILES.get(attachment.objectKey);
  if(!object)return Response.json({error:"Attachment file not found"},{status:404});
  return new Response(object.body,{headers:{"content-type":attachment.contentType,"content-disposition":`attachment; filename="${attachment.fileName.replace(/"/g,"")}"`}});
}
