// P7 (PX6) photo helpers shared by qa_full.js and webkit.js. LIB is page code: page.evaluate(LIB) defines window.__p7.
//  __p7.make()        -> base64 of a synthetic 12 MP JPEG: 4032x3024 stored with EXIF orientation 6 (shown 3024x4032 upright), a seeded
//                        mix of gradient, 3 px hatching, specks and small text, and a red block in the stored top-left corner (shown top-right).
//  __p7.file(b64)     -> the same bytes as a File.
//  __p7.oldShrink(f)  -> the pre-P7 phShrink, kept verbatim as the yardstick (one direct draw to 1280 px, JPEG 0.82).
//  __p7.measure(blob, file) -> {w,h,upright,psnr}: the stored image decoded as the app shows it, against a box-filtered reference of the full decode.
//  __p7.quality(f)    -> {own, app, s:{low,medium,high}}: PSNR of the real phShrink (PNG out) as shipped and with each smoothing quality.
//  __p7.magic(buf)    -> "webp" | "jpeg" | "png" | "?" from the first bytes, to prove the stored type field names the real encoding.
const LIB=`(()=>{const P={};
P.make=async()=>{let s=12345;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
 const W=4032,H=3024;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#3a4a5a');g.addColorStop(1,'#c9a98b');x.fillStyle=g;x.fillRect(0,0,W,H);
 x.strokeStyle='#000';x.lineWidth=1.2;for(let i=0;i<W;i+=3){x.beginPath();x.moveTo(i,1200);x.lineTo(i,1800);x.stroke();}
 for(let i=0;i<1000;i++){x.fillStyle='rgba('+(rnd()*255|0)+','+(rnd()*255|0)+',120,.5)';x.fillRect(rnd()*W,rnd()*H,2+rnd()*6,2+rnd()*6);}
 x.fillStyle='#fff';x.font='28px sans-serif';for(let r=0;r<12;r++)x.fillText('Comeback Blueprint fine detail sharpness test 0123456789',200,2000+r*34);
 x.fillStyle='#f00';x.fillRect(0,0,300,300);
 const tb=HTMLCanvasElement.prototype.__p7tb||HTMLCanvasElement.prototype.toBlob;
 const blob=await new Promise(r=>tb.call(c,r,'image/jpeg',0.92));c.width=0;const buf=new Uint8Array(await blob.arrayBuffer());
 const exif=[0xFF,0xE1,0,0x22,0x45,0x78,0x69,0x66,0,0,0x49,0x49,0x2A,0,8,0,0,0,1,0,0x12,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0];
 const out=new Uint8Array(buf.length+exif.length);out.set(buf.slice(0,2),0);out.set(exif,2);out.set(buf.slice(2),2+exif.length);
 let bin='';for(let i=0;i<out.length;i+=32768)bin+=String.fromCharCode.apply(null,out.subarray(i,i+32768));return btoa(bin);};
P.file=b64=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new File([u],'IMG_0001.JPG',{type:'image/jpeg'});};
P.dec=f=>new Promise((res,rej)=>{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('decode'));i.src=u;});
P.oldShrink=function(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{const k=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k)),c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);URL.revokeObjectURL(u);(HTMLCanvasElement.prototype.__p7tb||HTMLCanvasElement.prototype.toBlob).call(c,b=>b?res({blob:b,w,h}):rej(new Error("encode")),"image/jpeg",0.82);};
  img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error("decode"));};img.src=u;});};
P.measure=async(blob,file)=>{const src=await P.dec(file);const nw=src.naturalWidth,nh=src.naturalHeight;
 const full=document.createElement('canvas');full.width=nw;full.height=nh;const fx=full.getContext('2d');fx.drawImage(src,0,0);const fd=fx.getImageData(0,0,nw,nh).data;full.width=0;
 const im=await P.dec(blob);const w=im.naturalWidth,h=im.naturalHeight;const oc=document.createElement('canvas');oc.width=w;oc.height=h;const ox=oc.getContext('2d');ox.drawImage(im,0,0);const d=ox.getImageData(0,0,w,h).data;oc.width=0;
 const px=(X,Y)=>{const i=(Y*w+X)*4;return [d[i],d[i+1],d[i+2]];};const red=a=>a[0]>200&&a[1]<60&&a[2]<60;
 const sx=nw/w,sy=nh/h;let se=0;for(let y=0;y<h;y++){const y0=Math.floor(y*sy),y1=Math.min(nh,Math.floor((y+1)*sy));for(let xx=0;xx<w;xx++){let R=0,G=0,B=0,n=0;const x0=Math.floor(xx*sx),x1=Math.min(nw,Math.floor((xx+1)*sx));for(let yy=y0;yy<y1;yy++)for(let x2=x0;x2<x1;x2++){const i=(yy*nw+x2)*4;R+=fd[i];G+=fd[i+1];B+=fd[i+2];n++;}const o=(y*w+xx)*4;se+=(d[o]-R/n)**2+(d[o+1]-G/n)**2+(d[o+2]-B/n)**2;}}
 return {src:[nw,nh],w,h,upright:red(px(w-20,20))&&!red(px(20,20))&&!red(px(20,h-20))&&!red(px(w-20,h-20)),psnr:+(10*Math.log10(255*255/(se/(w*h*3)))).toFixed(2)};};
P.magic=buf=>{const u=new Uint8Array(buf.slice?buf.slice(0,12):buf);const s=String.fromCharCode.apply(null,u);return /^RIFF....WEBP/.test(s)?'webp':(u[0]===0xFF&&u[1]===0xD8)?'jpeg':/^.PNG/.test(s)?'png':'?';};
/* An iPhone-like encoder: asked for WebP it writes PNG (what Safari does); lieURL also makes the 1x1 WebP probe say no. */
P.noWebP=lieURL=>{const p=HTMLCanvasElement.prototype;if(!p.__p7tb){p.__p7tb=p.toBlob;p.__p7du=p.toDataURL;}window.__p7asked=[];
 p.toBlob=function(cb,t,q){window.__p7asked.push(t||'');return p.__p7tb.call(this,cb,t==='image/webp'?'image/png':t,q);};
 if(lieURL)p.toDataURL=function(t,q){return p.__p7du.call(this,t==='image/webp'?'image/png':t,q);};if(typeof _phWebP!=='undefined')_phWebP=null;};
/* P.quality(file): the real phShrink run once as shipped and once with each smoothing quality forced on every canvas it makes (phCanvas
   wrapped), the encoder swapped for lossless PNG so only the resample is scored; originals restored after. -> {own, app, s:{low,medium,high}} */
P.quality=async file=>{const oc=window.phCanvas,oe=window.phEncode;const own=oc(2,2)[1].imageSmoothingQuality;const s={};let app=null;
 window.phEncode=c=>new Promise((r,j)=>(HTMLCanvasElement.prototype.__p7tb||HTMLCanvasElement.prototype.toBlob).call(c,b=>b?r(b):j(new Error('png')),'image/png'));
 try{app=(await P.measure((await phShrink(file)).blob,file)).psnr;
  for(const q of ['low','medium','high']){window.phCanvas=(w,h)=>{const a=oc(w,h);a[1].imageSmoothingQuality=q;return a;};s[q]=(await P.measure((await phShrink(file)).blob,file)).psnr;}}
 finally{window.phCanvas=oc;window.phEncode=oe;}return {own,app,s};};
window.__p7=P;})();`;
module.exports={LIB};
