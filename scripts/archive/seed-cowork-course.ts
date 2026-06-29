import prisma from "../src/lib/prisma";

async function main() {
  const courseId = "cmn4g36lp000009jo31qp6mw9";

  const lessons = [
    {
      title: "What is Claude Co-work?",
      slug: "what-is-claude-cowork",
      order: 1,
      isPreview: true,
      duration: "5 min",
      content: `# What is Claude Co-work?

Claude Co-work is a collaborative, in-person working session where community members come together to build, create, and learn using Claude AI. Think of it as a co-working session specifically designed for people who use Claude in their daily work.

## The Format

Each Co-work session typically runs for 2\u20133 hours. You bring your laptop, pick a project to work on, and join a room full of like-minded builders. There is no formal presentation or lecture \u2014 just focused work time, with the added benefit of having experienced Claude users around you for help, feedback, and inspiration.

## Who Attends?

Our Co-work sessions attract a wide range of attendees:

- **Professional developers** working on production codebases
- **Vibe coders** building their first apps with Claude
- **Startup founders** prototyping new ideas
- **Freelancers and agency developers** working on client projects
- **Students** learning AI-assisted development

## Why It Works

Working alongside others creates natural accountability and serendipitous knowledge sharing. You might overhear someone solving a problem you have been stuck on, or discover a Claude workflow you had never considered. The casual environment makes it easy to ask questions and share tips without the pressure of a formal workshop.`,
    },
    {
      title: "Preparing for Your First Session",
      slug: "preparing-for-first-session",
      order: 2,
      isPreview: false,
      duration: "8 min",
      content: `# Preparing for Your First Session

A little preparation goes a long way. Here is how to set yourself up for a productive Co-work session.

## Before the Day

### 1. Choose a Project
Come with something specific to work on. This could be:
- A side project you have been meaning to start
- A feature at work you want to prototype
- A tutorial or course you want to work through
- An existing project where you are stuck and want feedback

### 2. Set Up Your Environment
Make sure your development environment is ready before you arrive:
- **Claude Pro or Team subscription** active (or free tier if you are exploring)
- Your IDE installed and configured (VS Code, Cursor, etc.)
- Any project dependencies installed
- Git repos cloned and up to date

### 3. Have a Goal
Set a clear, achievable goal for the session. Something like:
- "Build the landing page for my new project"
- "Set up authentication for my app"
- "Refactor my API routes using Claude"

Vague goals like "play around with Claude" tend to lead to unfocused sessions.

## What to Bring

- **Laptop** with charger (essential!)
- **Headphones** for focused work periods
- **Water bottle** \u2014 stay hydrated
- **Notebook** for jotting down ideas and tips from others

## What NOT to Worry About

- You do not need to be an expert \u2014 all skill levels are welcome
- You do not need to present or demo anything (though you can if you want to)
- You do not need to know anyone \u2014 the format naturally encourages conversation`,
    },
    {
      title: "The Co-work Session Structure",
      slug: "session-structure",
      order: 3,
      isPreview: false,
      duration: "6 min",
      content: `# The Co-work Session Structure

While every Co-work is slightly different, here is the typical flow.

## Arrival & Setup (15 minutes)

Grab a seat, set up your laptop, and say hello to people around you. There is usually tea, coffee, and light snacks available. This is a great time to meet new people casually.

## Quick Intros (10 minutes)

Everyone does a brief round of introductions \u2014 just your name, what you are working on, and what you hope to accomplish in the session. This helps people find others working on similar things and identifies who might be able to help with what.

## Focused Work Block 1 (45\u201360 minutes)

The main event. Headphones on, heads down, building things. This is your protected focus time. The room goes quiet (or quietly productive) as everyone digs into their projects.

During this time:
- Work on your project with Claude
- Ask your neighbours for quick help if you are stuck
- Take notes on interesting prompts or workflows you discover

## Community Break (15 minutes)

Structured social time. Stretch your legs, grab a coffee, and chat with other attendees. This is where the magic happens \u2014 casual conversations about what you are building, problems you have hit, and Claude tips you have discovered.

## Focused Work Block 2 (45\u201360 minutes)

Back to work with fresh energy and possibly new ideas from the break. Many people shift focus during this block based on something they learned in the first session.

## Show & Tell (15 minutes)

Optional but encouraged. Anyone who wants to can do a 2-minute demo of what they built or learned during the session. No slides needed \u2014 just share your screen and walk through what you accomplished. This is always the highlight of the session.

## Wrap-Up

Exchange contact details, join the online community if you have not already, and check the calendar for the next Co-work session in your city.`,
    },
    {
      title: "Getting Help During Co-work",
      slug: "getting-help",
      order: 4,
      isPreview: false,
      duration: "5 min",
      content: `# Getting Help During Co-work

One of the biggest advantages of Co-work over working alone is access to help. Here is how to make the most of it.

## Ask Your Neighbours

The people sitting next to you are your first resource. A quick "Hey, have you ever dealt with..." often leads to a 2-minute conversation that saves you an hour of debugging.

**Good questions to ask:**
- "Has anyone here worked with [specific technology]?"
- "I am getting this error \u2014 has anyone seen this before?"
- "Can I show you my Claude prompt? I feel like I am not getting good results."
- "What approach would you take for [specific problem]?"

## Share Your Screen

Sometimes the best way to get help is to show someone what you are working on. Do not be shy about it \u2014 people love helping, and seeing different codebases and approaches is genuinely interesting.

## Help Others

If you overhear someone struggling with something you know about, offer to help. The community culture is built on mutual support. Even if you are a beginner, you might have fresh eyes that spot something an experienced developer missed.

## Use the Community Channel

Each Co-work session usually has a dedicated channel in the online community. Post questions, share links, or coordinate pair programming during the session.

## Pair Programming

Some of the best Co-work outcomes come from spontaneous pair programming. If you and another attendee are working on similar problems, consider teaming up for a focused session. One person drives, the other navigates \u2014 and Claude assists both of you.`,
    },
    {
      title: "Claude Tips for Co-work Sessions",
      slug: "claude-tips",
      order: 5,
      isPreview: false,
      duration: "10 min",
      content: `# Claude Tips for Co-work Sessions

Make the most of your Co-work time with these practical Claude workflows.

## Start with a Clear Brief

Before you start prompting Claude, write a brief for your session goal. Include:
- What you are building
- The tech stack you are using
- What "done" looks like for this session

Paste this as context at the start of your Claude conversation. It saves time and produces better results.

## Use Projects for Context

If you are using Claude Pro, set up a Project with your codebase context before the session. Upload key files, README, and any relevant documentation. This means Claude understands your project from the first message.

## The "Teach Me" Pattern

A great Co-work workflow for learners:
1. Ask Claude to explain the concept you are learning
2. Ask it to generate a small example
3. Modify the example yourself
4. Ask Claude to review your changes

This is much more effective than just asking Claude to build everything for you.

## The "Pair Programming" Pattern

When building features:
1. Describe the feature to Claude in plain English
2. Review the generated code \u2014 do not just copy-paste
3. Ask Claude to explain any parts you do not understand
4. Make manual adjustments based on your domain knowledge
5. Ask Claude to review your final version

## The "Debug Together" Pattern

When you are stuck:
1. Paste the error message and relevant code
2. Ask Claude to explain what is going wrong
3. Ask for 2\u20133 possible solutions
4. Try the most likely solution
5. If it does not work, share the new error and iterate

## Share Your Prompts

One of the best things about Co-work is learning how other people prompt Claude. If you discover an effective prompt pattern, share it with the group during the break or in show-and-tell. The community maintains a shared library of effective prompts.

## Time-Boxing

Set a timer for each task. If Claude and you cannot solve something in 15 minutes, it might be time to:
- Take a different approach
- Ask a neighbour for help
- Move on and come back to it later`,
    },
    {
      title: "After the Session",
      slug: "after-the-session",
      order: 6,
      isPreview: false,
      duration: "4 min",
      content: `# After the Session

The value of a Co-work session extends well beyond the hours you spend there.

## Commit Your Work

Before you pack up, make sure to commit and push your work. There is nothing worse than losing momentum because you forgot to save your progress.

## Share in the Community

Post about what you built in the online community feed. Include:
- What you worked on
- What you accomplished
- Any interesting Claude techniques you discovered
- Screenshots or demos if you have them

This helps other members learn and keeps the community engaged between sessions.

## Connect with People You Met

Follow up with anyone you had a good conversation with. The online community makes it easy to stay connected between sessions. Some of the strongest professional relationships in our community started with a casual chat at Co-work.

## Review Your Notes

If you jotted down tips, prompts, or ideas during the session, review them while they are fresh. Add them to your personal knowledge base or project documentation.

## Plan for Next Time

Check the events calendar for the next Co-work session in your city. Regular attendance compounds \u2014 each session you build on relationships and knowledge from previous ones.

## Give Feedback

The organisers are always looking to improve the Co-work format. If you have suggestions \u2014 venue, timing, format changes \u2014 share them in the community or directly with the organisers.

---

**Congratulations!** You have completed the Claude Cowork for Beginners course. You are now ready to get the most out of any Co-work session. See you at the next one!`,
    },
  ];

  for (const lesson of lessons) {
    await prisma.lesson.create({
      data: {
        ...lesson,
        courseId,
      },
    });
    console.log(`Created lesson: ${lesson.title}`);
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { isPublished: true },
  });
  console.log("Course published!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
