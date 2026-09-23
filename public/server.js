const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const app=express(), server=http.createServer(app), io=new Server(server);
const rooms=new Map();
app.use(express.static("public"));
const colors=["cyan","violet","pink","lime","amber"], shapes=["circle","square","diamond","triangle","hex"];
const code=()=>{let c;do c=Math.random().toString(36).slice(2,7).toUpperCase();while(rooms.has(c));return c};
const pub=r=>({code:r.code,maxPlayers:r.maxPlayers,stake:r.stake,players:[...r.players.values()]});
const emit=r=>io.to(r.code).emit("room:update",pub(r));
function lobby(r){clearTimeout(r.timer);r.state="lobby";r.target=null;for(const p of r.players.values())p.ready=false;emit(r);io.to(r.code).emit("game:state",{state:"lobby"})}
function start(r){if(r.state!=="lobby"||r.players.size<2||![...r.players.values()].every(p=>p.ready))return;r.state="waiting";io.to(r.code).emit("game:state",{state:"waiting"});r.timer=setTimeout(()=>{r.state="target";r.target={x:8+Math.random()*84,y:10+Math.random()*78,color:colors[Math.floor(Math.random()*colors.length)],shape:shapes[Math.floor(Math.random()*shapes.length)]};io.to(r.code).emit("game:target",r.target)},2000+Math.random()*13000)}
io.on("connection",s=>{
s.on("room:create",d=>{const r={code:code(),maxPlayers:Math.min(20,Math.max(2,+d.maxPlayers||8)),stake:Math.max(1,+d.stake||5),players:new Map(),state:"lobby",timer:null,target:null};r.players.set(s.id,{id:s.id,name:String(d.name||"Joueur").slice(0,18),ready:false,credits:100});rooms.set(r.code,r);s.join(r.code);s.data.room=r.code;s.emit("room:created",pub(r));emit(r)});
s.on("room:join",d=>{const r=rooms.get(String(d.code||"").toUpperCase());if(!r)return s.emit("room:error","Salon introuvable.");if(r.players.size>=r.maxPlayers)return s.emit("room:error","Salon complet.");r.players.set(s.id,{id:s.id,name:String(d.name||"Joueur").slice(0,18),ready:false,credits:100});s.join(r.code);s.data.room=r.code;s.emit("room:joined",pub(r));emit(r)});
s.on("player:ready",v=>{const r=rooms.get(s.data.room);if(!r||r.state!=="lobby")return;const p=r.players.get(s.id);if(p)p.ready=!!v;emit(r);start(r)});
s.on("target:click",()=>{const r=rooms.get(s.data.room);if(!r||r.state!=="target")return;const w=r.players.get(s.id);if(!w)return;clearTimeout(r.timer);r.state="result";const pot=r.stake*r.players.size;w.credits+=pot;io.to(r.code).emit("game:result",{winnerId:s.id,winnerName:w.name,pot,reaction:110+Math.floor(Math.random()*390)});setTimeout(()=>lobby(r),7000)});
s.on("disconnect",()=>{const r=rooms.get(s.data.room);if(!r)return;r.players.delete(s.id);if(!r.players.size)rooms.delete(r.code);else lobby(r)})
});
server.listen(process.env.PORT||3000);