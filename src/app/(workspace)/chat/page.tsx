"use client";

import { useState } from "react";
import {
  MessageSquare,
  Hash,
  Send,
} from "lucide-react";

interface Message {
  id: string;
  author: string;
  avatar: string;
  text: string;
  time: string;
  codeSnippet?: string;
}

const CHANNELS = [
  { id: "general", name: "general", unread: 2 },
  { id: "engineering", name: "engineering", unread: 4 },
  { id: "design-system", name: "design-system", unread: 0 },
  { id: "announcements", name: "announcements", unread: 0 },
];

const DMS = [
  { id: "abdul", name: "Abdul Rahman", status: "online" },
  { id: "maryam", name: "Maryam Sani", status: "away" },
  { id: "kofi", name: "Kofi Mensah", status: "offline" },
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  engineering: [
    {
      id: "m-1",
      author: "Abdul Rahman",
      avatar: "AR",
      text: "Hey team, I opened PR #12 for mobile responsiveness. Can someone check the table break points?",
      time: "10:14 AM",
    },
    {
      id: "m-2",
      author: "Mohammed Fareed",
      avatar: "MF",
      text: "Looking at it right now. Looks solid, just make sure the horizontal scroll on code view doesn't clip badges.",
      time: "10:18 AM",
    },
    {
      id: "m-3",
      author: "Maryam Sani",
      avatar: "MS",
      text: "Tested on iPad Pro Safari and iPhone 15 Pro — verified smooth navigation without layout shift.",
      time: "10:25 AM",
    },
    {
      id: "m-4",
      author: "Mohammed Fareed",
      avatar: "MF",
      text: "Approved and merging into main now.",
      time: "10:30 AM",
      codeSnippet: "git checkout main && git merge feat/mobile-responsive",
    },
  ],
  general: [
    {
      id: "g-1",
      author: "Mohammed Fareed",
      avatar: "MF",
      text: "Welcome to Klyro Workspace! All project repositories and sprint tasks are synced here.",
      time: "Yesterday",
    },
    {
      id: "g-2",
      author: "Abdul Rahman",
      avatar: "AR",
      text: "Super stoked to start shipping features together! 🚀",
      time: "Yesterday",
    },
  ],
};

export default function WorkspaceChatPage() {
  const [activeChannel, setActiveChannel] = useState("engineering");
  const [messages, setMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");

  const currentMessages = messages[activeChannel] || [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      author: "Mohammed Fareed",
      avatar: "MF",
      text: input.trim(),
      time: "Just now",
    };

    setMessages({
      ...messages,
      [activeChannel]: [...currentMessages, newMsg],
    });
    setInput("");
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-[#0a0f24] min-w-0">
      {/* Channels Sidebar */}
      <aside className="w-56 shrink-0 border-r border-white/10 bg-[#0b1226] flex flex-col">
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-white uppercase tracking-wider">
            <MessageSquare size={14} className="text-indigo-400" />
            <span>Workspace Chat</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Channels</span>
            <div className="mt-1 space-y-0.5">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    activeChannel === ch.id
                      ? "bg-indigo-600 text-white font-medium"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Hash size={13} className="text-slate-400" />
                    <span>{ch.name}</span>
                  </span>
                  {ch.unread > 0 && activeChannel !== ch.id && (
                    <span className="rounded-full bg-indigo-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                      {ch.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Direct Messages</span>
            <div className="mt-1 space-y-0.5">
              {DMS.map((dm) => (
                <button
                  key={dm.id}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      dm.status === "online"
                        ? "bg-emerald-500"
                        : dm.status === "away"
                        ? "bg-amber-500"
                        : "bg-slate-600"
                    }`}
                  />
                  <span className="truncate">{dm.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Chat Conversation Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Channel Header */}
        <div className="h-14 border-b border-white/10 bg-[#0d1430] px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-indigo-400" />
            <span className="font-bold text-white text-sm">#{activeChannel}</span>
            <span className="text-xs text-slate-500">| Core developer discussion</span>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentMessages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 group">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow">
                {msg.avatar}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{msg.author}</span>
                  <span className="text-[10px] text-slate-500">{msg.time}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{msg.text}</p>
                {msg.codeSnippet && (
                  <pre className="mt-1 rounded-lg border border-white/10 bg-black/40 p-2 text-xs font-mono text-emerald-400 overflow-x-auto">
                    <code>{msg.codeSnippet}</code>
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Message Input Bar */}
        <div className="p-4 border-t border-white/10 bg-[#0d1430]">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              placeholder={`Message #${activeChannel}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-[#0b1226] px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 p-2.5 text-white hover:bg-indigo-500 transition-colors shrink-0"
              title="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
