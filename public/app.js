const s=io(),$=id=>document.getElementById(id);let me=null;
const money=n=>Number(n).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
function show(id){["home","lobby","game"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden")}
$("createBtn").onclick=()=>s.emit("createRoom",{name:$("name").value||"Joueur"});
$("showJoin").onclick=()=>$("join").classList.toggle("hidden");
$("joinBtn").onclick=()=>s.emit("joinRoom",{code:$("code").value,name:$("name").value||"Joueur"});
$("stake").onchange=()=>s.emit("setStake",{stake:$("stake").value});
$("start").onclick=()=>s.emit("startGame");
s.on("connect",()=>me=s.id);s.on("errorMessage",m=>alert(m));
s.on("roomCreated",()=>show("lobby"));s.on("joinedRoom",()=>show("lobby"));
s.on("roomUpdate",r=>{show(r.state==="lobby"?"lobby":"game");$("roomCode").textContent=r.code;$("stake").value=r.stake;$("pot").textContent=money(r.pot);$("gamePot").textContent=money(r.pot);let p=r.players.find(x=>x.id===me);if(p)$("balance").textContent="Solde : "+money(p.credits);$("players").innerHTML=r.players.map(x=>`<div class="player">${x.name}${x.id===me?" (toi)":""} — ${money(x.credits)}</div>`).join("")});
s.on("roundWaiting",()=>{show("game");$("target").className="";$("target").style.cssText="";$("msg").textContent="Préparez-vous…";$("status").textContent="Attendez…";$("winner").classList.add("hidden")});
s.on("targetOn",t=>{let e=$("target");e.className=t.shape;e.style.left=t.x+"%";e.style.top=t.y+"%";e.style.background=t.color;e.style.color=t.color;$("msg").textContent="";$("status").textContent="CLIQUEZ !"});
$("arena").onclick=e=>{if(!$("target").className)return;let r=$("arena").getBoundingClientRect();s.emit("targetClick",{x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100})};
s.on("winner",w=>{$("target").className="";$("winnerName").textContent=w.name;$("prize").textContent="+ "+money(w.prize);$("reaction").textContent="Temps de réaction : "+(w.reactionMs/1000).toFixed(3).replace(".",",")+" s";$("winner").classList.remove("hidden")});
$("again").onclick=()=>s.emit("newRound");
s.on("roundTimeout",()=>{$("msg").textContent="Personne n’a cliqué.";});
