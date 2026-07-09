import React from "react";
import "./ReactionBox.css";

function ReactionBox({ roundRunning, clickHandler, timer1Running }) {
  let reactionBoxText = "Waiting for round to start...";

  if (timer1Running) reactionBoxText = "STEADY...";
  if (roundRunning) reactionBoxText = "CLICK!";

  return (
    <div className="reaction-box">
      <button
        className={`click-button ${timer1Running ? "steady" : ""} ${
          roundRunning ? "click" : ""
        }`}
        onClick={clickHandler}
      >
        {reactionBoxText}
      </button>
    </div>
  );
}

export default ReactionBox;
