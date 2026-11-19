import {parentPort,workerData} from 'node:worker_threads';
try{
 const buffer=Buffer.from(workerData.bytes);let text='';
 if(workerData.kind==='pdf'){
  const {getDocumentProxy}=await import('unpdf');const pdf=await getDocumentProxy(new Uint8Array(buffer),{isEvalSupported:false,verbosity:0,useSystemFonts:false,useWorkerFetch:false,disableFontFace:true,maxImageSize:1000000});
  try{if(pdf.numPages>20)throw Error('document_pages');for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const data=await page.getTextContent();text+=data.items.map(x=>x.str||'').join(' ')+'\n';if(text.length>20000)throw Error('document_long');}}finally{await pdf.loadingTask.destroy();}
 }else{const mammoth=await import('mammoth');text=(await mammoth.extractRawText({buffer})).value;}
 text=text.replace(/\u0000/g,'').trim();if(text.length<12)throw Error('document_empty');if(text.length>20000)throw Error('document_long');parentPort.postMessage({text});
}catch(e){parentPort.postMessage({error:['document_pages','document_empty','document_long'].includes(e.message)?e.message:'document_invalid'});}
