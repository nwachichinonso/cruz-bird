import { useEffect, useRef, useState } from "react";
import { matchesLetter } from "@/game/letters";
import { speakLetter, stopSpeaking } from "@/game/audio";

export type ListenPhase = "off" | "speaking" | "listening" | "blocked" | "unsupported";

type Alt = { transcript: string };
type RecResult = { isFinal: boolean; length: number; [index: number]: Alt };
type RecEvent = { resultIndex: number; results: { length: number; [index: number]: RecResult } };
type RecError = { error: string };

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecEvent) => void) | null;
  onerror: ((event: RecError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

function recognitionCtor(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const host = window as unknown as Record<string, unknown>;
  const ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as new () => Rec) : null;
}

export function speechRecognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

type Options = {
  enabled: boolean;
  letter: string;
  sound: boolean;
  coach: boolean;
  runId: string;
  onMatch: () => void;
  onMiss: (heard: string) => void;
};

export function useLetterListener({ enabled, letter, sound, coach, runId, onMatch, onMiss }: Options) {
  const [phase, setPhase] = useState<ListenPhase>("off");
  const [heard, setHeard] = useState("");
  const onMatchRef = useRef(onMatch);
  const onMissRef = useRef(onMiss);
  const speakNowRef = useRef<() => void>(() => {});
  onMatchRef.current = onMatch;
  onMissRef.current = onMiss;

  useEffect(() => {
    if (!enabled) {
      setPhase("off");
      return;
    }

    const Ctor = recognitionCtor();
    if (!Ctor) {
      setPhase("unsupported");
      return;
    }

    let cancelled = false;
    let matched = false;
    let holding = false;
    let generation = 0;
    let rec: Rec | null = null;
    let restartTimer = 0;
    let lastMiss = 0;
    setHeard("");

    const startRec = () => {
      if (cancelled || matched || holding) return;
      const my = ++generation;
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      const next = new Ctor();
      rec = next;
      next.continuous = true;
      next.interimResults = true;
      next.lang = "en-US";
      next.onresult = (event) => {
        if (cancelled || matched || holding) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const options: string[] = [];
          for (let j = 0; j < result.length; j++) options.push(result[j].transcript);
          const hit = options.some((text) => matchesLetter(letter, text));
          if (hit) {
            matched = true;
            try {
              next.abort();
            } catch {
              /* ignore */
            }
            onMatchRef.current();
            return;
          }
          if (result.isFinal) {
            const text = options[0]?.trim() ?? "";
            if (!text) continue;
            const now = performance.now();
            if (now - lastMiss < 1400) continue;
            lastMiss = now;
            setHeard(text);
            onMissRef.current(text);
          }
        }
      };
      next.onerror = (event) => {
        if (event.error === "aborted" || event.error === "no-speech") return;
        cancelled = true;
        setPhase("blocked");
      };
      next.onend = () => {
        if (cancelled || matched || holding || my !== generation) return;
        restartTimer = window.setTimeout(() => {
          if (!cancelled && !matched && !holding && my === generation) startRec();
        }, 280);
      };
      try {
        next.start();
        if (!cancelled) setPhase("listening");
      } catch {
        if (!cancelled) setPhase("blocked");
      }
    };

    const say = (force: boolean) => {
      holding = true;
      window.clearTimeout(restartTimer);
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
      const shouldSpeak = sound && (force || coach);
      if (!shouldSpeak) {
        holding = false;
        startRec();
        return;
      }
      if (!cancelled) setPhase("speaking");
      speakLetter(letter, {
        onend: () => {
          holding = false;
          if (cancelled || matched) return;
          window.setTimeout(() => {
            if (!cancelled && !matched) startRec();
          }, 420);
        },
      });
    };

    speakNowRef.current = () => {
      if (cancelled || matched) return;
      say(true);
    };

    say(false);

    return () => {
      cancelled = true;
      window.clearTimeout(restartTimer);
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
      stopSpeaking();
      speakNowRef.current = () => {};
    };
  }, [enabled, letter, sound, coach, runId]);

  return {
    phase,
    heard,
    speakNow: () => speakNowRef.current(),
  };
}
