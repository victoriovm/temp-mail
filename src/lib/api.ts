export interface Message {
  id: string;
  title: string;
}

export interface MessageContent {
  id: string;
  content: {
    text: string;
    subject: string;
    to: string;
    from: string;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function extractUsername(email: string): string {
  return email.split('@')[0];
}

export async function listMessages(email: string): Promise<Message[]> {
  try {
    const username = extractUsername(email);

    const response = await fetch(`${API_BASE_URL}/api/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: username }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }

    const data = await response.json();
    return data.messages;
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

export async function readMessage(email: string, id: string): Promise<MessageContent | null> {
  try {
    const username = extractUsername(email);

    const response = await fetch(`${API_BASE_URL}/api/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: username, id }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch message content");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching message content:", error);
    return null;
  }
}
