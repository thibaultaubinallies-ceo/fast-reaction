import express from "express";
import http from "http";
import {Server} from "socket.io";
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static("public"));
const rooms=new Map();
const COLORS=["#ff1744","#2979ff","#00e676","#ffd600","#aa00ff","#ff6d00","#f50057","#00b8d4","#7c4dff","#76ff03"];
const SHAPES=["square","circle","diamond","triangle","star","hexagon","rectangle","cross","heart"];
const code=()=>{let c;do c=String(Math.floor(100000+Math.random()*900000));while(rooms.has(c));return c};
const view=r=>({code:r.code,stake:r.stake,pot:r.pot,state:r.state,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,credits:p.credits}))});
const emit=r=>io.to(r.code).emit("roomUpdate",view(r));
function reset(r){if(r.timer)clearTimeout(r.timer);r.timer=null;r.state="lobby";r.target=null;r.pot=0;emit(r)}
io.on("connection",s=>{
 s.on("createRoom",({name})=>{let c=code(),r={code:c,stake:10,pot:0,state:"lobby",players:new Map(),target:null,timer:null,started:0};rooms.set(c,r);s.join(c);s.data.room=c;r.players.set(s.id,{id:s.id,name:String(name||"Joueur").slice(0,20),credits:100});s.emit("roomCreated",{code:c});emit(r)});
 s.on("joinRoom",({code,name})=>{let r=rooms.get(String(code||"").trim());if(!r)return s.emit("errorMessage","Salon introuvable.");if(r.state!=="lobby")return s.emit("errorMessage","La partie est déjà en cours.");if(r.players.size>=20)return s.emit("errorMessage","Salon complet.");s.join(r.code);s.data.room=r.code;r.players.set(s.id,{id:s.id,name:String(name||"Joueur").slice(0,20),credits:100});s.emit("joinedRoom",{code:r.code});emit(r)});
 s.on("setStake",({stake})=>{let r=rooms.get(s.data.room);if(!r||r.state!=="lobby")return;r.stake=Math.max(1,Math.min(1000,Number(stake)||10));emit(r)});
 s.on("startGame",()=>{let r=rooms.get(s.data.room);if(!r||r.state!=="lobby")return;for(let p of r.players.values())if(p.credits<r.stake)return s.emit("errorMessage",p.name+" n'a pas assez de crédits.");for(let p of r.players.values())p.credits-=r.stake;r.pot=Math.round(r.players.size*r.stake*100)/100;r.state="waiting";emit(r);io.to(r.code).emit("roundWaiting");r.timer=setTimeout(()=>{if(r.state!=="waiting")return;r.state="active";r.started=Date.now();r.target={x:8+Math.random()*84,y:12+Math.random()*76,color:COLORS[Math.floor(Math.random()*COLORS.length)],shape:SHAPES[Math.floor(Math.random()*SHAPES.length)]};io.to(r.code).emit("targetOn",r.target);emit(r);r.timer=setTimeout(()=>{if(r.state==="active"){io.to(r.code).emit("roundTimeout");reset(r)}},120000)},2000+Math.random()*13000)});
 s.on("targetClick",({x,y})=>{let r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!r||r.state!=="active"||!p)return;let dx=Number(x)-r.target.x,dy=Number(y)-r.target.y;if(Math.hypot(dx,dy)>7)return;r.state="results";if(r.timer)clearTimeout(r.timer);let w={id:p.id,name:p.name,prize:r.pot,reactionMs:Date.now()-r.started};p.credits+=r.pot;io.to(r.code).emit("winner",w);emit(r)});
 s.on("newRound",()=>{let r=rooms.get(s.data.room);if(r?.state==="results")reset(r)});
 s.on("disconnect",()=>{let r=rooms.get(s.data.room);if(!r)return;r.players.delete(s.id);if(!r.players.size){if(r.timer)clearTimeout(r.timer);rooms.delete(r.code)}else{if(r.state!=="lobby"&&r.state!=="results"){r.state="lobby";r.pot=0}emit(r)}});
});
server.listen(process.env.PORT||3000,"0.0.0.0",()=>console.log("Fast Reaction V4 running"));
