const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

const PORT = process.env.PORT || 4000;

// Create HTTP server and wrap Express app
const server = http.createServer(app);

// Attach socket.io to the server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const { makeid } = require("./utils");

// SERVER WIDE SETTINGS
const NUMBEROFROUNDS = 5;
const API_URL = "http://127.0.0.1:8000/"; // Using explicit IPv4 address

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
      socket.emit("unknownCode");
      return;
    }
    //room is a set
    const room = io.sockets.adapter.rooms.get(roomName);

    //get the size of the room if its a thing
    let numsockets;
    if (room) {
      numsockets = room.size;
    }

    if (!room || numsockets === 0) {
      socket.emit("unknownCode");
      return;
    } else if (numsockets >= 2) {
      socket.emit("tooManyPlayers");
      return;
    }

    console.log(`Socket joining room: ${roomName}`);

    socketRooms[socket.id] = roomName;
    socket.join(roomName);

    //find the lowest free player id
    let thisPlayerId = 1;
    while (getGameObjFromRoom[roomName].players[thisPlayerId] != null) {
      thisPlayerId += 1;
    }

    const currentGame = getGameObjFromRoom[socketRooms[socket.id]];

    currentGame.playerNumberFromId[socket.id] = thisPlayerId;
    currentGame.players[thisPlayerId] = newPlayerObj();
    currentGame.players[thisPlayerId].username = username;
    currentGame.playerNumberFromUsername[username] = thisPlayerId;
    currentGame.state.numPlayers += 1;

    socket.emit("player-number", thisPlayerId);

    socket.emit("game-update", currentGame);
  }

  function handleNewRoom(username) {
    console.log("Handling new room");
    const roomName = makeid(5);
    socketRooms[socket.id] = roomName;
    socket.join(roomName);

    console.log(`Creating new room: ${roomName}`);

    getGameObjFromRoom[roomName] = newGameObj(roomName);
    thisGameObj = getGameObjFromRoom[roomName];

    thisGameObj.players[1] = newPlayerObj();
    thisGameObj.playerNumberFromId[socket.id] = 1;
    thisGameObj.playerNumberFromUsername[username] = 1;
    thisGameObj.roomName = roomName;
    thisGameObj.players[1].username = username;

    socket.emit("player-number", 1);

    socket.emit("game-update", thisGameObj);
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

    // all players are ready so start the game
    if (thisState.playersReady === 2) {
      thisState.currentRound += 1;
      thisState.playersReady = 0;

      io.in(socketRooms[socket.id]).emit("game-update", currentGame);
      console.log("Moving on to next round!");
      io.in(socketRooms[socket.id]).emit("next-round");

      //reset players ready
      Object.keys(currentGame.players).forEach((key) => {
        currentGame.players[key].isReady = false;
      });
    } else {
      io.in(socketRooms[socket.id]).emit("game-update", currentGame);
    }
  }

  function handlePlayerScore(score) {
    const currentGame = getGameObjFromRoom[socketRooms[socket.id]];
    const thisPlayerId = currentGame.playerNumberFromId[socket.id];

    console.log(
      `Room ${socketRooms[socket.id]} Received Player ${
        currentGame.playerNumberFromId[socket.id]
      } Score: ${score}!`
    );
    const playerNumber = currentGame.playerNumberFromId[socket.id];
    currentGame.players[playerNumber].score.push(score);

    if (
      currentGame.players[1].score.length ===
      currentGame.players[2].score.length
    ) {
      console.log("Both players have submitted scores!");
      if (currentGame.state.currentRound >= NUMBEROFROUNDS) {
        function getPlayerAverage(playerNumber) {
          let total = 0;
          let playerScores = currentGame.players[playerNumber].score;
          for (let i = 0; i < playerScores.length; i++) {
            total += playerScores[i];
          }
          console.log(`Player ${playerNumber} Total: ${total}`);
          return total / currentGame.state.currentRound;
        }
        const player1Average = getPlayerAverage(1);
        const player2Average = getPlayerAverage(2);
        console.log(`Player 1 Average: ${player1Average}`);
        console.log(`Player 2 Average: ${player2Average}`);
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
        console.log("Sending data to update_rank:", currentGame.state.result);
        axios
          .post(API_URL + "update_rank", currentGame.state.result)
          .then((response) => {
            console.log("Rank updated successfully:", response.data);
            console.log(
              "Winner player number:",
              currentGame.playerNumberFromUsername[
                response.data.winner.username
              ]
            );
            console.log(
              "Loser player number:",
              currentGame.playerNumberFromUsername[response.data.loser.username]
            );
            const winnerPlayerNumber =
              currentGame.playerNumberFromUsername[
                response.data.winner.username
              ];
            const loserPlayerNumber =
              currentGame.playerNumberFromUsername[
                response.data.loser.username
              ];

            if (winnerPlayerNumber && currentGame.players[winnerPlayerNumber]) {
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
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
