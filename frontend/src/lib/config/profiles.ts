export interface Profile {
  id: string;
  name: string;
  inference: {
    chatProvider?: string;
    providerUrl?: string;
    providerToken?: string;
    providerModelId?: string;
    bedrockRegion?: string;
    bedrockModelId?: string;
  };
  voice: { voiceProvider?: string };
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

export function exportProfiles(profiles: Profile[]): void {
  const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'profiles.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importProfiles(file: File): Promise<Profile[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const profiles: Profile[] = Array.isArray(data) ? data : [data];
        for (const p of profiles) {
          if (!p.name) throw new Error('Invalid profile: missing name');
          if (!p.id) p.id = crypto.randomUUID();
          if (!p.inference) p.inference = {};
          if (!p.voice) p.voice = {};
          saveProfile(p);
        }
        resolve(profiles);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
