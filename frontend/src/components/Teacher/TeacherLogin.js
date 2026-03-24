import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./TeacherLogin.css";

const TeacherLogin = () => {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  // Get API URL from environment variable
 const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!emailOrPhone) return alert("Enter your email or phone.");
    if (!password) return alert("Enter your password.");

    try {
      const response = await axios.post(`${API_URL}/api/auth/teacher/login`, {
        emailOrPhone,
        password,
      });

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        alert("Login successful!");
        navigate("/teacher/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error.response?.data || error.message);
      alert("Invalid credentials or account not approved. Try again.");
    }
  };

  return (
    <div className="student-container">
      <div className="student-card">
        {/* Left Image Section - Working teacher image */}
        <div className="student-image">
          <img
            src="https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=900&q=80"
            alt="Teacher teaching in classroom"
          />
        </div>

        {/* Right Form Section */}
        <div className="student-form">
          <h2>Teacher Login</h2>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Email or Phone"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              required
            />

            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <button type="submit" className="btn">Login</button>
          </form>

          <p>
            <a href="/forgot-password" className="forgot-link">
              Forgot Password?
            </a>
          </p>

          <p>
            Don’t have an account?{" "}
            <span
              onClick={() => navigate("/teacher/register")}
              className="toggle-link"
            >
              Register
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TeacherLogin;