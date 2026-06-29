"use client";

interface MentionTextProps {
  content: string;
  className?: string;
}

export default function MentionText({ content, className = "" }: MentionTextProps) {
  // Split on @mentions and URLs
  const parts = content.split(/(@\w+(?:\s\w+)?|https?:\/\/[^\s<>"')\]]+)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;
        if (part.startsWith("@")) {
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: parts come from a deterministic string split that never reorders or inserts; index keeps otherwise-identical fragments distinct.
              key={`${index}-${part}`}
              className="text-[#D4836A] font-medium hover:underline cursor-pointer"
            >
              {part}
            </span>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              // biome-ignore lint/suspicious/noArrayIndexKey: parts come from a deterministic string split that never reorders or inserts; index keeps otherwise-identical fragments distinct.
              key={`${index}-${part}`}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[#D4836A] hover:underline break-all"
            >
              {part}
            </a>
          );
        }
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: parts come from a deterministic string split that never reorders or inserts; index keeps otherwise-identical fragments distinct.
            key={`${index}-${part}`}
          >
            {part}
          </span>
        );
      })}
    </span>
  );
}
