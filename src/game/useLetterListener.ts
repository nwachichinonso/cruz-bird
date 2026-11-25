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
export function speechRecognitionSupported(): boolean { return recognitionCtor() !== null; }
type Options = {
  enabled: boolean; letter: string; sound: boolean; coach: boolean; runId: string;
  onMatch: () => void; onMiss: (heard: string) => void;
};
export function useLetterListener({ enabled, letter, sound, coach, runId, onMatch, onMiss }: Options) {
  const [phase, setPhase] = useState<ListenPhase>("off");
  const [heard, setHeard] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const onMatchRef = useRef(onMatch);
  const onMissRef = useRef(onMiss);
  const speakNowRef = useRef<() => void>(() => {});
  onMatchRef.current = onMatch;
  onMissRef.current = onMiss;
  useEffect(() => {
    if (!enabled) { setPhase("off"); setVoiceActive(false); return; }
    const Ctor = recognitionCtor();
    if (!Ctor) { setPhase("unsupported"); return; }
    let cancelled = false;
    let holding = false;
    let generation = 0;
    let rec: Rec | null = null;
    let restartTimer = 0;
    let voiceTimer = 0;
    let lastMiss = 0;
    let lastMatch = 0;
    setHeard("");
    const startRec = () => {
      if (cancelled || holding) return;
      const my = ++generation;
      try { rec?.abort(); } catch { /* already stopped */ }
      const next = new Ctor();
      rec = next;
      next.continuous = true;
      next.interimResults = true;
      next.lang = "en-US";
      next.onresult = (event) => {
        if (cancelled || holding) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) continue;
          const options: string[] = [];
          for (let j = 0; j < result.length; j++) options.push(result[j].transcript.trim());
          const hit = options.find((value) => value && matchesLetter(letter, value));
          if (hit) {
            const now = performance.now();
            if (now - lastMatch < 500) continue;
            lastMatch = now;
            setVoiceActive(true);
            window.clearTimeout(voiceTimer);
            voiceTimer = window.setTimeout(() => setVoiceActive(false), 1050);
            setHeard(hit);
            onMatchRef.current();
            continue;
          }
          const text = options[0] ?? "";
          if (!text) continue;
          const now = performance.now();
          if (now - lastMiss < 1100) continue;
          lastMiss = now;
          setHeard(text);
          onMissRef.current(text);
        }
      };
      next.onerror = (event) => {
        if (event.error === "aborted" || event.error === "no-speech") return;
        cancelled = true;
        setPhase("blocked");
      };
      next.onend = () => {
        if (cancelled || holding || my !== generation) return;
        restartTimer = window.setTimeout(() => {
          if (!cancelled && !holding && my === generation) startRec();
        }, 180);
      };
      try { next.start(); if (!cancelled) setPhase("listening"); }
      catch { if (!cancelled) setPhase("blocked"); }
    };
    const say = (force: boolean) => {
      holding = true;
      window.clearTimeout(restartTimer);
      try { rec?.abort(); } catch { /* ignore */ }
      if (!(sound && (force || coach))) { holding = false; startRec(); return; }
      setPhase("speaking");
      speakLetter(letter, { onend: () => {
        holding = false;
        if (cancelled) return;
        window.setTimeout(() => { if (!cancelled) startRec(); }, 320);
      }});
    };
    speakNowRef.current = () => { if (!cancelled) say(true); };
    say(false);
    return () => {
      cancelled = true;
      window.clearTimeout(restartTimer);
      window.clearTimeout(voiceTimer);
      try { rec?.abort(); } catch { /* ignore */ }
      stopSpeaking();
      setVoiceActive(false);
      speakNowRef.current = () => {};
    };
  }, [enabled, letter, sound, coach, runId]);
  return { phase, heard, voiceActive, speakNow: () => speakNowRef.current() };
}
