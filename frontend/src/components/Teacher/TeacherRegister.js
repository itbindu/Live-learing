import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./TeacherRegister.css";

const TeacherRegister = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  // Get API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const isValidName = (name) => /^[A-Za-z]{2,}$/.test(name);
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone) => /^[6-9]\d{9}$/.test(phone);
  const isValidPassword = (pwd) =>
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(pwd);

  // ---------- SEND OTP ----------
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!isValidName(firstName)) return alert("First name must be at least 2 letters.");
    if (!isValidName(lastName)) return alert("Last name must be at least 2 letters.");
    if (!isValidEmail(email)) return alert("Invalid email address.");
    if (!isValidPhone(phoneNumber)) return alert("Enter a valid 10-digit phone number.");

    try {
      const response = await axios.post(`${API_URL}/api/teachers/send-otp`, { email });
      if (response.data.success) {
        alert(response.data.message);
        setIsOtpSent(true);
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      console.error("Error sending OTP:", error.response?.data || error.message);
      alert("Failed to send OTP. Try again.");
    }
  };

  // ---------- VERIFY OTP ----------
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return alert("Enter the OTP.");

    try {
      const response = await axios.post(`${API_URL}/api/teachers/verify-otp`, { email, otp });
      if (response.data.success) {
        alert("OTP verified! Creating account...");
        handleSignup();
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      console.error("OTP verification failed:", error.response?.data || error.message);
      alert("Invalid OTP. Try again.");
    }
  };

  // ---------- SIGNUP ----------
  const handleSignup = async () => {
    if (!password || !confirmPassword) return alert("Please enter password and confirm it.");
    if (!isValidPassword(password))
      return alert("Password must be 8+ chars, 1 uppercase, 1 number & 1 special char.");
    if (password !== confirmPassword) return alert("Passwords do not match.");

    try {
      const response = await axios.post(`${API_URL}/api/teachers/signup`, {
        firstName,
        lastName,
        email,
        phoneNumber,
        password,
      });
      if (response.status === 200) {
        alert("Account created successfully! Awaiting admin approval.");
        navigate("/teacher/login");
      }
    } catch (error) {
      console.error("Signup error:", error.response?.data || error.message);
      alert(`Signup failed. Try again. Error: ${error.response?.data?.message || error.message}`);
    }
  };

  return (
    <div className="student-container">
      <div className="student-card">
        {/* Left Image - Teacher related */}
        <div className="student-image">
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80"
            alt="Teacher in classroom"
          />
        </div>

        {/* Right Form */}
        <div className="student-form">
          <h2>Teacher Registration</h2>

          <form onSubmit={isOtpSent ? handleVerifyOtp : handleSendOtp}>
            {!isOtpSent ? (
              <>
                <div className="name-fields">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />

                {/* Password field with eye icon */}
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

                {/* Confirm Password field with eye icon */}
                <div className="password-field">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <span
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>

                <button type="submit" className="btn">Send OTP</button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
                <button type="submit" className="btn">Verify OTP</button>
              </>
            )}
          </form>

          <p>
            Already have an account?{" "}
            <span onClick={() => navigate("/teacher/login")} className="toggle-link">
              Login
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TeacherRegister;