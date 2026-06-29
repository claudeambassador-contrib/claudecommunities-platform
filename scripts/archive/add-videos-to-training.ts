import prisma from "../src/lib/prisma";

// Add video/3D component markers to existing lesson content
// We prepend/insert them at strategic points

const COURSE_SLUG = "claude-cowork-training";

const insertions: Record<
  string,
  { prepend?: string; append?: string; replace?: [string, string][] }
> = {
  "setting-up-claude-code": {
    // Add 3D hero and terminal demo to Getting Started lesson
    replace: [
      // Replace the lesson-intro with a 3D hero + lesson intro
      [
        "{{component:lesson-intro}}",
        "{{component:threejs-hero-cowork}}\n\n{{component:lesson-intro}}",
      ],
      // Add terminal demo after "Your First Task" section
      [
        "> Important: Claude Desktop must stay open",
        "{{component:terminal-setup}}\n\n> Important: Claude Desktop must stay open",
      ],
      // Add task flow demo after the Chat vs Cowork table
      ["## Safety First", "{{component:task-flow}}\n\n## Safety First"],
    ],
  },
  "prompting-fundamentals": {
    // Add terminal demo and file flow to Files lesson
    replace: [
      [
        "{{component:lesson-intro}}",
        "{{component:threejs-hero-files}}\n\n{{component:lesson-intro}}",
      ],
      // Add file flow demo after "Organise and Rename" section
      ["### Process Receipts", "{{component:file-flow}}\n\n### Process Receipts"],
      // Add terminal demo after Process Receipts
      ["### Clean Up Duplicates", "{{component:terminal-files}}\n\n### Clean Up Duplicates"],
    ],
  },
  "building-a-feature": {
    // Add 3D hero and terminal demo to Research lesson
    replace: [
      [
        "{{component:lesson-intro}}",
        "{{component:threejs-hero-research}}\n\n{{component:lesson-intro}}",
      ],
      // Add terminal demo for research
      [
        "## Analysing Your Own Data",
        "{{component:terminal-research}}\n\n## Analysing Your Own Data",
      ],
      // Add task flow for research
      [
        "## Building a Knowledge Base",
        "{{component:task-flow-research}}\n\n## Building a Knowledge Base",
      ],
    ],
  },
  "debugging-with-claude": {
    // Add Cowork UI demo and terminal to Projects lesson
    replace: [
      // Add terminal demo after project creation
      [
        "## Using Projects for Recurring Work",
        "{{component:terminal-project}}\n\n## Using Projects for Recurring Work",
      ],
      // Add Cowork UI demo at start
      ["{{component:lesson-intro}}", "{{component:lesson-intro}}\n\n{{component:cowork-ui}}"],
    ],
  },
  "refactoring-code-quality": {
    // Add network graph and task flow to Advanced lesson
    replace: [
      // Add network graph for integrations section
      [
        "## Integration with External Tools",
        "{{component:network-graph}}\n\n## Integration with External Tools",
      ],
    ],
  },
  "shipping-in-cowork": {
    // Add floating files 3D to Quick Reference
    replace: [
      ["{{component:lesson-intro}}", "{{component:lesson-intro}}\n\n{{component:floating-files}}"],
    ],
  },
};

async function main() {
  const course = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    include: { lessons: true },
  });

  if (!course) {
    console.error("Course not found");
    process.exit(1);
  }

  for (const lesson of course.lessons) {
    const ins = insertions[lesson.slug];
    if (!ins) continue;

    let content = lesson.content;

    if (ins.replace) {
      for (const [find, replace] of ins.replace) {
        content = content.replace(find, replace);
      }
    }

    if (ins.prepend) {
      content = ins.prepend + "\n\n" + content;
    }

    if (ins.append) {
      content = content + "\n\n" + ins.append;
    }

    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { content },
    });
    console.log(`Updated: ${lesson.title}`);
  }

  console.log("\nAll lessons updated with video and 3D components!");
  process.exit(0);
}

main().catch(console.error);
