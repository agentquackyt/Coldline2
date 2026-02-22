import { AudioManager } from "./AudioManager";
import { PhoneGraphKeys } from "./PhoneGraphKeys";

/**
 * "navigation" — a single digit keypress immediately routes to the next node.
 * "code_entry" — digits accumulate in a buffer; Space confirms, Backspace corrects.
 * "passthrough" — no input expected; node plays audio and immediately advances
 *                 to its only connection (used for dead-ends like hold_line).
 */
type NodeMode = "navigation" | "code_entry" | "passthrough";

interface GraphConnection {
    key: number;
    nodeId: string;
}

interface NodeConfig {
    id: string;
    audioKey: string;
    mode?: NodeMode;
    /** For code_entry: expected string. Supports "{{type3key}}" token. */
    expectedCode?: string;
    successNodeId?: string;
    failNodeId?: string;
    onEnter?: (graph: PhoneGraph) => void;
    /**
     * If true, the node is passthrough mode but will NOT auto-advance via
     * setTimeout. The caller is responsible for calling graph.advancePassthrough().
     * Use this when onEnter needs to do async work (e.g. playKeyCode) before moving on.
     */
    manualPassthrough?: boolean;
    /** For passthrough: ms delay before auto-advancing. Default 0. */
    passthroughDelay?: number;
}

class GraphNode {
    readonly id: string;
    readonly audioKey: string;
    readonly mode: NodeMode;
    readonly expectedCode?: string;
    readonly successNodeId?: string;
    readonly failNodeId?: string;
    readonly onEnter?: (graph: PhoneGraph) => void;
    readonly manualPassthrough: boolean;
    readonly passthroughDelay: number;

    private connections: Map<number, string> = new Map();

    constructor(config: NodeConfig) {
        this.id = config.id;
        this.audioKey = config.audioKey;
        this.mode = config.mode ?? "navigation";
        this.expectedCode = config.expectedCode;
        this.successNodeId = config.successNodeId;
        this.failNodeId = config.failNodeId;
        this.onEnter = config.onEnter;
        this.manualPassthrough = config.manualPassthrough ?? false;
        this.passthroughDelay = config.passthroughDelay ?? 0;
    }

    connect(...connections: GraphConnection[]): this {
        connections.forEach(c => this.connections.set(c.key, c.nodeId));
        return this;
    }

    /** Returns the first registered connection (used by passthrough nodes). */
    firstConnection(): string | undefined {
        return this.connections.values().next().value;
    }

    getConnection(key: number): string | undefined {
        return this.connections.get(key);
    }

    playAudio(): void {
        console.log(`[PhoneGraph] ▶ ${this.id} (${this.audioKey})`);
        AudioManager.getInstance().playPhone(this.audioKey);
    }
}

class PhoneGraph {
    private nodes: Map<string, GraphNode> = new Map();
    private currentNode: GraphNode | null = null;

    /** Digit buffer used in code_entry mode. */
    private codeBuffer: string = "";

    /**
     * The type-3 key generated when the player calls high_ranking_role → key_type3.
     * Stored here so enter_6digit_key can validate against it.
     */
    private type3Key: string = "";

    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

    // Public API

    addNode(node: GraphNode): this {
        this.nodes.set(node.id, node);
        return this;
    }

    public getNode(id: string): GraphNode | undefined {
        return this.nodes.get(id);
    }

    setType3Key(key: string): void {
        this.type3Key = key;
        console.log(`[PhoneGraph] Type-3 key stored: ${key}`);
    }

    getType3Key(): string {
        return this.type3Key;
    }

    /** Call once to boot the graph. */
    start(): void {
        this.attachKeyboard();
        this.goTo(PhoneGraphKeys.NODES.INITIAL);
    }

    stop(): void {
        this.detachKeyboard();
    }

    // navigation

    private goTo(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node) {
            console.warn(`[PhoneGraph] Unknown node: "${nodeId}"`);
            return;
        }

        this.currentNode = node;
        this.codeBuffer = "";
        node.playAudio();
        node.onEnter?.(this);

        if (node.mode === "passthrough" && !node.manualPassthrough) {
            const next = node.firstConnection();
            if (next !== undefined) {
                setTimeout(() => this.goTo(next), node.passthroughDelay);
            }
        }
    }

    /**
     * Manually advance a passthrough node that has manualPassthrough: true.
     * Call this from onEnter once your async work (e.g. playKeyCode) is done.
     * Passing the nodeId guards against stale calls if the player has moved on.
     */
    public advancePassthrough(fromNodeId: string): void {
        if (this.currentNode?.id !== fromNodeId) return; // player moved, ignore
        const next = this.currentNode.firstConnection();
        if (next !== undefined) this.goTo(next);
    }

    // Keyboard

    private attachKeyboard(): void {
        this.keydownHandler = (e) => this.handleKey(e);
        window.addEventListener("keydown", this.keydownHandler);
    }

    private detachKeyboard(): void {
        if (this.keydownHandler) {
            window.removeEventListener("keydown", this.keydownHandler);
            this.keydownHandler = null;
        }
    }

    private handleKey(e: KeyboardEvent): void {
        if (!this.currentNode) return;

        const digit = parseDigit(e.key);
        const dial_sound = AudioManager.getInstance().play("dial_tone");

        switch (this.currentNode.mode) {
            case "navigation":
                //finish the dial tone before navigating, for better feedback when keys are mashed
                if (dial_sound) {
                    dial_sound.addEventListener("ended", () => {
                        if (digit !== null) this.navigate(digit);
                    }, { once: true });
                } else {
                    if (digit !== null) this.navigate(digit);
                }
                break;

            case "code_entry":
                this.handleCodeKey(e, digit);
                break;

            case "passthrough":
                // Passthrough nodes handle themselves via setTimeout; ignore input.
                break;
        }
    }

    private navigate(digit: number): void {
        if (!this.currentNode) return;
        const nextId = this.currentNode.getConnection(digit);
        if (nextId !== undefined) {
            this.goTo(nextId);
        } else {
            console.log(`[PhoneGraph] No connection for key ${digit} on "${this.currentNode.id}"`);
        }
    }

    private handleCodeKey(e: KeyboardEvent, digit: number | null): void {
        if (!this.currentNode) return;

        if (digit !== null) {
            this.codeBuffer += String(digit);
            console.log(`[PhoneGraph] Buffer: "${this.codeBuffer}"`);
            return;
        }

        if (e.key === "Backspace") {
            this.codeBuffer = this.codeBuffer.slice(0, -1);
            console.log(`[PhoneGraph] Buffer (←): "${this.codeBuffer}"`);
            return;
        }

        if (e.key === " " || e.code === "Space") {
            e.preventDefault();
            this.confirmCode();
        }
    }

    private confirmCode(): void {
        const node = this.currentNode;
        if (!node?.expectedCode) return;

        const expected = this.resolveCode(node.expectedCode);
        const correct = this.codeBuffer === expected;

        console.log(
            `[PhoneGraph] Code check on "${node.id}": ` +
            `entered="${this.codeBuffer}" expected="${expected}" → ${correct ? "✓" : "✗"}`
        );

        this.codeBuffer = "";

        if (correct) {
            if (node.successNodeId) this.goTo(node.successNodeId);
        } else {
            if (node.failNodeId) this.goTo(node.failNodeId);
        }
    }

    private resolveCode(code: string): string {
        if (code === "{{type3key}}") return this.type3Key;
        return code;
    }
}

// Helpers

function parseDigit(key: string): number | null {
    if (/^[0-9]$/.test(key)) return parseInt(key, 10);
    const numpad = key.match(/^Numpad(\d)$/);
    if (numpad) return parseInt(numpad[1] as string, 10);
    return null;
}

function rand6(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// Graph builder

function buildPhoneGraph(): PhoneGraph {
    const graph = new PhoneGraph();
    const { NODES: N, AUDIO: A, CODES: C } = PhoneGraphKeys;

    // Entry
    graph.addNode(
        new GraphNode({ id: N.INITIAL, audioKey: A.INITIAL })
            .connect(
                { key: 1, nodeId: N.URGENT_CHECK },   // → representative
                { key: 2, nodeId: N.OTHER_MENU },   // → other options
            )
    );

    // Other-options branch

    graph.addNode(
        new GraphNode({ id: N.OTHER_MENU, audioKey: A.OTHER_MENU })
            .connect(
                { key: 1, nodeId: N.US_PROTECTS_MENU },
                { key: 2, nodeId: N.ACCESS_KEY_MENU },
                { key: 3, nodeId: N.INITIAL },   // "return to main menu" option
            )
    );

    // Info sub-branch — three single nodes, all return to us_protects_menu.
    // No sub-navigation: player listens, presses any digit to go back.

    graph.addNode(
        new GraphNode({ id: N.US_PROTECTS_MENU, audioKey: A.US_PROTECTS_MENU })
            .connect(
                { key: 1, nodeId: N.INFO_COMMANDS },
                { key: 2, nodeId: N.INFO_OFFENSE_DEFENSE },
                { key: 3, nodeId: N.INFO_MISSILES },
                { key: 4, nodeId: N.INITIAL },   // "return to main menu" option
            )
    );

    // Any digit key returns to the parent menu.
    for (const infoNode of [
        { id: N.INFO_COMMANDS, audioKey: A.INFO_COMMANDS },
        { id: N.INFO_OFFENSE_DEFENSE, audioKey: A.INFO_OFFENSE_DEFENSE },
        { id: N.INFO_MISSILES, audioKey: A.INFO_MISSILES },
    ]) {
        const n = new GraphNode(infoNode);
        for (let k = 0; k <= 9; k++) n.connect({ key: k, nodeId: N.US_PROTECTS_MENU });
        graph.addNode(n);
    }

    // Access-key sub-branch

    graph.addNode(
        new GraphNode({ id: N.ACCESS_KEY_MENU, audioKey: A.ACCESS_KEY_MENU })
            .connect(
                { key: 1, nodeId: N.LOW_RANKING },
                { key: 2, nodeId: N.HIGH_RANKING_ROLE },
            )
    );

    // Low ranking: passthrough back to other_menu after audio plays
    graph.addNode(
        new GraphNode({ id: N.LOW_RANKING, audioKey: A.LOW_RANKING, mode: "passthrough", passthroughDelay: 3000 })
            .connect({ key: 0, nodeId: N.OTHER_MENU })  // passthrough uses firstConnection()
    );

    graph.addNode(
        new GraphNode({ id: N.HIGH_RANKING_ROLE, audioKey: A.HIGH_RANKING_ROLE })
            .connect(
                { key: 1, nodeId: N.KEY_TYPE1 },
                { key: 2, nodeId: N.KEY_TYPE2 },
                { key: 3, nodeId: N.KEY_TYPE3 },
            )
    );

    // Type-1 and Type-2: generate key, passthrough back to other_menu
    graph.addNode(
        new GraphNode({
            id: N.KEY_TYPE1, audioKey: A.KEY_TYPE1, mode: "passthrough", passthroughDelay: 4000,
            onEnter: () => console.log(`[PhoneGraph] Type-1 key: ${rand6()}`),
        }).connect({ key: 0, nodeId: N.OTHER_MENU })
    );

    graph.addNode(
        new GraphNode({
            id: N.KEY_TYPE2, audioKey: A.KEY_TYPE2, mode: "passthrough", passthroughDelay: 4000,
            onEnter: () => console.log(`[PhoneGraph] Type-2 key: ${rand6()}`),
        }).connect({ key: 0, nodeId: N.OTHER_MENU })
    );

    // Type-3: generates AND stores the key so enter_6digit_key can verify it,
    // then reads it aloud digit-by-digit via playKeyCode.
    graph.addNode(
        new GraphNode({
            id: N.KEY_TYPE3, audioKey: A.KEY_TYPE3, mode: "passthrough", manualPassthrough: true,
            onEnter: (g) => {
                const key = rand6();
                g.setType3Key(key);
                console.log(`[PhoneGraph] Type-3 key issued to player: ${key}`);

                // The node audio is already playing (started by goTo → playAudio).
                // Grab the active element so we can wait for it to finish,
                // then read the digits aloud before advancing.
                const audio = AudioManager.getInstance().getActivePhoneAudio();
                const readKeyAndAdvance = () => {
                    AudioManager.getInstance()
                        .playKeyCode(key)
                        .then(() => g.advancePassthrough(N.KEY_TYPE3));
                };

                if (audio) {
                    audio.addEventListener("ended", readKeyAndAdvance, { once: true });
                } else {
                    setTimeout(readKeyAndAdvance, 500);
                }
            },
        }).connect({ key: 0, nodeId: N.OTHER_MENU })
    );

    // Representative branch

    graph.addNode(
        new GraphNode({ id: N.URGENT_CHECK, audioKey: A.URGENT_CHECK })
            .connect(
                { key: 1, nodeId: N.ENTER_6DIGIT_KEY },
                { key: 2, nodeId: N.HOLD_LINE },
            )
    );

    // Hold: passthrough — representative never comes, dead-end back to initial
    graph.addNode(
        new GraphNode({ id: N.HOLD_LINE, audioKey: A.HOLD_LINE, mode: "passthrough", passthroughDelay: 5000 })
            .connect({ key: 0, nodeId: N.INITIAL })
    );

    // 6-digit key entry — validated against the stored type-3 key
    graph.addNode(new GraphNode({
        id: N.ENTER_6DIGIT_KEY,
        audioKey: A.ENTER_6DIGIT_KEY,
        mode: "code_entry",
        expectedCode: "{{type3key}}",
        successNodeId: N.WELCOME_CHAIRMAN,
        failNodeId: N.KEY_INCORRECT,
    }));

    graph.addNode(
        new GraphNode({ id: N.KEY_INCORRECT, audioKey: A.KEY_INCORRECT })
            .connect(
                { key: 1, nodeId: N.ENTER_6DIGIT_KEY },
                { key: 2, nodeId: N.INITIAL },
            )
    );

    graph.addNode(
        new GraphNode({ id: N.WELCOME_CHAIRMAN, audioKey: A.WELCOME_CHAIRMAN })
            .connect(
                { key: 1, nodeId: N.ECONOMIC },
                { key: 2, nodeId: N.NUCLEAR_CHECK },
            )
    );

    graph.addNode(
        new GraphNode({ id: N.ECONOMIC, audioKey: A.ECONOMIC, mode: "passthrough", passthroughDelay: 3000 })
            .connect({ key: 0, nodeId: N.INITIAL })
    );

    graph.addNode(
        new GraphNode({ id: N.NUCLEAR_CHECK, audioKey: A.NUCLEAR_CHECK })
            .connect(
                { key: 1, nodeId: N.NUCLEAR_NO },
                { key: 2, nodeId: N.NUCLEAR_YES },
            )
    );

    graph.addNode(
        new GraphNode({ id: N.NUCLEAR_NO, audioKey: A.NUCLEAR_NO, mode: "passthrough", passthroughDelay: 3000 })
            .connect({ key: 0, nodeId: N.INITIAL })
    );

    graph.addNode(
        new GraphNode({ id: N.NUCLEAR_YES, audioKey: A.NUCLEAR_YES })
            .connect(
                { key: 1, nodeId: N.ENTER_LAUNCH_CODE },
                { key: 2, nodeId: N.INITIAL },
            )
    );

    // Launch code entry — the interception code heard in info_missiles
    graph.addNode(new GraphNode({
        id: N.ENTER_LAUNCH_CODE,
        audioKey: A.ENTER_LAUNCH_CODE,
        mode: "code_entry",
        expectedCode: C.LAUNCH_CODE,
        successNodeId: N.LAUNCH_CONFIRM,
        failNodeId: N.LAUNCH_CODE_WRONG,
    }));

    graph.addNode(
        new GraphNode({ id: N.LAUNCH_CODE_WRONG, audioKey: A.LAUNCH_CODE_WRONG })
            .connect(
                { key: 1, nodeId: N.ENTER_LAUNCH_CODE },
                { key: 2, nodeId: N.INITIAL },
            )
    );

    graph.addNode(
        new GraphNode({ id: N.LAUNCH_CONFIRM, audioKey: A.LAUNCH_CONFIRM })
            .connect(
                { key: 1, nodeId: N.LAUNCH_ABORT },
                { key: 2, nodeId: N.GAME_WON },
            )
    );

    graph.addNode(
        new GraphNode({ id: N.LAUNCH_ABORT, audioKey: A.LAUNCH_ABORT, mode: "passthrough", passthroughDelay: 2000 })
            .connect({ key: 0, nodeId: N.INITIAL })
    );

    // Terminal — no connections, game over
    graph.addNode(new GraphNode({ id: N.GAME_WON, audioKey: A.GAME_WON }));

    return graph;
}

export { GraphNode, PhoneGraph, buildPhoneGraph };