import { LETTERS } from "@/game/letters";

export type LetterStat = { ok: number; miss: number };

export type Settings = {
  sound: boolean;
  coach: boolean;
  difficulty: "easy" | "normal";
  playMinutes: 0 | 5 | 10 | 15 | 20;
  input: "voice" | "tap";
};

export type Save = {
  version: 1;
  stars: number;
  clears: number;
  resumeIndex: number;
  setupDone: boolean;
  letters: Record<string, LetterStat>;
  settings: Settings;
  today: string;
  todayMs: number;
};

const KEY = "voxfly-save-v1";
const PLAY = [0, 5, 10, 15, 20] as const;

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function defaultSave(): Save {
  return {
    version: 1,
    stars: 0,
    clears: 0,
    resumeIndex: 0,
    setupDone: false,
    letters: {},
    settings: {
      sound: true,
      coach: true,
      difficulty: "easy",
      playMinutes: 0,
      input: "voice",
    },
    today: todayKey(),
    todayMs: 0,
  };
}

function isPlay(n: unknown): n is Settings["playMinutes"] {
  return PLAY.includes(n as Settings["playMinutes"]);
}

export function loadSave(): Save {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw) as Partial<Save>;
    const settings = { ...base.settings, ...(data.settings ?? {}) };
    if (settings.difficulty !== "easy" && settings.difficulty !== "normal") settings.difficulty = "easy";
    if (settings.input !== "voice" && settings.input !== "tap") settings.input = "voice";
    if (!isPlay(settings.playMinutes)) settings.playMinutes = 0;
    const today = todayKey();
    const resume = Math.max(0, Math.min(LETTERS.length - 1, Number(data.resumeIndex) || 0));
    return {
      version: 1,
      stars: Math.max(0, Number(data.stars) || 0),
      clears: Math.max(0, Number(data.clears) || 0),
      resumeIndex: resume,
      setupDone: Boolean(data.setupDone),
      letters: data.letters && typeof data.letters === "object" ? data.letters : {},
      settings,
      today,
      todayMs: data.today === today ? Math.max(0, Number(data.todayMs) || 0) : 0,
    };
  } catch {
    return base;
  }
}

export function writeSave(save: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / full storage: play continues without persistence */
  }
}

export function learnedCount(save: Save): number {
  return LETTERS.filter((letter) => (save.letters[letter.id]?.ok ?? 0) > 0).length;
}

export function practiceLetters(save: Save): string[] {
  return LETTERS.filter((letter) => {
    const stat = save.letters[letter.id];
    if (!stat) return false;
    return stat.miss > 0 && stat.miss >= stat.ok;
  }).map((letter) => letter.id);
}
