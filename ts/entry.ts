import GameEngine from "./GameEngine.ts";

function loadGame() {
    console.log("Loading Game...");
    const gameEngine = GameEngine.getInstance();

    document.getElementById("start-button")?.addEventListener("click", async () => {
        document.getElementById("start-button")?.setAttribute("disabled", "true");
        try {
            // request fullscreen mode for the game container
            await setFullscreen();
            document.body.addEventListener("click", async () => {
                await setFullscreen();
            });
            await gameEngine.start();
        } catch (error) {
            console.error("[entry] Failed to start game:", error);
        }
    });

    // Wire up restart buttons on game-over and game-won screens
    document.querySelectorAll<HTMLButtonElement>(".game-over .start-button, .game-won .start-button")
        .forEach(btn => {
            btn.addEventListener("click", async () => {
                try {
                    await gameEngine.restart();
                } catch (error) {
                    console.error("[entry] Failed to restart game:", error);
                }
            });
        });
}


async function setFullscreen() {
    const gameContainer = document.body;
    if (gameContainer) {
        if (gameContainer.requestFullscreen) {
            await gameContainer.requestFullscreen();
        } else if ((gameContainer as any).webkitRequestFullscreen) { /* Safari */
            await(gameContainer as any).webkitRequestFullscreen();
        } else if ((gameContainer as any).msRequestFullscreen) { /* IE11 */
            await(gameContainer as any).msRequestFullscreen();
        }
    }
}

window.onload = loadGame;