// Curated list of common 5-letter English words.
// Used as both the answer pool (seeded by UTC day index) and the valid-guess
// dictionary. Keep this list lowercase, 5 letters, proper-noun free so the
// daily picks feel like real words.
export const WORDS: readonly string[] = [
  "about", "above", "actor", "acute", "admit", "adopt", "adult", "after", "again", "agent",
  "agree", "ahead", "alarm", "album", "alert", "alike", "alive", "allow", "alone", "along",
  "alter", "among", "anger", "angle", "angry", "apart", "apple", "apply", "arena", "argue",
  "arise", "array", "aside", "asset", "avoid", "awake", "award", "aware", "badly", "baker",
  "basic", "beach", "began", "begin", "begun", "being", "below", "bench", "birth", "black",
  "blame", "blank", "blast", "blind", "block", "blood", "board", "boost", "bound", "brain",
  "brand", "brave", "bread", "break", "brief", "bring", "broad", "broke", "brown", "brush",
  "build", "built", "cable", "canal", "candy", "cargo", "carry", "catch", "cause", "chain",
  "chair", "charm", "chart", "chase", "cheap", "check", "chess", "chest", "chief", "child",
  "chose", "civil", "claim", "clash", "class", "clean", "clear", "click", "climb", "clock",
  "close", "cloud", "coach", "coast", "could", "count", "court", "cover", "craft", "crash",
  "cream", "crime", "cross", "crowd", "crown", "curve", "daily", "dance", "death", "debug",
  "delay", "depth", "doing", "doubt", "dozen", "draft", "drama", "drawn", "dream", "dress",
  "drift", "drill", "drink", "drive", "drove", "eager", "early", "earth", "eight", "elite",
  "empty", "enemy", "enjoy", "enter", "entry", "equal", "error", "event", "every", "exact",
  "exist", "extra", "faith", "false", "fault", "fiber", "field", "fifty", "fight", "final",
  "first", "fixed", "flame", "flash", "fleet", "flesh", "float", "flock", "flood", "floor",
  "flour", "focus", "force", "forth", "forty", "forum", "found", "frame", "fraud", "fresh",
  "front", "frost", "fruit", "fully", "funny", "giant", "given", "glass", "globe", "glove",
  "going", "grace", "grade", "grain", "grand", "grant", "grape", "grass", "great", "green",
  "gross", "group", "grown", "guard", "guess", "guest", "guide", "happy", "harsh", "heart",
  "heavy", "hello", "hence", "horse", "hotel", "house", "human", "ideal", "image", "index",
  "inner", "input", "issue", "joint", "judge", "juice", "knife", "knock", "known", "label",
  "labor", "large", "laser", "later", "laugh", "layer", "learn", "least", "leave", "legal",
  "lemon", "level", "light", "limit", "local", "logic", "loose", "lover", "lower", "lucky",
  "lunch", "magic", "major", "maker", "march", "match", "maybe", "mayor", "meant", "media",
  "medal", "metal", "might", "minor", "minus", "mixed", "model", "money", "month", "moral",
  "motor", "mount", "mouse", "mouth", "movie", "music", "naval", "never", "newly", "night",
  "noise", "north", "noted", "novel", "nurse", "ocean", "offer", "often", "olive", "opera",
  "order", "other", "ought", "outer", "owner", "paint", "panel", "paper", "party", "peace",
  "phase", "phone", "photo", "piano", "piece", "pilot", "pitch", "place", "plain", "plane",
  "plant", "plate", "plaza", "point", "pound", "power", "press", "price", "pride", "prime",
  "print", "prior", "prize", "proof", "proud", "prove", "queen", "query", "quick", "quiet",
  "quite", "quote", "radio", "raise", "range", "rapid", "ratio", "reach", "ready", "realm",
  "refer", "relax", "reply", "right", "rival", "river", "roast", "robot", "round", "route",
  "royal", "rural", "scale", "scare", "scene", "scope", "score", "sense", "serve", "seven",
  "shade", "shake", "shall", "shame", "shape", "share", "sharp", "sheep", "sheet", "shelf",
  "shell", "shift", "shine", "shirt", "shock", "shoot", "shore", "short", "shown", "sight",
  "silly", "since", "sixty", "skill", "slate", "sleep", "slice", "slide", "small", "smart",
  "smile", "smoke", "snake", "solid", "solve", "sorry", "sound", "south", "space", "spare",
  "speak", "speed", "spend", "spent", "spice", "spoke", "sport", "staff", "stage", "stake",
  "stand", "stare", "start", "state", "steam", "steel", "stick", "still", "stock", "stone",
  "stood", "store", "storm", "story", "stove", "study", "stuff", "style", "sugar", "suite",
  "super", "swamp", "sweet", "swift", "sword", "table", "taken", "taste", "teach", "theft",
  "their", "theme", "there", "these", "thick", "thief", "thing", "think", "third", "those",
  "three", "threw", "throw", "thumb", "tiger", "tight", "timer", "title", "toast", "today",
  "topic", "total", "touch", "tough", "tower", "track", "trade", "trail", "train", "trait",
  "treat", "trend", "trial", "tribe", "trick", "tried", "troop", "trust", "truth", "twice",
  "under", "union", "unity", "until", "upper", "upset", "urban", "usage", "usual", "valid",
  "value", "video", "virus", "visit", "vital", "vivid", "vocal", "voice", "waste", "watch",
  "water", "weigh", "whale", "wheat", "wheel", "where", "which", "while", "white", "whole",
  "whose", "woman", "world", "worry", "worse", "worst", "worth", "would", "wound", "write",
  "wrong", "wrote", "young", "youth", "zebra",
];

// Deterministic day index (UTC midnight based) so every client sees the same
// word on the same calendar day regardless of their timezone.
export function utcDayIndex(ts: number): number {
  return Math.floor(ts / 86_400_000);
}

export function wordForDay(ts: number): string {
  // Stable offset keeps the first day from always landing on "about".
  const OFFSET = 21;
  const idx = (utcDayIndex(ts) + OFFSET) % WORDS.length;
  return WORDS[idx];
}

const VALID = new Set(WORDS);
export function isValidGuess(guess: string): boolean {
  return VALID.has(guess.toLowerCase());
}
