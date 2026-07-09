const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const PORT = process.env.PORT || 4000;
const API_URL = process.env.DJANGO_API_URL || "http://127.0.0.1:8000/";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const NODE_ENV = process.env.NODE_ENV || "development";

// Enable CORS for Express routes
app.use(
  cors({
    origin:
      NODE_ENV === "production"
        ? ["https://whos-the-better-human-v83v.onrender.com"]
        : "*",
    methods: ["GET", "POST"],
    credentials: true,
  }),
);

// Create HTTP server and wrap Express app
const server = http.createServer(app);

// Attach socket.io to the server
const io = new Server(server, {
  cors: {
    origin:
      NODE_ENV === "production"
        ? ["https://whos-the-better-human-v83v.onrender.com"]
        : "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const { makeid, getRoundWins } = require("./utils");

// SERVER WIDE SETTINGS
const NUMBEROFROUNDS = 5;
const WINS_TO_CLINCH = 3;

/*
game is a dictionary with the keys as the roomNumbers
    state: state of the game
    players: the dictionary of players mapped by their player numbers
    playerNumberFromId: gets player number from socket id
    roomName: the game code
*/
let newGameObj = (roomName) => {
  return {
    state: {
      playersReady: 0,
      currentRound: 0,
      numPlayers: 1,
      roundFinished: false,
      result: {
        winner: null,
        loser: null,
      },
    },
    players: {},
    playerNumberFromId: {},
    playerNumberFromUsername: {},
    roomName: roomName,
  };
};

let newPlayerObj = () => {
  return {
    score: [],
    // Parallel to score — tooSoon[i] is true iff score[i] came from an early
    // click (clicked during STEADY) rather than a real reaction or a missed
    // timeout, both of which also submit the same 1000ms penalty value and
    // would otherwise be indistinguishable from an early click by score alone.
    tooSoon: [],
    isReady: false,
    username: null,
    eloDiff: 0,
  };
};

const socketRooms = {};
let getGameObjFromRoom = {};

io.on("connect", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join-room", handleJoinRoom);
  socket.on("create-room", handleNewRoom);

  socket.on("player-ready", handlePlayerReady);
  socket.on("player-score", handlePlayerScore);
  // socket.on("disconnect", handleDisconnect);

  function handleJoinRoom(roomName, username) {
    if (!roomName) {
      console.log("[Debug] Join Room: No room name provided");
      socket.emit("unknownCode");
      return;
    }

    const room = io.sockets.adapter.rooms.get(roomName);
    let numsockets = room ? room.size : 0;

    console.log(
      `[Debug] Join Room: Room ${roomName} exists with ${numsockets} socket(s)`,
    );

    if (!room || numsockets === 0) {
      socket.emit("unknownCode");
      return;
    } else if (numsockets >= 2) {
      socket.emit("tooManyPlayers");
      return;
    }

    // Join the room first
    socket.join(roomName);
    console.log(`[Debug] Socket ${socket.id} joined room ${roomName}`);

    // Update room tracking
    socketRooms[socket.id] = roomName;
    const currentGame = getGameObjFromRoom[roomName];

    // Find available player slot
    let thisPlayerId = 1;
    while (currentGame.players[thisPlayerId] != null) {
      thisPlayerId += 1;
    }

    // Set up player data
    currentGame.playerNumberFromId[socket.id] = thisPlayerId;
    currentGame.players[thisPlayerId] = newPlayerObj();
    currentGame.players[thisPlayerId].username = username;
    currentGame.playerNumberFromUsername[username] = thisPlayerId;
    currentGame.state.numPlayers += 1;

    // Send initial game state
    socket.emit("player-number", thisPlayerId);
    socket.emit("game-update", currentGame);

    // Wait a brief moment to ensure socket has joined room
    setTimeout(() => {
      // Emit player join event to the room
      const messageData = {
        user: "System",
        message: `${username} has joined the room!`,
      };
      console.log(
        `[Debug] Emitting player-event to room ${roomName}:`,
        messageData,
      );

      // Broadcast to all sockets in the room
      io.in(roomName).emit("player-event", messageData);
      io.in(roomName).emit("game-update", currentGame);
    }, 100);
  }

  function handleNewRoom(username) {
    console.log("[Debug] Creating new room");
    const roomName = makeid(5);

    // Join the room first
    socket.join(roomName);
    console.log(`[Debug] Socket ${socket.id} joined room ${roomName}`);

    // Update room tracking
    socketRooms[socket.id] = roomName;
    getGameObjFromRoom[roomName] = newGameObj(roomName);
    const thisGameObj = getGameObjFromRoom[roomName];

    // Set up player data
    thisGameObj.players[1] = newPlayerObj();
    thisGameObj.playerNumberFromId[socket.id] = 1;
    thisGameObj.playerNumberFromUsername[username] = 1;
    thisGameObj.roomName = roomName;
    thisGameObj.players[1].username = username;

    // Send initial game state
    socket.emit("player-number", 1);
    socket.emit("game-update", thisGameObj);

    // Wait a brief moment to ensure socket has joined room
    setTimeout(() => {
      // Emit room creation event
      const messageData = {
        user: "System",
        message: `${username} has created the room!`,
      };
      console.log(
        `[Debug] Emitting player-event to room ${roomName}:`,
        messageData,
      );
      // Emit to the specific socket
      socket.emit("player-event", messageData);
    }, 100);
  }

  function handlePlayerReady() {
    const currentGame = getGameObjFromRoom[socketRooms[socket.id]];
    const thisPlayerId = currentGame.playerNumberFromId[socket.id];
    const thisState = currentGame.state;

    console.log(`Room ${socketRooms[socket.id]} Player ${thisPlayerId} ready!`);

    //ignore players that are already ready
    let player = currentGame.players[thisPlayerId];

    if (player.isReady) return;

    player.isReady = true;
    thisState.playersReady += 1;

    const messageData = {
      user: "System",
      message: `${player.username} is ready!`,
    };

    io.in(socketRooms[socket.id]).emit("player-event", messageData);

    // all players are ready so start the game
    if (thisState.playersReady === 2) {
      thisState.currentRound += 1;
      thisState.playersReady = 0;

      io.in(socketRooms[socket.id]).emit("game-update", currentGame);
      console.log("Moving on to next round!");
      io.in(socketRooms[socket.id]).emit("next-round");

      const messageData = {
        user: "System",
        message: `Round ${thisState.currentRound} has started!`,
      };
      io.in(socketRooms[socket.id]).emit("player-event", messageData);

      //reset players ready
      Object.keys(currentGame.players).forEach((key) => {
        currentGame.players[key].isReady = false;
      });
    } else {
      io.in(socketRooms[socket.id]).emit("game-update", currentGame);
    }
  }

  // Old: "player-score" carried just the raw ms number, so a 1000 penalty
  //   from an early click and a 1000 penalty from simply missing the CLICK
  //   window were indistinguishable to the opponent (and to this server).
  // New: carries { score, tooSoon }. score is stored exactly as before —
  //   round-win/match-win logic is unaffected either way, a 1000 still loses
  //   the round regardless of why. tooSoon is stored in a parallel array
  //   purely so clients can show the accurate "TOO SOON" reason instead of
  //   guessing from the score value.
  function handlePlayerScore(payload) {
    const { score, tooSoon } = payload;
    const currentGame = getGameObjFromRoom[socketRooms[socket.id]];
    const thisPlayerId = currentGame.playerNumberFromId[socket.id];

    console.log(
      `Room ${socketRooms[socket.id]} Received Player ${
        currentGame.playerNumberFromId[socket.id]
      } Score: ${score}! (tooSoon: ${tooSoon})`,
    );
    const playerNumber = currentGame.playerNumberFromId[socket.id];
    currentGame.players[playerNumber].score.push(score);
    currentGame.players[playerNumber].tooSoon.push(tooSoon);

    if (
      currentGame.players[1].score.length ===
      currentGame.players[2].score.length
    ) {
      console.log("Both players have submitted scores!");
      const { wins1, wins2 } = getRoundWins(
        currentGame.players[1].score,
        currentGame.players[2].score,
      );
      // Old: match ended only once every round had been played
      //   (currentRound >= NUMBEROFROUNDS), and the winner was whoever had the
      //   lower average reaction time across all 5 rounds.
      // New: match ends as soon as either player clinches best-of-5
      //   (WINS_TO_CLINCH round wins), same as the round cap being reached.
      //   Winner is decided by round-win count; average time is now only a
      //   tiebreaker for the rare case both hit the round-5 cap tied.
      if (
        wins1 >= WINS_TO_CLINCH ||
        wins2 >= WINS_TO_CLINCH ||
        currentGame.state.currentRound >= NUMBEROFROUNDS
      ) {
        function getPlayerAverage(playerNumber) {
          let total = 0;
          let playerScores = currentGame.players[playerNumber].score;
          for (let i = 0; i < playerScores.length; i++) {
            total += playerScores[i];
          }
          console.log(`Player ${playerNumber} Total: ${total}`);
          return total / currentGame.state.currentRound;
        }
        console.log(
          `Player 1 round wins: ${wins1}, Player 2 round wins: ${wins2}`,
        );
        if (wins1 > wins2) {
          currentGame.state.result.winner = `${currentGame.players[1].username}`;
          currentGame.state.result.loser = `${currentGame.players[2].username}`;
        } else if (wins2 > wins1) {
          currentGame.state.result.winner = `${currentGame.players[2].username}`;
          currentGame.state.result.loser = `${currentGame.players[1].username}`;
        } else {
          // Tied round wins at the round-5 cap (e.g. 2-2 with a push) — fall
          // back to average reaction time as a tiebreaker, same comparison
          // the old average-only model always used.
          const player1Average = getPlayerAverage(1);
          const player2Average = getPlayerAverage(2);
          console.log(
            `Tiebreak — Player 1 Average: ${player1Average}, Player 2 Average: ${player2Average}`,
          );
          if (player1Average < player2Average) {
            currentGame.state.result.winner = `${currentGame.players[1].username}`;
            currentGame.state.result.loser = `${currentGame.players[2].username}`;
          } else if (player1Average > player2Average) {
            currentGame.state.result.winner = `${currentGame.players[2].username}`;
            currentGame.state.result.loser = `${currentGame.players[1].username}`;
          } else {
            currentGame.state.result.winner = "Draw";
            currentGame.state.result.loser = "Draw";
          }
        }
        console.log("Sending data to update_rank:", currentGame.state.result);
        axios
          .post(API_URL + "update_rank", currentGame.state.result)
          .then((response) => {
            console.log("Rank updated successfully:", response.data);
            // A "Draw" result skips the rank lookup on the Django side and
            // responds with { draw: true } instead of { winner, loser } — in
            // that case there's no eloDiff to assign, just end the game.
            if (!response.data.draw) {
              console.log(
                "Winner player number:",
                currentGame.playerNumberFromUsername[
                  response.data.winner.username
                ],
              );
              console.log(
                "Loser player number:",
                currentGame.playerNumberFromUsername[
                  response.data.loser.username
                ],
              );
              const winnerPlayerNumber =
                currentGame.playerNumberFromUsername[
                  response.data.winner.username
                ];
              const loserPlayerNumber =
                currentGame.playerNumberFromUsername[
                  response.data.loser.username
                ];

              if (
                winnerPlayerNumber &&
                currentGame.players[winnerPlayerNumber]
              ) {
                currentGame.players[winnerPlayerNumber].eloDiff =
                  response.data.winner.rank_diff;
              }
              if (loserPlayerNumber && currentGame.players[loserPlayerNumber]) {
                currentGame.players[loserPlayerNumber].eloDiff =
                  response.data.loser.rank_diff;
              }

              // Log the updated game state
              console.log("Updated game state:", {
                player1: currentGame.players[1]
                  ? currentGame.players[1].eloDiff
                  : "no player 1",
                player2: currentGame.players[2]
                  ? currentGame.players[2].eloDiff
                  : "no player 2",
              });
            }

            console.log("Game Over!");
            io.in(socketRooms[socket.id]).emit("game-end", {
              playerNumber: thisPlayerId,
              game: currentGame,
            });
          })
          .catch((error) => {
            console.error("Error updating rank:", error);
            // Even if there's an error updating rank, we should still end the game
            console.log("Game Over (with error)!");
            io.in(socketRooms[socket.id]).emit("game-end", {
              playerNumber: thisPlayerId,
              game: currentGame,
            });
          });
        return;
      }
      currentGame.state.roundFinished = true;
      io.in(socketRooms[socket.id]).emit("game-update", currentGame);
      currentGame.state.roundFinished = false;
    }
  }

  // function handleDisconnect() {
  //   console.log(`Socket disconnected: ${socket.id}`);
  //   if (!socketRooms[socket.id]) return;

  //   const currentGame = getGameObjFromRoom[socketRooms[socket.id]];

  //   delete currentGame.playerNumberFromId[socket.id];
  //   currentGame.state.numPlayers -= 1;
  // }
});

app.get("/", (req, res) => {
  console.log("Get request on api");
  res.send("Hello from Express + Socket.IO on Render!");

  axios.get(API_URL + "leaderboard").then((response) => {
    console.log(response.data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
