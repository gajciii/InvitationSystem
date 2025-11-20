import express from "express";
import crypto from "crypto";
import Invitation from "../models/Invitation.js";
import PDFDocument from "pdfkit";
import jwt from "jsonwebtoken";

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || "changeme";
const RSVP_STATUSES = ["attending", "not_attending", "maybe"];
const STATUS_LABELS = {
  attending: "Attending",
  not_attending: "Not attending",
  maybe: "Maybe",
};

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

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header) return next();
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next();
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
  } catch {
    // silently ignore bad optional tokens
  }
  return next();
}

const sanitizeOwnerInvitation = (invitation) => {
  const obj = invitation.toObject ? invitation.toObject() : invitation;
  return {
    _id: obj._id,
    title: obj.title,
    message: obj.message,
    dateTime: obj.dateTime,
    location: obj.location,
    rsvpLink: obj.rsvpLink,
    responseCutoff: obj.responseCutoff,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    responses: (obj.responses || []).map((resp) => ({
      _id: resp._id,
      status: resp.status,
      notes: resp.notes,
      createdAt: resp.createdAt,
      updatedAt: resp.updatedAt,
      name: resp.user ? resp.displayName || resp.name || null : null,
    })),
  };
};

const sanitizePublicInvitation = (invitation) => {
  const obj = invitation.toObject ? invitation.toObject() : invitation;
  return {
    _id: obj._id,
    title: obj.title,
    message: obj.message,
    dateTime: obj.dateTime,
    location: obj.location,
    rsvpLink: obj.rsvpLink,
    responseCutoff: obj.responseCutoff,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

const parseOptionalDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

const findViewerResponse = (invitation, { userId, anonToken }) => {
  if (!invitation.responses?.length) return null;
  if (userId) {
    const match = invitation.responses.find((resp) => resp.user && resp.user.toString() === userId);
    if (match) return match;
  }
  if (anonToken) {
    return invitation.responses.find((resp) => resp.anonToken && resp.anonToken === anonToken);
  }
  return null;
};

const responseClosed = (invitation) => {
  if (!invitation.responseCutoff) return false;
  return Date.now() > new Date(invitation.responseCutoff).getTime();
};

const safeFileName = (value) => {
  if (!value) return "invitation";
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "invitation";
};

// List my invitations (auth)
router.get("/", auth, async (req, res) => {
  try {
    const list = await Invitation.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(list.map(sanitizeOwnerInvitation));
  } catch {
    res.status(500).json({ error: "Failed to list invitations" });
  }
});

// Create invitation (auth)
router.post("/", auth, async (req, res) => {
  try {
    const { title, message, dateTime, location, rsvpLink, responseCutoff } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    const parsedDateTime = parseOptionalDate(dateTime);
    if (dateTime && !parsedDateTime) return res.status(400).json({ error: "Invalid event date" });
    const parsedCutoff = parseOptionalDate(responseCutoff);
    if (responseCutoff && !parsedCutoff) return res.status(400).json({ error: "Invalid cutoff date" });
    const invitation = await Invitation.create({
      title,
      message,
      dateTime: parsedDateTime,
      location,
      rsvpLink,
      owner: req.user.id,
      responseCutoff: parsedCutoff,
    });
    res.status(201).json(sanitizeOwnerInvitation(invitation));
  } catch (e) {
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// Update invitation (auth, owner)
router.put("/:id", auth, async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ _id: req.params.id, owner: req.user.id });
    if (!invitation) return res.status(404).json({ error: "Invitation not found" });
    const { title, message, dateTime, location, rsvpLink, responseCutoff } = req.body;
    if (typeof title !== "undefined") {
      if (!title) return res.status(400).json({ error: "Title required" });
      invitation.title = title;
    }
    if (typeof message !== "undefined") invitation.message = message;
    if (typeof location !== "undefined") invitation.location = location;
    if (typeof rsvpLink !== "undefined") invitation.rsvpLink = rsvpLink;
    if (typeof dateTime !== "undefined") {
      const parsedDateTime = parseOptionalDate(dateTime);
      if (dateTime && !parsedDateTime) return res.status(400).json({ error: "Invalid event date" });
      invitation.dateTime = parsedDateTime;
    }
    if (typeof responseCutoff !== "undefined") {
      const parsedCutoff = parseOptionalDate(responseCutoff);
      if (responseCutoff && !parsedCutoff) return res.status(400).json({ error: "Invalid cutoff date" });
      invitation.responseCutoff = parsedCutoff;
    }
    await invitation.save();
    res.json(sanitizeOwnerInvitation(invitation));
  } catch {
    res.status(500).json({ error: "Failed to update invitation" });
  }
});

// Delete invitation (auth, owner)
router.delete("/:id", auth, async (req, res) => {
  try {
    const invitation = await Invitation.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!invitation) return res.status(404).json({ error: "Invitation not found" });
    res.json({ success: true, id: invitation._id });
  } catch {
    res.status(500).json({ error: "Failed to delete invitation" });
  }
});

// List invitations I responded to (auth)
router.get("/my/responses", auth, async (req, res) => {
  try {
    const invitations = await Invitation.find({ "responses.user": req.user.id }).sort({ updatedAt: -1 });
    const payload = invitations
      .map((invitation) => {
        const viewerResponse = invitation.responses.find((resp) => resp.user && resp.user.toString() === req.user.id);
        if (!viewerResponse) return null;
        return {
          ...sanitizePublicInvitation(invitation),
          response: {
            _id: viewerResponse._id,
            status: viewerResponse.status,
            notes: viewerResponse.notes,
            updatedAt: viewerResponse.updatedAt || viewerResponse.createdAt,
            canEdit: !responseClosed(invitation),
          },
        };
      })
      .filter(Boolean);
    res.json(payload);
  } catch {
    res.status(500).json({ error: "Failed to load responses" });
  }
});

// Export invitation responses as PDF (auth, owner)
router.get("/:id/export", auth, async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ _id: req.params.id, owner: req.user.id });
    if (!invitation) return res.status(404).json({ error: "Invitation not found" });
    const responses = invitation.responses || [];
    const counts = responses.reduce(
      (acc, resp) => {
        if (resp.status && acc[resp.status] !== undefined) {
          acc[resp.status] += 1;
        }
        return acc;
      },
      { attending: 0, maybe: 0, not_attending: 0 }
    );

    const filename = `${safeFileName(invitation.title)}-responses.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text(invitation.title || "Invitation", { align: "left" });
    doc.moveDown(0.5);
    if (invitation.dateTime) {
      doc.fontSize(12).text(`Event: ${new Date(invitation.dateTime).toLocaleString()}`);
    }
    if (invitation.location) {
      doc.fontSize(12).text(`Location: ${invitation.location}`);
    }
    if (invitation.responseCutoff) {
      doc.fontSize(12).text(`RSVP cutoff: ${new Date(invitation.responseCutoff).toLocaleString()}`);
    }

    doc.moveDown();
    doc.fontSize(12).text(
      `Responses: ${responses.length} (Attending: ${counts.attending} | Maybe: ${counts.maybe} | Not attending: ${counts.not_attending})`
    );
    doc.moveDown();
    doc.fontSize(14).text("Guest responses", { underline: true });

    if (!responses.length) {
      doc.moveDown().fontSize(12).text("No responses yet.");
    } else {
      responses
        .sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        })
        .forEach((resp, index) => {
          const displayName = resp.displayName || resp.name || "Anonymous";
          const status = STATUS_LABELS[resp.status] || resp.status || "Unknown";
          const updated = resp.updatedAt || resp.createdAt;
          doc.moveDown(0.7);
          doc.fontSize(12).text(`${index + 1}. ${displayName}`);
          doc.fontSize(11).text(`Status: ${status}`);
          doc.fontSize(11).text(`Updated: ${updated ? new Date(updated).toLocaleString() : "-"}`);
          if (resp.notes) {
            doc.fontSize(11).text(`Notes: ${resp.notes}`);
          }
        });
    }

    doc.end();
  } catch {
    res.status(500).json({ error: "Failed to export invitation" });
  }
});

// Get by id (public)
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id);
    if (!invitation) return res.status(404).json({ error: "Not found" });
    const anonToken = req.header("x-response-token");
    const viewerResponse = findViewerResponse(invitation, {
      userId: req.user?.id,
      anonToken,
    });
    const payload = sanitizePublicInvitation(invitation);
    payload.myResponse = viewerResponse
      ? {
          _id: viewerResponse._id,
          status: viewerResponse.status,
          notes: viewerResponse.notes,
          updatedAt: viewerResponse.updatedAt || viewerResponse.createdAt,
        }
      : null;
    payload.canEditResponse = !responseClosed(invitation);
    res.json(payload);
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

// Submit RSVP (public)
router.post("/:id/rsvp", optionalAuth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status || !RSVP_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const invitation = await Invitation.findById(req.params.id);
    if (!invitation) return res.status(404).json({ error: "Not found" });
    if (responseClosed(invitation)) {
      return res.status(403).json({ error: "RSVP window closed" });
    }

    const anonToken = req.header("x-response-token");
    const existing = findViewerResponse(invitation, { userId: req.user?.id, anonToken });
    if (existing) {
      existing.status = status;
      existing.notes = notes;
      existing.updatedAt = new Date();
      if (req.user) {
        existing.user = req.user.id;
        existing.displayName = req.user.username;
      }
    } else {
      const newResponse = {
        status,
        notes,
        user: req.user ? req.user.id : undefined,
        displayName: req.user ? req.user.username : undefined,
        anonToken: req.user ? undefined : crypto.randomBytes(16).toString("hex"),
      };
      invitation.responses.push(newResponse);
    }

    await invitation.save();
    const saved = existing || invitation.responses[invitation.responses.length - 1];
    res.json({
      success: true,
      mode: existing ? "updated" : "created",
      responseId: saved._id,
      responseToken: req.user ? null : saved.anonToken,
      updatedAt: saved.updatedAt || saved.createdAt,
    });
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

export default router;
