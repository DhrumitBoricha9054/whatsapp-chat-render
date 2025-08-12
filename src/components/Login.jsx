import { useState } from "react";
import { motion } from "framer-motion";
import "./Login.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === "Dhrumit" && password === "Dhrumit123") {
      onLogin();
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="login-bg">
      <motion.div
        className="login-box"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <h2>Welcome Back</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <motion.span
              className="eye-icon"
              onClick={() => setShowPassword(!showPassword)}
              whileTap={{ rotate: 360 }}
              transition={{ duration: 0.4 }}
            >
              {showPassword ? "🙈" : "👁️"}
            </motion.span>
          </div>

          {error && <p className="error">{error}</p>}

          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Login
          </motion.button>
        </form>

        {/* Footer Credit */}
        <div className="login-footer">
          Design & Developed by{" "}
          <a href="https://zenbytetechnology.com" target="_blank" rel="noopener noreferrer">
            Zenbyte Technology
          </a>
        </div>
      </motion.div>
    </div>
  );
}
