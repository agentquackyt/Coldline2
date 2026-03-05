import { AudioManager } from "./AudioManager";
import { animateText } from "./FancyText";

const tutorialText = [
    "Control the game using your keyboard.",
    "You will need to use the number keys (0-9) and space to confirm",
];

const introText = [
    "The year is 1963.",
    "You are chairman of the Soviet Union.",
    "The Cold War is at its peak.",
    "Due to a series of unfortunate events,",
    "a nuclear missile has been launched by accident.",
    "The world is on the brink of nuclear war."
];

const finalIntroMessage = "It's time to call the President!";

class Tutorial {
    private progress: number;
    private mainContainer: HTMLElement;
    private introContainer: HTMLElement;
    private skipButton: HTMLButtonElement;

    constructor(container: HTMLElement) {
        this.progress = 0;
        this.mainContainer = container;
        this.introContainer = document.createElement("div");
        this.introContainer.classList.add("intro-container");
        this.mainContainer.appendChild(this.introContainer);

        this.skipButton = document.createElement("button");
        this.skipButton.textContent = "Skip Intro";
        this.skipButton.classList.add("skip-button");
        this.skipButton.addEventListener("click", () => {
            this.skip();
            this.skipButton.disabled = true; // Disable the skip button after it's clicked
        });
        this.introContainer.appendChild(this.skipButton);

        console.log("Tutorial Initialized");
    }

    public async step() {
        this.progress++;
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for 2 seconds before showing the next line
        const textRolling = AudioManager.getInstance().get("text_rolling");
        // First show the tutorial text, show only one line at a time

        if (this.progress <= tutorialText.length) {
            if (this.progress > 1) {
                // Fade out the previous line
                const previousLine = this.introContainer.querySelector(`.tutorial-line-${this.progress - 2}`) as HTMLElement;
                if (previousLine) {
                    previousLine.classList.add("fade-out");
                    await new Promise(resolve => setTimeout(resolve, 400)); // Wait for fade-out to complete
                    previousLine.classList.add("hidden");
                }
            }
            const lineElement = document.createElement("p");
            lineElement.classList.add(`tutorial-line-${this.progress - 1}`, "tutorial-line");
            this.introContainer.appendChild(lineElement);
            await animateText(lineElement, tutorialText[this.progress - 1] as string, 800, textRolling);
            return;
        } else if (this.progress === tutorialText.length + 1) {
            // Fade out the last tutorial line
            const lastLine = this.introContainer.querySelector(`.tutorial-line-${this.progress - 2}`) as HTMLElement;
            if (lastLine) {
                lastLine.classList.add("fade-out");
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait for fade-out to complete
                lastLine.classList.add("hidden");
            }
        }

        // After the tutorial text is done, show the intro text
        // Show the intro text two lines at a time, with a delay of 1 second between each line
        if (this.progress > tutorialText.length && this.progress <= tutorialText.length + introText.length) {
            const currentLineIndex = this.progress - tutorialText.length - 1;
            const lineElement = document.createElement("p");
            lineElement.classList.add(`intro-line-${currentLineIndex}`, "intro-line");
            this.introContainer.appendChild(lineElement);
            await animateText(lineElement, introText[currentLineIndex] as string, 900, textRolling);
        }

        console.log("Tutorial step:", this.progress);
    }

    public isFinished(): boolean {
        return this.progress >= tutorialText.length + introText.length;
    }

    public async cleanup() {
        await new Promise(resolve => setTimeout(resolve, 2500)); // Wait for 2.5 seconds before showing the next line
        const lineElements = this.introContainer.querySelectorAll(".tutorial-line");
        lineElements.forEach((lineElement, i) => {
            (lineElement as HTMLElement).classList.add("fade-out");
        });
        AudioManager.getInstance().play("gong");
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for fade-out to complete
        this.introContainer.innerHTML = ""; // Clear all tutorial lines

        const finalMessageElement = document.createElement("h2");
        finalMessageElement.classList.add("final-intro-message");
        finalMessageElement.textContent = finalIntroMessage;
        this.introContainer.appendChild(finalMessageElement);
        await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for 3 seconds before ending the intro
        this.introContainer.classList.add("fade-out");
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for fade-out to complete
        this.introContainer.classList.add("hidden");
        this.mainContainer.removeChild(this.introContainer);
        return Promise.resolve();
    }

    public async skip() {
        this.progress = tutorialText.length + introText.length; // Set progress to the end of the tutorial
        this.skipButton.remove(); // Remove the skip button
    }
}

class TutorialHandler {
    static instance: TutorialHandler;

    constructor() {
        console.log("[TutorialHandler] Tutorial Handler Initialized");
    }

    static getInstance() {
        if (!TutorialHandler.instance) {
            TutorialHandler.instance = new TutorialHandler();
        }
        return TutorialHandler.instance;
    }

    public async startTutorial(mainContainer: HTMLElement): Promise<void> {
        let tutorial = new Tutorial(mainContainer);
        while (!tutorial.isFinished()) {
            await tutorial.step();
        }
        await tutorial.cleanup();
        return Promise.resolve();
    }
}

export default TutorialHandler;