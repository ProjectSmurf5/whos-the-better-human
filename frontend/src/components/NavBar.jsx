import React from "react";

function NavBar({ roomName }) {
  return (
    <nav className="nav-container">
      <div className="nav-left">
        <span className="room-name">
          Room Name: <span className="room-code">{roomName}</span>
        </span>
      </div>
      <div className="nav-center">
        <h1>WHOSTHEBETTERHUMAN</h1>
      </div>
      <div className="nav-right">
        {/* Matches the mockup's corner button on every room screen; no
            drawer/menu exists yet for it to open, kept visual-only. */}
        <button
          className="dropdown-button"
          onClick={() => console.log("Menu button clicked (not yet wired to anything)")}>
          &gt;
        </button>
      </div>
    </nav>
  );
}

export default NavBar;
