// Fetch announcements markdown files from the public GitHub repository
// Repo: YEJIN-DEV/yejingram-announcements

import i18n from "../i18n/i18n";

export type AnnouncementKind = 'servicenotes' | 'patchnotes';

export interface AnnouncementMeta {
  id: string; // unique id (path)
  kind: AnnouncementKind;
  title: string;
  timestamp: number; // unix seconds
  date: Date; // derived from timestamp
  path: string; // repo path like servicenotes/1758477906-Title.md
  downloadUrl: string; // raw URL from GitHub API
}

export interface Announcement extends AnnouncementMeta {
  content: string; // full markdown content
}

const REPO_OWNER = 'YEJIN-DEV';
const REPO_NAME = 'yejingram-announcements';
const API_BASE = 'https://api.github.com';

// Simple in-memory caches
const listCache: Partial<Record<AnnouncementKind, AnnouncementMeta[]>> = {};
const contentCache: Record<string, string> = {};

// Parse filename like: 1758477906-Welcome to yejingram.md
function parseFilename(kind: AnnouncementKind, name: string, path: string, downloadUrl: string): AnnouncementMeta | null {
  const m = name.match(/^(\d+)-(.*)\.md$/i);
  if (!m) return null;
  const ts = Number(m[1]);
  if (!Number.isFinite(ts)) return null;
  const title = decodeURIComponent(m[2]).replace(/[_-]/g, ' ').trim();
  const date = new Date(ts * 1000);
  return {
    id: `${kind}:${path}`,
    kind,
    title,
    timestamp: ts,
    date,
    path,
    downloadUrl,
  };
}

async function fetchDirectory(kind: AnnouncementKind): Promise<AnnouncementMeta[]> {
  if (listCache[kind]) return listCache[kind]!;

  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${kind}`;
  const res = await fetch(url, {
    headers: {
      // unauthenticated, rely on public rate limit
      'Accept': 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    console.warn('Failed to fetch announcements list', kind, res.status, await res.text());
    return [];
  }
  const data = (await res.json()) as Array<{
    name: string;
    path: string;
    download_url: string | null;
    type: 'file' | 'dir';
  }>;

  const items = data
    .filter(item => item.type === 'file' && /\.md$/i.test(item.name))
    .map(item => parseFilename(kind, item.name, item.path, item.download_url ?? ''))
    .filter((v): v is AnnouncementMeta => !!v)
    .sort((a, b) => b.timestamp - a.timestamp);

  listCache[kind] = items;
  return items;
}

export async function fetchAnnouncementsList(kind?: AnnouncementKind): Promise<AnnouncementMeta[]> {
  if (!kind) {
    const [s, p] = await Promise.all([fetchDirectory('servicenotes'), fetchDirectory('patchnotes')]);
    return [...s, ...p].sort((a, b) => b.timestamp - a.timestamp);
  }
  return fetchDirectory(kind);
}

export async function fetchAnnouncementContent(meta: AnnouncementMeta): Promise<Announcement> {
  if (contentCache[meta.id]) {
    return { ...meta, content: contentCache[meta.id] };
  }
  let content = '';
  try {
    // Prefer raw download URL (faster). Fallback to contents API if missing.
    if (meta.downloadUrl) {
      const r = await fetch(meta.downloadUrl);
      if (r.ok) {
        content = await r.text();
      } else {
        console.warn('Failed raw download, falling back to contents API', meta.path);
      }
    }
    if (!content) {
      const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${meta.path}`;
      const r = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(`Failed to fetch content: ${r.status}`);
      const j = await r.json() as { content: string; encoding: string };
      if (j.encoding === 'base64') {
        content = typeof atob !== 'undefined' ? atob(j.content) : Buffer.from(j.content, 'base64').toString('utf-8');
      }
    }
  } catch (e) {
    console.error('Error fetching announcement content', e);
  }
  contentCache[meta.id] = content;
  return { ...meta, content };
}

export function formatDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
