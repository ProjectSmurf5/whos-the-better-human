// HeroPage.js
import React from "react";
import "./HeroPage.css";
import logoImage from "../assets/wtbh-logo.png";
import kingImage from "../assets/king.png";
import { useState, useEffect } from "react";
import { socket } from "../socket"; // Import the socket instance

const HeroPage = ({
  errorMessage,
  username,
  rank,
  validateUser,
  leaderboardHandler,
}) => {
  console.log("username:", username);
  console.log("rank:", rank);
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    validateUser(); // Call validateUser to check if the user is logged in
  }, []);

  const handleCreateRoom = () => {
    console.log("Create Room button clicked");
    socket.emit("create-room", username);
  };

  const handleJoinRoom = () => {
    console.log("Join Room button clicked");
    socket.emit("join-room", roomCode, username);
  };

  const handleLeaderboard = () => {
    console.log("Leaderboard button clicked");
    leaderboardHandler();
  };

  return (
    <>
      {/* Navbar */}
      <div className="navbar">
        <div className="navbar-left">Welcome {username}</div>
        <div className="navbar-right">Rank: {rank}</div>
      </div>

      <div className="heroPage">
        <button className="leaderboardButton" onClick={handleLeaderboard}>
          <img src={kingImage} alt="King" className="kingImage" />
        </button>
        <img src={logoImage} alt="Logo" className="logo" />
        <h1 className="heroTitle">WHOSTHEBETTERHUMAN?</h1>
        <div className="heroButtons">
          <button className="heroButton" onClick={handleCreateRoom}>
            Create Room
          </button>
          <input
            type="text"
            placeholder="Enter Room Code"
            className="roomInputField"
            onChange={(e) => setRoomCode(e.target.value)}
            value={roomCode} // It's good practice to control the input value
          />
          <button className="heroButton" onClick={handleJoinRoom}>
            Join Room
          </button>
        </div>
        <div className="errorMessage">
          {errorMessage && <p>{errorMessage}</p>}
        </div>
      </div>
    </>
  );
};

export default HeroPage;
