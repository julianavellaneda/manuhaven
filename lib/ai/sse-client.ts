/**
 * Minimal browser-side SSE reader shared by every AI streaming feature
 * (editorial report, assistant chat). Parses `event:`/`data:` blocks from
 * a fetch() response body and dispatches each JSON payload; blocks with
 * unparseable JSON are skipped.
 */
export async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex = buffer.indexOf("\n\n");
    while (sepIndex >= 0) {
      const block = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      dispatchSSEBlock(block, onEvent);
      sepIndex = buffer.indexOf("\n\n");
    }
  }
}

function dispatchSSEBlock(
  block: string,
  onEvent: (event: string, data: unknown) => void
): void {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }
  onEvent(event, data);
}
