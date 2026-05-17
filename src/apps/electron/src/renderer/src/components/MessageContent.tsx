import React, { useState, useEffect, useRef } from 'react';
import hljs from 'highlight.js';

// Types
interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  thinkingSignature?: string;
  name?: string;
  arguments?: any;
  toolCallId?: string;
  toolName?: string;
  content?: any;
  isError?: boolean;
  id?: string;
  code?: string;
  language?: string;
}

interface MessageContentProps {
  content: ContentBlock[] | string;
  role: 'user' | 'assistant';
}

// Status icons mapping
const statusIcons: Record<string, string> = {
  success: '🟢',
  error: '🔴',
  running: '🟡',
  pending: '⏳',
};

// Tool name display mapping
const toolNameMap: Record<string, string> = {
  read: 'Read File',
  write: 'Write File',
  bash: 'Bash Command',
  grep: 'Grep Search',
  find: 'Find Files',
  ls: 'List Directory',
  edit: 'Edit File',
};

// Helper to extract file paths from text
function highlightFilePaths(text: string): React.ReactNode {
  const pathRegex = /([A-Za-z]:\\[^\s]*|\/[^\s]*\.[a-z]+)/g;
  const parts = text.split(pathRegex);
  return parts.map((part, i) => {
    if (pathRegex.test(part)) {
      pathRegex.lastIndex = 0;
      return <span key={i} style={styles.filePath}>{part}</span>;
    }
    return part;
  });
}

// Text Block
function TextBlock({ text }: { text: string }) {
  return <div style={styles.textBlock}>{highlightFilePaths(text)}</div>;
}

// Code Block with syntax highlighting
function CodeBlock({ code, language }: { code?: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const codeContent = code || '';
  const lines = codeContent.split('\n');
  const isLongCode = lines.length > 20;
  const displayCode = isLongCode && !expanded ? lines.slice(0, 20).join('\n') + '\n...' : codeContent;
  const actualLanguage = language || 'plaintext';

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [displayCode, actualLanguage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={styles.codeBlock}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.codeHeader}>
        <span style={styles.codeLanguage}>{actualLanguage}</span>
        <div style={styles.codeActions}>
          {hovered && (
            <>
              {isLongCode && (
                <button style={styles.codeActionBtn} onClick={() => setExpanded(!expanded)}>
                  {expanded ? 'Collapse' : `Expand ${lines.length} lines`}
                </button>
              )}
              <button style={styles.codeActionBtn} onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
      </div>
      <pre style={{ ...styles.codePre, maxHeight: expanded ? 'none' : '400px' }}>
        {lines.length > 5 && (
          <div style={styles.lineNumbers}>
            {(isLongCode && !expanded ? lines.slice(0, 20) : lines).map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        )}
        <code ref={codeRef} className={`language-${actualLanguage}`}>
          {displayCode}
        </code>
      </pre>
    </div>
  );
}

// Thinking Block (Claude style)
function ThinkingBlock({ thinking }: { thinking?: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!thinking) return null;

  return (
    <div style={styles.thinkingBlock}>
      <div style={styles.thinkingHeader} onClick={() => setExpanded(!expanded)}>
        <span style={styles.thinkingIcon}>{expanded ? '▼' : '▶'}</span>
        <span style={styles.thinkingLabel}>Thinking</span>
      </div>
      {expanded && <div style={styles.thinkingContent}>{thinking}</div>}
    </div>
  );
}

// Tool Call Block
function ToolCallBlock({ name, arguments: args, id }: { name?: string; arguments?: any; id?: string }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = toolNameMap[name?.toLowerCase() || ''] || name || 'Tool';
  const argsStr = typeof args === 'string' ? args : JSON.stringify(args, null, 2);

  return (
    <div style={styles.toolCallBlock}>
      <div style={styles.toolCallHeader} onClick={() => setExpanded(!expanded)}>
        <span style={styles.toolCallBadge}>{displayName}</span>
        <span style={styles.toolCallExpand}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && <pre style={styles.toolCallArgs}>{argsStr}</pre>}
    </div>
  );
}

// Tool Result Block with status and file path highlighting
function ToolResultBlock({ content, isError, toolName }: { content?: any; isError?: boolean; toolName?: string }) {
  const [expanded, setExpanded] = useState(false);
  const textContent = Array.isArray(content)
    ? content.find(c => c.type === 'text')?.text || ''
    : typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const displayName = toolNameMap[toolName?.toLowerCase() || ''] || toolName || 'Result';
  const status = isError ? 'error' : 'success';
  const statusIcon = statusIcons[status];
  const isLongContent = textContent.length > 200;
  const summary = isLongContent && !expanded ? textContent.substring(0, 200) + '...' : textContent;

  const blockStyle = isError
    ? { ...styles.toolResultBlock, ...styles.toolResultError }
    : styles.toolResultBlock;

  return (
    <div style={blockStyle}>
      <div style={styles.toolResultHeader} onClick={() => setExpanded(!expanded)}>
        <div style={styles.toolResultTitle}>
          <span style={styles.toolResultIcon}>{statusIcon}</span>
          <span style={styles.toolResultBadge}>{displayName}</span>
        </div>
        <span style={styles.toolResultExpand}>{expanded ? '▲' : '▼'}</span>
      </div>
      <pre style={styles.toolResultPre}>
        {highlightFilePaths(summary)}
      </pre>
      {isLongContent && !expanded && (
        <div style={styles.toolResultExpandHint}>Click to expand</div>
      )}
    </div>
  );
}

// Main Message Content Renderer
export default function MessageContent({ content, role }: MessageContentProps) {
  if (!content) return null;

  if (typeof content === 'string') {
    return <TextBlock text={content} />;
  }

  if (Array.isArray(content)) {
    return (
      <div style={styles.contentBlocks}>
        {content.map((block, idx) => {
          switch (block.type) {
            case 'text':
              return <TextBlock key={idx} text={block.text || ''} />;
            case 'thinking':
              return <ThinkingBlock key={idx} thinking={block.thinking} />;
            case 'toolCall':
              return <ToolCallBlock key={idx} name={block.name} arguments={block.arguments} id={block.id} />;
            case 'tool_result':
            case 'toolResult':
              return <ToolResultBlock key={idx} content={block.content} isError={block.isError} toolName={block.toolName} />;
            case 'code':
              return <CodeBlock key={idx} code={block.code} language={block.language} />;
            default:
              if (block.text) return <TextBlock key={idx} text={block.text} />;
              return null;
          }
        })}
      </div>
    );
  }

  if (content.text) {
    return <TextBlock text={content.text} />;
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  contentBlocks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  textBlock: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 1.6,
  },
  filePath: {
    color: '#22c55e',
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  codeBlock: {
    background: '#1e1e1e',
    borderRadius: '8px',
    overflow: 'hidden',
    margin: '8px 0',
  },
  codeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3d3d3d',
  },
  codeLanguage: {
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  codeActions: {
    display: 'flex',
    gap: '8px',
  },
  codeActionBtn: {
    padding: '4px 8px',
    background: '#3d3d3d',
    border: 'none',
    borderRadius: '4px',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '11px',
  },
  codePre: {
    margin: 0,
    padding: '12px',
    paddingLeft: '40px',
    overflow: 'auto',
    fontSize: '13px',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    color: '#e0e0e0',
    lineHeight: 1.5,
    position: 'relative',
  },
  lineNumbers: {
    position: 'absolute',
    left: '12px',
    top: '12px',
    color: '#555',
    fontSize: '12px',
    textAlign: 'right',
    userSelect: 'none',
    lineHeight: 1.5,
  },
  thinkingBlock: {
    background: '#1a1a2e',
    border: '1px solid #2d2d5a',
    borderRadius: '8px',
    margin: '8px 0',
    overflow: 'hidden',
  },
  thinkingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    background: '#1a1a2e',
  },
  thinkingIcon: {
    fontSize: '10px',
    color: '#888',
  },
  thinkingLabel: {
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace',
  },
  thinkingContent: {
    padding: '12px',
    fontSize: '13px',
    color: '#a0a0c0',
    fontFamily: 'monospace',
    lineHeight: 1.6,
    borderTop: '1px solid #2d2d5a',
    whiteSpace: 'pre-wrap',
  },
  toolCallBlock: {
    background: '#1e2a1e',
    border: '1px solid #2a4a2a',
    borderRadius: '8px',
    margin: '8px 0',
    overflow: 'hidden',
  },
  toolCallHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    background: '#1e2a1e',
  },
  toolCallBadge: {
    fontSize: '12px',
    color: '#22c55e',
    fontFamily: 'monospace',
    background: '#22c55e20',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  toolCallExpand: {
    fontSize: '10px',
    color: '#888',
  },
  toolCallArgs: {
    margin: 0,
    padding: '12px',
    fontSize: '12px',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    color: '#a0a0c0',
    background: '#0d1a0d',
    borderTop: '1px solid #2a4a2a',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  toolResultBlock: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    margin: '8px 0',
    overflow: 'hidden',
  },
  toolResultError: {
    borderColor: '#4a2020',
    background: '#1a0a0a',
  },
  toolResultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    background: '#1a1a1a',
  },
  toolResultTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolResultIcon: {
    fontSize: '12px',
  },
  toolResultBadge: {
    fontSize: '11px',
    color: '#888',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  toolResultExpand: {
    fontSize: '10px',
    color: '#666',
  },
  toolResultPre: {
    margin: 0,
    padding: '12px',
    fontSize: '12px',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    color: '#e0e0e0',
    background: '#0a0a0a',
    borderTop: '1px solid #333',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '300px',
  },
  toolResultExpandHint: {
    padding: '6px 12px',
    fontSize: '11px',
    color: '#666',
    background: '#0a0a0a',
    textAlign: 'center',
    borderTop: '1px solid #333',
    cursor: 'pointer',
  },
};