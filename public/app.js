const socket=io();
const $=id=>document.getElementById(id);
let me="", room="", host=false;

function show(a,b){
  $(a).classList.add("hidden");
  $(b).classList.remove("hidden");
}

$("create").onclick=()=>{
  const n=$("name").value.trim();
  if(n) socket.emit("create",n);
  else $("err").textContent="Choisis un pseudo.";
};

$("join").onclick=()=>{
  const n=$("name").value.trim(), c=$("code").value.trim();
  if(n && c.length===6) socket.emit("join",{name:n,code:c});
  else $("err").textContent="Pseudo + code à 6 chiffres requis.";
};

socket.on("err",x=>$("err").textContent=x);

socket.on("joined",d=>{
  me=socket.id;
  room=d.code;
  host=d.host;
  $("roomCode").textContent=room;
  $("start").style.display=host?"block":"none";
  show("home","room");
});

socket.on("players",ps=>{
  const p=ps.find(x=>x.id===me);
  if(p) $("credits").textContent=Math.round(p.credits);

  $("players").innerHTML=ps.map(x=>`
    <div class="player">
      <span>${x.name}${x.id===me?" (toi)":""}</span>
      <span>${x.reaction!=null?x.reaction.toFixed(0)+" ms":"PRÊT"}</span>
    </div>`).join("");
});

$("start").onclick=()=>{
  socket.emit("start",{stake:$("stake").value});
};

socket.on("waiting",d=>{
  show("room","game");
  $("round").textContent=d.round;
  $("pot").textContent=d.pot+" crédits";
  $("message").textContent="OBSERVE BIEN…";
  $("pixel").className="";
  $("pixel").style.left="50%";
  $("pixel").style.top="50%";
  $("winner").textContent="";
  $("scores").innerHTML="";
});

socket.on("pixelOn",p=>{
  $("message").textContent="MAINTENANT !";
  $("pixel").style.left=p.x+"%";
  $("pixel").style.top=p.y+"%";
  $("pixel").className="active";
});

$("pixel").onclick=()=>{
  if(!$("pixel").classList.contains("active")) return;
  $("pixel").classList.remove("active");
  socket.emit("pixelClick");
};

socket.on("winner",w=>{
  $("winner").textContent=`🏆 ${w.name} — ${w.reaction.toFixed(0)} ms`;
});

socket.on("results",ps=>{
  $("message").textContent="MANCHE TERMINÉE";
  $("scores").innerHTML=ps
    .sort((a,b)=>(a.rank||99)-(b.rank||99))
    .map(x=>`<div class="score"><span>#${x.rank||"—"} ${x.name}</span><span>${x.reaction!=null?x.reaction.toFixed(0)+" ms":"—"}</span></div>`)
    .join("");
});

$("again").onclick=()=>{
  if(host) socket.emit("reset");
  else show("game","room");
};

socket.on("reset",()=>show("game","room"));