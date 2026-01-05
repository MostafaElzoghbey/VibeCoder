import React, { useRef, useEffect } from 'react';
import { Message } from '../types';
import { Send, Bot, User, Sparkles } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  input: string;
  isGenerating: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  input,
  isGenerating,
  onInputChange,
  onSend,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h2 className="font-semibold text-white tracking-tight">VibeCoder AI</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4 opacity-60">
            <Bot className="w-12 h-12" />
            <p className="text-sm">Describe an app to generate...</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div
              className={`rounded-lg p-3 max-w-[85%] text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600/10 text-indigo-100 border border-indigo-600/20'
                  : 'bg-gray-800 text-gray-200 border border-gray-700'
              } ${msg.isError ? 'bg-red-900/20 text-red-200 border-red-800' : ''}`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 bg-gray-900">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Build a landing page for a sushi restaurant..."
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-gray-700 resize-none h-[50px] max-h-[120px]"
            disabled={isGenerating}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || isGenerating}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {isGenerating && (
          <div className="mt-2 text-xs text-indigo-400 flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 bg-indigo-400 rounded-full" />
            Generating code...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
