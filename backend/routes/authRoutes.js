import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || "changeme";

// Register
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const existingUser = await User.findOne({ $or: [ { username }, { email: email.toLowerCase() } ] });
    if (existingUser) return res.status(409).json({ error: "Username or email taken" });
    const user = await User.create({ username, email, password });
    const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, jwtSecret, { expiresIn: "1d" });
    res.json({ user: { id: user._id, username: user.username, email: user.email }, token });
  } catch {
    res.status(500).json({ error: "Register failed" });
  }
});

// Login: allow username OR email
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body; // identifier = username or email
  if (!identifier || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const user = await User.findOne({ $or: [ { username: identifier }, { email: identifier.toLowerCase() } ] });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, jwtSecret, { expiresIn: "1d" });
    res.json({ user: { id: user._id, username: user.username, email: user.email }, token });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Bad token" });
  jwt.verify(token, jwtSecret, (err, payload) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.user = payload;
    next();
  });
}

// Me endpoint
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("_id username email");
  res.json({ user });
});

export default router;
