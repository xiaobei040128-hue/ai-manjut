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
  if (document.visibilityState === 'hidden' || !audio || audio.state !== 'running') return () => {};
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
    gain.gain.linearRampToValueAtTime(.06, at + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, at + .65);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(at); oscillator.stop(at + .7);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); if (i === 2) audio.removeEventListener('statechange', onState); };
    nodes.push(oscillator); gains.push(gain);
  });
  return cancel;
}

export function playTaskCue(kind:'standard'|'premium'|'complete'):()=>void{
 const audio=context;if(document.hidden||!audio||audio.state!=='running')return()=>{};
 const nodes:OscillatorNode[]=[],gains:GainNode[]=[];
 const stop=()=>{audio.removeEventListener('statechange',changed);nodes.forEach(n=>{try{n.stop();}catch{}n.disconnect();});gains.forEach(g=>g.disconnect());};
 const changed=()=>{if(audio.state!=='running')stop();};audio.addEventListener('statechange',changed);
 const notes=kind==='complete'?[659.25,830.61,987.77]:kind==='premium'?[440,659.25,880]:[587.33,880];
 notes.forEach((frequency,index)=>{const at=audio.currentTime+.03+index*(kind==='complete'?.095:.13),oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.055,at+.014);gain.gain.exponentialRampToValueAtTime(.0001,at+.62);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(at);oscillator.stop(at+.7);nodes.push(oscillator);gains.push(gain);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();if(index===notes.length-1)audio.removeEventListener('statechange',changed);};});
 return stop;
}
