const s=io(),$=id=>document.getElementById(id);let room,stake=5,max=8;
function home(id){document.querySelectorAll(".page,.modal").forEach(x=>x.classList.remove("active"));$(id).classList.add("active")}
$("account").onclick=()=>home("auth");$("create").onclick=()=>home("setup");$("join").onclick=()=>home("joinbox");
document.querySelectorAll(".close").forEach(x=>x.onclick=()=>home("home"));
document.querySelectorAll("#stakes button").forEach(x=>x.onclick=()=>{document.querySelectorAll("#stakes button").forEach(y=>y.classList.remove("sel"));x.classList.add("sel");stake=parseInt(x.textContent)});
$("minus").onclick=()=>{max=Math.max(2,max-1);$("max").textContent=max};$("plus").onclick=()=>{max=Math.min(20,max+1);$("max").textContent=max};
$("launch").onclick=()=>s.emit("room:create",{name:$("profileName").value||"Joueur",maxPlayers:max,stake});
$("gojoin").onclick=()=>s.emit("room:join",{code:$("jcode").value,name:$("jname").value||"Joueur"});
function enter(r){room=r;home("lobby");draw(r)}
s.on("room:created",enter);s.on("room:joined",enter);s.on("room:error",e=>$("err").textContent=e);
function draw(r){$("code").textContent=r.code;$("stake").textContent=r.stake+" €";$("count").textContent=r.players.length+"/"+r.maxPlayers;$("pot").textContent=r.stake*r.players.length+" €";const me=r.players.find(p=>p.id===s.id);$("balance").textContent=(me?.credits??100).toFixed(2).replace(".",",")+" €";$("players").innerHTML=r.players.map(p=>`<div class="player"><b>◉ ${p.name}${p.id===s.id?" (toi)":""}</b><span>${p.ready?"✓ PRÊT":"EN ATTENTE"}</span></div>`).join("");$("ready").classList.toggle("on",!!me?.ready);$("ready").textContent=me?.ready?"✓ Prêt — en attente":"✓ Je suis prêt"}
s.on("room:update",draw);$("ready").onclick=()=>{const me=room?.players.find(p=>p.id===s.id);s.emit("player:ready",!me?.ready)};$("copy").onclick=()=>navigator.clipboard?.writeText(room.code);
s.on("game:state",x=>{if(x.state==="waiting"){home("arenaPage");$("wait").textContent="PRÉPARE-TOI..."}});
s.on("game:target",t=>{home("arenaPage");const q=$("target");q.className=`target show ${t.color} ${t.shape}`;q.style.left=t.x+"%";q.style.top=t.y+"%";$("wait").textContent=""});
$("target").onclick=()=>{s.emit("target:click");$("target").classList.remove("show")};
s.on("game:result",r=>{home("result");const win=r.winnerId===s.id;$("card").className="resultCard";$("card").innerHTML=win?`<div>🪙　💰　🪙</div><h2>GAGNÉ !</h2><div class="gain">+${r.pot} €</div><p>Réaction : <b>${r.reaction} ms</b></p>`:`<h2 style="background:none;color:#aeb5c4">PERDU</h2><div class="loss">0 €</div><p><b>${r.winnerName}</b> a été plus rapide.</p><p>Pot remporté : <b>${r.pot} €</b></p>`});
