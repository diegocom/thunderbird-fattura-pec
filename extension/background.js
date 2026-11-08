const previewUrl = messenger.runtime.getURL("preview.html");
const pending = new Map();

messenger.messageDisplayAction.onClicked.addListener(async (tab) => {
  let selection = { error: "message" };
  try {
    const { messages } = await messenger.messageDisplay.getDisplayedMessages(tab.id);
    selection = messages.length === 1 ? { messageId: messages[0].id } : { error: "selection" };
  } catch {
    // The preview explains that the displayed message could not be read.
  }

  // Pass a one-use token so a tab restored after a restart cannot read a reused message ID.
  const token = crypto.randomUUID();
  pending.set(token, selection);
  setTimeout(() => pending.delete(token), 30_000);
  try {
    const windows = await messenger.windows.getAll({ windowTypes: ["normal"] });
    const target = windows.find((window) => window.id === tab.windowId) ?? windows[0]
      ?? await messenger.windows.create({ type: "normal" });
    await messenger.tabs.create({ windowId: target.id, url: `${previewUrl}#${token}` });
    if (target.id !== tab.windowId) {
      await messenger.windows.update(target.id, { focused: true });
    }
  } catch (error) {
    pending.delete(token);
    console.error("Impossibile aprire la scheda Fattura PEC", error);
  }
});

messenger.runtime.onMessage.addListener((request, sender) => {
  if (request?.type !== "readSelection" || sender.url !== `${previewUrl}#${request.token}`) {
    return;
  }
  const selection = pending.get(request.token);
  pending.delete(request.token);
  return Promise.resolve(selection ?? { error: "expired" });
});
