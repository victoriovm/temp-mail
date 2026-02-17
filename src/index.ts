import express, { json } from "express";
import type { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { configDotenv } from "dotenv";
import serverless from "serverless-http";
import cors from "cors";
import OpenAI from "openai";

interface EmailMessage {
    id: string;
    content: {
        subject: string;
        html?: string;
        [key: string]: unknown;
    };
    analysis?: AnalysisResult;
}

interface AnalysisResult {
    verification_code: string | null;
    confirmation_link: string | null;
}

const app = express();
app.use(json());
app.use(cors());
configDotenv();

const AUTH_TOKEN: string = process.env.SECRET_KEY!;
const redis = new Redis(process.env.REDIS_SERVER!);
const EMAIL_TTL: number = 43200;

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
});

async function analyzeEmailHtml(html: string): Promise<AnalysisResult> {
    const response = await openai.chat.completions.create({
        model: "stepfun/step-3.5-flash:free",
        messages: [
            {
                role: "system" as const,
                content: `You are an email analyzer. Extract verification codes and confirmation links from email HTML.
Respond ONLY with valid JSON in this exact format:
{"verification_code": "<code or null>", "confirmation_link": "<url or null>"}
Rules:
- verification_code: any numeric or alphanumeric code used for verification/OTP/2FA (e.g. "123456", "A1B2C3")
- confirmation_link: any URL the user must click to confirm/verify their account or action
- Use null if not found
- Do NOT wrap in markdown code blocks`,
            },
            {
                role: "user" as const,
                content: html,
            },
        ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";

    try {
        const parsed: AnalysisResult = JSON.parse(raw);
        return {
            verification_code: parsed.verification_code ?? null,
            confirmation_link: parsed.confirmation_link ?? null,
        };
    } catch {
        return { verification_code: null, confirmation_link: null };
    }
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = req.headers["authorization"];
    if (!token || token !== `Bearer ${AUTH_TOKEN}`) {
        res.status(403).json({ error: "Access Denied" });
        return;
    }
    next();
}

async function runAnalysisInBackground(emailKey: string, messageId: string, html: string): Promise<void> {
    try {
        const analysis = await analyzeEmailHtml(html);

        const emails: string[] = await redis.lrange(emailKey, 0, -1);
        for (let i = 0; i < emails.length; i++) {
            const parsed: EmailMessage = JSON.parse(emails[i]!);
            if (parsed.id === messageId) {
                parsed.analysis = analysis;
                await redis.lset(emailKey, i, JSON.stringify(parsed));
                break;
            }
        }
    } catch {
    }
}

app.post("/api/receive", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    let { email, message } = req.body;
    if (!email || !message) {
        res.status(400).json({ error: "Email and message required!" });
        return;
    }
    email = email.split("@")[0].toLowerCase();
    const messageId: string = uuidv4();
    const messageWithId: EmailMessage = { id: messageId, content: message };

    await redis.lpush(email, JSON.stringify(messageWithId));
    await redis.expire(email, EMAIL_TTL);
    res.json({ success: true, id: messageId });

    runAnalysisInBackground(email, messageId, Buffer.from(message.text, "base64").toString("utf-8"));
});

app.post("/api/list", async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ error: "Email required!" });
        return;
    }

    const emails: string[] = await redis.lrange(email, 0, -1);
    const messageIds = emails.map((msg: string) => {
        const parsed: EmailMessage = JSON.parse(msg);
        return { id: parsed.id, title: parsed.content.subject };
    });

    res.json({ messages: messageIds });
});

app.post("/api/read", async (req: Request, res: Response): Promise<void> => {
    const { email, id } = req.body;
    if (!email || !id) {
        res.status(400).json({ error: "Email and ID required!" });
        return;
    }

    const emails: string[] = await redis.lrange(email, 0, -1);
    const targetMessage: EmailMessage | undefined = emails
        .map((msg: string): EmailMessage => JSON.parse(msg))
        .find((msg: EmailMessage) => msg.id === id);

    if (!targetMessage) {
        res.status(404).json({ error: "Message not found!" });
        return;
    }

    res.json(targetMessage);
});

export default app;
export const handler = serverless(app);
