import React from "react";
import "./HeroLoginSignUp.css";
import "./HeroPage.css";
import logoImage from "../assets/wtbh-logo.png";
import { useNavigate } from "react-router-dom";

function HeroLoginSignUp() {
  const navigate = useNavigate();
  const handleLogIn = () => {
    console.log("Login Room button clicked");
    navigate("/login");
  };

  const handleSignUp = () => {
    console.log("Sign Up Room button clicked");
    navigate("/signup");
  };

  return (
    <div className="heroPage">
      <img src={logoImage} alt="Logo" className="logo"></img>
      <h1 className="heroTitle">WHOSTHEBETTERHUMAN?</h1>
      <div className="formButtons">
        <button onClick={handleSignUp}>Sign Up</button>
        <button onClick={handleLogIn}>Login</button>
      </div>
    </div>
  );
}

export default HeroLoginSignUp;
