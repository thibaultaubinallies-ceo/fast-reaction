const express=require('express');const http=require('http');const {Server}=require('socket.io');
const app=express(),server=http.createServer(app),io=new Server(server);app.use(express.static('public'));
const rooms=new Map();const players=new Map();let seq=1000;
const STAKES=[.25,.5,1,2,5,10,20,50],DUR=[1,2,5,10,20];
const name=x=>String(x||'Joueur').trim().slice(0,18)||'Joueur';
const id=()=>`FR-${seq++}`;const code=()=>Math.random().toString(36).slice(2,6).toUpperCase();
function pub(r){return{id:r.id,code:r.code,private:r.private,stake:r.stake,duration:r.duration,maxPlayers:r.maxPlayers,players:r.players.map(p=>({id:p.id,name:p.name,ready:p.ready,vote:!!r.votes[p.id]})),phase:r.phase,target:r.target,votes:Object.values(r.votes).filter(Boolean).length}}
function broadcast(){io.emit('rooms:update',[...rooms.values()].filter(r=>!r.private&&r.phase==='lobby'&&r.players.length<r.maxPlayers).map(pub))}
function emit(r){io.to(r.id).emit('room:update',pub(r));broadcast()}
function reset(r){clearTimeout(r.timer);clearTimeout(r.endTimer);r.phase='lobby';r.target=null;r.winner=null;r.players.forEach(p=>p.ready=false);r.votes={};emit(r)}
function start(r){
 if(r.phase!=='lobby'||r.players.length<2)return;
 if(r.players.length<r.maxPlayers&&!r.players.every(p=>r.votes[p.id]))return;
 if(r.players.length===r.maxPlayers&&!r.players.every(p=>p.ready))return;
 r.phase='playing';r.players.forEach(p=>p.ready=false);emit(r);

 // The selected duration is the MAXIMUM duration of the round.
 // The target appears only once, at a random moment during that window.
 const total=r.duration*60*1000;
 const margin=Math.min(5000,Math.max(1500,total*0.08));
 const delay=margin+Math.random()*Math.max(1000,total-2*margin);

 r.timer=setTimeout(()=>{
   if(!rooms.has(r.id)||r.phase!=='playing')return;
   r.target={x:10+Math.random()*80,y:15+Math.random()*70,color:['red','green','gold','violet','blue'][Math.floor(Math.random()*5)]};
   r.targetAt=Date.now();
   io.to(r.id).emit('target:show',r.target);
 },delay);

 // If nobody clicks before the duration ends, the round expires.
 r.endTimer=setTimeout(()=>{
   if(!rooms.has(r.id)||r.phase!=='playing')return;
   r.phase='result';r.target=null;clearTimeout(r.timer);
   io.to(r.id).emit('game:timeout',{duration:r.duration});
 },total);
}
function leave(s){const p=players.get(s.id);if(!p)return;const r=rooms.get(p.roomId);players.delete(s.id);if(!r)return;r.players=r.players.filter(x=>x.id!==s.id);delete r.votes[s.id];if(r.phase==='playing')reset(r);else if(!r.players.length){rooms.delete(r.id);broadcast()}else emit(r)}
function join(s,r,n){if(r.players.length>=r.maxPlayers)return s.emit('notice','Salon complet.');r.players.push({id:s.id,name:n,ready:false,credits:100});players.set(s.id,{roomId:r.id});s.join(r.id);s.emit('room:joined',{room:pub(r),selfId:s.id});emit(r)}
io.on('connection',s=>{
 s.on('rooms:list',()=>s.emit('rooms:update',[...rooms.values()].filter(r=>!r.private&&r.phase==='lobby'&&r.players.length<r.maxPlayers).map(pub)));
 s.on('room:create',d=>{const stake=+d.stake,dur=+d.duration,max=Math.max(2,Math.min(20,+d.maxPlayers||8));if(!STAKES.includes(stake)||!DUR.includes(dur))return s.emit('notice','Paramètres invalides.');const r={id:id(),code:code(),private:!!d.private,stake,duration:dur,maxPlayers:max,players:[],votes:{},phase:'lobby',target:null};rooms.set(r.id,r);join(s,r,name(d.name))});
 s.on('room:joinPublic',d=>{const r=rooms.get(d.roomId);if(!r||r.private||r.phase!=='lobby')return s.emit('notice','Ce salon n’est plus disponible.');join(s,r,name(d.name))});
 s.on('room:joinPrivate',d=>{const c=String(d.code||'').toUpperCase();const r=[...rooms.values()].find(x=>x.private&&x.code===c&&x.phase==='lobby');if(!r)return s.emit('notice','Code privé introuvable.');join(s,r,name(d.name))});
 s.on('room:ready',()=>{const p=players.get(s.id),r=p&&rooms.get(p.roomId);if(!r||r.phase!=='lobby')return;const me=r.players.find(x=>x.id===s.id);me.ready=!me.ready;emit(r);if(r.players.length===r.maxPlayers&&r.players.every(x=>x.ready))start(r)});
 s.on('room:vote',()=>{const p=players.get(s.id),r=p&&rooms.get(p.roomId);if(!r||r.phase!=='lobby'||r.players.length>=r.maxPlayers)return;r.votes[s.id]=!r.votes[s.id];emit(r);if(r.players.length>=2&&r.players.every(x=>r.votes[x.id]))start(r)});
 s.on('room:rematch',()=>{
 const p=players.get(s.id),r=p&&rooms.get(p.roomId);
 if(!r||r.phase!=='result')return;
 clearTimeout(r.timer);clearTimeout(r.endTimer);
 r.phase='lobby';r.target=null;r.winner=null;r.votes={};
 r.players.forEach(x=>x.ready=false);
 emit(r);
});
s.on('room:leave',()=>{leave(s);s.emit('room:left')});
 s.on('target:click',()=>{const p=players.get(s.id),r=p&&rooms.get(p.roomId);if(!r||r.phase!=='playing'||!r.target||r.winner)return;const me=r.players.find(x=>x.id===s.id);r.winner=s.id;r.phase='result';clearTimeout(r.timer);clearTimeout(r.endTimer);const pot=+(r.stake*r.players.length).toFixed(2),reaction=Date.now()-r.targetAt;me.credits+=pot;io.to(r.id).emit('game:result',{winnerId:s.id,winnerName:me.name,pot,reaction});setTimeout(()=>{if(rooms.has(r.id))reset(r)},6000)});
 s.on('disconnect',()=>leave(s));
});
app.get('/health',(q,res)=>res.json({ok:true,version:'v8'}));server.listen(process.env.PORT||3000,()=>console.log('Fast Reaction V8 running'));
