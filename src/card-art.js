const CardArt={
 images:new Map(),
 fallback(canvas,c){
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#171324';ctx.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){ctx.fillStyle=((x/8+y/8+c.id)%5===0)?'#2d2341':'#1c182c';ctx.fillRect(x,y,7,7);}
  ctx.fillStyle=c.palette;ctx.globalAlpha=.18;ctx.fillRect(w*.23,h*.13,w*.54,h*.74);ctx.globalAlpha=1;
  const scale=Math.floor(h/12);PixelRenderer.draw(ctx,SPRITES[c.iconType]||SPRITES.star,Math.floor((w-8*scale)/2),Math.floor((h-8*scale)/2),scale,{'1':'#24162e','2':c.palette,'3':'#fff1c7','4':'#665380','5':'#21182b','6':'#f3ca78'});
  ctx.fillStyle=c.palette;for(let i=0;i<8;i++)if((c.id>>i)&1)ctx.fillRect(7+i*6,h-8,4,4);
 },
 paint(canvas,c){
  if(!canvas.getContext)return;const rect=canvas.getBoundingClientRect();if(rect.width>0&&rect.height>0){canvas.width=Math.round(rect.width*2);canvas.height=Math.round(rect.height*2);}this.fallback(canvas,c);
  const set=c.artSet,asset=ART_ASSETS[set];
  if(!this.images.has(set)){
   const img=new Image();this.images.set(set,{img,ready:false,failed:false});
   img.onload=()=>{const record=this.images.get(set);record.ready=true;document.querySelectorAll('canvas[data-art]').forEach(node=>{const card=C[node.dataset.art];if((card.artSet)===set)this.paint(node,card);});};
   img.onerror=()=>{this.images.get(set).failed=true;document.querySelectorAll('canvas[data-art]').forEach(node=>{if((C[node.dataset.art].artSet)===set)node.dataset.artStatus='fallback';});};
   img.src=asset.url;
  }
  const record=this.images.get(set);if(!record.ready){canvas.dataset.artStatus=record.failed?'fallback':'loading';return;}
  this.drawImage(canvas,c,record.img,asset);canvas.dataset.artStatus='ready';
 },
 drawImage(canvas,c,img,asset){
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const sw=img.width/asset.columns,sh=img.height/asset.rows,sx=(c.art%asset.columns)*sw,sy=Math.floor(c.art/asset.columns)*sh;
  const w=canvas.width,h=canvas.height;ctx.globalAlpha=.32;ctx.drawImage(img,sx,sy,sw,sh,0,0,w,h);ctx.globalAlpha=1;const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;ctx.drawImage(img,sx,sy,sw,sh,(w-dw)/2,(h-dh)/2,dw,dh);
  // Each card retains its own emblem and a distinct corner constellation.
  ctx.fillStyle=c.palette;for(let i=0;i<8;i++)if((c.id>>i)&1){const x=8+i*8;ctx.fillRect(x,h-9,3,3);}
 }
};
