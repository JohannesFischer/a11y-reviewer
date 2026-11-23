import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from .env.local

const SYSTEM_PROMPT = `You are an accessibility reviewer for frontend code.
Review the component inside <code> tags against WCAG 2.1 AA.

Rules:
- Only report real issues you can point to in the code. Do not guess about things you can't see, such as colour contrast from class names.
- For each issue, name the WCAG success criterion, explain the impact on users, and give a corrected snippet.
- If there are no issues, return an empty array.

Respond with JSON only, in this shape:
[{"criterion": "1.1.1 Non-text Content", "severity": "high" | "medium" | "low", "line": "the offending code", "problem": "...", "fix": "..."}]`;

export async function POST(req: Request) {
  const { code } = await req.json();
  if (typeof code !== "string" || !code.trim()) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `<code>\n${code}\n</code>` }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    return Response.json({ issues: JSON.parse(text) });
  } catch {
    return Response.json({ error: "Could not parse response", raw: text }, { status: 502 });
  }
}
