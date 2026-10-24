/* One place to swap NOOR AI sound events and their CC0 source samples. */
window.NOOR_SOUND_MAP = {
  eventToAsset: {
    "whoosh":"open_002", "click":"click_001", "pop":"click_002",
    "tick":"tick_001", "slide":"select_001", "ding":"confirmation_001",
    "soft-buzz":"error_001", "level-up":"glass_002", "bell":"bong_001",
    "typing-blip":"select_001",
    "sparkle":"glass_001", "coin-collect":"confirmation_002",
    "bubble-pop":"toggle_001", "soft-chime":"confirmation_003",
    "harp-swipe":"pluck_001", "page-flip":"open_003",
    "pencil-scribble":"scratch_001", "tinkle-bell":"bong_001",
    "magic-wand":"pluck_002", "marimba-tap":"select_002",
    "applause":"confirmation_004", "soft-drumroll":"scroll_002",
    "tada":"confirmation_001", "star-twinkle":"glass_003",
    "fire-whoosh":"open_004", "ice-crystal":"glass_002",
    "soft-tick-tock":"tick_001", "gentle-gong":"bong_001",
    "submit-swoosh":"close_002", "upload-blip":"drop_001",
    "download-done":"confirmation_002", "soft-thud":"drop_002",
    "two-note-warning":"question_001", "paper-crumple":"scratch_001",
    "soft-doorbell":"bong_001", "send-whoosh":"open_001",
    "check-tick":"tick_001", "party-horn":"confirmation_004",
    "card-flip":"open_002", "rising-fill":"maximize_001"
  },
  categories: [
    {id:"interaction",title:"Buttons & toggles",description:"Gentle button, switch and confirmation feedback.",preview:"click"},
    {id:"navigation",title:"Navigation & cards",description:"Soft page transitions, menus and note cards.",preview:"slide"},
    {id:"learning",title:"Learning & AI",description:"Writing, AI generation and study interactions.",preview:"magic-wand"},
    {id:"assessment",title:"Tests & results",description:"Timer, submit, answer and result feedback.",preview:"tada"},
    {id:"achievement",title:"Achievements & streaks",description:"Warm rewards for badges, XP and milestones.",preview:"sparkle"},
    {id:"messages",title:"Messages & files",description:"Notifications, chat, upload and download feedback.",preview:"soft-doorbell"},
    {id:"voice",title:"Voice cheers",description:"Short English, Hindi and Telugu cheers for big moments.",preview:"voice"},
    {id:"haptics",title:"Haptic feedback",description:"Very short vibration on key actions, where supported.",preview:"haptic"}
  ],
  cheers: {
    en: ["Well done!","Keep going!","All the best!"],
    hi: ["शाबाश!","बहुत अच्छा!","ऐसे ही आगे बढ़ते रहो!"],
    te: ["చాలా బాగా చేశావు!","ఇలాగే కొనసాగించు!","అన్నీ మంచిగా జరగాలి!"]
  },
  cheerEvents: ["level-up","sparkle","tada","applause","star-twinkle","rising-fill"]
};
