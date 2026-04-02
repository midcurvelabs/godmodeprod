const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface SendMessageOptions {
  chatId: string;
  text: string;
  parseMode?: "Markdown" | "HTML";
}

interface SendFileOptions {
  chatId: string;
  filePath: string;
  caption?: string;
}

async function telegramRequest(
  method: string,
  body: FormData | Record<string, unknown>
): Promise<unknown> {
  const isFormData = body instanceof FormData;
  const response = await fetch(`${BASE_URL}/${method}`, {
    method: "POST",
    ...(isFormData
      ? { body }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function sendMessage({
  chatId,
  text,
  parseMode = "Markdown",
}: SendMessageOptions): Promise<void> {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  });
}

export async function sendDocument({
  chatId,
  filePath,
  caption,
}: SendFileOptions): Promise<void> {
  const { readFile } = await import("fs/promises");
  const { basename } = await import("path");
  const fileBuffer = await readFile(filePath);
  const fileName = basename(filePath);

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", new Blob([fileBuffer]), fileName);
  if (caption) formData.append("caption", caption);

  await telegramRequest("sendDocument", formData);
}

export async function sendVideo({
  chatId,
  filePath,
  caption,
}: SendFileOptions): Promise<void> {
  const { readFile } = await import("fs/promises");
  const { basename } = await import("path");
  const fileBuffer = await readFile(filePath);
  const fileName = basename(filePath);

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("video", new Blob([fileBuffer]), fileName);
  if (caption) formData.append("caption", caption);

  await telegramRequest("sendVideo", formData);
}

export async function sendPhoto({
  chatId,
  filePath,
  caption,
}: SendFileOptions): Promise<void> {
  const { readFile } = await import("fs/promises");
  const { basename } = await import("path");
  const fileBuffer = await readFile(filePath);
  const fileName = basename(filePath);

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("photo", new Blob([fileBuffer]), fileName);
  if (caption) formData.append("caption", caption);

  await telegramRequest("sendPhoto", formData);
}
