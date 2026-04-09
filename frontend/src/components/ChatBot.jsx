import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { API_BASE } from "../config";

const SUGGESTIONS = [
  "What's the load forecast for Ahmedabad?",
  "Show EV charging growth trends",
  "Solar generation forecast for Surat",
  "Run capacity plan for Rajkot",
  "Compare commercial vs residential load",
];

export default function ChatBot({ onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "👋 Hi! I'm your **DISCOM AI Assistant**. I can help you with:\n\n- ⚡ **DT Load Forecasting** — transformer loads, area-wise demand\n- 🔌 **EV Charging Growth** — adoption trends, charger utilization\n- ☀️ **Solar/DER Forecasting** — generation, net metering\n- 🏗️ **Capacity Planning** — holistic assessment, scenarios\n\nTry asking a question or pick a suggestion below!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || "No response received.";
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: answer,
          toolUsed: data.tool_used,
          toolData: data.tool_data,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: `⚠️ **Error:** ${err.message}\n\nMake sure the API is deployed and accessible.` },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div>
          <h3>🤖 DISCOM AI Assistant</h3>
          <span className="chat-header-sub">Powered by Amazon Bedrock</span>
        </div>
        <button className="chat-close" onClick={onClose}>×</button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            {msg.role === "bot" ? (
              <div className="chat-md">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="chat-link">
                        {children}
                      </a>
                    ),
                    code: ({ children }) => <code className="chat-code">{children}</code>,
                    pre: ({ children }) => <pre className="chat-pre">{children}</pre>,
                    table: ({ children }) => <table className="chat-table">{children}</table>,
                    h2: ({ children }) => <h4 className="chat-heading">{children}</h4>,
                    h3: ({ children }) => <h4 className="chat-heading">{children}</h4>,
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
                {msg.toolUsed && (
                  <div className="chat-tool-badge">
                    📎 Agent: <strong>{msg.toolUsed.replace(/_/g, " ")}</strong>
                  </div>
                )}
              </div>
            ) : (
              msg.text
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-msg bot">
            <div className="chat-thinking">
              <span className="dot-pulse"></span>
              Analyzing your query...
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {messages.length <= 1 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about load, EV, solar, capacity..."
          disabled={loading}
        />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
