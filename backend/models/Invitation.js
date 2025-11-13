import mongoose from "mongoose";

const ResponseSchema = new mongoose.Schema({
  status: { type: String, enum: ["attending", "not_attending", "maybe"], required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  displayName: { type: String },
  anonToken: { type: String },
});

ResponseSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const InvitationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String },
    dateTime: { type: Date },
    location: { type: String },
    rsvpLink: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    responseCutoff: { type: Date },
    responses: [ResponseSchema],
  },
  { timestamps: true }
);

const Invitation = mongoose.model("Invitation", InvitationSchema);
export default Invitation;
