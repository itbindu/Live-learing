import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/config";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();

  const isValidName = (name) => /^[A-Za-z]{2,}$/.test(name);
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone) => /^[6-9]\d{9}$/.test(phone);
  const isValidPassword = (pwd) =>
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(pwd);

  // ---------- SEND OTP ----------
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    // Validation
    if (!isValidName(firstName)) {
      setError("First name must be at least 2 letters and only alphabets.");
      return;
    }
    if (!isValidName(lastName)) {
      setError("Last name must be at least 2 letters and only alphabets.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Invalid email address.");
      return;
    }
    if (!isValidPhone(phoneNumber)) {
      setError("Enter a valid 10-digit phone number starting with 6-9.");
      return;
    }

    setLoading(true);

    try {
      // Use the correct endpoint from authRoutes
      const response = await api.post("/api/auth/forgot-password/send-otp", { 
        email, 
        userType: "teacher" 
      });
      
      if (response.data.message) {
        setSuccess("OTP sent successfully! Please check your email.");
        setIsOtpSent(true);
      } else {
        setError(response.data.message || "Failed to send OTP.");
      }
    } catch (error) {
      console.error("Error sending OTP:", error.response?.data || error.message);
      setError(error.response?.data?.message || "Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- VERIFY OTP ----------
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      // Verify OTP using auth endpoint
      const response = await api.post("/api/auth/forgot-password/verify-otp", { 
        email, 
        otp, 
        userType: "teacher" 
      });
      
      if (response.data.message === "OTP verified") {
        setSuccess("OTP verified! Creating account...");
        // Proceed to signup
        await handleSignup();
      } else {
        setError(response.data.message || "Invalid OTP.");
      }
    } catch (error) {
      console.error("OTP verification failed:", error.response?.data || error.message);
      setError(error.response?.data?.message || "Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- SIGNUP ----------
  const handleSignup = async () => {
    if (!password || !confirmPassword) {
      setError("Please enter password and confirm it.");
      return;
    }
    if (!isValidPassword(password)) {
      setError("Password must be 8+ chars, 1 uppercase, 1 number & 1 special char.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      // Signup using teacher signup endpoint
      const response = await api.post("/api/teachers/signup", {
        firstName,
        lastName,
        email,
        phoneNumber,
        password,
      });
      
      if (response.status === 200) {
        setSuccess("Account created successfully! Please login.");
        setTimeout(() => {
          navigate("/teacher/login");
        }, 2000);
      }
    } catch (error) {
      console.error("Signup error:", error.response?.data || error.message);
      setError(error.response?.data?.message || "Signup failed. Try again.");
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    
    try {
      const response = await api.post("/api/auth/forgot-password/send-otp", { 
        email, 
        userType: "teacher" 
      });
      
      if (response.data.message) {
        setSuccess("New OTP sent successfully!");
      } else {
        setError("Failed to resend OTP.");
      }
    } catch (error) {
      setError("Failed to resend OTP. Try again.");
    } finally {
      setLoading(false);
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
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

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
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  disabled={loading}
                />

                {/* Password field with eye icon */}
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
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
                    disabled={loading}
                  />
                  <span
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>

                <button type="submit" className="btn" disabled={loading}>
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <div className="otp-info">
                  <p>We've sent a verification code to:</p>
                  <p className="email-display">{email}</p>
                </div>
                
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength="6"
                  required
                  disabled={loading}
                />
                
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
                
                <div className="otp-actions">
                  <button 
                    type="button"
                    onClick={handleResendOtp}
                    className="btn secondary"
                    disabled={loading}
                  >
                    Resend OTP
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsOtpSent(false);
                      setOtp("");
                      setError("");
                      setSuccess("");
                    }}
                    className="btn secondary"
                    disabled={loading}
                  >
                    Back
                  </button>
                </div>
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