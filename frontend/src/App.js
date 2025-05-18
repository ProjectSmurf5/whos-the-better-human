import "./App.css";
import Game from "./components/Game"; // Import the new Game component
import HeroPage from "./components/HeroPage";
import { useEffect, useState } from "react";
import { socket } from "./socket"; // Import the socket instance
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

function App() {
  const [gameObj, setgameObj] = useState({
    state: {
      playersReady: 0,
      currentRound: 0,
      numPlayers: 0,
      roundFinished: false,
    },
    players: {},
    playerNumberFromId: {},
    roomName: null,
  });

  const [playerNumber, setPlayerNumber] = useState(null);

  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    socket.on("game-update", (gameObj) => {
      setgameObj(gameObj);
      console.log("Game Update Received: ", gameObj);
    });
    socket.on("player-number", (playerNumber) => {
      setPlayerNumber(playerNumber);
      console.log("received player number: ", playerNumber);
    });
    socket.on("unknownCode", () => {
      setErrorMessage("Error: Unknown Room Code!");
    });
    socket.on("tooManyPlayers", () => {
      setErrorMessage("Error: Room is full!");
    });
    socket.on("game-end", (gameEnd) => {
      setgameObj(gameEnd.game);
      console.log("Game Ended: ", gameEnd);
    });
  }, []);

  function handleMainMenu() {
    setgameObj({
      state: {
        playersReady: 0,
        currentRound: 0,
        numPlayers: 0,
        roundFinished: false,
      },
      players: {},
      playerNumberFromId: {},
      roomName: null,
    });
    setPlayerNumber(null);
    setErrorMessage(null);
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HeroPage errorMessage={errorMessage} />} />
          <Route
            path="/game:roomId"
            element={<HeroPage errorMessage={errorMessage} />}
          />
          {gameObj.roomName ? (
            <Game
              gameObj={gameObj}
              playerNumber={playerNumber}
              handleMainMenu={handleMainMenu}
            /> // Pass the game state to the Game component
          ) : (
            <HeroPage errorMessage={errorMessage} />
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
