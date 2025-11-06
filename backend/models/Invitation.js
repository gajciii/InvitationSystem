import mongoose from "mongoose";

const ResponseSchema = new mongoose.Schema({
  status: { type: String, enum: ["attending", "not_attending", "maybe"], required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const InvitationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String },
    dateTime: { type: Date },
    location: { type: String },
    rsvpLink: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    responses: [ResponseSchema],
  },
  { timestamps: true }
);

const Invitation = mongoose.model("Invitation", InvitationSchema);
export default Invitation;
