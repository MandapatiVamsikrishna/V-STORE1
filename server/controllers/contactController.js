import Message from "../models/Message.js";
import { httpError } from "../utils/httpError.js";

export async function createMessage(req, res) {
  const { name, email, subject, message } = req.body;
  const doc = await Message.create({ name, email, subject, message });
  res.status(201).json({ message: "Thanks — we'll reply within one working day.", id: doc._id });
}

export async function listMessages(_req, res) {
  res.json(await Message.find().sort({ createdAt: -1 }).limit(300));
}

export async function updateMessage(req, res) {
  const doc = await Message.findById(req.params.id);
  if (!doc) throw httpError(404, "Message not found");
  if (["new", "read", "resolved"].includes(req.body.status)) doc.status = req.body.status;
  await doc.save();
  res.json(doc);
}
