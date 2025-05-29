import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Leaderboard.css";

function Leaderboard({ leaderboard, getLeaderboard }) {
  const navigate = useNavigate();

  useEffect(() => {
    getLeaderboard();
  }, []);

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div className="leaderboard-container">
      <h1 className="leaderboard-title">Leaderboard</h1>
      <div className="leaderboard-table-container">
        <div className="table-scroll-container">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Username</th>
                <th>Rank</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{player.username}</td>
                  <td>{player.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button className="back-button" onClick={handleBack}>
        Back
      </button>
    </div>
  );
}

export default Leaderboard;
