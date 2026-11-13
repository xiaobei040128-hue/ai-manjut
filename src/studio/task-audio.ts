// Preload media files off the interaction path. No AudioContext is created here.
export type TaskCue='standard'|'premium'|'complete';
const kinds:TaskCue[]=['standard','premium','complete'];
let enabled=true;try{enabled=localStorage.getItem('task-sound-enabled')!=='0';}catch{}
let activationEpoch=0;
const pool=new Map<TaskCue,{audio:HTMLAudioElement;generation:number;unlocked:boolean}>();
export function taskSoundEnabled(){return enabled;}
export function stopTaskAudio(){for(const entry of pool.values()){entry.generation++;entry.audio.pause();try{entry.audio.currentTime=0;}catch{}}}
export function suspendTaskAudio(){activationEpoch++;stopTaskAudio();for(const entry of pool.values())entry.unlocked=false;}
export function setTaskSoundEnabled(value:boolean){enabled=value;try{localStorage.setItem('task-sound-enabled',value?'1':'0');}catch{}if(!value)suspendTaskAudio();}
export function prepareTaskAudio(){if(typeof Audio==='undefined')return;for(const kind of kinds){if(pool.has(kind))continue;const audio=new Audio('/audio/task-'+kind+'-v2.wav');audio.preload='auto';audio.volume=.35;pool.set(kind,{audio,generation:0,unlocked:false});audio.load();}}
// A silent play inside a gesture grants this media element playback permission.
// Generation checks prevent its late promise from pausing a real completion cue.
export function activateTaskAudio(){if(!enabled||document.hidden)return;for(const entry of pool.values()){if(entry.unlocked||!entry.audio.paused)continue;const generation=++entry.generation,epoch=activationEpoch;entry.audio.muted=true;entry.audio.volume=0;void entry.audio.play().then(()=>{if(epoch!==activationEpoch)return;entry.unlocked=true;if(entry.generation!==generation)return;entry.audio.pause();entry.audio.currentTime=0;entry.audio.muted=false;entry.audio.volume=.35;},()=>{});}}
export function playTaskCue(kind:TaskCue):()=>void{stopTaskAudio();if(!enabled||document.hidden)return()=>{};const entry=pool.get(kind);if(!entry)return()=>{};const generation=++entry.generation;entry.audio.muted=false;entry.audio.volume=.35;void entry.audio.play().catch(()=>{});return()=>{if(entry.generation!==generation)return;entry.generation++;entry.audio.pause();try{entry.audio.currentTime=0;}catch{}};}
