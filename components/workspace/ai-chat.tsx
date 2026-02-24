"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface AIChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIChat({ open, onOpenChange }: AIChatProps) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: `${BASE_PATH}/api/chat` }),
    []
  );
  const { messages, sendMessage, status, stop } = useChat({ transport });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-80 flex-col p-0 sm:w-96"
      >
        <SheetHeader className="flex-none border-b px-3 py-2 gap-0">
          <SheetTitle className="text-xs font-semibold">AI Chat</SheetTitle>
          <SheetDescription className="sr-only">
            Chat with AI assistant
          </SheetDescription>
        </SheetHeader>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
        >
          {messages.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center mt-8">
              Ask anything about your data.
            </p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-md px-2.5 py-1.5 text-xs leading-relaxed",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? (
                  <span key={i} className="whitespace-pre-wrap">
                    {part.text}
                  </span>
                ) : null
              )}
            </div>
          ))}
          {status === "submitted" && (
            <div className="mr-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex-none border-t px-3 py-2">
          <div className="flex items-center gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something..."
              disabled={isLoading}
              className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            {isLoading ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => stop()}
              >
                <Square className="size-3" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="ghost"
                size="icon-xs"
                disabled={!input.trim()}
              >
                <Send className="size-3" />
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
