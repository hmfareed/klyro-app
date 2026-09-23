"use client";

import React from "react";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/**
 * Clean, sanitized Markdown renderer for README and issue/PR bodies
 */
export function MarkdownViewer({ content, className = "" }: MarkdownViewerProps) {
  if (!content) return null;

  // Simple, robust parser for core Markdown constructs
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-3 space-y-1 list-disc list-inside text-slate-300 text-xs sm:text-sm pl-2">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushCode = () => {
    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <div key={`code-${elements.length}`} className="my-4 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
          {codeLang && (
            <div className="border-b border-white/10 px-4 py-1.5 text-[11px] font-mono text-slate-400 uppercase tracking-wider bg-white/[0.02]">
              {codeLang}
            </div>
          )}
          <pre className="overflow-x-auto p-4 font-mono text-xs text-slate-200 leading-relaxed">
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        </div>
      );
      codeBuffer = [];
      inCodeBlock = false;
      codeLang = "";
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
      } else {
        flushList();
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="mt-6 mb-3 text-xl sm:text-2xl font-bold text-white border-b border-white/10 pb-2">
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="mt-5 mb-2.5 text-lg sm:text-xl font-bold text-white border-b border-white/5 pb-1.5">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="mt-4 mb-2 text-base font-semibold text-white">
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Bullet lists
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      inList = true;
      listItems.push(
        <li key={`li-${i}`} className="leading-relaxed">
          {renderInline(line.trim().slice(2))}
        </li>
      );
      continue;
    } else {
      flushList();
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={`bq-${i}`} className="my-3 border-l-2 border-indigo-500 pl-4 py-1 text-slate-400 italic text-xs sm:text-sm">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p-${i}`} className="my-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  flushList();
  flushCode();

  return <div className={`prose-invert max-w-none ${className}`}>{elements}</div>;
}

/**
 * Inline markdown parser: **bold**, *italic*, `code`, and [link](url)
 */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Tokenize regex for inline patterns including #123 references
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|#\d+)/g;

  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={match.index} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={match.index} className="italic text-slate-200">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-indigo-300">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("#") && /^#\d+$/.test(token)) {
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer hover:underline"
          title={`Reference #${token.slice(1)}`}
        >
          {token}
        </span>
      );
    } else if (token.startsWith("[") && token.includes("](")) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline font-medium"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
