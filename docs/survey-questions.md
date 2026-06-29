{
  "questions": [
    {
      "id": "welcome",
      "type": "welcome-screen",
      "label": "Welcome",
      "description": "Tell us what you think."
    },
    {
      "id": "q-V3jHx5",
      "type": "rating",
      "label": "How would you rate the event overall?",
      "required": true,
      "min": 1,
      "max": 5,
      "minLabel": "Poor",
      "maxLabel": "Excellent"
    },
    {
      "id": "q-kY6zkf",
      "type": "rating",
      "label": "How would you rate the speaker selection?",
      "required": true,
      "min": 1,
      "max": 5,
      "minLabel": "Poor",
      "maxLabel": "Excellent"
    },
    {
      "id": "q-2ERbHU",
      "type": "multiple-choice",
      "label": "Are you using Claude Cowork?",
      "required": false,
      "choices": [
        {
          "label": "Every day",
          "value": "every-day"
        },
        {
          "label": "Regular",
          "value": "regular"
        },
        {
          "label": "Beginner",
          "value": "beginner"
        },
        {
          "label": "Never",
          "value": "never"
        }
      ]
    },
    {
      "id": "q-kfgUCn",
      "type": "multiple-choice",
      "label": "Are you using Claude Code?",
      "required": false,
      "choices": [
        {
          "label": "Every day",
          "value": "every-day"
        },
        {
          "label": "Regular",
          "value": "regular"
        },
        {
          "label": "Beginner",
          "value": "beginner"
        },
        {
          "label": "Never",
          "value": "never"
        }
      ]
    },
    {
      "id": "q-Uzg1Ke",
      "type": "multi-select",
      "label": "What did you like the most?",
      "description": "Pick your top 2–3",
      "choices": [
        {
          "label": "The speakers and their topics",
          "value": "speakers"
        },
        {
          "label": "Networking with other attendees",
          "value": "networking"
        },
        {
          "label": "Practical, actionable takeaways",
          "value": "actionable"
        },
        {
          "label": "The venue and overall atmosphere",
          "value": "venue-atmosphere"
        },
        {
          "label": "The Q&A / discussion segments",
          "value": "qa-discussion"
        },
        {
          "label": "Learning what others are doing",
          "value": "peer-learning"
        },
        {
          "label": "Other",
          "value": "other"
        }
      ]
    },
    {
      "id": "q-433ptw",
      "type": "multi-select",
      "label": "What was missing, or what could we improve?",
      "description": "Select all that apply",
      "choices": [
        {
          "label": "More time for networking",
          "value": "more-networking"
        },
        {
          "label": "More hands-on / interactive segments",
          "value": "more-interactive"
        },
        {
          "label": "More technical depth",
          "value": "more-technical"
        },
        {
          "label": "More beginner-friendly content",
          "value": "more-beginner"
        },
        {
          "label": "More diverse speaker topics",
          "value": "more-diverse-topics"
        },
        {
          "label": "Better venue or logistics",
          "value": "better-venue"
        },
        {
          "label": "Longer event",
          "value": "longer-event"
        },
        {
          "label": "Shorter event",
          "value": "shorter-event"
        },
        {
          "label": "Other",
          "value": "other"
        }
      ]
    },
    {
      "id": "q-7M31bg",
      "type": "long-text",
      "label": "If you could outsource something to AI in your capacity today, what would it be?",
      "required": true
    },
    {
      "id": "q-Wz8RsK",
      "type": "long-text",
      "label": "Walk me through your most repetitive task of the week",
      "required": true
    },
    {
      "id": "q-qLY2qM",
      "type": "long-text",
      "label": "What are you struggling with right now? ",
      "description": "Either in Claude Chat, Code, or Cowork, or in trying to solve a business problem with AI.",
      "required": true
    },
    {
      "id": "q-92Tyz_",
      "type": "long-text",
      "label": "Anything else you want to share?",
      "placeholder": "Highlights, suggestions, ideas for next time...",
      "required": false
    }
  ]
}