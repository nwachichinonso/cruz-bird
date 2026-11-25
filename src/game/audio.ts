let audioCtx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

export function playCheer() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(523.25, now);
  osc.frequency.linearRampToValueAtTime(783.99, now + 0.14);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.34);
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((voice) => /en[-_]US/i.test(voice.lang) && /samantha|google|female|child/i.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

export function speakLetter(letter: string, hooks?: { onend?: () => void }) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    hooks?.onend?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.resume();
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(letter);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  utterance.pitch = 1.05;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    hooks?.onend?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  synth.speak(utterance);
  window.setTimeout(finish, 1800);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
