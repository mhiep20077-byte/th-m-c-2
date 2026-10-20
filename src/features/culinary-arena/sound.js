/**
 * =========================================================================
 * BỘ ÂM THANH CHIÊM TINH ẨM THỰC (CULINARY ORACLE SYNTHESIZER)
 * Tự sinh âm thanh huyền bí 100% bằng Web Audio API
 * =========================================================================
 */

let audioCtx = null;
let soundEnabled = true;

const SOUND_STORAGE_KEY = 'culinary-oracle-sound-enabled';

try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    if (saved !== null) {
        soundEnabled = saved === 'true';
    }
} catch (_) { }

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export function isSoundEnabled() {
    return soundEnabled;
}

export function toggleSound(forcedState) {
    soundEnabled = forcedState !== undefined ? Boolean(forcedState) : !soundEnabled;
    try {
        localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
    } catch (_) { }
    return soundEnabled;
}