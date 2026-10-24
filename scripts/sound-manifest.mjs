/**
 * What to ask Gemini to SAY and PLAY: voice lines (text-to-speech) and music
 * (Lyria). Every physical sound (lasers, pops, booms, toots) is synthesised in
 * src/core/audio.ts and src/core/sfx.ts, as in the siblings.
 *
 * The voice rules are slingshot's (see its sound-manifest.mjs for the history):
 * only the TRANSCRIPT section of the prompt is spoken, lines are a second or
 * two, and the raccoons are sped up (shorter and higher, the cartoon trick)
 * while Ellie plays at natural speed so the two never sound alike.
 *
 * ## Ellie is TTS for now
 *
 * Her real recordings come later, the same way as in the other four games
 * (../recordings/cut.py). When they do: drop them in as `e.<id>.m4a`, extra
 * takes as `e.<id>.2.m4a` and up, and set `recorded: true` on ELLIE below so a
 * regenerate never overwrites them. The game already picks a take at random.
 * The `cue` on each of her lines is the situation to give her when recording.
 */

const RACCOON = {
  voice: 'Puck',
  rate: 1.35,
  profile:
    "a tiny squeaky cartoon critter from a children's TV cartoon: a mischievous little raccoon with a " +
    'high, nasal, chipmunk-like voice, silly and over the top, never mean',
};

/** The bosses: the same raccoons, puffed up. Less speed-up, so a bit bigger and rounder. */
const BOSS = {
  voice: 'Puck',
  rate: 1.12,
  profile:
    "a pompous cartoon raccoon boss from a children's TV cartoon: a chubby show-off with a big silly " +
    'self-important voice, theatrical and goofy, never scary',
};

const MAMA = {
  // World 2's last boss. A grown-up voice, so slowed less than the raccoons.
  voice: 'Kore',
  rate: 1.08,
  profile:
    "a big bossy cartoon mother raccoon from a children's TV cartoon: a loud, warm, over-the-top mum " +
    'with curlers in her hair, theatrical and silly, scolding but never scary',
};

const ELLIE = {
  // Not yet recorded: see the note at the top. Flip to `recorded: true` once
  // her real takes are in public/sounds.
  recorded: false,
  voice: 'Zephyr',
  rate: 1,
  profile:
    "a little cartoon girl from a children's TV cartoon, about five years old: high, bright, squeaky " +
    'and bouncy, innocent and goofy, like an animated kid sidekick. NOT grown-up, NOT breathy, NOT ' +
    'soft or sultry: a loud happy little kid',
};

function line(id, who, style, text, cue) {
  return { id, kind: 'voice', who, style, text, ...(cue ? { cue } : {}) };
}

export const SOUNDS = [
  // --- Ellie ------------------------------------------------------------------
  line('e.blastoff', ELLIE, 'thrilled, shouting, the countdown just finished', 'Blast off!', 'Ten, nine... the cardboard box turns into a real rocket!'),
  line('e.captain', ELLIE, 'proud and heroic, like a cartoon superhero', 'Captain Ellie to the rescue!', 'You are the bravest space captain ever, say your name!'),
  line('e.pewpew', ELLIE, 'playful, making laser noises with her mouth', 'Pew pew pew!', 'Make your laser sound!'),
  line('e.gotcha', ELLIE, 'triumphant, giggly', 'Got you!', 'You just zapped a raccoon ship!'),
  line('e.takethat', ELLIE, 'bold, playful', 'Take that!', 'Zap! Right on the nose!'),
  line('e.wow', ELLIE, 'wide-eyed amazement', 'Woooow!', 'You just found a shiny power-up!'),
  line('e.laser', ELLIE, 'excited, punchy', 'Super laser!', 'Your laser just got twice as big!'),
  line('e.stars', ELLIE, 'delighted, sing-song', 'Star power!', 'Now you shoot sparkly stars!'),
  line('e.shield', ELLIE, 'relieved and happy', 'Shields up!', 'You caught a heart, your shield is back!'),
  line('e.ew', ELLIE, 'grossed out but laughing', 'Ew, stinky!', 'A raccoon just tooted a stink bubble at you!'),
  line('e.whoa', ELLIE, 'startled but cheerful, a little wobble', 'Whoa!', 'Bump! Your ship got bonked!'),
  line('e.uhoh', ELLIE, 'excited, not scared', 'Uh-oh, a big one!', 'Look! The giant boss ship is coming!'),
  line('e.kaboom', ELLIE, 'thrilled, shouting', 'KABOOM!', 'The biggest explosion ever!'),
  line('e.nyah', ELLIE, 'teasing right back, playful', 'Nyah nyah!', 'The raccoon is teasing you, tease him back!'),
  line('e.won', ELLIE, 'thrilled and proud', 'We did it!', 'You beat the boss!'),
  line('e.ohno', ELLIE, 'disappointed but cheerful', 'Oh no!', 'Oops, your shields ran out.'),
  line('e.again', ELLIE, 'determined, bouncing back', "Let's try again!", 'Ready to go again?'),

  // --- Raccoon pilots ----------------------------------------------------------
  line('r.nyah', RACCOON, 'sing-song teasing, quick', 'Nyah nyah!'),
  line('r.cantcatch', RACCOON, 'sing-song teasing, very pleased with himself', "Can't catch me!"),
  line('r.missed', RACCOON, 'gleeful, quick', 'Missed me!'),
  line('r.giggle', RACCOON, 'a short burst of giggles', 'Hee hee hee!'),
  line('r.toot', RACCOON, 'proud and silly, right after tooting a stink bubble', 'Toot toot!'),
  line('r.smell', RACCOON, 'smug, sing-song', 'Smell ya later!'),
  line('r.uhoh', RACCOON, 'suddenly nervous, two quick syllables', 'Uh-oh!'),
  line('r.whoa', RACCOON, 'spinning away through space, wobbly', 'Whoaaa!'),
  line('r.bye', RACCOON, 'cheerful, floating away waving', 'Bye-bye!'),
  line('r.nofair', RACCOON, 'whiny, dramatic', 'No fair!'),
  line('r.hello', RACCOON, 'sneaky and smug', 'Space is OURS!'),
  line('r.fart1', RACCOON, 'blowing a long, wet, silly cartoon raspberry with his lips, a mouth-fart noise, not words', 'Pbbbbbbbbbbbt!'),
  line('r.fart2', RACCOON, 'a short, sputtering cartoon mouth-fart noise, not words', 'Pfft-pfft-pbbt!'),

  // --- Bosses --------------------------------------------------------------------
  line('b.hello', BOSS, 'grand and pompous, announcing himself', 'Meet the BIG Boss!'),
  line('b.never', BOSS, 'smug and theatrical', "You'll never catch me!"),
  line('b.ouch', BOSS, 'pretend-outraged, silly', 'Hey! My shiny ship!'),
  line('b.toot', BOSS, 'very proud of a gigantic toot', 'Take a whiff of THIS!'),
  line('b.lose', BOSS, 'whiny and dramatic, floating away', "No fair! I'm telling my mom!"),

  // --- Mama Raccoon (stage 10) ------------------------------------------------------
  line('m.hello', MAMA, 'loud and indignant, arriving to sort things out', "Who's picking on my baby?!"),
  line('m.never', MAMA, 'bossy and proud', 'Nobody beats Mama!'),
  line('m.ouch', MAMA, 'outraged, silly', 'Hey! My good teapot!'),
  line('m.toot', MAMA, 'proud of an enormous toot, a bit embarrassed', "Mama's special toot!"),
  line('m.lose', MAMA, 'giving up, laughing, floating away', 'Okay, okay! Everybody, bedtime!'),

  // --- Music (Lyria) -------------------------------------------------------------
  {
    id: 'music.title',
    kind: 'music',
    prompt:
      "A warm, whimsical title theme for a children's cartoon game about a little girl who imagines her " +
      'cardboard box is a spaceship, on a summer evening in the backyard: dreamy celesta and glockenspiel, ' +
      'gentle plucked strings, a soft hopeful French horn melody that hints at a big adventure, 96 bpm. ' +
      'Steady the whole way through: no long intro, no ending, no fade-out. Instrumental, no vocals.',
  },
  {
    id: 'music.space',
    kind: 'music',
    prompt:
      "Upbeat, heroic, playful background music for a children's cartoon space-shooter game: a bouncy " +
      'retro-futuristic adventure with bright synth arpeggios, twangy surf guitar, brass fanfare stabs and ' +
      'driving light drums, like a 1960s cartoon space hero, 132 bpm. Fun, not scary. Gentle enough to ' +
      'play under sound effects. A steady groove the whole way through: no intro, no build-up, no ending ' +
      'and no fade-out, so it can loop. Instrumental, no vocals.',
  },
  {
    // World 2's stages (Mama's Galaxy): the same hero, bigger and faster.
    id: 'music.space2',
    kind: 'music',
    prompt:
      "Fast, exciting, heroic background music for the harder second world of a children's cartoon " +
      'space-shooter game: driving retro-futuristic synth bass, soaring brass melody, twangy surf guitar, ' +
      'energetic drums with handclaps, a sense of a big adventure getting serious but still fun, 146 bpm. ' +
      'Gentle enough to play under sound effects. A steady groove the whole way through: no intro, no ' +
      'build-up, no ending and no fade-out, so it can loop. Instrumental, no vocals.',
  },
  {
    id: 'music.boss',
    kind: 'music',
    prompt:
      "Exciting, silly boss-battle music for a children's cartoon space game against a pompous raccoon in " +
      'a giant spaceship: big bold brass, pounding toms, a cheeky tuba line and zippy synth runs, dramatic ' +
      'but goofy and never scary, 140 bpm. A steady groove the whole way through: no intro, no ending and ' +
      'no fade-out, so it can loop. Instrumental, no vocals.',
  },
];

/** The TTS prompt. Only the TRANSCRIPT section is spoken. */
export function voicePrompt(s) {
  return [
    `# AUDIO PROFILE: ${s.who.profile}`,
    "## DIRECTOR'S NOTES",
    `Style: ${s.style}. Cartoon voice acting, short, punchy and high-pitched.`,
    '#### TRANSCRIPT',
    s.text,
  ].join('\n');
}
