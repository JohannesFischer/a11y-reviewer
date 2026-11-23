# A11y Reviewer

A small Next.js app that reviews frontend component code for accessibility issues against **WCAG 2.1 AA**. Paste a component and Claude returns a list of issues. Each issue names the WCAG success criterion, its severity, the offending code, the impact on users, and a corrected snippet.

You can use it through the web UI or from the command line via its HTTP API.

## Setup

Requirements: Node.js 20+ and an [Anthropic API key](https://console.anthropic.com/).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root with your API key:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   The app runs at [http://localhost:3000](http://localhost:3000).

   For a production build, run `npm run build` and then `npm start`.

## Using the UI

1. Open [http://localhost:3000](http://localhost:3000).
2. Paste a component (JSX, TSX, HTML, etc.) into the **Paste a component** text area.
3. Click **Review**. The button shows "Reviewing…" while the request runs.
4. Results appear under **Issues (n)**. Each entry shows:
   - the WCAG criterion and severity (`high`, `medium` or `low`)
   - the offending line of code
   - a description of the problem
   - a suggested fix

If no issues are found, the page shows "No issues found". Errors appear in red above the results. Status changes are also announced to screen readers.

## Using the command line

The UI is a thin client for the `POST /api/review` endpoint. You can call that endpoint directly while the server is running (`npm run dev` or `npm start`).

**Request:** JSON body with a single `code` string.

```bash
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{"code": "<div onClick={save}><img src=\"icon.png\" /></div>"}'
```

**Review a file:** use [`jq`](https://jqlang.org/) to wrap the file contents in JSON safely:

```bash
jq -Rs '{code: .}' src/components/Button.tsx \
  | curl -s http://localhost:3000/api/review \
      -H "Content-Type: application/json" \
      -d @- \
  | jq
```

**Response (200):** for the example above, the response looks like this (the model's wording varies between runs):

```json
{
  "issues": [
    {
      "criterion": "2.1.1 Keyboard",
      "severity": "high",
      "line": "<div onClick={save}>",
      "problem": "A div with a click handler can't be focused or activated with the keyboard, so keyboard and screen reader users can't save.",
      "fix": "<button type=\"button\" onClick={save}>...</button>"
    },
    {
      "criterion": "1.1.1 Non-text Content",
      "severity": "high",
      "line": "<img src=\"icon.png\" />",
      "problem": "The image has no alt text, so the control has no accessible name.",
      "fix": "<img src=\"icon.png\" alt=\"Save\" />"
    }
  ]
}
```

An empty `issues` array means no issues were found.

**Errors:**

| Status | Body | Cause |
| ------ | ---- | ----- |
| 400 | `{ "error": "No code provided" }` | `code` is missing, not a string, or blank. |
| 502 | `{ "error": "Could not parse response", "raw": "..." }` | The model's reply was not valid JSON. `raw` holds the reply text. |

## How it works

- `app/page.tsx` contains the client-side UI.
- `app/api/review/route.ts` sends the code to Claude (`claude-sonnet-5-5`) with a system prompt that asks for a WCAG 2.1 AA review as JSON. The route then returns the parsed issues.

The reviewer reports only issues it can see in the code. It does not guess about things like colour contrast from class names, so a clean result is not a full accessibility audit.
