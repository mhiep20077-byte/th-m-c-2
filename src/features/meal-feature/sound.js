import { rarityOf } from './foodRarity.js';

const STORAGE_KEY = 'bungoi-sounds-enabled';
const SOUND_DIR = '/sounds';

/**
 * Âm thanh lấy từ file thật trong /public/sounds, dùng cho những khoảnh khốc
 * đáng được đánh dấu: lắc hộp, bung nắp hòm, và lúc món lộ ra.
 *
 * Mỗi sự kiện có một tên tiếng tổng hợp (rattle, crate, reveal) làm dự phòng, nên
 * khi file không tải được, bị trình duyệt chặn, hay người dùng tắt tiếng thì
 * app vẫn có tiếng như trước chứ không mất hẳn hiệu ứng.
 */
const SOUND_FILES = {
    // Lắc hộp airdrop: tiếng sạo lắc bên trong hòm
    rattle: 'csgo_ui_crate_item_scroll.mp3',
    // Bung nắp hòm
    crate: 'csgo_ui_crate_open.mp3',
    // Món lộ ra, chia theo bậc hiếm tính từ giá món
    revealRare: 'item_reveal3_rare.mp3',
    revealMythical: 'item_reveal4_mythical.mp3',
    revealLegendary: 'item_reveal5_legendary.mp3',
    revealAncient: 'item_reveal6_ancient.mp3'
};

/** File đã tải xong thì cache lại để lần sau không phải đợi mạng */
const fileCache = new Map();
/** Những file đã thử mà không được, để thôi thử lại vô ích */
const fileFailed = new Set();
/** Lần tải đang dở, để các lần gọi gần nhau dùng chung */
const filePending = new Map();

/**
 * Mỗi nốt nhạc hỗ trợ thêm:
 * - type: 'tone' (mặc định) | 'noise' | 'sweep'
 * - attack: thời gian lên tiếng (giây), mặc định 0.012
 * - filter: { type, freq, endFreq, q } để lọc cho tiếng bớt chói
 * - pan: -1 (trái) → 1 (phải)
 * - echo: số lần vọng lại sau tiếng gốc
 */
const SOUND_NOTES = {
    tap: [
        { frequency: 680, endFrequency: 920, delay: 0, duration: 0.075, waveform: 'sine', volume: 0.035 },
        { type: 'noise', delay: 0, duration: 0.045, volume: 0.012, filter: { type: 'highpass', freq: 2600 }, attack: 0.004 }
    ],
    tick: [{ type: 'noise', delay: 0, duration: 0.03, volume: 0.016, filter: { type: 'bandpass', freq: 3200, q: 2 } }],

    /* Bấm nút BỤP: tiếng bịch lục xuống, rung cả khung */
    press: [
        { type: 'noise', delay: 0, duration: 0.12, volume: 0.04, attack: 0.003, filter: { type: 'lowpass', freq: 1400 } },
        { frequency: 190, endFrequency: 90, delay: 0, duration: 0.22, waveform: 'sine', volume: 0.05 },
        { frequency: 640, endFrequency: 300, delay: 0.01, duration: 0.1, waveform: 'triangle', volume: 0.02 }
    ],

    /* Vòng quay: tiếng rít bắt đầu, tiếng cọ xanh giảm dần khi chậm lại */
    spin: [
        { type: 'noise', delay: 0, duration: 0.7, volume: 0.028, attack: 0.05, filter: { type: 'bandpass', freq: 700, endFreq: 2200, q: 0.6 } },
        { frequency: 300, endFrequency: 1200, delay: 0, duration: 0.6, waveform: 'sawtooth', volume: 0.018, filter: { type: 'lowpass', freq: 1800, endFreq: 3600 } }
    ],

    /* Máy quét tên món: tiếng lạch cạch dồn dần */
    scan: [
        { type: 'noise', delay: 0, duration: 0.06, volume: 0.02, attack: 0.002, filter: { type: 'bandpass', freq: 2800, q: 3 } },
        { frequency: 420, endFrequency: 1500, delay: 0, duration: 0.16, waveform: 'sine', volume: 0.016, echo: 1 },
        { type: 'noise', delay: 0.18, duration: 0.6, volume: 0.014, attack: 0.15, filter: { type: 'bandpass', freq: 1100, endFreq: 3400, q: 0.8 } }
    ],

    /* Trúng món: chuông ăn mừng, dày và vang */
    jackpot: [
        { frequency: 523.25, delay: 0, duration: 0.3, waveform: 'triangle', volume: 0.038, echo: 2 },
        { frequency: 659.25, delay: 0.05, duration: 0.32, waveform: 'sine', volume: 0.034, echo: 2 },
        { frequency: 783.99, delay: 0.1, duration: 0.34, waveform: 'sine', volume: 0.032, echo: 3, pan: 0.2 },
        { frequency: 1046.5, delay: 0.16, duration: 0.4, waveform: 'sine', volume: 0.03, echo: 3 },
        { frequency: 1318.51, delay: 0.24, duration: 0.5, waveform: 'sine', volume: 0.024, echo: 4, pan: -0.2 },
        { frequency: 1567.98, delay: 0.33, duration: 0.6, waveform: 'sine', volume: 0.02, echo: 5 },
        { type: 'noise', delay: 0.3, duration: 0.5, volume: 0.014, attack: 0.06, filter: { type: 'highpass', freq: 6000 } }
    ],
    roll: [
        { frequency: 240, endFrequency: 370, delay: 0, duration: 0.28, waveform: 'triangle', volume: 0.035 },
        { frequency: 310, endFrequency: 470, delay: 0.09, duration: 0.25, waveform: 'sine', volume: 0.025 },
        { frequency: 420, endFrequency: 640, delay: 0.2, duration: 0.22, waveform: 'triangle', volume: 0.03 },
        { frequency: 570, endFrequency: 820, delay: 0.32, duration: 0.2, waveform: 'sine', volume: 0.025 }
    ],
    success: [
        { frequency: 523.25, delay: 0, duration: 0.24, waveform: 'sine', volume: 0.04 },
        { frequency: 659.25, delay: 0.045, duration: 0.26, waveform: 'triangle', volume: 0.027 },
        { frequency: 783.99, delay: 0.09, duration: 0.3, waveform: 'sine', volume: 0.035 },
        { frequency: 1046.5, delay: 0.15, duration: 0.36, waveform: 'sine', volume: 0.025, echo: 2 },
        { frequency: 1318.5, delay: 0.22, duration: 0.5, waveform: 'sine', volume: 0.018, echo: 3 }
    ],
    error: [
        { frequency: 392, endFrequency: 330, delay: 0, duration: 0.13, waveform: 'triangle', volume: 0.035 },
        { frequency: 293.66, endFrequency: 246.94, delay: 0.1, duration: 0.18, waveform: 'sine', volume: 0.03 }
    ],

    /* Pháo bắn lên: tiếng nổ đầy, tiếng cháy, tiếng vút theo tầm xa */
    launch: [
        { type: 'noise', delay: 0, duration: 0.5, volume: 0.05, attack: 0.008, filter: { type: 'lowpass', freq: 1800, endFreq: 400, q: 0.9 } },
        { frequency: 110, endFrequency: 62, delay: 0, duration: 0.42, waveform: 'sine', volume: 0.05 },
        { frequency: 380, endFrequency: 1250, delay: 0.02, duration: 0.5, waveform: 'sawtooth', volume: 0.026, filter: { type: 'lowpass', freq: 2600, endFreq: 4200 } },
        { frequency: 760, endFrequency: 1900, delay: 0.16, duration: 0.42, waveform: 'sine', volume: 0.024, echo: 1 },
        { frequency: 1250, endFrequency: 2400, delay: 0.3, duration: 0.3, waveform: 'triangle', volume: 0.018 }
    ],

    /* Máy bay thả hòm: tiếng gió réo và tiếng hòm rơi xuống */
    drop: [
        { type: 'noise', delay: 0, duration: 0.55, volume: 0.03, attack: 0.03, filter: { type: 'bandpass', freq: 900, endFreq: 2600, q: 0.7 } },
        { frequency: 880, endFrequency: 320, delay: 0, duration: 0.45, waveform: 'triangle', volume: 0.028 },
        { frequency: 520, endFrequency: 210, delay: 0.42, duration: 0.4, waveform: 'sine', volume: 0.024 },
        { frequency: 1400, endFrequency: 900, delay: 0.4, duration: 0.2, waveform: 'sine', volume: 0.012, pan: -0.4 }
    ],

    /* Hòm chạm đất: tiếng cộp + tiếng trầm rung */
    thud: [
        { type: 'noise', delay: 0, duration: 0.16, volume: 0.045, attack: 0.003, filter: { type: 'lowpass', freq: 900 } },
        { frequency: 130, endFrequency: 58, delay: 0, duration: 0.3, waveform: 'sine', volume: 0.055 },
        { frequency: 300, endFrequency: 160, delay: 0.01, duration: 0.18, waveform: 'triangle', volume: 0.024 }
    ],

    /* Bung nắp hòm: tiếng kim loại và tiếng lò xong */
    crate: [
        { type: 'noise', delay: 0, duration: 0.1, volume: 0.03, attack: 0.003, filter: { type: 'bandpass', freq: 4200, q: 1.4 } },
        { frequency: 523.25, endFrequency: 1046.5, delay: 0, duration: 0.28, waveform: 'triangle', volume: 0.032, echo: 1 },
        { frequency: 659.25, endFrequency: 1318.5, delay: 0.07, duration: 0.32, waveform: 'sine', volume: 0.028 },
        { frequency: 783.99, endFrequency: 1567.98, delay: 0.14, duration: 0.36, waveform: 'sine', volume: 0.024 }
    ],

    /* Món lộ ra: chuông pha chút lốp bốp, có vọng cho sang */
    reveal: [
        { frequency: 880, delay: 0, duration: 0.5, waveform: 'sine', volume: 0.03, echo: 3 },
        { frequency: 1174.66, delay: 0.06, duration: 0.55, waveform: 'sine', volume: 0.026, echo: 3, pan: 0.3 },
        { frequency: 1567.98, delay: 0.12, duration: 0.7, waveform: 'sine', volume: 0.022, echo: 4, pan: -0.3 },
        { type: 'noise', delay: 0.02, duration: 0.3, volume: 0.012, filter: { type: 'highpass', freq: 5200 }, attack: 0.02 }
    ],

    /* Vòng quay dừng: tiếng lắp cộp dồn */
    stop: [
        { frequency: 1046.5, delay: 0, duration: 0.34, waveform: 'sine', volume: 0.032, echo: 2 },
        { frequency: 1318.5, delay: 0.05, duration: 0.4, waveform: 'sine', volume: 0.024, echo: 3 },
        { frequency: 1567.98, delay: 0.1, duration: 0.5, waveform: 'sine', volume: 0.016, echo: 4 }
    ],

    /* Lắc hộp bốc món: tiếng sạo lắc lơ lửng rồi tiếng bật nắp, dài đúng một vòng lắc */
    rattle: [
        { type: 'noise', delay: 0, duration: 0.1, volume: 0.024, attack: 0.004, filter: { type: 'bandpass', freq: 2200, q: 1.6 } },
        { type: 'noise', delay: 0.12, duration: 0.1, volume: 0.028, attack: 0.004, filter: { type: 'bandpass', freq: 2800, q: 1.8 } },
        { type: 'noise', delay: 0.24, duration: 0.12, volume: 0.032, attack: 0.004, filter: { type: 'bandpass', freq: 3400, q: 2 } },
        { type: 'noise', delay: 0.37, duration: 0.12, volume: 0.036, attack: 0.004, filter: { type: 'bandpass', freq: 4000, q: 2.2 } },
        { type: 'noise', delay: 0.5, duration: 0.12, volume: 0.034, attack: 0.004, filter: { type: 'bandpass', freq: 3200, q: 2 } },
        { type: 'noise', delay: 0.62, duration: 0.1, volume: 0.026, attack: 0.004, filter: { type: 'bandpass', freq: 2400, q: 1.6 } },
        { frequency: 180, endFrequency: 270, delay: 0, duration: 0.72, waveform: 'triangle', volume: 0.018, filter: { type: 'lowpass', freq: 1200 } },
        { type: 'noise', delay: 0.7, duration: 0.08, volume: 0.02, attack: 0.002, filter: { type: 'highpass', freq: 3400 } },
        { frequency: 660, endFrequency: 1320, delay: 0.71, duration: 0.2, waveform: 'sine', volume: 0.024 }
    ],

    /* Món lộ ra trên khay: tiếng "póp" nhẹ kèm nốt ngân */
    plating: [
        { type: 'noise', delay: 0, duration: 0.07, volume: 0.026, attack: 0.002, filter: { type: 'bandpass', freq: 2600, q: 1.2 } },
        { frequency: 880, delay: 0, duration: 0.3, waveform: 'sine', volume: 0.028, echo: 2 },
        { frequency: 1174.66, delay: 0.05, duration: 0.36, waveform: 'sine', volume: 0.022, echo: 2, pan: 0.2 }
    ],

    /* Dọn món: tiếng đĩa đặt xuống bàn rồi tiếng gõ pha lê */
    plate: [
        { type: 'noise', delay: 0, duration: 0.1, volume: 0.04, attack: 0.002, filter: { type: 'bandpass', freq: 5200, q: 1.1 } },
        { frequency: 392, endFrequency: 261.63, delay: 0, duration: 0.26, waveform: 'triangle', volume: 0.034 },
        { frequency: 1046.5, delay: 0.06, duration: 0.42, waveform: 'sine', volume: 0.03, echo: 2 },
        { frequency: 1318.51, delay: 0.13, duration: 0.5, waveform: 'sine', volume: 0.026, echo: 3 },
        { frequency: 1567.98, delay: 0.2, duration: 0.6, waveform: 'sine', volume: 0.02, echo: 4, pan: 0.25 },
        { frequency: 2093, delay: 0.28, duration: 0.7, waveform: 'sine', volume: 0.014, echo: 4, pan: -0.25 }
    ],

    /* Hơi nước bốc lên từ bữa ăn vừa dọn */
    steam: [
        { type: 'noise', delay: 0, duration: 1.1, volume: 0.016, attack: 0.35, filter: { type: 'bandpass', freq: 1600, endFreq: 5200, q: 0.5 } },
        { frequency: 523.25, delay: 0.12, duration: 0.9, waveform: 'sine', volume: 0.012, echo: 2, pan: 0.3 },
        { frequency: 659.25, delay: 0.24, duration: 0.85, waveform: 'sine', volume: 0.01, echo: 2, pan: -0.3 }
    ],

    /* Tiếng kim loại khi chốt lại một món trên khay */
    coin: [
        { frequency: 1318.51, delay: 0, duration: 0.16, waveform: 'triangle', volume: 0.026, echo: 1 },
        { frequency: 1975.53, delay: 0.04, duration: 0.22, waveform: 'sine', volume: 0.016, echo: 2, pan: 0.2 }
    ]
};

function readSoundPreference() {
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

function saveSoundPreference() {
    try {
        localStorage.setItem(STORAGE_KEY, String(soundEnabled));
    } catch {
        // Sound still works when browser storage is unavailable.
    }
}

function updateSoundButton(button) {
    if (!button) return;
    const label = soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(soundEnabled));
    button.title = label;
    button.classList.toggle('is-muted', !soundEnabled);
    button.querySelector('[data-sound-icon]').textContent = soundEnabled ? '🔊' : '🔇';
    button.querySelector('[data-sound-label]').textContent = soundEnabled ? 'Âm thanh bật' : 'Âm thanh tắt';
}

let audioContext;
let noiseBuffer;
let soundEnabled = readSoundPreference();

/** Đệm nhiễu trắng dùng lại cho các tiếng gió, tiếng nổ, tiếng lún */
function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;

    const frames = Math.floor(audioContext.sampleRate * 1.2);
    noiseBuffer = audioContext.createBuffer(1, frames, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

    return noiseBuffer;
}

/** Tạo node lọc cho tiếng bớt chói tai */
function createFilterNode({ type, freq, endFreq, q } = {}) {
    if (!type) return null;

    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q || 1;
    filter.frequency.setValueAtTime(freq, audioContext.currentTime);
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(endFreq, audioContext.currentTime + 0.5);
    return filter;
}

/**
 * Phát một nốt, có thêm tiếng vọng chậm dần để âm thanh nghe rộng và sang hơn
 */
function playNote(note, startTime, isEcho = false) {
    const { frequency, endFrequency, delay, duration, waveform, volume: peakVolume, type, attack, filter: filterSpec, pan, echo } = note;
    const noteStart = startTime + delay;
    const attackTime = Math.max(attack ?? 0.012, 0.004);

    let source;
    if (type === 'noise') {
        source = audioContext.createBufferSource();
        source.buffer = getNoiseBuffer();
        source.loop = true;
    } else {
        source = audioContext.createOscillator();
        source.type = waveform || 'sine';
        source.frequency.setValueAtTime(frequency, noteStart);
        if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, noteStart + duration);
    }

    const volume = audioContext.createGain();
    const target = (peakVolume || 0.04) * (isEcho ? 0.42 : 1);

    volume.gain.setValueAtTime(0.0001, noteStart);
    volume.gain.exponentialRampToValueAtTime(target, noteStart + attackTime);
    volume.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);

    let tail = source;
    const filterNode = createFilterNode(filterSpec);
    if (filterNode) {
        tail.connect(filterNode);
        tail = filterNode;
    }

    if (pan) {
        const panner = audioContext.createStereoPanner();
        panner.pan.value = pan;
        tail.connect(panner);
        panner.connect(volume);
    } else {
        tail.connect(volume);
    }

    volume.connect(audioContext.destination);
    source.start(noteStart);
    source.stop(noteStart + duration + 0.02);

    if (!isEcho && echo) {
        let echoDelay = 0.11;
        for (let i = 0; i < echo; i += 1) {
            playNote(note, startTime + echoDelay, true);
            echoDelay += 0.13;
        }
    }
}

/**
 * Phát âm thanh giao diện.
 * @param {string} type - Tên nhóm âm thanh trong SOUND_NOTES
 * @param {{volume?: number, rate?: number}} [options] - volume nhân thêm (0.2 → 2), rate đổi tốc độ (0.5 → chậm, 2 → nhanh)
 */
export function playUiSound(type = 'tap', options = {}) {
    if (!soundEnabled) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const volumeScale = options.volume ?? 1;
    const rate = Math.min(Math.max(options.rate ?? 1, 0.25), 4);

    try {
        audioContext ??= new AudioContextClass();
        if (audioContext.state === 'suspended') void audioContext.resume();

        const startTime = audioContext.currentTime + 0.01;
        (SOUND_NOTES[type] || SOUND_NOTES.tap).forEach(note => {
            playNote(rate === 1 ? note : { ...note, frequency: note.frequency * rate, endFrequency: note.endFrequency ? note.endFrequency * rate : undefined, duration: note.duration / rate, delay: note.delay / rate, volume: (note.volume ?? 0.04) * volumeScale }, startTime);
        });
    } catch {
        // A sound failure must not interrupt the food-picking flow.
    }
}

/**
 * Lấy về một file âm thanh, nhớ lại để các lần sau dùng lại.
 * Trình duyệt chỉ cho tải file khi có tương tác, nên hàm này chỉ chạy sau khi
 * người dùng đã bấm hoặc kéo, tức là đúng lúc AudioContext cũng được mở.
 * @param {string} key - Khoá trong SOUND_FILES
 * @returns {Promise<HTMLAudioElement|null>} null nếu không lấy được
 */
function loadSoundFile(key) {
    const fileName = SOUND_FILES[key];
    if (!fileName) return Promise.resolve(null);
    if (fileFailed.has(key)) return Promise.resolve(null);
    if (fileCache.has(fileName)) return Promise.resolve(fileCache.get(fileName));
    // Đang tải dở thì dùng chung một lần tải, tránh mỗi lần bốc tạo thêm một Audio mới
    if (filePending.has(key)) return filePending.get(key);

    const pending = new Promise(resolve => {
        try {
            const audio = new Audio(`${SOUND_DIR}/${fileName}`);
            audio.preload = 'auto';
            audio.volume = 0.7;

            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                fileCache.set(fileName, audio);
                resolve(audio);
            };
            const fail = () => {
                if (settled) return;
                settled = true;
                // Đánh dấu hỏng để những lần bốc sau không cố tải lại file này nữa
                fileFailed.add(key);
                resolve(null);
            };

            audio.addEventListener('canplaythrough', done, { once: true });
            audio.addEventListener('error', fail, { once: true });
            audio.load();

            // File có thể nằm sẵn trong bộ nhớ đệm nên sự kiện không kịp bắn,
            // kiểm tra readyState để không treo promise vĩnh viễn
            if (audio.readyState >= 3) done();
        } catch {
            fail();
        }
    }).finally(() => filePending.delete(key));

    filePending.set(key, pending);
    return pending;
}

/**
 * Phát một file âm thanh, chỉ phát được khi file tải xong.
 * @param {string} key - Khoá trong SOUND_FILES
 * @param {number} [volumeScale] - Nhân thêm âm lượng (1 → giữ nguyên)
 * @returns {boolean} true nếu đã phát được
 */
async function playSoundFile(key, volumeScale = 1) {
    if (!soundEnabled) return false;

    const audio = await loadSoundFile(key);
    if (!audio) return false;

    try {
        // Một file có thể bị dùng lại liên tiếp nhiều lần, cần tua lại từ đầu
        audio.currentTime = 0;
        audio.volume = Math.min(Math.max(0.7 * volumeScale, 0), 1);
        await audio.play();
        return true;
    } catch {
        return false;
    }
}

/**
 * Phát tiếng lắc hòm / lắc hộp: ưu tiên file thật, không có thì rơi về tiếng tổng hợp.
 * @param {number} [volumeScale]
 * @returns {boolean} true nếu phát được file
 */
export async function playCrateRattleSound(volumeScale = 1) {
    if (!soundEnabled) return false;
    if (await playSoundFile('rattle', volumeScale)) return true;
    playUiSound('rattle');
    return false;
}

/**
 * Phát tiếng bung nắp hòm: ưu tiên file thật, không có thì rơi về tiếng tổng hợp.
 * @param {number} [volumeScale]
 * @returns {boolean} true nếu phát được file
 */
export async function playCrateOpenSound(volumeScale = 1) {
    if (!soundEnabled) return false;
    if (await playSoundFile('crate', volumeScale)) return true;
    playUiSound('crate');
    return false;
}

/**
 * Phát tiếng món lộ ra, chọn file theo bậc hiếm của món.
 *
 * Món bình thường không có file riêng nên dùng tiếng "hiếm" cho nhẹ, còn món đắt dần
 * thì nổ tiếng mạnh và dài hơn: càng đắt càng nghe ra món đó đắc. Món phổ thông
 * không có bậc nào thì dùng đúng tiếng reveal tổng hợp sẵn có.
 * @param {Object} dish - Món vừa lộ ra
 * @param {number} [volumeScale]
 * @returns {boolean} true nếu phát được file
 */
export async function playRevealSound(dish, volumeScale = 1) {
    if (!soundEnabled) return false;

    const tier = rarityOf(dish);
    const scale = volumeScale * (tier.gain ?? 1);

    if (tier.sound && await playSoundFile(tier.sound, scale)) return true;

    // File của bậc này không tải được thì thử bậc dưới cho đỡ mất tiếng
    const fallbacks = {
        revealAncient: 'revealLegendary',
        revealLegendary: 'revealMythical',
        revealMythical: 'revealRare'
    };
    const lower = fallbacks[tier.sound];
    if (lower && await playSoundFile(lower, scale)) return true;

    playUiSound('reveal');
    return false;
}

/**
 * Tải sẵn các file âm thanh nặng.
 * Gọi ngay khi người dùng lần đầu chạm vào trang, vì trình duyệt chỉ cho tải file
 * sau tương tác. Nhờ vậy lúc món lộ ra, file đã nằm sẵn và tiếng nổ đúng nhịp với hình.
 */
function preloadSoundFiles() {
    Object.keys(SOUND_FILES).forEach(loadSoundFile);
}

/** Dừng mọi file đang phát, dùng khi người dùng tắt tiếng giữa chừng */
function stopSoundFiles() {
    fileCache.forEach(audio => {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch {
            // Bỏ qua, dừng tiếng không được thì không được làm hỏng cả trang
        }
    });
}

export function initializeSounds() {
    const toggle = document.getElementById('sound-toggle');
    updateSoundButton(toggle);

    // Tương tác đầu tiên là lúc trình duyệt cho phép tải file âm thanh
    const warmUp = () => {
        if (soundEnabled) preloadSoundFiles();
        document.removeEventListener('pointerdown', warmUp);
        document.removeEventListener('keydown', warmUp);
    };
    document.addEventListener('pointerdown', warmUp, { once: true });
    document.addEventListener('keydown', warmUp, { once: true });

    toggle?.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        saveSoundPreference();
        updateSoundButton(toggle);
        if (soundEnabled) {
            preloadSoundFiles();
            playUiSound('tap');
        } else {
            stopSoundFiles();
        }
    });

    document.addEventListener('click', (event) => {
        const target = event.target.closest('button, a, [role="button"], .dish-card');
        // Các nút đã tự phát tiếng riêng thì không cộng thêm tiếng tap
        if (!target || target.id === 'sound-toggle'
            || target.matches('.btn-roll, .btn-wheel-spin, .wheel-hub, .airdrop-launch-button, .airdrop-crate, [data-action="reroll"], .meal-btn, [data-action="roll"], [data-action="roll-all"], [data-action="serve"], [data-action="new"]')) return;
        playUiSound('tap');
    }, true);

    document.addEventListener('change', (event) => {
        if (event.target.matches('select, input[type="checkbox"], input[type="radio"]')) {
            playUiSound('tap');
        }
    });
}