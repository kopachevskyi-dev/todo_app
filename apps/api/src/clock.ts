import { existsSync, readFileSync } from 'node:fs';

export interface Clock {
  now(): Date;
  timezone: string;
}

function hostTimezone(): string {
  // Docker Desktop passes the host's timezone file, but the image's own
  // /etc/localtime symlink and /etc/timezone can still name UTC. Match the
  // mounted file to an IANA zone instead of trusting those image defaults.
  if (!existsSync('/host-localtime')) return Intl.DateTimeFormat().resolvedOptions().timeZone;
  const host = readFileSync('/host-localtime');
  const zones = readFileSync('/usr/share/zoneinfo/zone.tab', 'utf8')
    .split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('\t')[2]);
  for (const zone of ['Etc/UTC', ...zones]) {
    if (readFileSync(`/usr/share/zoneinfo/${zone}`).equals(host)) return zone;
  }
  throw new Error('Cannot identify the host timezone; set TZ to an IANA timezone in .env.');
}

export function systemClock(timezone?: string): Clock {
  if (process.env.TZ === '') delete process.env.TZ;
  timezone ||= process.env.TZ || hostTimezone();
  new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  return { now: () => new Date(), timezone };
}
