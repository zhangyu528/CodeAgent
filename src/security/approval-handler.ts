export type ApprovalHandler = (message: string) => Promise<boolean>;

let handler: ApprovalHandler | null = null;

export function setApprovalHandler(next: ApprovalHandler) {
  handler = next;
}

export function getApprovalHandler(): ApprovalHandler | null {
  return handler;
}
