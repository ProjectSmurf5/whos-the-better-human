import React from "react";

function NavBar({ roomName, showSideInterface, toggleSideInterface }) {
  return (
    <nav className="nav-container">
      <div className="nav-left">
        <span className="room-name">Room Name: {roomName}</span>
      </div>
      <div className="nav-center">
        <h1>WHOSTHEBETTERHUMAN</h1>
      </div>
      <div className="nav-right">
        <button className="dropdown-button" onClick={toggleSideInterface}>
          {showSideInterface ? ">" : "<"}
        </button>
      </div>
    </nav>
  );
}

export default NavBar;
