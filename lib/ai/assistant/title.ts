import { generateText } from "ai";
import { resolveModelForUser } from "@/lib/ai/assistant/models";
import type { AssistantLocale } from "@/lib/ai/assistant/types";

const TITLE_MAX_LENGTH = 80;

const TITLE_PROMPTS: Record<AssistantLocale, string> = {
  en: "Write a title of at most six words for a conversation that starts with the message below. Reply with the title only — no quotes, no punctuation at the end.",
  es: "Escribe un título de máximo seis palabras para una conversación que empieza con el mensaje de abajo. Responde solo con el título — sin comillas y sin punto final.",
};

/**
 * One cheap utility-model call to name a new conversation from its first
 * message. Failures are the caller's to swallow — a null title is fine.
 */
export async function generateConversationTitle(
  firstMessage: string,
  locale: AssistantLocale,
  userId: string
): Promise<string | null> {
  const { model } = await resolveModelForUser(userId, "utility");
  const { text } = await generateText({
    model,
    system: TITLE_PROMPTS[locale],
    prompt: firstMessage.slice(0, 1_000),
    maxOutputTokens: 40,
  });
  const title = text.trim().replace(/^["'«]+|["'»]+$/g, "").trim();
  if (!title) return null;
  return title.length > TITLE_MAX_LENGTH
    ? `${title.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : title;
}
