import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const makeCode = () => {
  let c;
  do c = String(Math.floor(100000 + Math.random() * 900000));
  while (rooms.has(c));
  return c;
};

function players(room) {
  return [...room.players.values()].map(p => ({
    id:p.id, name:p.name, credits:p.credits, reaction:p.reaction, rank:p.rank
  }));
}

function endRound(code) {
  const r = rooms.get(code);
  if (!r) return;
  if (r.timer) clearTimeout(r.timer);
  r.timer = null;
  r.state = "results";
  const sorted = [...r.players.values()]
    .filter(p => p.reaction != null)
    .sort((a,b) => a.reaction-b.reaction);
  sorted.forEach((p,i) => p.rank = i+1);
  io.to(code).emit("results", players(r));
}

io.on("connection", socket => {
  socket.on("create", name => {
    const code = makeCode();
    const room = {
      players:new Map(), state:"lobby", round:0, timer:null,
      startedAt:0, pixel:{x:50,y:50,color:"#ffffff"}
    };
    rooms.set(code, room);
    room.players.set(socket.id, {
      id:socket.id, name:String(name || "Joueur").slice(0,16),
      credits:1000, reaction:null, rank:null
    });
    socket.join(code);
    socket.data.room = code;
    socket.emit("joined",{code,host:true});
    io.to(code).emit("players",players(room));
  });

  socket.on("join", ({code,name}) => {
    const room = rooms.get(String(code));
    if (!room) return socket.emit("err","Salle introuvable.");
    if (room.state !== "lobby") return socket.emit("err","La partie a déjà commencé.");
    if (room.players.size >= 20) return socket.emit("err","Salle complète.");

    room.players.set(socket.id,{
      id:socket.id, name:String(name || "Joueur").slice(0,16),
      credits:1000, reaction:null, rank:null
    });
    socket.join(code);
    socket.data.room = code;
    socket.emit("joined",{code,host:false});
    io.to(code).emit("players",players(room));
  });

  socket.on("start", ({stake}) => {
    const code = socket.data.room;
    const room = rooms.get(code);
    if (!room || room.players.size < 2 || room.state !== "lobby") return;

    const mise = Math.max(1, Math.min(1000, Number(stake) || 10));
    room.stake = mise;
    room.round++;
    room.state = "waiting";

    room.players.forEach(p => {
      p.reaction = null;
      p.rank = null;
      p.credits -= mise;
    });

    // Position aléatoire du pixel dans une zone confortable pour les écrans mobiles.
    room.pixel = {
      x: 8 + Math.random()*84,
      y: 12 + Math.random()*76,
      color: "#ffffff"
    };

    io.to(code).emit("waiting", {
      round:room.round,
      stake:mise,
      pot:mise*room.players.size
    });

    // Le moment exact reste imprévisible.
    const delay = 3000 + Math.random()*12000;
    room.timer = setTimeout(() => {
      room.state = "go";
      room.startedAt = performance.now();
      room.pixel.color = "#ff1744";

      io.to(code).emit("pixelOn", {
        x:room.pixel.x,
        y:room.pixel.y,
        color:room.pixel.color
      });

      // Sécurité : une manche ne reste pas bloquée indéfiniment.
      room.timer = setTimeout(() => endRound(code), 30000);
    }, delay);
  });

  socket.on("pixelClick", () => {
    const code = socket.data.room;
    const room = rooms.get(code);
    const p = room?.players.get(socket.id);
    if (!room || !p || room.state !== "go" || p.reaction != null) return;

    p.reaction = performance.now() - room.startedAt;
    p.rank = 1;

    const pot = room.stake * room.players.size;
    p.credits += pot;

    room.state = "results";
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;

    io.to(code).emit("winner", {
      id:p.id,
      name:p.name,
      reaction:p.reaction,
      pot
    });
    endRound(code);
  });

  socket.on("reset", () => {
    const code = socket.data.room;
    const room = rooms.get(code);
    if (!room) return;
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    room.state = "lobby";
    room.players.forEach(p => {
      p.reaction = null;
      p.rank = null;
    });
    io.to(code).emit("reset");
    io.to(code).emit("players",players(room));
  });

  socket.on("disconnect", () => {
    const code = socket.data.room;
    const room = rooms.get(code);
    if (!room) return;
    room.players.delete(socket.id);
    if (!room.players.size) {
      if (room.timer) clearTimeout(room.timer);
      rooms.delete(code);
    } else {
      io.to(code).emit("players",players(room));
    }
  });
});

sserver.listen(process.env.PORT || 10000, "0.0.0.0", () => {
  console.log("Fast Reaction V3 running");
});
});
