"use client";

import { RotateCcw, Terminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "claude";
  text: string;
}

interface TypewriterDemoProps {
  conversation: Message[];
}

export default function TypewriterDemo({ conversation }: TypewriterDemoProps) {
  const [visibleMessages, setVisibleMessages] = useState<
    { role: "user" | "claude"; text: string; isTyping: boolean }[]
  >([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (currentIndex >= conversation.length) {
      setIsComplete(true);
      return;
    }

    const msg = conversation[currentIndex];

    if (msg.role === "user") {
      // User messages appear instantly with slide animation
      animationRef.current = setTimeout(() => {
        setVisibleMessages((prev) => [...prev, { role: "user", text: msg.text, isTyping: false }]);
        setCurrentIndex((prev) => prev + 1);
        scrollToBottom();
      }, 500);
    } else {
      // Claude messages: show typing indicator first, then typewrite
      if (!isTypingIndicator && charIndex === 0) {
        setIsTypingIndicator(true);
        animationRef.current = setTimeout(() => {
          setIsTypingIndicator(false);
          setVisibleMessages((prev) => [...prev, { role: "claude", text: "", isTyping: true }]);
          scrollToBottom();
        }, 1200);
        return;
      }

      if (charIndex < msg.text.length) {
        const speed = msg.text[charIndex] === " " ? 15 : 25;
        animationRef.current = setTimeout(() => {
          setVisibleMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === "claude") {
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: msg.text.slice(0, charIndex + 1),
              };
            }
            return updated;
          });
          setCharIndex((prev) => prev + 1);
          scrollToBottom();
        }, speed);
      } else {
        // Finished typing this message
        setVisibleMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0) {
            updated[lastIdx] = { ...updated[lastIdx], isTyping: false };
          }
          return updated;
        });
        setCharIndex(0);
        setCurrentIndex((prev) => prev + 1);
      }
    }

    return cleanup;
  }, [currentIndex, charIndex, isTypingIndicator, conversation, scrollToBottom, cleanup]);

  const handleReplay = () => {
    cleanup();
    setVisibleMessages([]);
    setCurrentIndex(0);
    setCharIndex(0);
    setIsTypingIndicator(false);
    setIsComplete(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <style>{`
        @keyframes tw-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes tw-slide-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tw-slide-in-left {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tw-typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes tw-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tw-cursor {
          animation: tw-cursor-blink 0.8s ease-in-out infinite;
        }
        .tw-msg-user {
          animation: tw-slide-in-right 0.3s ease-out;
        }
        .tw-msg-claude {
          animation: tw-slide-in-left 0.3s ease-out;
        }
        .tw-replay-enter {
          animation: tw-fade-in 0.4s ease-out;
        }
      `}</style>

      {/* Terminal header */}
      <div className="rounded-t-xl bg-[#1C1917] border border-white/[0.06] border-b-0 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#78716C]/40" />
            <div className="w-3 h-3 rounded-full bg-[#78716C]/40" />
            <div className="w-3 h-3 rounded-full bg-[#78716C]/40" />
          </div>
          <div className="flex items-center gap-1.5 ml-3">
            <Terminal size={13} className="text-[#78716C]" />
            <span className="text-xs text-[#78716C] font-mono">claude-cowork-session</span>
          </div>
        </div>
        {isComplete && (
          <button
            type="button"
            onClick={handleReplay}
            className="tw-replay-enter flex items-center gap-1.5 text-xs text-[#A8A29E] hover:text-[#D4836A] transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
            Replay
          </button>
        )}
      </div>

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="bg-[#1C1917] border-x border-white/[0.06] px-4 py-4 min-h-[280px] max-h-[400px] overflow-y-auto space-y-4"
      >
        {visibleMessages.map((msg, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only typewriter message list that never reorders or removes items
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`
                max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed
                ${
                  msg.role === "user"
                    ? "bg-[#D4836A]/15 text-[#E7E5E4] border border-[#D4836A]/20 tw-msg-user"
                    : "bg-[#2D2926] text-[#E7E5E4] border border-white/[0.06] tw-msg-claude"
                }
              `}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`text-[10px] font-mono mt-0.5 flex-shrink-0 ${
                    msg.role === "user" ? "text-[#D4836A]" : "text-[#78716C]"
                  }`}
                >
                  {msg.role === "user" ? "you" : "claude"}
                </span>
                <span className="whitespace-pre-wrap">
                  {msg.text}
                  {msg.isTyping && (
                    <span className="tw-cursor inline-block w-[2px] h-[14px] bg-[#D4836A] ml-[1px] align-text-bottom" />
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTypingIndicator && (
          <div className="flex justify-start">
            <div className="bg-[#2D2926] border border-white/[0.06] rounded-xl px-4 py-3 tw-msg-claude">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-[#78716C] mr-2">claude</span>
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="w-1.5 h-1.5 rounded-full bg-[#A8A29E]"
                    style={{
                      animation: "tw-typing-dot 1.4s ease-in-out infinite",
                      animationDelay: `${dot * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terminal footer */}
      <div className="rounded-b-xl bg-[#1C1917] border border-white/[0.06] border-t-0 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-[#78716C]/60 font-mono">
          {isComplete
            ? "session complete"
            : `message ${Math.min(currentIndex + 1, conversation.length)}/${conversation.length}`}
        </span>
        <div className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isComplete ? "bg-green-500/60" : "bg-[#D4836A]"}`}
          />
          <span className="text-[10px] text-[#78716C]/60 font-mono">
            {isComplete ? "done" : "streaming"}
          </span>
        </div>
      </div>
    </div>
  );
}
