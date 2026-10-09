import{NextResponse}from'next/server';
import{getAdminClient}from'@/lib/supabase/server';
import{processQueuedDocument}from'@/lib/automation/worker';
import{hasMatchingFileSignature}from'@/lib/extraction/file-validation';
import{isDemoMode}from'@/lib/config';

export const maxDuration=120;
const MAX=10*1024*1024;
const accepted=new Map([['application/pdf','pdf'],['image/png','png'],['image/jpeg','jpg']]);

export async function POST(req:Request){
 let id:string|undefined;
 try{
  const form=await req.formData(),file=form.get('file');
  if(!(file instanceof File))return NextResponse.json({error:'Choose a PDF, PNG, or JPEG document.'},{status:400});
  const ext=accepted.get(file.type);
  if(!ext||file.size>MAX||file.size===0)return NextResponse.json({error:'File must be a non-empty PDF, PNG, or JPEG no larger than 10 MB.'},{status:400});
  const fileBytes=new Uint8Array(await file.arrayBuffer());
  if(!hasMatchingFileSignature(fileBytes,file.type))return NextResponse.json({error:'The file content does not match its declared PDF, PNG, or JPEG type.'},{status:400});
  const filename=file.name.replace(/[\\/\0-\x1f]/g,'_').slice(0,180)||`invoice.${ext}`;
  if(!isDemoMode()&&!process.env.OPENAI_API_KEY)return NextResponse.json({error:'Live processing requires OPENAI_API_KEY. Configure it before uploading.'},{status:503});
  const db=getAdminClient();id=crypto.randomUUID();const key=`${id}/${filename}`;
  const{error:storeError}=await db.storage.from('ledgerlens-invoice-documents').upload(key,fileBytes,{contentType:file.type,upsert:false});
  if(storeError)throw new Error('The document could not be stored securely. Check the private Supabase storage bucket.');
  const{error}=await db.from('ledgerlens_documents').insert({id,filename,original_filename:filename,file_type:file.type,file_size:file.size,storage_path:key,source:'upload',status:'received',processing_status:'queued',review_status:'not_required'});
  if(error){await db.storage.from('ledgerlens-invoice-documents').remove([key]);throw new Error('Document metadata could not be saved.');}
  await db.from('ledgerlens_audit_logs').insert({document_id:id,action:'document_received',actor_type:'system',actor_name:'LedgerLens API',description:'Document uploaded and queued for processing.'});
  if(isDemoMode())return NextResponse.json({ok:true,id,filename,status:'queued',message:'Stored securely. Demo Mode keeps new uploads queued; explore the seeded deterministic sample invoices.'},{status:202});
  const result=await processQueuedDocument(id,'upload');
  return NextResponse.json({ok:true,id,filename,...result},{status:201});
 }catch(error){
  const message=error instanceof Error?error.message:'Upload or processing failed.';
  return NextResponse.json({error:message,id},{status:id?500:503});
 }
}
