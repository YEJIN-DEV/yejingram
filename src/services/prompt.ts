
import type { Message } from "../entities/message/types";

export function buildTimeContext(messages: Message[], isProactive: boolean) {
  const currentTime = new Date();
  const lastMessageTime = messages.length > 0 ? new Date(messages[messages.length - 1].id) : new Date();
  const timeDiff = Math.round((currentTime.getTime() - lastMessageTime.getTime()) / 1000 / 60);

  let timeContext = `(Context: It's currently ${currentTime.toLocaleString('en-US')}.`;
  if (isProactive) {
    const isFirstContactEver = messages.length === 0;
    if (isFirstContactEver && false /*character.isRandom*/) {
      timeContext += ` You are initiating contact for the very first time. You found the user's profile interesting and decided to reach out. Your first message MUST reflect this. Greet them and explain why you're contacting them, referencing their persona. This is a special instruction just for this one time.)`;
    } else if (isFirstContactEver) {
      timeContext += ` You are starting this conversation for the first time.)`;
    } else {
      timeContext += ` Last message was ${timeDiff} minutes ago. You are proactively reaching out.)`;
    }
  } else {
    timeContext += ` Last message was ${timeDiff} minutes ago.)`;
  }

  return timeContext;
}
