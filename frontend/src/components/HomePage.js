import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaChalkboardTeacher, FaUserGraduate } from "react-icons/fa";
import "./HomePage.css";

const HomePage = () => {
  const [role, setRole] = useState("");
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!role) return;
    navigate(`/${role}/register`);
  };

  return (
    <div className="homepage">
      {/* HERO */}
      <header className="hero">
        <h1>Live Learn Platform</h1>
      </header>

      {/* ROLE SELECTION */}
      <section className="cards" aria-label="Select your role">
        <div
          className={`card ${role === "teacher" ? "active" : ""}`}
          tabIndex="0"
          role="button"
          aria-pressed={role === "teacher"}
          onClick={() => setRole("teacher")}
          onKeyDown={(e) => e.key === "Enter" && setRole("teacher")}
        >
          <FaChalkboardTeacher className="icon" />
          <h2>Teacher</h2>
        </div>

        <div
          className={`card ${role === "student" ? "active" : ""}`}
          tabIndex="0"
          role="button"
          aria-pressed={role === "student"}
          onClick={() => setRole("student")}
          onKeyDown={(e) => e.key === "Enter" && setRole("student")}
        >
          <FaUserGraduate className="icon" />
          <h2>Student</h2>
        </div>
      </section>

      {/* CONTINUE BUTTON */}
      <button
        className="continue-btn"
        onClick={handleContinue}
        disabled={!role}
        aria-disabled={!role}
      >
        Continue
      </button>
    </div>
  );
};

export default HomePage;