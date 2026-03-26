import React from 'react';

export type ChatLine = { id: string; text: string };

export type ChatSessionInfo = {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
  messageCount: number;
};

export type WelcomeProps = {
  version: string;
  cwd: string;
  provider?: string;
  logs: string[];
  rows: number;
  cols: number;
  isDimmed?: boolean;
  children?: React.ReactNode;
};

export type ChatPageProps = {
  lines: ChatLine[];
  isDimmed?: boolean;
  session?: ChatSessionInfo | null;
};
