import TutorialHandler from "./Tutorial.ts";
import { AudioManager } from "./AudioManager.ts";
import { buildPhoneGraph, PhoneGraph } from "./PhoneGraph.ts";
import { PhoneGraphKeys } from "./PhoneGraphKeys.ts";
import phoneGraphNodes from "./phoneGraphNodes.json";

class GameEngine {
    static instance: any;
    static readonly GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes

    private mainContainer: HTMLElement;
    private audio: AudioManager;
    private countdownStartTime: number | null = null;
    private isGameOver: boolean = false;
    private audioDramaStage: number = 0;
    private timerInterval: number | null = null;
    private phoneGraph: PhoneGraph | null = null;
    private missileAnimFrame: number | null = null;

    constructor() {
        this.audio = AudioManager.getInstance();
        const gameContainer = document.getElementById("game-container");
        if (!(gameContainer instanceof HTMLElement)) {
            throw new Error("[GameEngine] Missing #game-container element.");
        }
        this.mainContainer = gameContainer;
        console.log("Game Engine Initialized");
    }

    static getInstance() {
        if (!GameEngine.instance) {
            GameEngine.instance = new GameEngine();
        }
        return GameEngine.instance;
    }

    public async start() {
        await this.loadAssets();

        const introScreen = document.querySelector(".intro") as HTMLElement;
        introScreen.classList.add("fade-out");
        await new Promise(resolve => setTimeout(resolve, 700));
        introScreen.classList.add("hidden");

        this.mainContainer.classList.remove("hidden");
        await TutorialHandler.getInstance().startTutorial(this.mainContainer);

        console.log("Game started!");
        await this.setupGameplay();
        console.log("Ready for game loop...");
    }

    private async loadAssets() {
        console.log("Loading assets...");
        // Load game sounds and phone audio in parallel
        await Promise.all([
            this.audio.loadAll(),
            this.audio.loadPhoneAudio(
                phoneGraphNodes.nodes.map((n) => n.audioKey)
            ),
        ]);
    }

    private async setupGameplay() {
        const wrapper = document.createElement("div");
        wrapper.classList.add("gameplay-wrapper");
        this.mainContainer.appendChild(wrapper);

        // Upper panel: timer and world map
        const upperPanel = document.createElement("div");
        upperPanel.classList.add("upper-panel");

        const timerElement = document.createElement("h2");
        timerElement.id = "game-timer";
        upperPanel.appendChild(timerElement);

        const mapContainer = document.createElement("div");
        mapContainer.classList.add("map-container");

        const worldMap = document.createElement("img");
        worldMap.src = "./images/MapChart_Map.svg";
        worldMap.classList.add("world-map");
        mapContainer.appendChild(worldMap);

        const missileCanvas = document.createElement("canvas");
        missileCanvas.classList.add("missile-canvas");
        mapContainer.appendChild(missileCanvas);

        upperPanel.appendChild(mapContainer);
        this.startMissileAnimation(missileCanvas);

        wrapper.appendChild(upperPanel);

        this.updateTimer();
        this.timerInterval = window.setInterval(() => this.updateTimer(), 100);

        // Lower panel: phone interface
        const lowerPanel = document.createElement("div");
        lowerPanel.classList.add("lower-panel");

        const phone = document.createElement("img");
        phone.src = "./images/telephone.png";
        phone.classList.add("phone");
        lowerPanel.appendChild(phone);

        wrapper.appendChild(lowerPanel);

        // Phone ringing
        const ringAudio = AudioManager.getInstance().play("telephone") as HTMLAudioElement;
        await new Promise<void>((resolve) => {
            ringAudio.onended = () => resolve();
        });

        this.startPhoneGraph();
    }

    private startPhoneGraph(): void {
        this.phoneGraph = buildPhoneGraph();
        this.patchGameWonNode();
        this.phoneGraph.start();
        console.log("[GameEngine] PhoneGraph started.");
    }


    // Missile animation along a quadratic Bézier curve, synced to the game timer
    private stopMissileAnimation(): void {
        if (this.missileAnimFrame !== null) {
            cancelAnimationFrame(this.missileAnimFrame);
            this.missileAnimFrame = null;
        }
    }

    private startMissileAnimation(canvas: HTMLCanvasElement): void {
        this.stopMissileAnimation();

        // Quadratic Bézier: P0 → P1 (control) → P2
        // Passes through (0.30, 0.25) at t = 0.5
        const P0 = { x: 0.70, y: 0.23 };
        const P2 = { x: 0.06, y: 0.65 };
        const P1 = {
            x: 2 * 0.30 - 0.5 * P0.x - 0.5 * P2.x, // 0.275
            y: 2 * 0.25 - 0.5 * P0.y - 0.5 * P2.y,  // 0.10
        };

        const bezierPos = (t: number) => ({
            x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t ** 2 * P2.x,
            y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t ** 2 * P2.y,
        });

        // Un-normalised tangent — scale axes by canvas size when computing angle
        const bezierTangent = (t: number) => ({
            dx: 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x),
            dy: 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y),
        });

        const TOTAL_MS     = GameEngine.GAME_DURATION_MS;
        const SIZE         = 16;             // missile half-size in px (2×)
        const MISSILE_RED  = "#fe0e1a";      // soviet red
        const TRAIL_RED    = "#c2000a";      // slightly darker
        const STEPS        = 60;

        const drawMissile = (ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(SIZE, 0);                    // nose
            ctx.lineTo(-SIZE * 0.7, -SIZE * 0.45);  // left tail
            ctx.lineTo(-SIZE * 0.3, 0);             // tail notch
            ctx.lineTo(-SIZE * 0.7,  SIZE * 0.45);  // right tail
            ctx.closePath();
            ctx.fillStyle = MISSILE_RED;
            ctx.fill();
            ctx.restore();
        };

        const loop = () => {
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Sync canvas pixel size to its CSS layout size
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width  = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }
            const W = canvas.width;
            const H = canvas.height;

            // Derive t from the game countdown so missile position = time elapsed
            const elapsed = this.countdownStartTime !== null
                ? Date.now() - this.countdownStartTime
                : 0;
            const t = Math.min(1, Math.max(0, elapsed / TOTAL_MS));

            ctx.clearRect(0, 0, W, H);

            // Dashed trail from P0 to current missile position
            if (t > 0) {
                ctx.beginPath();
                for (let i = 0; i <= STEPS; i++) {
                    const tt  = (i / STEPS) * t;
                    const pos = bezierPos(tt);
                    if (i === 0) ctx.moveTo(pos.x * W, pos.y * H);
                    else         ctx.lineTo(pos.x * W, pos.y * H);
                }
                ctx.setLineDash([6, 5]);
                ctx.strokeStyle = TRAIL_RED;
                ctx.lineWidth   = 4;
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Missile triangle
            const pos = bezierPos(t);
            const tan = bezierTangent(t);
            const angle = Math.atan2(tan.dy * H, tan.dx * W);
            drawMissile(ctx, pos.x * W, pos.y * H, angle);

            this.missileAnimFrame = requestAnimationFrame(loop);
        };

        this.missileAnimFrame = requestAnimationFrame(loop);
    }

    private patchGameWonNode(): void {
        if (!this.phoneGraph) return;

        const wonNode = this.phoneGraph.getNode(PhoneGraphKeys.NODES.GAME_WON);
        if (!wonNode) {
            console.warn("[GameEngine] GAME_WON node not found in graph.");
            return;
        }

        const originalOnEnter = wonNode.onEnter?.bind(wonNode);

        (wonNode as unknown as { onEnter: (g: PhoneGraph) => void }).onEnter = (g) => {
            originalOnEnter?.(g);
            this.onPlayerWin();
        };
    }

    private onPlayerWin(): void {
        console.log("[GameEngine] Player won!");
        this.phoneGraph?.stop();

        // Capture remaining time before stopping the interval
        let remainingMs = 0;
        if (this.countdownStartTime !== null) {
            const elapsed = Date.now() - this.countdownStartTime;
            remainingMs = Math.max(0, GameEngine.GAME_DURATION_MS - elapsed);
        }
        const minutes      = Math.floor(remainingMs / (60 * 1000));
        const seconds      = Math.floor((remainingMs % (60 * 1000)) / 1000);
        const timeString   = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

        // Stop the countdown and missile animation immediately
        if (this.timerInterval !== null) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;

            // stop the timer audio as well
            AudioManager.getInstance().stop("timer_slow");
            AudioManager.getInstance().stop("timer_fast");
        }
        this.stopMissileAnimation();

        const showWinScreen = () => {
            AudioManager.getInstance().stopAll();
            this.mainContainer.classList.add("hidden");
            this.mainContainer.innerHTML = "";
            const winScreen = document.querySelector(".game-won") as HTMLElement | null;
            if (winScreen) {
                const timeEl = winScreen.querySelector("#win-time");
                if (timeEl) timeEl.textContent = timeString;
                winScreen.classList.remove("hidden");
            } else {
                console.warn("[GameEngine] No .game-won element found in DOM.");
            }
        };

        // Wait for the game-won phone clip to finish before switching view
        const audio = AudioManager.getInstance().getActivePhoneAudio();
        if (audio && !audio.ended) {
            audio.addEventListener("ended", showWinScreen, { once: true });
        } else {
            showWinScreen();
        }
    }

    // Timer logic: 5 minute countdown with escalating audio drama as time runs out

    private updateTimer() {
        if (this.countdownStartTime === null) {
            this.countdownStartTime = Date.now();
        }

        const elapsed   = Date.now() - this.countdownStartTime;
        const remaining = Math.max(0, GameEngine.GAME_DURATION_MS - elapsed);

        if (remaining === 0 && !this.isGameOver) {
            this.endGame();
            return;
        }

        if (this.audioDramaStage === 1 && remaining <= 60 * 1000) {
            AudioManager.getInstance().stop("timer_slow");
            AudioManager.getInstance().play("timer_fast", true);
            this.audioDramaStage = 2;
        } else if (this.audioDramaStage === 0 && remaining <= 2 * 60 * 1000) {
            AudioManager.getInstance().play("timer_slow", true);
            this.audioDramaStage = 1;
        }

        const minutes      = Math.floor(remaining / (60 * 1000));
        const seconds      = Math.floor((remaining % (60 * 1000)) / 1000);
        const milliseconds = Math.floor((remaining % 1000) / 100);
        const timerElement = document.getElementById("game-timer");
        if (timerElement) {
            timerElement.textContent =
                `${minutes.toString().padStart(2, "0")}:` +
                `${seconds.toString().padStart(2, "0")}:` +
                `${milliseconds.toString().padEnd(2, "0")}`;
        }
    }

    // game over logic

    private async endGame() {
        this.isGameOver = true;
        this.phoneGraph?.stop();

        if (this.timerInterval !== null) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.stopMissileAnimation();

        AudioManager.getInstance().stopAll();
        AudioManager.getInstance().play("siren");

        setTimeout(() => {
            AudioManager.getInstance().play("nuclear_explosion");
        }, 3500);

        this.mainContainer.classList.add("hidden");
        this.mainContainer.innerHTML = "";

        setTimeout(() => {
            const gameOverScreen = document.querySelector(".game-over") as HTMLElement;
            gameOverScreen?.classList.remove("hidden");
        }, 4000);
    }

    // Restart

    public async restart() {
        // Reset state
        this.countdownStartTime = null;
        this.isGameOver = false;
        this.audioDramaStage = 0;
        this.phoneGraph = null;

        if (this.timerInterval !== null) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        AudioManager.getInstance().stopAll();
        this.stopMissileAnimation();

        // Hide end screens
        const gameOverScreen = document.querySelector(".game-over") as HTMLElement | null;
        const winScreen      = document.querySelector(".game-won")  as HTMLElement | null;
        gameOverScreen?.classList.add("hidden");
        winScreen?.classList.add("hidden");

        // Reset and show main container
        this.mainContainer.innerHTML = "";
        this.mainContainer.classList.remove("hidden");

        // Jump straight into gameplay — assets are already loaded
        await this.setupGameplay();
        console.log("[GameEngine] Game restarted.");
    }
}

export default GameEngine;