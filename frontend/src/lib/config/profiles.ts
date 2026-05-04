import { FactorySettings } from './app-settings';

export interface Profile extends Partial<FactorySettings> {
  id: string;
  name: string;
}

const KEY = 'doc-chatter-profiles';

function load(): Profile[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(profiles: Profile[]) {
  localStorage.setItem(KEY, JSON.stringify(profiles));
}

export function listProfiles(): Profile[] {
  return load();
}

export function getProfile(id: string): Profile | undefined {
  return load().find(p => p.id === id);
}

export function saveProfile(profile: Profile): void {
  const profiles = load();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  save(profiles);
}

export function deleteProfile(id: string): void {
  save(load().filter(p => p.id !== id));
}

export function exportProfile(profile: Profile): void {
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${profile.name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProfile(file: File): Promise<Profile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const profile = JSON.parse(reader.result as string) as Profile;
        if (!profile.name) throw new Error('Invalid profile: missing name');
        if (!profile.id) profile.id = crypto.randomUUID();
        saveProfile(profile);
        resolve(profile);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
