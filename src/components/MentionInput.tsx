"use client";

import Image from "next/image";
import { type Ref, useCallback, useEffect, useRef, useState } from "react";

interface User {
  id: string;
  name: string;
  image: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentionedUserIds: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
}

export default function MentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder,
  className = "",
  disabled = false,
  multiline = false,
  rows = 1,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map());
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Search for users when mention query changes
  useEffect(() => {
    if (mentionQuery.length > 0) {
      const searchUsers = async () => {
        try {
          const res = await fetch(`/api/users/search?q=${encodeURIComponent(mentionQuery)}`);
          if (res.ok) {
            const users = await res.json();
            setSuggestions(users);
            setSelectedIndex(0);
          }
        } catch (error) {
          console.error("Failed to search users:", error);
        }
      };
      searchUsers();
    } else {
      setSuggestions([]);
    }
  }, [mentionQuery]);

  // Notify parent of mentioned user IDs
  useEffect(() => {
    if (onMentionsChange) {
      onMentionsChange(Array.from(mentionedUsers.keys()));
    }
  }, [mentionedUsers, onMentionsChange]);

  const detectMention = useCallback((text: string, cursorPos: number) => {
    // Look backwards from cursor to find @ symbol
    let start = cursorPos - 1;
    while (start >= 0 && text[start] !== "@" && text[start] !== " " && text[start] !== "\n") {
      start--;
    }

    if (start >= 0 && text[start] === "@") {
      const query = text.slice(start + 1, cursorPos);
      // Only show suggestions if we're actively typing a mention
      if (query.length >= 0 && !/\s/.test(query)) {
        setMentionStartPos(start);
        setMentionQuery(query);
        setShowSuggestions(true);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionQuery("");
    setMentionStartPos(-1);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newValue);
    detectMention(newValue, cursorPos);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
      case "Tab":
        if (showSuggestions && suggestions.length > 0) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  };

  const insertMention = (user: User) => {
    if (mentionStartPos === -1) return;

    const before = value.slice(0, mentionStartPos);
    const after = value.slice(mentionStartPos + mentionQuery.length + 1);
    const mentionText = `@${user.name}`;
    const newValue = `${before + mentionText} ${after}`;

    // Track this mentioned user
    setMentionedUsers((prev) => new Map(prev).set(user.id, user.name));

    onChange(newValue);
    setShowSuggestions(false);
    setMentionQuery("");
    setMentionStartPos(-1);

    // Focus and set cursor position after mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = before.length + mentionText.length + 1;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleClick = () => {
    if (inputRef.current) {
      const cursorPos = inputRef.current.selectionStart || 0;
      detectMention(value, cursorPos);
    }
  };

  const InputComponent = multiline ? "textarea" : "input";

  // Auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: value is intentionally a dep so the textarea re-measures whenever its content changes.
  useEffect(() => {
    if (multiline && inputRef.current) {
      const textarea = inputRef.current as HTMLTextAreaElement;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(textarea.scrollHeight, rows * 24)}px`;
    }
  }, [value, multiline, rows]);

  return (
    <div className="relative flex-1">
      <InputComponent
        ref={inputRef as Ref<HTMLInputElement & HTMLTextAreaElement>}
        type={multiline ? undefined : "text"}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        placeholder={placeholder}
        disabled={disabled}
        rows={multiline ? rows : undefined}
        className={`${className} ${multiline ? "overflow-hidden" : ""}`}
        style={multiline ? { minHeight: `${rows * 24}px` } : undefined}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 top-full mt-1 w-64 bg-[#2D2926] rounded-xl border border-white/[0.1] shadow-xl z-50 overflow-hidden"
        >
          {suggestions.map((user, index) => (
            <button
              type="button"
              key={user.id}
              onClick={() => insertMention(user)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                index === selectedIndex ? "bg-[#D4836A]/20" : "hover:bg-white/[0.05]"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#D4836A] flex items-center justify-center text-white text-sm font-bold shrink-0">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  user.name?.[0]?.toUpperCase() || "?"
                )}
              </div>
              <span className="text-white text-sm truncate">{user.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
