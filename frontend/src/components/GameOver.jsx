import React from "react";
import "./GameOver.css";

function GameOver({ winner, handleMainMenu, eloDifference }) {
  const handleButtonClick = () => {
    handleMainMenu();
  };
  return (
    <div className="game-over-container">
      <h1 className="game-over-text">Game Over!</h1>
      <h2 className="game-over-winner">{winner} Wins!</h2>
      <h3 className="game-over-elogain">
        {eloDifference > 0
          ? `Elo Gain: +${eloDifference}`
          : eloDifference < 0
          ? `Elo Loss: ${eloDifference}`
          : "No Elo Change"}
      </h3>
      <button onClick={handleButtonClick}>Main Menu</button>
    </div>
  );
}

export default GameOver;
