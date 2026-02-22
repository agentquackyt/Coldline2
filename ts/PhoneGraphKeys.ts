const PhoneGraphKeys = {

    // ── Secret codes (entered via keyboard, confirmed with Space) ─────────────
    CODES: {
        /**
         * The interception / launch code.
         * Heard during info_missiles (other_menu → us_protects → info_missiles).
         * Entered during enter_launch_code.
         */
        LAUNCH_CODE: "4264",
    },

    NODES: {
        // Entry point
        INITIAL:              "initial",

        // Other-options branch
        OTHER_MENU:           "other_menu",

        // Info sub-branch (other_menu → 1)
        US_PROTECTS_MENU:     "us_protects_menu",
        INFO_COMMANDS:        "info_commands",
        INFO_OFFENSE_DEFENSE: "info_offense_defense",
        INFO_MISSILES:        "info_missiles",   // ← launch code revealed here

        // Access-key sub-branch (other_menu → 2)
        ACCESS_KEY_MENU:      "access_key_menu",
        LOW_RANKING:          "low_ranking",
        HIGH_RANKING_ROLE:    "high_ranking_role",
        KEY_TYPE1:            "key_type1",
        KEY_TYPE2:            "key_type2",
        KEY_TYPE3:            "key_type3",       // ← type-3 key generated here

        // Representative branch (initial → 1)
        URGENT_CHECK:         "urgent_check",
        HOLD_LINE:            "hold_line",

        // Chairman sub-branch (urgent → 1 → correct key)
        ENTER_6DIGIT_KEY:     "enter_6digit_key",
        KEY_INCORRECT:        "key_incorrect",
        WELCOME_CHAIRMAN:     "welcome_chairman",   // absorbs call_reason — one node, two choices
        ECONOMIC:             "economic",

        // Nuclear sub-branch
        NUCLEAR_CHECK:        "nuclear_check",
        NUCLEAR_NO:           "nuclear_no",
        NUCLEAR_YES:          "nuclear_yes",

        // Launch sequence
        ENTER_LAUNCH_CODE:    "enter_launch_code",
        LAUNCH_CODE_WRONG:    "launch_code_wrong",
        LAUNCH_CONFIRM:       "launch_confirm",
        LAUNCH_ABORT:         "launch_abort",
        GAME_WON:             "game_won",
    },

    // ── Audio keys (must match audioKey fields in phoneGraphNodes.json) ───────
    AUDIO: {
        INITIAL:              "audio_initial",
        OTHER_MENU:           "audio_other_menu",
        US_PROTECTS_MENU:     "audio_us_protects_menu",
        INFO_COMMANDS:        "audio_info_commands",
        INFO_OFFENSE_DEFENSE: "audio_info_offense_defense",
        INFO_MISSILES:        "audio_info_missiles",
        ACCESS_KEY_MENU:      "audio_access_key_menu",
        LOW_RANKING:          "audio_low_ranking",
        HIGH_RANKING_ROLE:    "audio_high_ranking_role",
        KEY_TYPE1:            "audio_key_type1",
        KEY_TYPE2:            "audio_key_type2",
        KEY_TYPE3:            "audio_key_type3",
        URGENT_CHECK:         "audio_urgent_check",
        HOLD_LINE:            "audio_hold_line",
        ENTER_6DIGIT_KEY:     "audio_enter_6digit_key",
        KEY_INCORRECT:        "audio_key_incorrect",
        WELCOME_CHAIRMAN:     "audio_welcome_chairman",
        ECONOMIC:             "audio_economic",
        NUCLEAR_CHECK:        "audio_nuclear_check",
        NUCLEAR_NO:           "audio_nuclear_no",
        NUCLEAR_YES:          "audio_nuclear_yes",
        ENTER_LAUNCH_CODE:    "audio_enter_launch_code",
        LAUNCH_CODE_WRONG:    "audio_launch_code_wrong",
        LAUNCH_CONFIRM:       "audio_launch_confirm",
        LAUNCH_ABORT:         "audio_launch_abort",
        GAME_WON:             "audio_game_won",
    },

} as const;

export { PhoneGraphKeys };