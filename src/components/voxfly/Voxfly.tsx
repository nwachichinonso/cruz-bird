import { useEffect, useRef, useState } from "react";
import { House, Mic, Pause, Play, RotateCcw, Shield, Star, Volume2, VolumeX } from "lucide-react";
import { playCheer, speakLetter, stopSpeaking, unlockAudio } from "@/game/audio";
import { LETTERS } from "@/game/letters";
import {
  defaultSave,
  learnedCount,
  loadSave,
  practiceLetters,
  todayKey,
  writeSave,
  type Save,
} from "@/game/save";
import { useLetterListener } from "@/game/useLetterListener";
import { SkyCanvas } from "@/components/voxfly/SkyCanvas";

type Screen = "splash" | "menu" | "setup" | "test" | "play" | "crashed" | "done" | "progress" | "gate" | "parent" | "break";

function minutesLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins <= 0) return `${secs} sec`;
  return `${mins} min ${secs} sec`;
}

export function CruzingBird() {
  const [save, setSave] = useState<Save>(() => defaultSave());
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>("splash");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [voiceHits, setVoiceHits] = useState(0);
  const [runReset, setRunReset] = useState(0);
  const [note, setNote] = useState("");
  const [cheer, setCheer] = useState(0);
  const [assist, setAssist] = useState(false);
  const [micNote, setMicNote] = useState("");
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [extraMs, setExtraMs] = useState(0);
  const [typed, setTyped] = useState("");
  const [shakeN, setShakeN] = useState(0);
  const [puzzle, setPuzzle] = useState({ a: 6, b: 7 });
  const [confirmReset, setConfirmReset] = useState(false);

  const indexRef = useRef(0);
  const screenRef = useRef<Screen>("splash");
  const pendingFrom = useRef(0);
  const gateNext = useRef<"parent" | "extra">("parent");
  const advanceLock = useRef(false);
  const failureLock = useRef(false);
  const voiceHitsRef = useRef(0);
  const voiceHitsRef = useRef(0);
  indexRef.current = index;
  screenRef.current = screen;

  useEffect(() => {
    const loaded = loadSave();
    setSave(loaded);
    setIndex(loaded.resumeIndex);
    indexRef.current = loaded.resumeIndex;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeSave(save);
  }, [save, hydrated]);

  useEffect(() => {
    const timer = window.setTimeout(() => setScreen((current) => (current === "splash" ? "menu" : current)), 1300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onHide = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(""), 1700);
    return () => window.clearTimeout(timer);
  }, [note]);

  useEffect(() => {
    if (screen !== "play" || paused) return;
    const timer = window.setInterval(() => {
      setSave((prev) => {
        const today = todayKey();
        const todayMs = (prev.today === today ? prev.todayMs : 0) + 1000;
        return { ...prev, today, todayMs };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, paused]);

  useEffect(() => {
    const limit = save.settings.playMinutes * 60 * 1000 + extraMs;
    if (screen === "play" && !paused && save.settings.playMinutes > 0 && save.todayMs >= limit) {
      setPaused(true);
      setScreen("break");
    }
  }, [save.todayMs, save.settings.playMinutes, extraMs, screen, paused]);

  useEffect(() => {
    if (screen !== "play" || paused || save.settings.input !== "voice") {
      setAssist(false);
      return;
    }
    setAssist(false);
    const timer = window.setTimeout(() => setAssist(true), 10000);
    return () => window.clearTimeout(timer);
  }, [screen, paused, index, save.settings.input]);

  useEffect(() => {
    if (screen !== "play" || paused || hidden) return;
    if (save.settings.input !== "tap") return;
    if (!save.settings.sound || !save.settings.coach) return;
    speakLetter(LETTERS[index].id);
    return () => stopSpeaking();
  }, [screen, paused, hidden, index, save.settings.input, save.settings.sound, save.settings.coach]);

  const score = () => {
    if (screenRef.current !== "play" || advanceLock.current || failureLock.current) return;
    advanceLock.current = true;
    window.setTimeout(() => {
      advanceLock.current = false;
    }, 700);
    const i = indexRef.current;
    const id = LETTERS[i].id;
    if (save.settings.sound) {
      unlockAudio();
      playCheer();
    }
    setCheer((value) => value + 1);
    const finished = i + 1 >= LETTERS.length;
    setSave((prev) => {
      const current = prev.letters[id] ?? { ok: 0, miss: 0 };
      const letters = {
        ...prev.letters,
        [id]: { ok: (Number(current.ok) || 0) + 1, miss: Number(current.miss) || 0 },
      };
      if (finished) {
        return { ...prev, letters, stars: prev.stars + 11, clears: prev.clears + 1, resumeIndex: 0 };
      }
      return { ...prev, letters, stars: prev.stars + 1, resumeIndex: i + 1 };
    });
    if (finished) {
      setNote("");
      setPaused(false);
      setScreen("done");
      return;
    }
    const next = i + 1;
    failureLock.current = false;
    voiceHitsRef.current = 0;
    setVoiceHits(0);
    indexRef.current = next;
    setIndex(next);
    setNote(`Yes! Now ${LETTERS[next].id}`);
  };

  const failRun = (heard?: string) => {
    if (screenRef.current !== "play" || failureLock.current) return;
    failureLock.current = true;
    setFailed(true);
    const id = LETTERS[indexRef.current].id;
    setNote(heard ? `I heard “${heard.slice(0, 28)}”. The bird is falling!` : `Say ${id} before the bird falls!`);
    setSave((prev) => {
      const current = prev.letters[id] ?? { ok: 0, miss: 0 };
      return { ...prev, resumeIndex: 0, letters: {
        ...prev.letters,
        [id]: { ok: Number(current.ok) || 0, miss: (Number(current.miss) || 0) + 1 },
      }};
    });
  };

  const scoreRef = useRef(score);
  scoreRef.current = score;

  const voiceOn =
    save.settings.input === "voice" && !hidden && ((screen === "play" && !paused && !failed) || screen === "test");

  const listener = useLetterListener({
    enabled: voiceOn,
    letter: screen === "test" ? "A" : LETTERS[index].id,
    sound: save.settings.sound,
    coach: save.settings.coach,
    runId: screen === "test" ? "test" : screen === "play" ? `play-${index}` : "idle",
    onMatch: () => {
      if (screenRef.current === "test") {
        startPlay(pendingFrom.current);
        return;
      }
      voiceHitsRef.current += 1;
      setVoiceHits(voiceHitsRef.current);
      if (voiceHitsRef.current >= 3) {
        voiceHitsRef.current = 0;
        setVoiceHits(0);
        scoreRef.current();
      }
    },
    onMiss: (text) => {
      if (screenRef.current !== "play") return;
      failRun(text);
    },
  });

  useEffect(() => {
    if (screen !== "play" || paused || failed || save.settings.input !== "voice" || listener.phase !== "listening") return;
    const timer = window.setTimeout(() => failRun(), 2500);
    return () => window.clearTimeout(timer);
  }, [screen, paused, failed, index, save.settings.input, listener.phase, listener.voicePulse]);

  useEffect(() => {
    if (screen !== "play" || paused) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "Escape") {
        setPaused(true);
        return;
      }
      const canTap =
        save.settings.input === "tap" ||
        assist ||
        listener.phase === "blocked" ||
        listener.phase === "unsupported";
      if (!canTap) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        scoreRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, paused, assist, listener.phase, save.settings.input]);

  function startPlay(from: number) {
    unlockAudio();
    const next = Math.max(0, Math.min(LETTERS.length - 1, from));
    indexRef.current = next;
    setIndex(next);
    setPaused(false);
    setFailed(false);
    failureLock.current = false;
    voiceHitsRef.current = 0;
    setVoiceHits(0);
    setRunReset((value) => value + 1);
    setNote("");
    setScreen("play");
    setSave((prev) => ({ ...prev, resumeIndex: next }));
  }

  function requestPlay(from: number) {
    unlockAudio();
    pendingFrom.current = from;
    if (!save.setupDone) {
      setMicNote("");
      setScreen("setup");
      return;
    }
    startPlay(from);
  }

  async function enableMic() {
    unlockAudio();
    setMicNote("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicNote("This browser cannot listen. Say the letter out loud, then tap it.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setSave((prev) => ({ ...prev, setupDone: true, settings: { ...prev.settings, input: "voice" } }));
      setScreen("test");
    } catch {
      setMicNote("Microphone permission was blocked. Say the letter out loud, then tap it.");
    }
  }

  function chooseTap() {
    unlockAudio();
    setSave((prev) => ({ ...prev, setupDone: true, settings: { ...prev.settings, input: "tap" } }));
    startPlay(pendingFrom.current);
  }

  function openGate(next: "parent" | "extra") {
    gateNext.current = next;
    setPuzzle({
      a: 4 + Math.floor(Math.random() * 6),
      b: 4 + Math.floor(Math.random() * 6),
    });
    setTyped("");
    setScreen("gate");
  }

  function submitGate() {
    if (Number(typed) !== puzzle.a + puzzle.b) {
      setShakeN((value) => value + 1);
      setTyped("");
      return;
    }
    if (gateNext.current === "parent") {
      setConfirmReset(false);
      setScreen("parent");
      return;
    }
    setExtraMs((value) => value + 5 * 60 * 1000);
    setPaused(false);
    setScreen("play");
  }

  function hear() {
    unlockAudio();
    if (!save.settings.sound) return;
    if (voiceOn && listener.phase !== "unsupported" && listener.phase !== "blocked") {
      listener.speakNow();
      return;
    }
    speakLetter(screen === "test" ? "A" : LETTERS[index].id);
  }

  function toggleSound() {
    unlockAudio();
    setSave((prev) => ({ ...prev, settings: { ...prev.settings, sound: !prev.settings.sound } }));
  }

  const letter = LETTERS[index];
  const showTap =
    screen === "play" &&
    (save.settings.input === "tap" || assist || listener.phase === "blocked" || listener.phase === "unsupported");
  const status =
    note ||
    (save.settings.input === "tap"
      ? "Say it out loud, then tap below"
      : listener.phase === "speaking"
        ? "Listen…"
        : listener.phase === "listening"
          ? "Listening"
          : listener.phase === "blocked" || listener.phase === "unsupported"
            ? "Say it out loud, then tap below"
            : "Get ready");
  const learned = learnedCount(save);
  const needsPractice = practiceLetters(save);

  return (
    <main className="stage">
      <SkyCanvas
        mode={screen === "play" && !paused ? "play" : "ambient"}
        difficulty={save.settings.difficulty}
        cheer={cheer}
        listening={listener.phase === "listening"}
        lift={listener.voiceActive}
        reduced={reduced}
        paused={screen === "play" && paused}
        failed={failed}
        reset={runReset}
        onCrash={() => setScreen("crashed")}
      />
      <div className="overlay pointer-events-none absolute inset-0 flex flex-col">
        {screen === "splash" && (
          <button type="button" className="pointer-events-auto mt-auto w-full text-left" onClick={() => setScreen("menu")}>
            <div className="card text-center">
              <h1 className="font-display text-6xl tracking-wide">Cruzing Bird</h1>
              <p className="mt-2 text-lg text-muted">KEEP TALKING. KEEP FLYING.</p>
            </div>
          </button>
        )}

        {screen === "menu" && (
          <div className="pointer-events-auto flex h-full flex-col">
            <div className="flex justify-end">
              <button type="button" className="icon-btn" onClick={toggleSound} aria-label={save.settings.sound ? "Sound on" : "Sound off"}>
                {save.settings.sound ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
            </div>
            <div className="card mt-4">
              <h1 className="font-display text-5xl tracking-wide">Cruzing Bird</h1>
              <p className="mt-1 text-muted">Say the same letter three times to power the bird forward.</p>
            </div>
            <div className="card mt-auto flex flex-col gap-3">
              <button type="button" className="btn btn-primary" onClick={() => requestPlay(save.resumeIndex)}>
                <Play size={22} />
                {save.resumeIndex > 0 ? `Continue from ${LETTERS[save.resumeIndex].id}` : "Play"}
              </button>
              {save.resumeIndex > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => requestPlay(0)}>
                  Start from A
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="btn btn-ghost" onClick={() => setScreen("progress")}>
                  <Star size={18} />
                  Letters
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => openGate("parent")}>
                  <Shield size={18} />
                  Grown-ups
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === "setup" && (
          <div className="pointer-events-auto mt-auto">
            <div className="card flex flex-col gap-3">
              <h1 className="font-display text-3xl">Say it out loud</h1>
              <p>Cruzing Bird listens only while you play. It does not save your voice.</p>
              <p className="text-muted">
                Keep saying the displayed letter. Each correct call lifts the bird; silence makes it sink. Listening works best in Chrome on Android.
                On iPhone, say the letter, then tap it if the mic cannot hear you.
              </p>
              {micNote && <p>{micNote}</p>}
              <button type="button" className="btn btn-primary" onClick={() => void enableMic()}>
                <Mic size={20} />
                Turn on microphone
              </button>
              <button type="button" className="btn btn-ghost" onClick={chooseTap}>
                Say it, then tap
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setScreen("menu")}>
                Back
              </button>
            </div>
          </div>
        )}

        {screen === "test" && (
          <div className="pointer-events-auto flex h-full flex-col">
            <div className="card mt-auto text-center">
              <p className="text-muted">Say this letter</p>
              <h1 className="font-display text-8xl leading-none">A</h1>
              <p className="mt-1 text-muted">as in apple</p>
              <p className="mt-3 flex items-center justify-center gap-2" aria-live="polite">
                {listener.phase === "listening" && <span className="listen-dot" />}
                {listener.phase === "speaking"
                  ? "Listen…"
                  : listener.phase === "listening"
                    ? "Listening"
                    : listener.phase === "blocked" || listener.phase === "unsupported"
                      ? "This browser cannot hear letters here."
                      : "Get ready"}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <button type="button" className="btn btn-ghost" onClick={hear} disabled={!save.settings.sound}>
                  <Volume2 size={18} />
                  Hear A
                </button>
                <button type="button" className="btn btn-primary" onClick={chooseTap}>
                  Play without the microphone
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === "play" && (
          <div className="pointer-events-none flex h-full flex-col">
            <div className="pointer-events-auto flex items-center justify-between gap-3">
              <button type="button" className="icon-btn" onClick={() => setPaused(true)} aria-label="Pause">
                <Pause size={22} />
              </button>
              <p className="flex items-center gap-1 font-display text-xl" aria-label={`${save.stars} stars`}>
                <Star size={18} className="text-gold" fill="currentColor" />
                {save.stars}
              </p>
              <button type="button" className="icon-btn" onClick={hear} aria-label={`Hear ${letter.id}`} disabled={!save.settings.sound}>
                <Volume2 size={22} />
              </button>
            </div>
            <div className="letter-hud mt-5 text-center">
              <LetterMark id={letter.id} example={letter.example} />
              <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-white/30 shadow-inner">
                <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${((index + 1) / LETTERS.length) * 100}%` }} />
              </div>
              <p className="mt-2 text-sm font-extrabold tracking-wide text-white drop-shadow">LETTER {index + 1} / {LETTERS.length} · {save.settings.input === "voice" ? `${voiceHits}/3 CALLS` : "TAP TO FLY"} · 3 CALLS TO FLY ON</p>
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-center text-ink" aria-live="polite">
              {listener.phase === "listening" && save.settings.input === "voice" && <span className="listen-dot" />}
              {status}
            </p>
            {showTap && (
              <button type="button" className="btn btn-gold pointer-events-auto mt-auto" onClick={() => scoreRef.current()}>
                I said {letter.id}
              </button>
            )}
          </div>
        )}

        {screen === "play" && paused && (
          <div className="pointer-events-auto absolute inset-0 flex items-center bg-ink/25 px-4">
            <div className="card flex w-full flex-col gap-3">
              <h2 className="font-display text-3xl">Paused</h2>
              <button type="button" className="btn btn-primary" onClick={() => setPaused(false)}>
                <Play size={18} />
                Resume
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPaused(false);
                  startPlay(0);
                }}
              >
                <RotateCcw size={18} />
                Start from A
              </button>
              <button type="button" className="btn btn-ghost" onClick={toggleSound}>
                {save.settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                Sound {save.settings.sound ? "on" : "off"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPaused(false);
                  setScreen("menu");
                }}
              >
                <House size={18} />
                Exit
              </button>
            </div>
          </div>
        )}

        {screen === "crashed" && (
          <div className="pointer-events-auto absolute inset-0 flex items-end bg-slate-950/20 px-4 pb-5">
            <div className="crash-panel w-full text-center">
              <div className="text-5xl" aria-hidden="true">💥</div>
              <h1 className="mt-2 font-display text-4xl">Bird down!</h1>
              <p className="mt-2 text-muted">That letter got away. Let’s start again from A.</p>
              <button type="button" className="btn btn-primary mt-5" onClick={() => startPlay(0)}>
                <RotateCcw size={20} /> Start again
              </button>
              <button type="button" className="btn btn-ghost mt-2" onClick={() => setScreen("menu")}>
                <House size={18} /> Main menu
              </button>
            </div>
          </div>
        )}

        {screen === "done" && (
          <div className="pointer-events-auto mt-auto">
            <div className="card flex flex-col gap-3 text-center">
              <div className="flex justify-center gap-2 text-gold">
                <Star fill="currentColor" />
                <Star fill="currentColor" />
                <Star fill="currentColor" />
              </div>
              <h1 className="font-display text-4xl">A to Z complete</h1>
              <p>You said every letter. 10 bonus stars for finishing. {save.stars} stars in all.</p>
              <p className="text-muted">Finished the alphabet {save.clears} {save.clears === 1 ? "time" : "times"}.</p>
              <button type="button" className="btn btn-primary" onClick={() => startPlay(0)}>
                Fly again
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setScreen("menu")}>
                Menu
              </button>
            </div>
          </div>
        )}

        {screen === "progress" && (
          <div className="pointer-events-auto mt-auto max-h-full overflow-auto">
            <div className="card">
              <h1 className="font-display text-3xl">Your letters</h1>
              <p className="mt-1 text-muted">
                {learned} of 26 learned · {save.stars} stars
              </p>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {LETTERS.map((item) => {
                  const known = (save.letters[item.id]?.ok ?? 0) > 0;
                  return (
                    <span key={item.id} className={known ? "choice choice-on px-0 text-center" : "choice px-0 text-center"}>
                      {item.id}
                    </span>
                  );
                })}
              </div>
              <button type="button" className="btn btn-primary mt-4" onClick={() => setScreen("menu")}>
                Back
              </button>
            </div>
          </div>
        )}

        {screen === "gate" && (
          <div className="pointer-events-auto mt-auto">
            <div key={shakeN} className={shakeN > 0 ? "card shake" : "card"}>
              <h1 className="font-display text-3xl">Grown-ups only</h1>
              <p className="mt-1">What is {puzzle.a} + {puzzle.b}?</p>
              <p className="mt-3 font-display text-4xl" aria-live="polite">
                {typed || "?"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button key={digit} type="button" className="choice" onClick={() => setTyped((value) => (value.length >= 2 ? value : value + digit))}>
                    {digit}
                  </button>
                ))}
                <button type="button" className="choice" onClick={() => setTyped((value) => value.slice(0, -1))}>
                  Back
                </button>
                <button type="button" className="choice" onClick={() => setTyped((value) => (value.length >= 2 ? value : `${value}0`))}>
                  0
                </button>
                <button type="button" className="choice choice-on" onClick={submitGate}>
                  OK
                </button>
              </div>
              <button type="button" className="btn btn-ghost mt-3" onClick={() => setScreen(gateNext.current === "extra" ? "break" : "menu")}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {screen === "parent" && (
          <div className="pointer-events-auto mt-auto max-h-full overflow-auto">
            <div className="card flex flex-col gap-4">
              <h1 className="font-display text-3xl">Grown-ups</h1>
              <p>
                {learned} of 26 letters learned. Play time today: {minutesLabel(save.todayMs)}. Alphabet clears: {save.clears}.
              </p>
              <p>
                Needs practice: {needsPractice.length > 0 ? needsPractice.join(", ") : "none yet"}.
              </p>
              <div>
                <p className="font-display text-lg">Difficulty</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={save.settings.difficulty === "easy" ? "choice choice-on" : "choice"}
                    onClick={() => setSave((prev) => ({ ...prev, settings: { ...prev.settings, difficulty: "easy" } }))}
                  >
                    Easy
                  </button>
                  <button
                    type="button"
                    className={save.settings.difficulty === "normal" ? "choice choice-on" : "choice"}
                    onClick={() => setSave((prev) => ({ ...prev, settings: { ...prev.settings, difficulty: "normal" } }))}
                  >
                    Normal
                  </button>
                </div>
              </div>
              <div>
                <p className="font-display text-lg">How you play</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={save.settings.input === "voice" ? "choice choice-on" : "choice"}
                    onClick={() => setSave((prev) => ({ ...prev, settings: { ...prev.settings, input: "voice" } }))}
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    className={save.settings.input === "tap" ? "choice choice-on" : "choice"}
                    onClick={() => setSave((prev) => ({ ...prev, settings: { ...prev.settings, input: "tap" } }))}
                  >
                    Say then tap
                  </button>
                </div>
              </div>
              <div>
                <p className="font-display text-lg">Play time limit</p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {[0, 5, 10, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={save.settings.playMinutes === mins ? "choice choice-on px-0" : "choice px-0"}
                      onClick={() =>
                        setSave((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, playMinutes: mins as Save["settings"]["playMinutes"] },
                        }))
                      }
                    >
                      {mins === 0 ? "Off" : mins}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className={save.settings.coach ? "choice choice-on" : "choice"}
                onClick={() => setSave((prev) => ({ ...prev, settings: { ...prev.settings, coach: !prev.settings.coach } }))}
              >
                Speak each new letter: {save.settings.coach ? "on" : "off"}
              </button>
              <button type="button" className={save.settings.sound ? "choice choice-on" : "choice"} onClick={toggleSound}>
                Sound: {save.settings.sound ? "on" : "off"}
              </button>
              <p className="text-muted">
                Voice stays on this device’s browser. Cruzing Bird does not store recordings. Words and numbers come in a later version.
                Add Cruzing Bird to your home screen to open it like an app on Android or iPhone.
              </p>
              {confirmReset ? (
                <div className="flex flex-col gap-2">
                  <p>Reset letters and stars?</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setSave((prev) => ({
                        ...defaultSave(),
                        settings: prev.settings,
                        setupDone: prev.setupDone,
                        today: prev.today,
                        todayMs: prev.todayMs,
                      }));
                      setIndex(0);
                      indexRef.current = 0;
                      setConfirmReset(false);
                    }}
                  >
                    Reset progress
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
                  Reset progress
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setScreen("menu")}>
                Done
              </button>
            </div>
          </div>
        )}

        {screen === "break" && (
          <div className="pointer-events-auto mt-auto">
            <div className="card flex flex-col gap-3">
              <h1 className="font-display text-4xl">Time for a rest</h1>
              <p>You have been flying for {minutesLabel(save.todayMs)} today. Your letters are saved.</p>
              <button type="button" className="btn btn-primary" onClick={() => setScreen("menu")}>
                Back to menu
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => openGate("extra")}>
                Keep playing
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function LetterMark({ id, example }: { id: string; example: string }) {
  const hue = (id.charCodeAt(0) * 37) % 360;
  return (
    <div key={id} className="letter-character letter-pop" role="img" aria-label={`Cartoon letter ${id}, as in ${example}`}>
      <svg viewBox="0 0 260 190" className="mx-auto block h-44 w-full max-w-[18rem] overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`letter-fill-${id}`} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor={`hsl(${hue} 94% 76%)`} />
            <stop offset="100%" stopColor={`hsl(${(hue + 28) % 360} 82% 48%)`} />
          </linearGradient>
          <filter id={`letter-shadow-${id}`} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="9" stdDeviation="4" floodColor="#16323a" floodOpacity=".28" />
          </filter>
        </defs>
        <g filter={`url(#letter-shadow-${id})`}>
          <text x="130" y="143" textAnchor="middle" fontFamily="Fredoka, Nunito, system-ui, sans-serif" fontSize="154" fontWeight="700" fill={`url(#letter-fill-${id})`} stroke="#fff9ee" strokeWidth="13" strokeLinejoin="round" paintOrder="stroke">{id}</text>
          <path d="M174 65 Q185 54 195 65" fill="none" stroke="#16323a" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="174" cy="83" rx="8" ry="11" fill="#fff" stroke="#16323a" strokeWidth="3" />
          <ellipse cx="197" cy="83" rx="8" ry="11" fill="#fff" stroke="#16323a" strokeWidth="3" />
          <circle cx="176" cy="85" r="3.6" fill="#16323a" />
          <circle cx="199" cy="85" r="3.6" fill="#16323a" />
          <path d="M181 105 Q187 113 194 104" fill="none" stroke="#16323a" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="163" cy="101" rx="7" ry="4" fill="#ff8b8b" opacity=".72" />
          <ellipse cx="207" cy="101" rx="7" ry="4" fill="#ff8b8b" opacity=".72" />
        </g>
        <path d="M48 128 Q34 138 30 151" fill="none" stroke="#fff9ee" strokeWidth="7" strokeLinecap="round" />
        <circle cx="28" cy="154" r="8" fill="#ffca55" stroke="#fff9ee" strokeWidth="4" />
        <path d="M210 135 Q225 142 230 153" fill="none" stroke="#fff9ee" strokeWidth="7" strokeLinecap="round" />
        <circle cx="232" cy="157" r="8" fill="#ffca55" stroke="#fff9ee" strokeWidth="4" />
      </svg>
      <p className="mt-1 font-display text-lg font-bold text-white drop-shadow">as in {example}</p>
    </div>
  );
}
