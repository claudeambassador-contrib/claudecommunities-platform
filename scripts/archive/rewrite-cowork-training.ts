import prisma from "../src/lib/prisma";

const COURSE_SLUG = "claude-cowork-training";

const lessonRewrites: Record<string, { title: string; content: string; duration: string }> = {
  "setting-up-claude-code": {
    title: "Before Your First Co-work",
    duration: "8 min",
    content: `{{component:lesson-intro}}

## What to Expect

A Claude Co-work session is a community gathering where everyone works on their own projects — together. There are no presentations, no lectures, no set agenda. You bring your laptop, pick a project, and work alongside other Claude users for 2-3 hours.

Think of it like a library study group meets a casual hackathon, minus the competition.

## The Session Format

Every co-work follows the same structure so you always know what to expect:

{{component:session-timeline}}

## Who's in the Room?

Sessions attract all kinds of people:

- **Professional developers** shipping features at work
- **Vibe coders** building their first app with Claude
- **Startup founders** prototyping MVPs
- **Freelancers** working on client projects
- **Students** learning AI-assisted development
- **Hobbyists** building side projects for fun

There's no minimum skill level. If you can open a laptop, you're qualified.

## What to Bring

{{component:prep-checklist}}

## Setting a Session Goal

The single most important thing you can do before a co-work is **decide what you want to work on**. Your goal should be:

- **Specific** — "Add a contact form to my portfolio site" not "work on my site"
- **Achievable in 45-60 minutes** — Scope it for the deep work block
- **Something you care about** — Motivation matters when you hit a wall

> Don't have a project? That's fine. Come with "explore Claude Code for the first time" — the facilitator can help you find something to work on.`,
  },

  "prompting-fundamentals": {
    title: "Making the Most of Deep Work",
    duration: "10 min",
    content: `{{component:lesson-intro}}

## The Deep Work Block

The core of every co-work is 45-60 minutes of focused building time. This is where the real value happens. Here's how to make every minute count.

## Setting Up Your Space

When you arrive:

1. **Find a seat** — anywhere is fine, but sitting near someone working on similar tech can lead to helpful exchanges
2. **Put on headphones** — even without music, they signal "I'm in focus mode"
3. **Close distractions** — Slack, email, social media. You've got 45 minutes. Protect them.
4. **Open your project + Claude** — Have your IDE and Claude Code ready before the timer starts

## Working with Claude During Co-work

The beauty of co-work is that you have Claude as your pair programmer AND humans nearby if you need a second opinion. Here's how to use both effectively:

### Start by orienting Claude

\`\`\`
I'm at a co-work session and have 45 minutes. My goal is to
add a dark mode toggle to my React app. Let's start by looking
at my current setup and making a plan.
\`\`\`

### Keep momentum with small asks

Don't try to build everything in one giant prompt. Break it into steps:

\`\`\`
Step 1: Create the ThemeProvider context
\`\`\`
Then review, test, and continue:
\`\`\`
Step 2: Add the toggle button to the header
\`\`\`

### When you're stuck, say so

\`\`\`
I've been going back and forth on this for 10 minutes.
The dark mode works but the transition is flickering.
Can you diagnose what's causing the flash of white?
\`\`\`

{{component:claude-conversation-demo}}

## The "Ask Your Neighbour" Rule

If you've been stuck for more than 10 minutes:

1. **First** — Ask Claude to approach the problem differently
2. **Then** — Raise your hand or message in the session chat
3. **Or** — Tap the person next to you: "Hey, have you seen this before?"

Some of the best co-work breakthroughs come from a 30-second conversation with a stranger who had the exact same problem last week.

## Tracking Your Progress

At the halfway point of deep work (~20 minutes in), do a quick self-check:

- Am I making progress on my goal?
- Am I stuck on something I should ask about?
- Do I need to adjust my scope?

It's perfectly fine to scale down. "I planned to build the whole feature but I'm going to focus on getting the data layer right" is a great outcome.`,
  },

  "building-a-feature": {
    title: "Collaborating at Co-work",
    duration: "10 min",
    content: `{{component:lesson-intro}}

## The Social Side of Co-work

Co-work isn't just about solo productivity — the community aspect is what makes it special. Here's how to get the most from the people around you.

## During Check-in

When it's your turn to share what you're working on, keep it to one sentence:

- "I'm adding user authentication to my side project"
- "I'm exploring Claude Code for the first time"
- "I'm debugging a nasty race condition at work"

This helps the facilitator know who might benefit from sitting near each other, and lets others know who to ask if they hit a similar problem.

## Pair Programming Naturally

Co-work sessions often produce spontaneous pair programming. If someone nearby is working on something interesting:

- **Ask before hovering** — "Mind if I watch for a sec? I'm curious how you're doing that"
- **Offer help casually** — "I've dealt with that Prisma error before, want me to take a look?"
- **Time-box it** — Help for 5-10 minutes, then both get back to your own work

## The Coffee Break

The mid-session break is structured social time. This is where you:

- Share what you've discovered so far
- Compare notes on Claude workflows
- Ask questions you didn't want to interrupt deep work for
- Meet people you might collaborate with later

Don't skip the break to keep working. The connections you make here are half the value of showing up.

## Working with the Facilitator

The facilitator is there to help. They can:

- Help you scope your goal at the start
- Unstick you if Claude isn't cooperating
- Connect you with someone who has relevant experience
- Keep the session on track and on time

Don't hesitate to flag them down — that's literally why they're there.

## Co-work Etiquette

A few unwritten rules:

- **Headphones on = focus mode** — Don't interrupt someone with headphones unless it's important
- **Headphones off = open to chat** — Fair game for a quick question
- **Keep voice low** — Others are concentrating
- **Share the power outlets** — Bring your charger but be mindful of limited sockets
- **Clean up after yourself** — Leave the space as you found it

{{component:session-quiz}}`,
  },

  "debugging-with-claude": {
    title: "Show & Tell",
    duration: "8 min",
    content: `{{component:lesson-intro}}

## Why Show & Tell Matters

The last 15 minutes of every co-work is Show & Tell — where participants voluntarily share what they built, learned, or struggled with. This is often the most valuable part of the session.

**You don't need to have finished something.** The best Show & Tell moments are often:

- "I tried three approaches and none worked, but here's what I learned"
- "I only got one thing done but it was the thing blocking me for a week"
- "I discovered this Claude workflow that saved me 20 minutes"

## How to Present (2 Minutes Max)

Keep it short and structured:

### 1. What was your goal?
One sentence. "I wanted to add a search feature to my app."

### 2. What did you actually do?
Show your screen — the code, the working feature, or even the error message. "I got the backend working but the UI needs another session."

### 3. One takeaway
The most useful thing to share: "I learned that Claude works way better when you show it the existing code patterns first."

## Why You Should Present (Even If It Feels Awkward)

- **Teaching solidifies learning** — Explaining what you built helps you understand it better
- **You inspire others** — Someone in the room is thinking "I could do that too"
- **You get feedback** — "Oh, I solved that exact problem last month — try using X instead"
- **It builds your reputation** — People remember the person who shared that clever trick

## Being a Good Audience

When others present:

- **Listen actively** — Put your laptop aside for 15 minutes
- **Ask questions** — "How did you get Claude to do that?" is always a good one
- **Offer follow-ups** — "I know a library that might help with that" is gold
- **Clap** — Seriously. Celebrating small wins creates a culture where people feel safe sharing

## What If Nothing Worked?

Share that too. "I spent 45 minutes trying to fix this CORS error and I'm still stuck" is valuable because:

1. Someone might have the answer right now
2. Others learn what pitfalls to avoid
3. It normalises struggle — nobody ships every session

> The only bad Show & Tell is no Show & Tell. Say something, even if it's just "I learned that I need to read the docs more carefully."`,
  },

  "refactoring-code-quality": {
    title: "Building a Co-work Habit",
    duration: "8 min",
    content: `{{component:lesson-intro}}

## From One Session to a Practice

The biggest gains from co-work come from consistency. One session is fun — a regular practice is transformative.

## Why Regularity Matters

People who attend co-work regularly report:

- **Shipping more** — The accountability of "I told the group I'd finish this" is powerful
- **Learning faster** — You absorb techniques from different people each session
- **Expanding your network** — The same faces become collaborators, mentors, even cofounders
- **Breaking isolation** — Working with AI can be lonely. Co-work fixes that.

## Creating Your Rhythm

### Weekly Attendees
If there's a weekly session near you, try to make it a recurring calendar event. The predictability helps — you plan your week knowing "Thursday afternoon is co-work time."

### Fortnightly or Monthly
If sessions are less frequent, use the gap to:
- Build up a backlog of tasks perfect for co-work
- Continue conversations from the last session async
- Post progress updates in the community feed

### Can't Attend In-Person?
Online co-work sessions follow the same format. Join from anywhere with a stable internet connection. The chat becomes your "tap your neighbour" mechanism.

## Between Sessions

### Post in the Community
After each session, write a short post:
- What you worked on
- What you accomplished
- What you're planning for next time

This creates a public log of your progress and inspires others.

### Set Your Next Goal
The best time to plan your next session is right after the current one. While context is fresh, write down:
- What you'll work on next
- What questions you want to ask
- Who you want to connect with

### Practice Solo
Use the co-work structure even when working alone:
- Set a 45-minute timer
- State your goal out loud (or write it down)
- Work with Claude in focused mode
- Review what you accomplished

The structure works whether or not there's a room full of people around you.

## Finding Sessions

Check the community events page for upcoming co-work sessions in your city. Sessions run in Sydney, Melbourne, Brisbane, Perth, Adelaide, and more.

Can't find one? Consider hosting your own — the community team can help you get started.`,
  },

  "shipping-in-cowork": {
    title: "Your Co-work Toolkit",
    duration: "8 min",
    content: `{{component:lesson-intro}}

## Quick Reference: Session Checklist

### Before the Session
{{component:prep-checklist}}

### During the Session

**Check-in (5 min)**
- Share your name and one-sentence goal
- Listen to what others are working on — note who's doing something similar

**Deep Work (45-60 min)**
- Start Claude with context about your goal
- Work in small steps — prompt, review, test, repeat
- Ask for help if stuck for more than 10 minutes
- Do a halfway self-check at the 20-minute mark

**Coffee Break (15 min)**
- Step away from your screen
- Talk to at least one person you haven't met
- Share a discovery or ask a question

**Show & Tell (15 min)**
- Volunteer to share — even 30 seconds counts
- Show your screen, explain your goal, share one takeaway
- Ask questions when others present

### After the Session
{{component:post-session-checklist}}

## Common First-Session Scenarios

**"I don't know what to work on"**
Tell the facilitator during check-in. They'll help you find a starter project or pair you with someone to shadow.

**"I'm too beginner"**
Perfect. Co-work is the fastest way to level up because you have Claude + humans + focused time. Start with "Help me build a simple to-do app" and see where it goes.

**"I'm too advanced for this"**
Experienced developers get value from: shipping side projects, mentoring others (which deepens your own understanding), and discovering new Claude workflows from people who use it differently than you.

**"I'm nervous about Show & Tell"**
Nobody judges. Start with "I'm new, I tried X, I learned Y" — that takes 15 seconds and the room will be supportive.

**"I didn't finish anything"**
Neither did half the room. Progress > completion. Share what you learned.

## You're Ready

You've completed the Claude Co-work Training. You know:

- How to prepare and set goals for a session
- How to maximise your deep work time with Claude
- How to collaborate and get help from the community
- How to present in Show & Tell (even when things don't work)
- How to build a consistent co-work practice
- What to do in every scenario

**Your next step:** Find a co-work session on the events page and sign up. We'll see you there.`,
  },
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
    const rewrite = lessonRewrites[lesson.slug];
    if (rewrite) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          title: rewrite.title,
          content: rewrite.content,
          duration: rewrite.duration,
        },
      });
      console.log(`Rewritten: ${lesson.slug} → "${rewrite.title}"`);
    } else {
      console.log(`Skipped (no rewrite): ${lesson.slug}`);
    }
  }

  // Also update the course description
  await prisma.course.update({
    where: { slug: COURSE_SLUG },
    data: {
      description:
        "Everything you need to know to get the most out of Claude Co-work sessions. Learn how to prepare, set goals, collaborate with others, present in Show & Tell, and build a consistent co-work practice. Designed for first-timers and regulars alike.",
    },
  });

  console.log("\nClaude Co-work Training rewritten with co-work-specific content!");
  process.exit(0);
}

main().catch(console.error);
