import prisma from "../src/lib/prisma";

const COURSE_SLUG = "claude-cowork-for-beginners";

const lessonUpdates: Record<string, string> = {
  "what-is-claude-cowork": `{{component:lesson-intro}}

Claude Co-work sessions are community-powered working sessions where people come together — in person or online — to build real projects with Claude Code.

Think of it as a study group meets hackathon meets co-working space, but with AI superpowers.

## The Co-work Ecosystem

{{component:cowork-diagram}}

## Why Co-work?

Working with AI is better together. In a Co-work session, you get:

- **Focused time** — Dedicated blocks to actually build, not just talk about building
- **Community support** — Stuck on something? Someone nearby has probably solved it before
- **Accountability** — Sharing your goals means you're more likely to follow through
- **Inspiration** — Seeing what others build sparks ideas you'd never have alone

## How a Session Flows

Every Co-work session follows a proven structure designed to maximise your productivity:

{{component:session-timeline}}

## What People Build

People bring all kinds of projects to Co-work sessions:

- Automating tedious workflows with Claude Code
- Building full-stack web apps from scratch
- Refactoring legacy codebases
- Learning new frameworks with Claude as a tutor
- Prototyping startup ideas
- Contributing to open source projects

The only rule? **Bring something you want to work on.** The session structure handles the rest.`,

  "preparing-for-first-session": `{{component:lesson-intro}}

A little preparation goes a long way. Walking into a Co-work session ready means you spend the deep work time actually building — not setting up.

## Your Pre-Session Checklist

Work through these items before your first session:

{{component:prep-checklist}}

## What to Expect

Your first session might feel a little different from what you're used to. Here's the vibe:

- **Casual, not corporate** — No presentations, no pressure. Just people building stuff.
- **All skill levels welcome** — From first-time coders to senior engineers. Everyone learns something.
- **Facilitator-led** — Someone keeps the session on track so you can focus on your work.
- **Optional sharing** — You're never forced to present, but Show & Tell is where the magic happens.

## Choosing Your First Project

Pick something that's:

1. **Scoped** — You can make meaningful progress in 45 minutes
2. **Interesting to you** — Motivation matters when you're learning
3. **Slightly challenging** — Push your comfort zone, but don't overwhelm yourself

> Pro tip: "Add a feature to an existing project" is usually better than "build something from scratch" for your first session. You'll have context and can focus on learning the Claude Code workflow.

## Talking to Claude

If you're new to Claude Code, here's what a conversation might look like:

{{component:claude-conversation-demo}}

Notice how specific the prompts are — Claude works best when you give it clear context about what you want. You'll get a feel for this during the session.`,

  "session-structure": `{{component:lesson-intro}}

Every Co-work session follows a carefully designed structure. Let's break down each phase so you know exactly what to expect.

## The Five Phases

{{component:session-timeline}}

## Phase Deep Dive

### Check-in (5 minutes)
Everyone briefly shares what they're planning to work on. This is quick — just a sentence or two. It helps the facilitator know who might need help and who has complementary skills.

### Goal Setting (5 minutes)
Write down your specific goal for the session. Not "work on my app" but "implement user authentication with Clerk." Specific goals lead to specific outcomes.

### Deep Work (45 minutes)
This is the core of the session. Headphones on, Claude open, and build. The facilitator is available for questions, and you can ask the group for help in the chat.

### Show & Tell (10 minutes)
Voluntarily share what you accomplished. Even "I got stuck on X and learned Y" is valuable. This is often the most inspiring part — seeing what's possible sparks new ideas.

### Wrap-up (5 minutes)
Commit your work, share reflections, and plan your next session goal.

## Test Your Knowledge

Let's see how well you know the Co-work structure:

{{component:session-quiz}}`,

  "getting-help": `{{component:lesson-intro}}

One of the best things about Co-work sessions is that you're not alone. Here's how to get the most out of the support available.

## Your Help Toolkit

During a session, you have multiple avenues for help:

### 1. Claude Code (Your AI Pair Programmer)
Claude is right there in your terminal. Ask it questions, have it debug your code, or get it to explain concepts. It's like having a senior developer sitting next to you.

### 2. Session Facilitator
The facilitator has experience with Claude Code and can help with:
- Getting unstuck on setup issues
- Suggesting approaches to problems
- Connecting you with someone who's solved a similar problem

### 3. Fellow Participants
Don't underestimate the power of the person sitting next to you. A quick "hey, have you ever seen this error?" can save you 30 minutes of debugging.

## How to Ask Good Questions

Whether you're asking Claude or a human, better questions get better answers:

{{component:tips-conversation-demo}}

Notice how the conversation evolves — starting broad, then getting specific as Claude identifies the issues.

## Common First-Session Challenges

- **"I don't know what to build"** — Start with a small improvement to something you already use
- **"Claude isn't doing what I want"** — Be more specific. Show it the error, the file, the expected behavior
- **"I'm too slow compared to everyone else"** — There is no comparison. Everyone is working on different things at different levels
- **"My setup isn't working"** — Ask for help immediately. Don't spend your deep work time on setup issues`,

  "claude-tips": `{{component:lesson-intro}}

These tips will help you get dramatically better results from Claude Code during co-work sessions.

## Tip 1: Start with Context

Before diving into code, give Claude the lay of the land:

\`\`\`
Hey Claude, I'm working on a Next.js app that uses Prisma and PostgreSQL.
I want to add a new feature: user notifications. Can you look at my
current schema and suggest how to add a notifications table?
\`\`\`

Claude works best when it understands your stack, your goal, and your constraints.

## Tip 2: Use Claude's Memory

Claude Code remembers your conversation within a session. Build on previous messages instead of starting fresh:

\`\`\`
That notification schema looks good. Now can you create the API route
to mark notifications as read? Use the same patterns you see in the
existing API routes.
\`\`\`

## Tip 3: Review Before Accepting

Claude is fast, but always review what it produces:

- Read the diff before accepting changes
- Run your tests after each change
- Ask Claude to explain anything you don't understand

## Tip 4: Break Big Tasks Down

Instead of "build me an entire auth system," try:

1. "Create the User model in Prisma"
2. "Add the signup API route"
3. "Create the login form component"
4. "Add the auth middleware"

Smaller tasks = better results = faster progress.

## Tip 5: Learn from the Output

Don't just accept Claude's code — understand it. Ask:

\`\`\`
Can you explain why you used useCallback here instead of a regular function?
\`\`\`

Co-work sessions are learning opportunities. Use them.

## Put It Into Practice

The best way to learn these tips is to try them. In your next session, focus on just one tip and see how it changes your workflow.

> Remember: the goal isn't speed — it's building something you're proud of, and learning along the way.`,

  "after-the-session": `{{component:lesson-intro}}

What you do after a Co-work session is just as important as what you do during it. Here's how to maximise the value of your time.

## Your Post-Session Checklist

{{component:post-session-checklist}}

## Reflect on Your Progress

Take 5 minutes to answer these questions:

1. **What did I accomplish?** — Even small wins count
2. **What did I learn?** — New techniques, tools, or concepts
3. **What surprised me?** — Unexpected challenges or discoveries
4. **What will I do differently next time?** — Continuous improvement

## Share with the Community

Posting about your session helps everyone:

- **Your accomplishment** inspires others to try Co-work
- **Your challenges** help others prepare for similar situations
- **Your tips** save someone else hours of frustration

## Plan Your Next Session

The best time to plan your next session is right after the current one:

- Look at what's coming up on the events page
- Set a specific goal based on where you left off
- Consider bringing a friend — Co-work is better with people you know

## You're Ready!

You've completed the Claude Cowork for Beginners course. You now know:

- What Co-work sessions are and how they work
- How to prepare and what to bring
- The session structure and what happens in each phase
- How to get help and support during sessions
- Tips for getting the best results from Claude
- How to wrap up and maintain momentum

**Your next step:** Find a session on the events page and sign up. We can't wait to see what you build!`,
};

async function main() {
  const course = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    include: { lessons: true },
  });

  if (!course) {
    console.error("Course not found:", COURSE_SLUG);
    process.exit(1);
  }

  for (const lesson of course.lessons) {
    const newContent = lessonUpdates[lesson.slug];
    if (newContent) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { content: newContent },
      });
      console.log(`Updated: ${lesson.title}`);
    } else {
      console.log(`Skipped (no update): ${lesson.title}`);
    }
  }

  console.log("\nAll lessons updated with interactive content!");
  process.exit(0);
}

main().catch(console.error);
