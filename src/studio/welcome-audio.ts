// Unlock only inside a user gesture. Suspended audio is never queued for later.
let context: AudioContext | undefined;
export async function unlockWelcomeAudio(): Promise<boolean> {
  try {
    if (!context || context.state === 'closed') context = new AudioContext({latencyHint: 'interactive'});
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch { return false; }
}
export function welcomeAudioReady(): boolean { return context?.state === 'running'; }
export function playWelcomeChime(delaySeconds: number): () => void {
  const audio = context;
  if (!audio || audio.state !== 'running') return () => {};
  const nodes: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  const cancel = () => { audio.removeEventListener('statechange', onState); nodes.forEach(n => { try { n.stop(); } catch {} n.disconnect(); }); gains.forEach(n => n.disconnect()); };
  const onState = () => { if (audio.state !== 'running') cancel(); };
  audio.addEventListener('statechange', onState);
  const start = audio.currentTime + Math.max(0, delaySeconds);
  [523.25, 783.99, 1046.5].forEach((frequency, i) => {
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    const at = start + i * .075;
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(.025, at + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, at + .65);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(at); oscillator.stop(at + .7);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); if (i === 2) audio.removeEventListener('statechange', onState); };
    nodes.push(oscillator); gains.push(gain);
  });
  return cancel;
}
