import "./App.css";
import Game from "./components/Game";
import HeroPage from "./components/HeroPage";
import React, { useEffect, useState } from "react"; // Imported React for JSX
import { socket } from "./socket";
import { BrowserRouter as Router, Route, Routes, useNavigate, Navigate } from "react-router-dom";


function AppRoutes() {
  const navigate = useNavigate();

  // State for the game object, player number, and error messages
  const [gameObj, setGameObj] = useState({
    state: {
      playersReady: 0,
      currentRound: 0,
      numPlayers: 0,
      roundFinished: false,
    },
    players: {}, // Ensure players is initialized as an object
    playerNumberFromId: {},
    roomName: null,
  });

  const [playerNumber, setPlayerNumber] = useState(null);
  const [signUpHandler, setSignUpHandler] = useState(false); // Not used
  const [logInHandler, setLogInHandler] = useState(false);   // Not used
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {

    // Register socket event listeners
    socket.on("game-update", (gameObj) => {
      console.log("Game Update Received: ", gameObj);
      setGameObj(gameObj);
      if (gameObj.roomName && window.location.pathname !== `/game${gameObj.roomName}`) {
        navigate(`/game/${gameObj.roomName}`);
      }
    });
    socket.on("player-number", (playerNumber) => {
      console.log("Player Number Received: ", playerNumber);
      setPlayerNumber(playerNumber);
    });
    socket.on("tooManyPlayers", () => {
      console.log("Too many players in the room");
      setErrorMessage("Room is full. Please try again later.");
    });
    socket.on("unknownCode", () => {  
      console.log("Unknown room code");
      setErrorMessage("Room not found. Please check the code.");
    });
  }, [navigate]); 

  // Function to handle returning to the main menu
  function handleMainMenu() {
    // Reset game-related state
    setGameObj({
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
    setErrorMessage(null); // Clear any error messages

    // Navigate to the home page if not already there
    if (window.location.pathname !== "/") {
      navigate("/");
    }
  }

  return (
    <div className="App">
      <Routes>
        <Route
          path="/"
          element={<HeroPage errorMessage={errorMessage} setErrorMessage={setErrorMessage} />}
        />
        <Route
          path="/game/:roomId"
          element={
            gameObj.roomName ? (
              <Game
                gameObj={gameObj}
                playerNumber={playerNumber}
                handleMainMenu={handleMainMenu}
                setGameObj={setGameObj}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </div>
  );
}

// Main App component that sets up the Router
function App() {
  return (
    <Router>
      <AppRoutes /> 
    </Router>
  );
}

export default App;
