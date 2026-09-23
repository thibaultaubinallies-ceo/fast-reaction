import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const app=express();
const server=http.createServer(app);
const io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));

const rooms=new Map();
const COLORS=["#ff3b30","#007aff","#34c759","#ffcc00","#af52de","#ff9500","#ff2d55","#5ac8fa","#5856d6","#a8e063"];
const SHAPES=["square","circle","diamond","triangle","star","hexagon","rectangle","cross","heart"];

const code=()=>{let c;do{c=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms.has(c));return c};
const state=r=>({code:r.code,ownerId:r.ownerId,maxPlayers:r.maxPlayers,stake:r.stake,state:r.state,
players:[...r.players.values()].map(p=>({id:p.id,name:p.name,ready:p.ready,credits:p.credits})),
pot:[...r.players.values()].reduce((s,p)=>s+r.stake,0)});
const broadcast=r=>io.to(r.code).emit("roomUpdate",state(r));
const resetReady=r=>[...r.players.values()].forEach(p=>p.ready=false);
const allReady=r=>r.players.size>=2&&[...r.players.values()].every(p=>p.ready);

function start(r){
 if(!r||r.state!=="lobby"||!allReady(r))return;
 r.state="waiting";
 r.waitTimer=setTimeout(()=>activate(r),2000+Math.random()*13000);
 broadcast(r);
 io.to(r.code).emit("roundStarting");
}
function activate(r){
 if(!r||r.state!=="waiting")return;
 r.state="active";
 r.target={color:COLORS[Math.floor(Math.random()*COLORS.length)],
 shape:SHAPES[Math.floor(Math.random()*SHAPES.length)],x:7+Math.random()*86,y:10+Math.random()*76,size:28+Math.random()*18};
 r.started=Date.now();
 io.to(r.code).emit("target",r.target);
 r.timeoutTimer=setTimeout(()=>{
  if(r.state!=="active")return;
  r.state="lobby";r.target=null;resetReady(r);broadcast(r);
  io.to(r.code).emit("roundTimeout",{message:"Personne n'a trouvé la cible."});
 },30000);
}
function finish(r,id){
 if(!r||r.state!=="active")return;
 clearTimeout(r.timeoutTimer);
 const w=r.players.get(id); if(!w)return;
 const pot=[...r.players.values()].reduce((s,p)=>s+r.stake,0);
 const reaction=Date.now()-r.started;
 w.credits+=pot;r.state="result";r.target=null;
 io.to(r.code).emit("roundResult",{winnerId:id,winnerName:w.name,prize:pot,reactionMs:reaction});
 broadcast(r);
 r.nextTimer=setTimeout(()=>{
  if(!rooms.has(r.code))return;
  r.state="lobby";resetReady(r);broadcast(r);io.to(r.code).emit("backToLobby");
 },7000);
}

io.on("connection",socket=>{
 socket.on("createRoom",({name,stake,maxPlayers})=>{
  name=String(name||"Joueur").trim().slice(0,18);
  stake=Number(stake);maxPlayers=Math.floor(Number(maxPlayers));
  if(!Number.isFinite(stake)||stake<=0)return socket.emit("errorMessage","Mise invalide.");
  if(maxPlayers<2||maxPlayers>20)return socket.emit("errorMessage","Le nombre de joueurs doit être compris entre 2 et 20.");
  const r={code:code(),ownerId:socket.id,maxPlayers,stake,state:"lobby",players:new Map(),target:null};
  r.players.set(socket.id,{id:socket.id,name,ready:false,credits:100});
  rooms.set(r.code,r);socket.join(r.code);socket.data.room=r.code;
  socket.emit("roomCreated",{code:r.code});broadcast(r);
 });
 socket.on("joinRoom",({code,name})=>{
  code=String(code||"").trim().toUpperCase();name=String(name||"Joueur").trim().slice(0,18);
  const r=rooms.get(code);
  if(!r)return socket.emit("errorMessage","Salon introuvable.");
  if(r.state!=="lobby")return socket.emit("errorMessage","La partie est déjà en cours.");
  if(r.players.size>=r.maxPlayers)return socket.emit("errorMessage","Le salon est complet.");
  r.players.set(socket.id,{id:socket.id,name,ready:false,credits:100});
  socket.join(code);socket.data.room=code;broadcast(r);
 });
 socket.on("setReady",()=>{
  const r=rooms.get(socket.data.room),p=r?.players.get(socket.id);
  if(!r||r.state!=="lobby"||!p)return;
  p.ready=!p.ready;broadcast(r);if(allReady(r))start(r);
 });
 socket.on("targetClick",({x,y})=>{
  const r=rooms.get(socket.data.room);
  if(!r||r.state!=="active"||!r.target)return;
  if(Math.abs(Number(x)-r.target.x)<=7&&Math.abs(Number(y)-r.target.y)<=7)finish(r,socket.id);
 });
 socket.on("disconnect",()=>{
  const r=rooms.get(socket.data.room);if(!r)return;
  r.players.delete(socket.id);
  if(!r.players.size){clearTimeout(r.waitTimer);clearTimeout(r.timeoutTimer);clearTimeout(r.nextTimer);rooms.delete(r.code);return}
  if(r.ownerId===socket.id)r.ownerId=r.players.keys().next().value;
  if(r.state!=="lobby"){clearTimeout(r.waitTimer);clearTimeout(r.timeoutTimer);clearTimeout(r.nextTimer);r.state="lobby";r.target=null;resetReady(r);io.to(r.code).emit("backToLobby")}
  broadcast(r);
 });
});
server.listen(process.env.PORT||3000,"0.0.0.0",()=>console.log("Fast Reaction V5 running"));
