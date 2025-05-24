import "./App.css";
import Game from "./components/Game";
import HeroPage from "./components/HeroPage";
import HeroLoginSignUp from "./components/HeroLoginSignUp";
import SignUp from "./components/SignUp";
import Login from "./components/Login";
import React, { useEffect, useState } from "react"; // Imported React for JSX
import { socket } from "./socket";
import axios from "axios";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useNavigate,
  Navigate,
} from "react-router-dom";

function AppRoutes() {
  const API_URL = "http://localhost:8000/";
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
  const [user, setUser] = useState({
    username: "",
    rank: "",
  });
  const [playerNumber, setPlayerNumber] = useState(null);
  const [loggedIn, setLoggedIn] = useState(
    localStorage.getItem("token") !== null
  );
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    // Register socket event listeners
    socket.on("game-update", (gameObj) => {
      console.log("Game Update Received: ", gameObj);
      setGameObj(gameObj);
      if (
        gameObj.roomName &&
        window.location.pathname !== `/game${gameObj.roomName}`
      ) {
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

  function validateUser() {
    const token = localStorage.getItem("token");
    if (token) {
      setLoggedIn(true);

      axios
        .get(API_URL + "test_token", {
          headers: {
            Authorization: `Token ${token}`,
          },
        })
        .then((response) => {
          console.log("Token is valid:", response.data);
          setUser({
            username: response.data.user.username,
            rank: response.data.user.rank,
          });
        });
    }
  }

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

  function handleLogin(e, username, password) {
    e.preventDefault();
    if (username === "" || password === "") {
      alert("Please fill in all fields!");
      return;
    }
    const userData = {
      username: username,
      password: password,
    };
    axios
      .post(API_URL + "login", userData)
      .then((response) => {
        console.log("User logged in successfully:", response.data);
        alert("User logged in successfully!");
        localStorage.setItem("token", response.data.token);
        setLoggedIn(true);
        setUser({
          username: response.data.user.username,
          rank: response.data.user.rank,
        });
        navigate("/");
      })
      .catch((error) => {
        console.error("Error logging in:", error);
        alert("Login failed! Please check your credentials.");
      });
  }

  function handleSignIn(e, username, password, confirmPassword) {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    if (username === "" || password === "" || confirmPassword === "") {
      alert("Please fill in all fields!");
      return;
    }
    const userData = {
      username: username,
      password: password,
    };
    axios
      .post(API_URL + "signup", userData)
      .then((response) => {
        console.log("User signed up successfully:", response.data);
        alert("User signed up successfully!");
        navigate("/");
      })
      .catch((error) => {
        console.error("Error signing up:", error);
        alert("Sign up failed! Please try again.");
      });
  }

  return (
    <div className="App">
      <Routes>
        <Route
          path="/"
          element={
            loggedIn ? (
              <HeroPage
                errorMessage={errorMessage}
                username={user.username}
                rank={user.rank}
                validateUser={validateUser}
              />
            ) : (
              <HeroLoginSignUp />
            )
          }
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
        <Route
          path="/signup"
          element={<SignUp handleSignIn={handleSignIn} />}
        />
        <Route path="/login" element={<Login handleLogin={handleLogin} />} />
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
