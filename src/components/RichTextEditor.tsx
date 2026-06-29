"use client";

import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  minHeight?: string;
}

type FormatType = "bold" | "italic" | "code" | "link" | "heading" | "quote" | "ul" | "ol";

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  maxLength = 10000,
  className = "",
  disabled = false,
  minHeight = "120px",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);

  // Initialize editor content
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount to seed the contentEditable; reacting to `value` would clobber user input mid-edit
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Convert to markdown-like format for storage
      const text = htmlToMarkdown(html);
      if (text.length <= maxLength) {
        onChange(text);
      }
    }
  }, [onChange, maxLength]);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSavedSelection(selection.getRangeAt(0).cloneRange());
    }
  };

  const restoreSelection = () => {
    if (savedSelection) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelection);
      }
    }
  };

  const applyFormat = (format: FormatType) => {
    if (disabled) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    switch (format) {
      case "bold":
        document.execCommand("bold", false);
        break;
      case "italic":
        document.execCommand("italic", false);
        break;
      case "code":
        if (selectedText) {
          const code = document.createElement("code");
          code.className = "bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-[#D4836A]";
          code.textContent = selectedText;
          range.deleteContents();
          range.insertNode(code);
        }
        break;
      case "link":
        saveSelection();
        setLinkText(selectedText);
        setShowLinkModal(true);
        return;
      case "heading":
        if (selectedText) {
          const h3 = document.createElement("h3");
          h3.className = "text-lg font-semibold text-white mt-3 mb-1";
          h3.textContent = selectedText;
          range.deleteContents();
          range.insertNode(h3);
        }
        break;
      case "quote":
        if (selectedText) {
          const blockquote = document.createElement("blockquote");
          blockquote.className = "border-l-2 border-[#D4836A] pl-3 text-[#A8A29E] italic my-2";
          blockquote.textContent = selectedText;
          range.deleteContents();
          range.insertNode(blockquote);
        }
        break;
      case "ul":
        document.execCommand("insertUnorderedList", false);
        break;
      case "ol":
        document.execCommand("insertOrderedList", false);
        break;
    }

    handleInput();
    editorRef.current?.focus();
  };

  const insertLink = () => {
    if (!linkUrl) {
      setShowLinkModal(false);
      return;
    }

    restoreSelection();

    const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
    const text = linkText || url;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const link = document.createElement("a");
      link.href = url;
      link.className = "text-[#D4836A] hover:underline";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = text;

      range.deleteContents();
      range.insertNode(link);

      // Move cursor after link
      range.setStartAfter(link);
      range.setEndAfter(link);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    setShowLinkModal(false);
    setLinkUrl("");
    setLinkText("");
    handleInput();
    editorRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          applyFormat("bold");
          break;
        case "i":
          e.preventDefault();
          applyFormat("italic");
          break;
        case "k":
          e.preventDefault();
          applyFormat("link");
          break;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    handleInput();
  };

  const remainingChars = maxLength - value.length;

  return (
    <div className={`relative ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-white/[0.06] bg-[#1C1917] rounded-t-xl">
        <ToolbarButton
          icon={Bold}
          onClick={() => applyFormat("bold")}
          title="Bold (Ctrl+B)"
          disabled={disabled}
        />
        <ToolbarButton
          icon={Italic}
          onClick={() => applyFormat("italic")}
          title="Italic (Ctrl+I)"
          disabled={disabled}
        />
        <div className="w-px h-5 bg-white/[0.1] mx-1" />
        <ToolbarButton
          icon={LinkIcon}
          onClick={() => applyFormat("link")}
          title="Insert Link (Ctrl+K)"
          disabled={disabled}
        />
        <ToolbarButton
          icon={Code}
          onClick={() => applyFormat("code")}
          title="Inline Code"
          disabled={disabled}
        />
        <div className="w-px h-5 bg-white/[0.1] mx-1" />
        <ToolbarButton
          icon={Heading2}
          onClick={() => applyFormat("heading")}
          title="Heading"
          disabled={disabled}
        />
        <ToolbarButton
          icon={Quote}
          onClick={() => applyFormat("quote")}
          title="Quote"
          disabled={disabled}
        />
        <div className="w-px h-5 bg-white/[0.1] mx-1" />
        <ToolbarButton
          icon={List}
          onClick={() => applyFormat("ul")}
          title="Bullet List"
          disabled={disabled}
        />
        <ToolbarButton
          icon={ListOrdered}
          onClick={() => applyFormat("ol")}
          title="Numbered List"
          disabled={disabled}
        />
      </div>

      {/* Editor */}
      {/* biome-ignore lint/a11y/useSemanticElements: a contentEditable rich-text surface cannot be a native <input>/<textarea>; role="textbox" is the correct ARIA mapping */}
      <div
        ref={editorRef}
        aria-multiline="true"
        role="textbox"
        tabIndex={disabled ? -1 : 0}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`w-full bg-[#2D2926] text-white placeholder-[#78716C] focus:outline-none p-4 rounded-b-xl prose prose-invert prose-sm max-w-none ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        style={{ minHeight }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Character count */}
      {maxLength && (
        <div className="absolute bottom-2 right-3 text-xs text-[#78716C]">
          <span className={remainingChars < 200 ? "text-[#D4836A]" : ""}>{remainingChars}</span>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2D2926] rounded-xl border border-white/[0.1] w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Insert Link</h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="p-1 hover:bg-white/[0.05] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#78716C]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="rte-link-text" className="block text-sm text-[#A8A29E] mb-1.5">
                  Link Text
                </label>
                <input
                  id="rte-link-text"
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Display text"
                  className="w-full bg-[#1C1917] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                />
              </div>
              <div>
                <label htmlFor="rte-link-url" className="block text-sm text-[#A8A29E] mb-1.5">
                  URL
                </label>
                <input
                  id="rte-link-url"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-[#1C1917] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                  // biome-ignore lint/a11y/noAutofocus: focus the URL input when the link modal opens
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={insertLink}
                  disabled={!linkUrl}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#D4836A] text-white hover:bg-[#c4775f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Insert Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #78716C;
          pointer-events: none;
        }
        [contenteditable] ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contenteditable] ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contenteditable] li {
          margin: 0.25rem 0;
        }
      `}</style>
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ElementType;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
}

function ToolbarButton({ icon: Icon, onClick, title, disabled, active }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        active
          ? "bg-[#D4836A]/20 text-[#D4836A]"
          : "text-[#A8A29E] hover:text-white hover:bg-white/[0.05]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// Convert HTML to markdown-like format
function htmlToMarkdown(html: string): string {
  let text = html;

  // Convert common HTML to text (for storage/display)
  text = text.replace(/<b>|<strong>/gi, "**");
  text = text.replace(/<\/b>|<\/strong>/gi, "**");
  text = text.replace(/<i>|<em>/gi, "_");
  text = text.replace(/<\/i>|<\/em>/gi, "_");
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "## $1\n");
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<li[^>]*>/gi, "- ");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/?ul[^>]*>/gi, "");
  text = text.replace(/<\/?ol[^>]*>/gi, "");
  text = text.replace(/<div[^>]*>/gi, "");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&amp;/g, "&");

  return text.trim();
}
