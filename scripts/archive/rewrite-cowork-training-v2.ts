import prisma from "../src/lib/prisma";

const COURSE_SLUG = "claude-cowork-training";

const lessonRewrites: Record<string, { title: string; content: string; duration: string }> = {
  "setting-up-claude-code": {
    title: "Getting Started with Claude Cowork",
    duration: "10 min",
    content: `{{component:lesson-intro}}

## What is Claude Cowork?

Claude Cowork is Anthropic's desktop AI agent that brings the power of Claude Code to everyone — no coding required. It works directly on your computer, reading and writing files, creating documents, analysing data, and completing complex multi-step tasks on your behalf.

Think of it as having an expert assistant that can actually _do_ things on your machine, not just chat about them.

## What You Need

- **Claude Desktop app** — Download from claude.ai for macOS or Windows (x64)
- **A paid subscription** — Pro ($20/mo), Max, Team, or Enterprise
- **Internet connection** — Must stay connected while Cowork runs tasks

## Switching to Cowork Mode

1. Open the **Claude Desktop** app
2. Look at the top of the window — you'll see **Chat** and **Cowork** tabs
3. Click **Cowork** to switch to Tasks mode
4. That's it — you're in Cowork

## Your First Task

Try something simple to see how it works:

\`\`\`
Organise all the files on my Desktop into folders by type —
PDFs in one folder, images in another, documents in another.
Show me what you plan to do before moving anything.
\`\`\`

Claude will:
1. **Analyse** your request and make a plan
2. **Show you** what it intends to do
3. **Wait for your approval** before executing
4. **Complete the task** and report back

> Important: Claude Desktop must stay open while tasks run. Closing the app or putting your computer to sleep will stop the task.

## How Cowork is Different from Chat

| Feature | Chat | Cowork |
|---------|------|--------|
| Reads your files | No | Yes |
| Creates documents | No | Yes (Excel, slides, reports) |
| Multi-step tasks | Limited | Full autonomous execution |
| Works while you step away | No | Yes |
| File system access | No | Yes, with your permission |

## Safety First

Cowork runs in a controlled environment but does access files you give it permission to. Always:

- **Review the plan** before clicking approve
- **Start with non-sensitive files** while you're learning
- **Check the output** — Claude is powerful but not infallible`,
  },

  "prompting-fundamentals": {
    title: "Working with Files and Folders",
    duration: "12 min",
    content: `{{component:lesson-intro}}

## Giving Cowork Access to Your Files

When you start a Cowork task, you can point Claude at specific folders on your computer. This is how it knows what to work with.

### Selecting Folders

Click the folder icon in Cowork to choose which directories Claude can access. Be specific — don't give it your entire hard drive. Point it at the folder relevant to your task.

### Folder Instructions

You can add context about a folder that Claude will remember:

\`\`\`
This folder contains client invoices from 2025.
They're a mix of PDF and Excel files.
The naming convention is: ClientName_InvoiceNumber_Date.
\`\`\`

This helps Claude understand what it's working with before it starts.

## File Tasks You Can Do Right Now

### Organise and Rename
\`\`\`
Sort all files in my Downloads folder from the last month.
Move them into subfolders by type: Documents, Images,
Spreadsheets, Other. Rename anything with a messy filename
to something descriptive.
\`\`\`

### Process Receipts
\`\`\`
Look at all the receipt photos in my Expenses folder.
Create an Excel spreadsheet with columns: Date, Vendor,
Amount, Category. Extract the info from each receipt image
and populate the spreadsheet.
\`\`\`

### Clean Up Duplicates
\`\`\`
Find duplicate files in my Documents folder. Show me a list
of duplicates with their file sizes. Don't delete anything
yet — just show me what you found.
\`\`\`

## Creating Documents

Cowork excels at creating polished documents from rough inputs:

### Spreadsheets with Real Formulas
\`\`\`
Create a monthly budget tracker in Excel. Include categories
for rent, groceries, transport, entertainment, savings.
Add formulas that calculate totals, percentage of income,
and a running balance. Include conditional formatting —
red if over budget, green if under.
\`\`\`

### Reports from Notes
\`\`\`
I've got meeting notes in notes.txt. Turn them into a
professional meeting summary with action items, owners,
and deadlines. Save it as a Word document.
\`\`\`

### Presentations from Ideas
\`\`\`
Create a 10-slide presentation about our Q1 results.
Use the data in q1-results.csv. Include charts for
revenue trends and customer growth. Keep the style
clean and professional.
\`\`\`

## Global Instructions

Go to **Settings > Cowork** to set standing instructions that apply to every task:

\`\`\`
Always use Australian English spelling.
When creating spreadsheets, use the date format DD/MM/YYYY.
Save all output files to my Documents/Claude Output folder.
\`\`\`

These persist across sessions so you don't have to repeat yourself.`,
  },

  "building-a-feature": {
    title: "Research and Analysis Tasks",
    duration: "12 min",
    content: `{{component:lesson-intro}}

## Cowork as Your Research Assistant

One of Cowork's most powerful use cases is research — it can gather information, synthesise sources, and produce structured outputs.

## Web Research

\`\`\`
Research the top 5 project management tools for small teams
in Australia. Compare pricing, features, and integrations.
Create a comparison spreadsheet and a one-page summary
with your recommendation.
\`\`\`

Claude will search the web, compile findings, and deliver a polished comparison — not just a chat response, but actual files on your computer.

## Analysing Your Own Data

### CSV and Spreadsheet Analysis
\`\`\`
Analyse the sales data in sales-2025.csv. I want to know:
1. Total revenue by month
2. Top 10 customers by spend
3. Which products are trending up vs down
4. Any outliers or anomalies

Create charts for each insight and save everything
as an Excel workbook with separate tabs.
\`\`\`

### Document Analysis
\`\`\`
Read all the PDF contracts in my Contracts folder.
Create a summary spreadsheet with: Client name,
contract start date, end date, renewal terms,
and total value. Flag any contracts expiring
in the next 90 days.
\`\`\`

### Survey and Feedback Analysis
\`\`\`
I have 200 customer feedback responses in feedback.csv.
Analyse the sentiment, identify the top 5 themes,
and create a report with specific quotes that
illustrate each theme. Include a chart showing
sentiment distribution.
\`\`\`

## Building a Knowledge Base

\`\`\`
I have 50 meeting transcripts in my Meetings folder.
Go through all of them and create:
1. A master list of all decisions made
2. A list of all action items with owners and status
3. A summary of recurring topics
Save everything in a new folder called Meeting Insights.
\`\`\`

## Tips for Better Research Tasks

- **Be specific about output format** — "Create a spreadsheet" not "tell me about"
- **Ask for sources** — "Include links to where you found each data point"
- **Set scope boundaries** — "Focus on Australian companies only" or "Only look at data from 2025"
- **Request multiple formats** — "Give me both a detailed report and a one-page executive summary"`,
  },

  "debugging-with-claude": {
    title: "Projects and Ongoing Work",
    duration: "10 min",
    content: `{{component:lesson-intro}}

## What Are Cowork Projects?

Projects are persistent workspaces in Cowork where Claude remembers context across sessions. Instead of starting fresh every time, you can pick up where you left off.

## Creating a Project

1. In Cowork, click **New Project**
2. Give it a name (e.g. "Q1 Reporting" or "Job Applications")
3. Attach the relevant folders
4. Add project instructions — context Claude should always know

### Example Project Instructions
\`\`\`
This project tracks my freelance business finances.
My business name is Smith Design Co. ABN: 12 345 678 901.
I charge $150/hr for design work and $120/hr for consulting.
All amounts are in AUD. Financial year is July-June.
\`\`\`

Now every task in this project has that context automatically.

## Using Projects for Recurring Work

### Weekly Report Project
Set up once:
\`\`\`
Project: Weekly Client Reports
Folders: /Reports, /Client Data
Instructions: Create weekly status reports for each active
client. Use the template in /Reports/template.docx.
Pull latest data from the matching CSV in /Client Data.
\`\`\`

Then each week, just say:
\`\`\`
Generate this week's reports.
\`\`\`

Claude knows the template, the data location, and the format.

### Job Application Project
\`\`\`
Project: Job Search 2026
Folders: /Job Search
Instructions: My CV is at cv-2026.pdf. When I share a job
listing, create a tailored cover letter and update my CV
highlights to match the role. Save in a subfolder named
after the company.
\`\`\`

Then for each application:
\`\`\`
Here's a job listing for Senior Designer at Canva.
Prepare my application materials.
\`\`\`

## Assign Tasks from Your Phone

On Pro and Max plans, you can message Claude a task from your phone and Cowork will complete it on your desktop:

\`\`\`
Hey Claude, pull together the monthly expense report
from my receipts folder. I'll review it when I'm
back at my desk.
\`\`\`

Your desktop does the work. You review it later. Your computer needs to be on and Claude Desktop open.

## Memory Across Sessions

Within a project, Claude remembers:
- Previous conversations and decisions
- Your preferences and corrections
- Context about the files and data
- Standing instructions you've set

> Note: Memory only persists within projects, not in standalone one-off tasks. If you're doing something you'll want to continue, make it a project.`,
  },

  "refactoring-code-quality": {
    title: "Advanced Cowork Techniques",
    duration: "10 min",
    content: `{{component:lesson-intro}}

## Computer Use

Cowork can now use your computer directly — opening apps, navigating browsers, filling in forms, and interacting with software.

### Example: Data Entry
\`\`\`
Open the spreadsheet at expenses.xlsx, then log into
our Xero account and enter each expense line item.
Use the categories I've marked in column D.
\`\`\`

### Example: Web Automation
\`\`\`
Go to our company's job listing on Seek.com.au and
download all the application PDFs from the last week.
Save them in the Applications folder, named by
applicant name and date.
\`\`\`

## Scheduled Tasks

Set up tasks that run automatically:

\`\`\`
Every Monday at 9am, check my email for any invoices
received over the weekend. Download them, extract the
key details, and add them to my invoice tracker
spreadsheet.
\`\`\`

## Integration with External Tools

Enterprise and Team plans can connect Cowork to:

- **Google Drive** — Read and write files directly
- **Gmail** — Process and draft emails
- **DocuSign** — Handle document signing workflows
- **Spreadsheet tools** — Excel, Google Sheets, CSV processing

## Chaining Complex Workflows

The real power is combining capabilities:

\`\`\`
1. Read all the customer feedback emails from this week
   (they're in my Feedback folder)
2. Categorise each piece of feedback by theme
3. Create a summary report with sentiment analysis
4. Draft a response email for any negative feedback
5. Save the report as PDF and the draft responses
   in separate files
6. Update the feedback tracker spreadsheet
\`\`\`

Claude breaks this into subtasks, executes them in order, and delivers everything.

## Optimising Your Usage

Cowork uses significantly more compute than regular chat. To get the most from your plan:

- **Batch related tasks** — One session for "process all receipts" rather than one per receipt
- **Use projects** — Context from previous sessions means less back-and-forth
- **Be specific upfront** — Clear instructions = fewer clarification loops = less usage
- **Reserve Cowork for complex tasks** — Simple questions are better in regular Chat

## When NOT to Use Cowork

- Quick questions → Use Chat instead
- Sensitive credentials → Never give Cowork your passwords
- Irreversible actions → Always review the plan first
- Regulated data → Cowork activity isn't in audit logs`,
  },

  "shipping-in-cowork": {
    title: "Cowork Quick Reference",
    duration: "8 min",
    content: `{{component:lesson-intro}}

## Setup Checklist

{{component:prep-checklist}}

## Common Tasks Cheat Sheet

### File Management
- "Organise my Downloads folder by file type"
- "Find and list all duplicate files in Documents"
- "Rename all photos in this folder using the date taken"
- "Back up all .xlsx files from 2025 into an archive folder"

### Document Creation
- "Turn these meeting notes into a professional summary"
- "Create a budget spreadsheet with formulas and formatting"
- "Build a presentation from this data with charts"
- "Write a report comparing these three vendor proposals"

### Research
- "Research competitors in [industry] and create a comparison table"
- "Summarise all PDFs in this folder into a single overview document"
- "Analyse this CSV and create visualisations of the key trends"

### Recurring Work
- "Generate this week's status report using the usual template"
- "Process new receipts and update the expense tracker"
- "Check for contract renewals due in the next 30 days"

### Data Processing
- "Extract all email addresses from these documents"
- "Convert this messy CSV into a clean, formatted spreadsheet"
- "Merge these three spreadsheets into one master file"

## Troubleshooting

**Task stopped unexpectedly**
→ Check that Claude Desktop stayed open and your computer didn't sleep

**Claude can't find my files**
→ Make sure you've selected the right folder in Cowork. Claude can only access folders you explicitly grant.

**Hitting usage limits quickly**
→ Batch related work into fewer, larger tasks. Use Chat for simple questions.

**Output isn't what I expected**
→ Be more specific in your instructions. Add examples of what you want. Use Global Instructions for consistent preferences.

## What's Next

Now that you know how to use Claude Cowork:

1. **Start small** — Organise a folder, create a spreadsheet, process some receipts
2. **Build a project** — Set up a persistent workspace for ongoing work
3. **Explore computer use** — Let Claude interact with apps on your behalf
4. **Share what you learn** — Post your best Cowork workflows in the community

{{component:post-session-checklist}}`,
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
    }
  }

  await prisma.course.update({
    where: { slug: COURSE_SLUG },
    data: {
      description:
        "Learn how to use Claude Cowork — Anthropic's desktop AI agent that works directly on your files. From setup to advanced workflows, this course covers file management, document creation, research tasks, projects, computer use, and more. No coding required.",
    },
  });

  console.log("\nCourse rewritten with actual Claude Cowork product training!");
  process.exit(0);
}

main().catch(console.error);
