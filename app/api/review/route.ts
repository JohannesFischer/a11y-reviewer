import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an accessibility reviewer for frontend code.
Review the component inside <code> tags against WCAG 2.1 AA.

Rules:
- Only report real issues you can point to in the code. Do not guess about things you can't see, such as colour contrast from class names.
- For each issue, name the WCAG success criterion, explain the impact on users, and give a corrected snippet.
- Order issues from most to least severe.

Output format:
- One JSON object per line (JSON Lines). No array, no code fences, no other text.
- Each object: {"criterion": "1.1.1 Non-text Content", "severity": "high" | "medium" | "low", "line": "the offending code", "problem": "...", "fix": "..."}
- If there are no issues, output nothing.`;

export async function POST(req: Request) {
  const { code } = await req.json();

  if (typeof code !== "string" || !code.trim()) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  const stream = client.messages.stream({
    model: "claude-sonnet-5-5",
    // Thinking tokens count toward this cap too; a low value cuts the review off mid-list
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `<code>\n${code}\n</code>` }],
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        // Tell the client the list is incomplete instead of silently dropping issues
        const final = await stream.finalMessage();
        if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode('\n{"truncated":true}\n'));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      stream.abort(); // stop paying for tokens if the user leaves
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
