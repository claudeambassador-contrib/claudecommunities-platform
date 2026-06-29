import prisma from "../src/lib/prisma";

async function main() {
  const courseId = "cmn4iijzg000009jxeqkztj88";

  const lessons = [
    {
      title: "Setting Up Claude Code",
      slug: "setting-up-claude-code",
      order: 1,
      isPreview: true,
      duration: "10 min",
      content: `{{component:lesson-intro}}

## Install Claude Code

Open your terminal and run:

\`\`\`bash
npm install -g @anthropic-ai/claude-code
\`\`\`

Then verify the installation:

\`\`\`bash
claude --version
\`\`\`

## Authentication

You need one of the following to use Claude Code:

- **Claude Max subscription** — Included usage, no API key needed
- **Claude Pro/Team** — Included usage via Anthropic console
- **API key** — Pay-as-you-go via console.anthropic.com

To authenticate, run:

\`\`\`bash
claude
\`\`\`

Follow the prompts to connect your account. Claude will open a browser window for OAuth if you're using a subscription, or ask for your API key.

## Your First Conversation

Navigate to any project directory and start Claude:

\`\`\`bash
cd ~/my-project
claude
\`\`\`

Try these starter prompts:

\`\`\`
What does this project do? Give me a quick summary.
\`\`\`

\`\`\`
What's the tech stack here?
\`\`\`

Claude reads your files, understands your codebase, and responds with context-aware answers.

## Exercise: Explore a Codebase

1. Clone any open-source repo (or use your own project)
2. Run \`claude\` in the root directory
3. Ask: "What are the main entry points in this project?"
4. Ask: "What dependencies does this project use and why?"
5. Ask: "Are there any obvious issues or improvements you'd suggest?"

> This is exactly what you'd do in the first 5 minutes of a co-work session — get oriented in your project with Claude's help.

{{component:prep-checklist}}`,
    },
    {
      title: "Prompting Fundamentals",
      slug: "prompting-fundamentals",
      order: 2,
      isPreview: false,
      duration: "15 min",
      content: `{{component:lesson-intro}}

## The Anatomy of a Good Prompt

Claude Code works best when you give it **context**, **intent**, and **constraints**.

### Bad prompt:
\`\`\`
fix the bug
\`\`\`

### Good prompt:
\`\`\`
The /api/users endpoint returns 500 when the email field is missing.
Look at src/api/users.ts and add validation that returns a 400 with
a helpful error message when required fields are missing.
\`\`\`

## The Three Layers

### 1. Context — What are we working with?
Tell Claude about the file, the feature, or the problem:
\`\`\`
I'm working on the checkout flow in src/components/Checkout.tsx.
It uses Stripe for payments and React Hook Form for validation.
\`\`\`

### 2. Intent — What do you want?
Be specific about the outcome:
\`\`\`
Add a promo code input field that validates against our API
at /api/promo/validate before applying the discount.
\`\`\`

### 3. Constraints — What are the boundaries?
\`\`\`
Keep the existing form structure. Don't add new dependencies.
Show inline validation errors matching the current error style.
\`\`\`

## Prompt Patterns That Work

### The Scout Pattern
Ask Claude to investigate before making changes:
\`\`\`
Before making any changes, look at how authentication works
in this app. Which files handle it? What patterns are used?
\`\`\`

### The Plan-First Pattern
Get Claude to outline its approach:
\`\`\`
I want to add dark mode support. Don't write any code yet —
give me a plan of what files need to change and what the
approach should be.
\`\`\`

### The Iterative Pattern
Build up complexity step by step:
\`\`\`
Step 1: Create the database model for notifications.
\`\`\`
Then after reviewing:
\`\`\`
Step 2: Now create the API route to fetch unread notifications.
Use the same patterns you see in the existing API routes.
\`\`\`

## Exercise: Prompt Rewriting

Take these bad prompts and rewrite them using context + intent + constraints:

1. "make it look better"
2. "add tests"
3. "it's broken"
4. "add a login page"

Practice this during your next co-work session. Better prompts = better results = faster shipping.

{{component:claude-conversation-demo}}`,
    },
    {
      title: "Building a Feature from Scratch",
      slug: "building-a-feature",
      order: 3,
      isPreview: false,
      duration: "20 min",
      content: `{{component:lesson-intro}}

## The Co-work Feature Workflow

In a typical 45-minute deep work session, you can build a complete feature. Here's the workflow that works:

### Phase 1: Understand (5 min)

\`\`\`
I want to add a bookmark feature to this app. Users should be able
to bookmark posts and view their bookmarks on a separate page.

Before writing any code, tell me:
1. What existing patterns should we follow?
2. What files will need to change?
3. What's the simplest way to implement this?
\`\`\`

### Phase 2: Data Layer (5 min)

\`\`\`
Create the Bookmark model in the Prisma schema with a many-to-many
relationship between User and Post. Add a createdAt timestamp.
Then generate the migration.
\`\`\`

### Phase 3: API (10 min)

\`\`\`
Create two API routes following the patterns in our existing routes:
1. POST /api/bookmarks - toggle bookmark on/off for a post
2. GET /api/bookmarks - get all bookmarked posts for the current user

Use the same auth pattern as the other routes.
\`\`\`

### Phase 4: UI (15 min)

\`\`\`
Add a bookmark button to the PostCard component. It should:
- Show a filled icon when bookmarked, outline when not
- Optimistically update the UI on click
- Use the same icon style as the existing like button
\`\`\`

Then:

\`\`\`
Create a /community/bookmarks page that shows all bookmarked posts.
Use the same layout and card style as the main feed page.
\`\`\`

### Phase 5: Polish (10 min)

\`\`\`
Add loading states to the bookmark button and empty state
to the bookmarks page. Make sure the bookmark count updates
in real-time without a page refresh.
\`\`\`

## Key Technique: Review Every Change

After each phase, always review the diff:

\`\`\`
Show me what you changed and explain why.
\`\`\`

Don't blindly accept — read the code, understand the logic, run it locally. This is where the real learning happens.

## Exercise: Build a Feature

Pick one of these and build it in your next co-work session:

1. **Emoji reactions** on posts (beyond just likes)
2. **User mentions** with @ autocomplete
3. **Reading time estimates** on posts
4. **Share via link** with copy-to-clipboard

Use the 5-phase workflow above. Time yourself — aim for 45 minutes.

{{component:session-timeline}}`,
    },
    {
      title: "Debugging with Claude",
      slug: "debugging-with-claude",
      order: 4,
      isPreview: false,
      duration: "15 min",
      content: `{{component:lesson-intro}}

## The Debugging Workflow

When something breaks, Claude is your best debugging partner. But you need to give it the right information.

### Step 1: Share the Error

Don't just say "it's broken." Give Claude the exact error:

\`\`\`
I'm getting this error when I submit the form:

TypeError: Cannot read properties of undefined (reading 'id')
  at handleSubmit (src/components/ContactForm.tsx:42:18)
  at HTMLFormElement.callCallback (react-dom.development.js:4164:14)

The form was working yesterday. I recently added validation.
\`\`\`

### Step 2: Let Claude Investigate

\`\`\`
Read the handleSubmit function and the form validation logic.
What's causing the undefined value? Check what changed recently.
\`\`\`

### Step 3: Understand Before Fixing

\`\`\`
Explain what's happening step by step before you fix it.
I want to understand the root cause, not just patch the symptom.
\`\`\`

## Common Debugging Patterns

### The "Works Locally, Fails in Prod" Pattern
\`\`\`
This API route works on localhost but returns 500 in production.
Check for environment variable differences, hardcoded URLs,
and any code that assumes a development environment.
\`\`\`

### The "It Was Working Yesterday" Pattern
\`\`\`
The login flow broke sometime today. Look at recent changes
to auth-related files. Check if any dependencies were updated
that might affect session handling.
\`\`\`

### The "Intermittent Failure" Pattern
\`\`\`
This endpoint fails about 30% of the time with a timeout.
Check for race conditions, connection pool exhaustion,
or unhandled promises. Look at the database query patterns.
\`\`\`

## Reading Error Messages

Train yourself to parse errors:

\`\`\`
Ask Claude: "Break down this error message for me.
What does each line of the stack trace mean?
Where should I look first?"
\`\`\`

This is one of the best learning accelerators — understanding error messages makes you a dramatically faster debugger over time.

## Exercise: Debug Challenge

Next co-work session, try this:

1. Introduce a deliberate bug into your project (comment out an import, misspell a variable, remove a null check)
2. Ask Claude to find and fix it — but only by describing the symptom, not the cause
3. See how it investigates and traces the issue

This builds your intuition for how to communicate bugs to both AI and human teammates.

{{component:tips-conversation-demo}}`,
    },
    {
      title: "Refactoring & Code Quality",
      slug: "refactoring-code-quality",
      order: 5,
      isPreview: false,
      duration: "15 min",
      content: `{{component:lesson-intro}}

## When to Refactor

Co-work sessions are great for refactoring because you have focused time and Claude can handle the tedious parts. Good candidates:

- **Functions over 50 lines** — Ask Claude to break them down
- **Duplicated logic** — Extract shared utilities
- **Inconsistent patterns** — Standardise across the codebase
- **Complex conditionals** — Simplify nested if/else chains
- **Missing types** — Add TypeScript types to untyped code

## The Safe Refactoring Workflow

### 1. Understand First
\`\`\`
Read src/utils/helpers.ts. This file has grown too large.
Identify groups of related functions that could be split
into separate modules. Don't change anything yet.
\`\`\`

### 2. Test Coverage Check
\`\`\`
Do we have tests covering the functions in helpers.ts?
If not, write tests for the current behavior before
we refactor. I want a safety net.
\`\`\`

### 3. Refactor in Small Steps
\`\`\`
Move the date-related functions into a new src/utils/dates.ts
file. Update all imports across the codebase. Run the tests
after to verify nothing broke.
\`\`\`

### 4. Verify
\`\`\`
Show me a summary of every file you changed. Are there any
imports that might have been missed?
\`\`\`

## Claude Code Quality Prompts

### Code Review
\`\`\`
Review src/api/orders.ts for:
- Security issues (SQL injection, missing auth checks)
- Performance problems (N+1 queries, missing indexes)
- Error handling gaps
- Code style consistency
\`\`\`

### Type Safety
\`\`\`
This file uses 'any' in 12 places. Replace each 'any' with
proper TypeScript types. Infer from usage where possible.
\`\`\`

### Performance
\`\`\`
This component re-renders on every keystroke. Identify what's
causing unnecessary renders and fix it with memoization
or restructuring. Explain each change.
\`\`\`

## Exercise: Refactor Challenge

In your next co-work session:

1. Pick the messiest file in your project
2. Ask Claude to review it and suggest improvements
3. Refactor it step by step, running tests after each change
4. Compare the before and after — share in Show & Tell!

{{component:session-quiz}}`,
    },
    {
      title: "Shipping in a Co-work Session",
      slug: "shipping-in-cowork",
      order: 6,
      isPreview: false,
      duration: "12 min",
      content: `{{component:lesson-intro}}

## The 45-Minute Ship Challenge

The ultimate co-work goal: go from idea to deployed feature in one deep work session. Here's a real-world example.

### Minute 0-5: Plan
\`\`\`
I want to add a "share via link" feature to posts.
When a user clicks share, it copies a public link to clipboard.
Plan the implementation — what do I need?
\`\`\`

### Minute 5-15: Build the Backend
\`\`\`
Create an API route at /api/posts/[id]/share that generates
a short share token, stores it, and returns the public URL.
Make shared posts viewable without authentication.
\`\`\`

### Minute 15-30: Build the Frontend
\`\`\`
Add a share button to PostCard. On click, call the API,
copy the URL to clipboard, and show a "Link copied!" toast.
Use the same button style as the existing bookmark button.
\`\`\`

### Minute 30-40: Test & Polish
\`\`\`
Test the full flow: click share, verify the link works in
an incognito window, check mobile responsiveness.
Fix any issues you find.
\`\`\`

### Minute 40-45: Deploy
\`\`\`
Write a clear commit message, push to main, and verify
the deploy succeeds. Check the production URL.
\`\`\`

## Git Workflow with Claude

Claude can handle your git workflow too:

\`\`\`
Create a new branch called feature/share-links,
stage all the changes, and write a descriptive commit message.
\`\`\`

\`\`\`
Show me the diff of everything we changed in this session.
Summarise it for a PR description.
\`\`\`

## What to Share in Show & Tell

After shipping, prepare a 2-minute demo:

1. **What you built** — One sentence
2. **Quick demo** — Show it working
3. **One thing you learned** — A Claude technique, a gotcha, a pattern
4. **What's next** — Where this feature goes from here

## Exercise: Ship Something Today

Pick a feature, set a 45-minute timer, and ship it. Use the workflow above. The constraint of time forces you to make smart scope decisions — that's the skill.

Some ideas sized for 45 minutes:
- Add a character count to a text input
- Build a simple API health check dashboard
- Add keyboard shortcuts to navigate your app
- Create a "recently viewed" section using localStorage
- Add CSV export to a data table

{{component:post-session-checklist}}

## You're Ready

You now have the core skills for productive co-work sessions:

- **Setup** — Claude Code installed and authenticated
- **Prompting** — Context + intent + constraints
- **Building** — The 5-phase feature workflow
- **Debugging** — Systematic error investigation
- **Refactoring** — Safe, incremental code improvements
- **Shipping** — Idea to deploy in 45 minutes

Find your next co-work session on the events page and put these skills to work. See you there!`,
    },
  ];

  for (const lesson of lessons) {
    await prisma.lesson.create({
      data: {
        ...lesson,
        courseId,
      },
    });
    console.log(`Created: ${lesson.title}`);
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { isPublished: true },
  });

  console.log("\nClaude Co-work Training course published!");
  process.exit(0);
}

main().catch(console.error);
