import { env } from "cloudflare:workers";
import { currentMember } from "@/lib/access";

const statements=[
  "CREATE TABLE IF NOT EXISTS improvements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, owner TEXT NOT NULL, impact TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runbooks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, product TEXT NOT NULL, environment TEXT NOT NULL, architecture TEXT NOT NULL, approval TEXT NOT NULL, owner TEXT NOT NULL, reviewed_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS skill_assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, engineer TEXT NOT NULL, skill TEXT NOT NULL, rating TEXT NOT NULL, evidence TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runbook_attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, runbook_id INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_runbook_attachments_runbook_id ON runbook_attachments(runbook_id)",
];
async function ready(){await env.DB.batch(statements.map(x=>env.DB.prepare(x)))}
const value=(data:FormData|Record<string,unknown>,key:string)=>data instanceof FormData?String(data.get(key)??"").trim():String(data[key]??"").trim();

export async function GET(request:Request){
  if(!await currentMember(request))return Response.json({error:"Access denied"},{status:403});
  await ready();
  const type=new URL(request.url).searchParams.get("type");
  if(type==="runbooks"){
    const {results:runbooks}=await env.DB.prepare("SELECT * FROM runbooks ORDER BY reviewed_at DESC").all<Record<string,unknown>>();
    const {results:attachments}=await env.DB.prepare("SELECT id, runbook_id AS runbookId, file_name AS fileName, content_type AS contentType, size_bytes AS sizeBytes FROM runbook_attachments ORDER BY id DESC").all<Record<string,unknown>>();
    const byRunbook=new Map<number,Record<string,unknown>[]>();
    for(const attachment of attachments){const id=Number(attachment.runbookId);byRunbook.set(id,[...(byRunbook.get(id)??[]),attachment]);}
    return Response.json({records:runbooks.map(runbook=>({...runbook,attachments:byRunbook.get(Number(runbook.id))??[]}))});
  }
  const table=type==="improvements"?"improvements":"skill_assessments";
  const order=table==="skill_assessments"?"updated_at":"created_at";
  const {results}=await env.DB.prepare(`SELECT * FROM ${table} ORDER BY ${order} DESC`).all();
  return Response.json({records:results});
}

export async function POST(request:Request){
  if(!await currentMember(request))return Response.json({error:"Access denied"},{status:403});
  await ready();
  const multipart=request.headers.get("content-type")?.includes("multipart/form-data");
  const body=multipart?await request.formData():await request.json() as Record<string,unknown>;
  const type=value(body,"type"),now=new Date().toISOString();
  if(type==="improvements"){
    const fields=["title","category","owner","impact"];
    if(fields.some(key=>!value(body,key)))return Response.json({error:"Complete all improvement fields."},{status:400});
    await env.DB.prepare("INSERT INTO improvements (title,category,owner,impact,status,created_at) VALUES (?,?,?,?,?,?)").bind(value(body,"title"),value(body,"category"),value(body,"owner"),value(body,"impact"),"Proposed",now).run();
  }else if(type==="runbooks"){
    const fields=["title","product","environment","architecture","owner"];
    if(fields.some(key=>!value(body,key)))return Response.json({error:"Complete all runbook fields."},{status:400});
    const result=await env.DB.prepare("INSERT INTO runbooks (title,product,environment,architecture,approval,owner,reviewed_at) VALUES (?,?,?,?,?,?,?)").bind(value(body,"title"),value(body,"product"),value(body,"environment"),value(body,"architecture"),"Review needed",value(body,"owner"),now).run();
    const attachment=body instanceof FormData?body.get("attachment"):null;
    if(attachment&&typeof attachment!=="string"&&attachment.size>0){
      if(attachment.size>10*1024*1024)return Response.json({error:"Attachments must be 10 MB or smaller."},{status:400});
      const safeName=attachment.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const objectKey=`runbooks/${result.meta.last_row_id}/${crypto.randomUUID()}-${safeName}`;
      await env.FILES.put(objectKey,attachment.stream(),{httpMetadata:{contentType:attachment.type||"application/octet-stream",contentDisposition:`attachment; filename="${safeName}"`}});
      await env.DB.prepare("INSERT INTO runbook_attachments (runbook_id,object_key,file_name,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?)").bind(result.meta.last_row_id,objectKey,attachment.name,attachment.type||"application/octet-stream",attachment.size,now).run();
    }
  }else if(type==="assessments"){
    const fields=["engineer","skill","rating","evidence"];
    if(fields.some(key=>!value(body,key)))return Response.json({error:"Complete all assessment fields."},{status:400});
    await env.DB.prepare("INSERT INTO skill_assessments (engineer,skill,rating,evidence,updated_at) VALUES (?,?,?,?,?)").bind(value(body,"engineer"),value(body,"skill"),value(body,"rating"),value(body,"evidence"),now).run();
  }else return Response.json({error:"Unknown record type."},{status:400});
  return Response.json({ok:true},{status:201});
}

export async function DELETE(request:Request){
  if(!await currentMember(request))return Response.json({error:"Access denied"},{status:403});
  await ready();
  const url=new URL(request.url),type=url.searchParams.get("type"),id=Number(url.searchParams.get("id"));
  if(type!=="runbooks"||!Number.isInteger(id)||id<1)return Response.json({error:"A valid runbook is required."},{status:400});
  const {results:attachments}=await env.DB.prepare("SELECT object_key AS objectKey FROM runbook_attachments WHERE runbook_id = ?").bind(id).all<{objectKey:string}>();
  await Promise.all(attachments.map(attachment=>env.FILES.delete(attachment.objectKey)));
  await env.DB.batch([env.DB.prepare("DELETE FROM runbook_attachments WHERE runbook_id = ?").bind(id),env.DB.prepare("DELETE FROM runbooks WHERE id = ?").bind(id)]);
  return Response.json({ok:true});
}
