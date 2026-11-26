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
  const voices = speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  if (!voices.length) return null;
  const preferred = [/samantha/i, /ava/i, /aria/i, /jenny/i, /google us english/i, /microsoft.*online/i, /natural|neural|enhanced|premium/i];
  for (const pattern of preferred) {
    const match = voices.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  return voices.find((voice) => /en[-_]US/i.test(voice.lang)) ?? voices[0];
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
  utterance.rate = 0.94;
  utterance.pitch = 1.12;
  utterance.volume = 1;
  let done = false;
  let started = false;
  let voiceTimer = 0;
  let finishTimer = 0;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(voiceTimer);
    window.clearTimeout(finishTimer);
    synth.removeEventListener("voiceschanged", startSpeaking);
    hooks?.onend?.();
  };
  const startSpeaking = () => {
    if (started || done) return;
    started = true;
    synth.removeEventListener("voiceschanged", startSpeaking);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
    finishTimer = window.setTimeout(finish, 2200);
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  if (synth.getVoices().length) startSpeaking();
  else {
    synth.addEventListener("voiceschanged", startSpeaking);
    voiceTimer = window.setTimeout(startSpeaking, 650);
  }
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
