export function startTestServer(options?: {
  entry?: string;
  testClock?: boolean;
}): Promise<{ url: string; stop(): Promise<void> }>;
