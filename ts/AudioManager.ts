type SoundId =
    | "text_rolling"
    | "timer_fast"
    | "timer_slow"
    | "nuclear_explosion"
    | "running_gear"
    | "gong"
    | "telephone"
    | "dial_tone"
    | "siren";

const SOUND_SOURCES: Record<SoundId, string> = {
    text_rolling:     "./sounds/text_rolling.mp3",
    timer_fast:       "./sounds/timer_fast.mp3",
    timer_slow:       "./sounds/timer_slow.mp3",
    nuclear_explosion:"./sounds/nuclear_explosion.mp3",
    running_gear:     "./sounds/freesound_community-running-gear-6403.mp3",
    gong:             "./sounds/gong-sound.mp3",
    telephone:        "./sounds/telephone.mp3",
    dial_tone:        "./sounds/dial.mp3",
    siren:            "./sounds/siren.mp3",
};

const NUMBERS: Record<string, string> = {
    "1": "./sounds/numbers/1.mp3",
    "2": "./sounds/numbers/2.mp3",
    "3": "./sounds/numbers/3.mp3",
    "4": "./sounds/numbers/4.mp3",
    "5": "./sounds/numbers/5.mp3",
    "6": "./sounds/numbers/6.mp3",
    "7": "./sounds/numbers/7.mp3",
    "8": "./sounds/numbers/8.mp3",
    "9": "./sounds/numbers/9.mp3",
    "0": "./sounds/numbers/0.mp3",
};

/** Base path for all phone-graph node audio files. */
const PHONE_AUDIO_BASE = "./sounds/phone/";

class AudioManager {
    private static instance: AudioManager;

    /** Preloaded game sounds keyed by SoundId. */
    private sounds: Map<SoundId, HTMLAudioElement> = new Map();

    /**
     * Phone-graph node audio files, keyed by the audioKey from phoneGraphNodes.json
     * e.g. "audio_initial"  => HTMLAudioElement for ./sounds/phone/audio_initial.mp3
     */
    private phoneSounds: Map<string, HTMLAudioElement> = new Map();

    /** Currently playing phone audio, so we can stop it before the next node plays. */
    private activePhoneAudio: HTMLAudioElement | null = null;

    private loaded = false;

    private constructor() {}

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    // ── Loading───

    /**
     * Preloads all registered game sounds. Call once before the game starts.
     * Resolves even if individual files fail, so the game never hangs.
     */
    async loadAll(): Promise<void> {
        if (this.loaded) return;

        const entries = Object.entries(SOUND_SOURCES) as [SoundId, string][];
        await Promise.all(entries.map(([id, src]) => this.loadSound(id, src)));

        this.loaded = true;
        console.log("[AudioManager] All game sounds loaded.");
        return Promise.resolve();
    }

    /**
     * Preloads all phone-graph node audio files.
     * Pass the array of audioKey strings from phoneGraphNodes.json.
     *
     * @example
     * import nodes from "./phoneGraphNodes.json";
     * await AudioManager.getInstance().loadPhoneAudio(nodes.nodes.map(n => n.audioKey));
     */
    async loadPhoneAudio(audioKeys: string[]): Promise<void> {
        await Promise.all(audioKeys.map((key) => this.loadPhoneSound(key)));
        console.log("[AudioManager] All phone audio loaded.");
        return Promise.resolve();
    }

    private loadSound(id: SoundId, src: string): Promise<void> {

        return new Promise<void>((resolve) => {
            const audio = new Audio();
            audio.preload = "auto";

            const cleanup = () => {
                audio.removeEventListener("canplaythrough", onReady);
                audio.removeEventListener("error", onError);
            };
            const onReady = () => {
                this.sounds.set(id, audio);
                console.log(`[AudioManager] Loaded: ${id}`);
                this.updateLoadingScreen(`${id}.mp3`);
                cleanup();
                resolve();
            };
            const onError = () => {
                console.warn(`[AudioManager] Failed to load: ${id} (${src})`);
                cleanup();
                resolve();
            };

            audio.addEventListener("canplaythrough", onReady, { once: true });
            audio.addEventListener("error", onError, { once: true });
            audio.src = src;
            audio.load();
        });
    }

    private loadPhoneSound(audioKey: string): Promise<void> {
        return new Promise<void>((resolve) => {
            const src = `${PHONE_AUDIO_BASE}${audioKey}.mp3`;
            const audio = new Audio();
            audio.preload = "auto";

            const cleanup = () => {
                audio.removeEventListener("canplaythrough", onReady);
                audio.removeEventListener("error", onError);
            };
            const onReady = () => {
                this.phoneSounds.set(audioKey, audio);
                console.log(`[AudioManager] Phone audio loaded: ${audioKey}`);
                this.updateLoadingScreen(`${audioKey}.mp3`);
                cleanup();
                resolve();
            };
            const onError = () => {
                console.warn(`[AudioManager] Failed to load phone audio: ${audioKey} (${src})`);
                cleanup();
                resolve();
            };

            audio.addEventListener("canplaythrough", onReady, { once: true });
            audio.addEventListener("error", onError, { once: true });
            audio.src = src;
            audio.load();
        });
    }

    // ── Game sound playback ───────────────────────────────────────────────────

    get(id: SoundId): HTMLAudioElement | undefined {
        return this.sounds.get(id);
    }

    play(id: SoundId, loop = false): HTMLAudioElement | undefined {
        const audio = this.sounds.get(id);
        console.info(`[AudioManager:play] Playing: ${id}`);
        if (!audio) {
            console.warn(`[AudioManager:play] Sound not available: ${id}`);
            return undefined;
        }
        audio.loop = loop;
        audio.currentTime = 0;
        audio.play().catch((err) =>
            console.warn(`[AudioManager:play] Playback blocked for ${id}:`, err)
        );
        return audio;
    }

    stop(id: SoundId): void {
        const audio = this.sounds.get(id);
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
    }

    stopAll(): void {
        this.sounds.forEach((audio) => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.stopPhone();
    }

    // ── Phone audio playback ──────────────────────────────────────────────────

    /**
     * Plays the audio file for a phone-graph node.
     * Stops any currently playing phone audio first.
     * Returns the HTMLAudioElement so callers can attach onended if needed.
     */
    playPhone(audioKey: string): HTMLAudioElement | undefined {
        this.stopPhone();

        const audio = this.phoneSounds.get(audioKey);
        if (!audio) {
            console.warn(`[AudioManager] Phone audio not available: ${audioKey}`);
            return undefined;
        }

        audio.currentTime = 0;
        audio.play().catch((err) =>
            console.warn(`[AudioManager] Phone playback blocked for ${audioKey}:`, err)
        );

        this.activePhoneAudio = audio;
        return audio;
    }

    /** Returns the currently playing phone audio element, if any. */
    getActivePhoneAudio(): HTMLAudioElement | null {
        return this.activePhoneAudio;
    }

    /** Stops the currently playing phone audio clip, if any. */
    stopPhone(): void {
        if (this.activePhoneAudio) {
            this.activePhoneAudio.pause();
            this.activePhoneAudio.currentTime = 0;
            this.activePhoneAudio = null;
        }
    }

    async playKeyCode(keyCode: string): Promise<void> {
        // multiple numbers in keyCode (e.g. "1963") should play sequentially with 500ms pauses in between. 
        await new Promise((r) => setTimeout(r, 500));
        for (const char of keyCode) {
            const audioSrc = NUMBERS[char];
            if (!audioSrc) {
                console.warn(`[AudioManager] No audio for key code character: ${char}`);
                continue;
            }
            const audio = new Audio(audioSrc);
            await new Promise<void>((resolve) => {
                audio.addEventListener("canplaythrough", () => {
                    audio.play().catch((err) =>
                        console.warn(`[AudioManager] Playback blocked for key code ${char}:`, err)
                    );
                }, { once: true });
                audio.addEventListener("error", () => {
                    console.warn(`[AudioManager] Failed to load key code audio for ${char}: ${audioSrc}`);
                    resolve();
                }, { once: true });
                audio.addEventListener("ended", () => resolve(), { once: true });
                audio.load();
            });
            // 1s pause between digits
            await new Promise((r) => setTimeout(r, 500));
        }
        return Promise.resolve();
    }

    private updateLoadingScreen(file: string): void {
        const element = document.getElementById("loading-progress");
        if (element) {
            element.textContent = `Loaded ${file}`;
        }
    }
}

export { AudioManager, type SoundId };