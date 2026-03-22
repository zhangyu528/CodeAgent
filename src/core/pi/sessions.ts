import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentMessage } from '@mariozechner/pi-agent-core';

const CONFIG_DIR = path.join(os.homedir(), '.codeagent');
const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');

export interface SessionInfo {
  id: string;
  title: string;
  timestamp: number;
}

export class SessionManager {
  constructor() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  }

  saveSession(id: string, messages: AgentMessage[]) {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    const title = this.extractTitle(messages) || 'New Session';
    const data = {
      id,
      title,
      timestamp: Date.now(),
      messages
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  loadSession(id: string): { id: string; title: string; messages: AgentMessage[] } | null {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      return null;
    }
  }

  getHistory(): SessionInfo[] {
    if (!fs.existsSync(SESSIONS_DIR)) return [];
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const sessions: SessionInfo[] = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8'));
        return {
          id: data.id,
          title: data.title,
          timestamp: data.timestamp
        };
      } catch (err) {
        return null;
      }
    }).filter((s): s is SessionInfo => s !== null);

    return sessions.sort((a, b) => b.timestamp - a.timestamp);
  }

  getLatestSessionId(): string | null {
    const history = this.getHistory();
    const latest = history[0];
    return latest ? latest.id : null;
  }

  private extractTitle(messages: AgentMessage[]): string | null {
    if (messages.length === 0) return null;
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg && typeof (firstUserMsg as any).content === 'string') {
        const text = (firstUserMsg as any).content.trim();
        return text.length > 40 ? text.slice(0, 40) + '...' : text;
    }
    return null;
  }
}

export const sessionManager = new SessionManager();
