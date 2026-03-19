export type PageState = 'welcome' | 'chat';

export type RecentSessionItem = {
  id: string;
  title: string;
};

export type NavigationEvent = {
  to: PageState;
  reason: 'new' | 'resume' | 'back' | 'startup';
};