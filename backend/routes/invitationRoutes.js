import express from "express";
import Invitation from "../models/Invitation.js";
import jwt from "jsonwebtoken";

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || "changeme";

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Bad token" });
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// List my invitations (auth)
router.get("/", auth, async (req, res) => {
  try {
    const list = await Invitation.find({ owner: req.user.id })
      .select("title dateTime location createdAt updatedAt responses")
      .sort({ createdAt: -1 });
    res.json(list);
  } catch {
    res.status(500).json({ error: "Failed to list invitations" });
  }
});

// Create invitation (auth)
router.post("/", auth, async (req, res) => {
  try {
    const { title, message, dateTime, location, rsvpLink } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    const invitation = await Invitation.create({
      title,
      message,
      dateTime: dateTime ? new Date(dateTime) : undefined,
      location,
      rsvpLink,
      owner: req.user.id,
    });
    res.status(201).json(invitation);
  } catch (e) {
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// Get by id (public)
router.get("/:id", async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id).select("title message dateTime location rsvpLink responses createdAt updatedAt");
    if (!invitation) return res.status(404).json({ error: "Not found" });
    res.json(invitation);
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

// Submit RSVP (public)
router.post("/:id/rsvp", async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status || !["attending", "not_attending", "maybe"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const invitation = await Invitation.findById(req.params.id);
    if (!invitation) return res.status(404).json({ error: "Not found" });
    invitation.responses.push({ status, notes });
    await invitation.save();
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

export default router;
