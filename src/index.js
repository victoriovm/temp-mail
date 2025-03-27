import express, { json } from "express";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { configDotenv } from "dotenv";
import serverless from "serverless-http";
import cors from "cors";

const app = express();
app.use(json());
app.use(cors());
configDotenv();

const AUTH_TOKEN = process.env.SECRET_KEY;
const redis = new Redis(process.env.REDIS_SERVER);
const EMAIL_TTL = 43200;

function authMiddleware(req, res, next) {
    const token = req.headers["authorization"];
    if (!token || token !== `Bearer ${AUTH_TOKEN}`) {
        return res.status(403).json({ error: "Access Denied" });
    }
    next();
}

app.post("/api/receive", authMiddleware, async (req, res) => {
    let { email, message } = req.body;
    if (!email || !message) {
        return res.status(400).json({ error: "Email and message required!" });
    }
    email = email.split("@")[0].toLowerCase();
    const messageId = uuidv4();
    const messageWithId = { id: messageId, content: message };

    await redis.lpush(email, JSON.stringify(messageWithId));
    await redis.expire(email, EMAIL_TTL);
    res.json({ success: true, id: messageId });
});

app.post("/api/list", async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email required!" });
    }

    const emails = await redis.lrange(email, 0, -1);
    const messageIds = emails.map(msg => {
        const parsed = JSON.parse(msg);
        return { id: parsed.id, title: parsed.content.subject };
    });

    res.json({ messages: messageIds });
});

app.post("/api/read", async (req, res) => {
    const { email, id } = req.body;
    if (!email || !id) {
        return res.status(400).json({ error: "Email and ID required!" });
    }

    const emails = await redis.lrange(email, 0, -1);
    const targetMessage = emails
        .map(JSON.parse)
        .find(msg => msg.id === id);

    if (!targetMessage) {
        return res.status(404).json({ error: "Message not found!" });
    }

    res.json(targetMessage);
});

export default app;
export const handler = serverless(app);
