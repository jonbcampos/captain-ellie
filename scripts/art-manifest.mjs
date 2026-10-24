/**
 * What art to generate, and the prompt for each piece.
 *
 * This file is the art direction; `generate-art.mjs` is plumbing (copied from
 * ../slingshot unchanged). The rules are slingshot's, which inherited them from
 * ../tower-defense, where each was learned the hard way:
 *
 *  1. **One shared style paragraph** and one subject per piece. Change the look
 *     by changing DRAW_STYLE and regenerating everything, never per piece.
 *  2. **A character's poses are ONE image.** Two calls are two characters.
 *  3. **Say the grid as a count**, loudly. The model draws the grid it likes.
 *  4. **Sheets face RIGHT**, because that is what the model draws anyway; the
 *     loader mirrors whatever needs to face left (every raccoon ship).
 *  5. **Nothing keyed may contain green**, because the key is green.
 *
 * Two pieces are not drawn here at all: `boom.motion` (the explosion flipbook)
 * and `fart.motion` (the toot clouds the stink bubbles are made of) are copied
 * from ../slingshot, so a BOOM looks the same in both games. Their entries are
 * below so the index and the shrink script know about them; generate-art skips
 * them because the files already exist.
 *
 * The look is Spaceman Spiff: the title is the real world (a cardboard box in
 * the backyard), everything after "Blast off!" is what Ellie imagines it to be.
 */

// --- Shared prompt parts -----------------------------------------------------

const KEY_BACKGROUND = [
  'THE BACKGROUND MUST BE FLAT SOLID CHROMA-KEY GREEN, hex #00FF00, pure saturated green,',
  'covering every pixel that is not the subject. No white, no gradient, no vignette,',
  'no shadow cast onto the background, no stars, no space, no scenery, no border.',
].join(' ');

const MAGENTA_BACKGROUND = [
  'THE BACKGROUND MUST BE FLAT SOLID MAGENTA, hex #FF00FF, pure saturated magenta-pink,',
  'covering every pixel that is not a cloud. No white, no gradient, no vignette, no shadow,',
  'no floor, no scenery, no border.',
].join(' ');

const BLACK_BACKGROUND = [
  'THE BACKGROUND MUST BE PURE SOLID BLACK, hex #000000, every single pixel that is not fire',
  'or glowing light. No smoke against the black, no haze, no ground, no scenery, no border.',
].join(' ');

const DRAW_STYLE = [
  "children's picture book illustration in the spirit of a classic Sunday comic strip about a",
  'little kid imagining she is a heroic space explorer: soft rounded shapes, thick clean dark',
  'outlines, flat bright colours with simple soft shading, playful and adventurous, never scary.',
  'Palette of deep navy and violet space, coral pink, sunny yellow, bright orange, chrome silver',
  'and sky blue. No text, no letters, no numbers, no watermark',
].join(' ');

const NO_GREEN = 'The subject contains NO green anywhere: no green lights, no green paint, no green trim.';

const CUT_OUT = 'clean crisp edges suitable for cutting out against pure green #00FF00.';

/** Grid rules shared by every keyed sheet, as in slingshot. */
function gridRules(cols, rows) {
  const cells = cols * rows;
  return [
    `A SPRITE SHEET laid out as a grid of ${cols} columns by ${rows} rows.`,
    `THE GRID IS EXACTLY ${cols} CELLS ACROSS AND ${rows} CELLS DOWN: ${cells} figures in total, no more and no fewer.`,
    `Do NOT add another row. Do NOT repeat a row. Do NOT draw more than ${cells} figures.`,
    'Read each row left to right, top row first.',
    'The subject is IDENTICAL in every single cell: same design, same size, same colours, same',
    'proportions. It must be impossible to tell that any two cells were drawn separately.',
    'ONLY THE POSE AND EXPRESSION CHANGE from cell to cell.',
    'Centre each figure in its own cell, at the same size. EVERY figure must fit ENTIRELY INSIDE its',
    'own cell with a clear band of plain background on all four sides; nothing may touch or cross',
    'the boundary between cells, and nothing may run off the edge of the picture.',
    'Draw NO lines, borders, boxes, numbers or dividers between the cells: one single continuous',
    'flat #00FF00 background behind and between all the figures.',
    'NEVER mirror or turn the subject around between cells.',
    'Draw NOTHING except the subject: no stars, no planets, no motion lines, no smoke, no stray marks.',
  ].join(' ');
}

function cellList(cells) {
  return cells.map((text, i) => `Cell ${i + 1}: ${text}`).join(' ');
}

// --- The cast -----------------------------------------------------------------

/** Ellie, word for word as in ../slingshot and ../tower-defense, so she is the same girl. */
const ELLIE_LOOK =
  'a little girl about five years old, long wavy dark brown hair past her shoulders, ' +
  'warm honey-tan skin, big brown eyes';

/** The raccoon bandits, as in ../slingshot, now flying. */
const RACCOON_LOOK =
  'a small plump cartoon raccoon bandit: soft grey fur, a black bandit mask across his eyes, a cream ' +
  'muzzle, small rounded ears and a cheeky grin. A naughty little troublemaker, never mean or scary';

export const PIECES = [
  // --- Ellie's imagined ship -------------------------------------------------------
  {
    // Row 1 is the flying cycle (only the flame and a tiny bob change); row 2 is
    // her moods, picked by game state. Drawn ~48px wide, so the WHOLE ship tells
    // the mood (a bank, a wobble), not just her face.
    id: 'ellie.motion',
    aspect: '16:9',
    size: '2K',
    //
    // Asked for 4x2, the first run drew 4x3: its third row repeats the moods.
    // Read as drawn, and the repeat row thrown away ('skip'), rather than paying
    // to redraw a sheet whose other two rows are exactly right. A regenerate
    // that comes back 4x2 must set this back to rows: 2.
    sheet: { cols: 4, rows: 3, align: 'center', rowIds: ['fly', 'mood', 'skip'] },
    subject:
      `a small chunky cartoon rocket ship seen exactly from the SIDE, nose pointing RIGHT, flying ` +
      'horizontally: a rounded shiny coral-pink and chrome-silver body like a fat bullet, a big clear ' +
      `glass bubble cockpit on top, two little yellow fins at the back, and a short orange flame out of ` +
      `the round nozzle at the back (LEFT). In the bubble cockpit sits ${ELLIE_LOOK}, wearing a round ` +
      'clear bubble space helmet and a coral-pink space suit, looking RIGHT. The ship is about twice as ' +
      'long as it is tall.',
    cells: [
      'flying level, Ellie grinning, a short flame.',
      'flying level, Ellie grinning, a slightly longer flame.',
      'flying level, Ellie grinning, a short flame, the ship one hair higher.',
      'flying level, Ellie grinning, a long bright flame.',
      'Ellie cheering with one fist up inside the bubble, huge grin.',
      'the ship tilted slightly nose-up and wobbling, Ellie surprised with a round "oh!" mouth, eyes wide.',
      'Ellie amazed, both hands on her helmet, mouth a wide round "O", eyes sparkling.',
      'Ellie determined, eyes narrowed with a brave little smile, leaning forward.',
    ],
    extra: NO_GREEN,
  },

  // --- Raccoon ships ---------------------------------------------------------------
  {
    // The common enemy. Mirrored at load so it faces Ellie.
    id: 'saucer.motion',
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'center', mirrorRows: [0, 1], rowIds: ['fly', 'tease'] },
    subject:
      `a small round cartoon flying saucer seen from the side, tilted a little so its front points ` +
      `RIGHT: a dented silver-grey disc with a ring of little yellow and orange lights round its rim and ` +
      `a clear glass dome on top. Inside the dome sits ${RACCOON_LOOK}. The saucer is wider than tall.`,
    cells: [
      'the raccoon grinning, lights on.',
      'the raccoon grinning, lights blinking in a different pattern.',
      'the raccoon grinning, saucer tipped slightly the other way.',
      'the raccoon grinning, lights on.',
      'the raccoon sticking his tongue right out, eyes squeezed shut.',
      'the raccoon with both thumbs in his ears, fingers waggling, tongue out.',
      'the raccoon laughing with his mouth wide open, eyes squeezed into crescents.',
      'the raccoon looking scared, eyes huge and round, paws up.',
    ],
    extra: NO_GREEN,
  },
  {
    // The fast one: a little rocket that zips straight across.
    id: 'zipper.motion',
    aspect: '1:1',
    size: '1K',
    sheet: { cols: 2, rows: 2, align: 'center', mirrored: true, rowIds: ['fly', 'fly'] },
    subject:
      `a tiny skinny cartoon rocket seen exactly from the side, nose pointing RIGHT, painted purple ` +
      `with orange stripes and a pointy nose, ridden like a scooter by ${RACCOON_LOOK}, sitting astride ` +
      'it wearing round flying goggles, his ringed grey-and-charcoal tail streaming out behind him. ' +
      'A small orange flame out of the back.',
    cells: [
      'the raccoon crouched forward grinning, a short flame.',
      'the raccoon crouched forward grinning, a longer flame.',
      'the raccoon waving one paw cheekily, a short flame.',
      'the raccoon blowing a raspberry, tongue out, a long flame.',
    ],
    extra: NO_GREEN,
  },
  {
    // The slow one that shoots stink bubbles out of a big brass horn.
    id: 'tooter.motion',
    aspect: '1:1',
    size: '1K',
    sheet: { cols: 2, rows: 2, align: 'center', mirrored: true, rowIds: ['fly', 'fly'] },
    subject:
      `a chubby round cartoon spaceship seen from the side, front pointing RIGHT, shaped like a ` +
      `rusty orange tin can on its side with patches bolted on, a big shiny brass trumpet horn sticking ` +
      `out of the FRONT, pointing RIGHT. A round porthole window, and in it ${RACCOON_LOOK}, holding his ` +
      'nose with one paw.',
    cells: [
      'the raccoon grinning, the horn still.',
      'the raccoon puffing his cheeks out, about to toot.',
      'the horn bulging, the raccoon\'s eyes squeezed shut, cheeks puffed out.',
      'the raccoon giggling, the horn quivering.',
    ],
    extra: NO_GREEN,
  },
  {
    // Nobody is ever hurt: when a ship goes poof, its raccoon floats away in a
    // bubble helmet. Eight different floating poses; each escape picks one and
    // the game spins it gently as it drifts off.
    id: 'pilot.motion',
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'center', rowIds: ['float', 'float'] },
    subject:
      `${RACCOON_LOOK}, his body round like a ball, his ringed grey-and-charcoal tail curling, floating ` +
      'weightless with a clear round bubble space helmet over his head and a little orange jet-pack. ' +
      'Unhurt and still cheeky.',
    cells: [
      'waving bye-bye with one paw, grinning.',
      'sticking his tongue out, eyes squeezed shut.',
      'tumbling upside down, giggling.',
      'dizzy, little stars circling his helmet, a silly grin.',
      'blowing a raspberry, cheeks puffed.',
      'both thumbs in his ears, fingers waggling.',
      'paws on his tummy, laughing.',
      'shrugging, paws up, a sheepish grin.',
    ],
    extra: NO_GREEN,
  },

  // --- Bosses: one big picture each, facing RIGHT (drawn mirrored) -------------------
  ...[
    [
      'boss.1',
      'a big cartoon flying-saucer mothership, a wide silver dish with a ring of yellow lights, a giant ' +
        'glass dome on top, and inside the dome a chubby raccoon captain in a little captain\'s hat',
    ],
    [
      'boss.2',
      'a giant flying robot shaped like a raccoon\'s head: grey metal plates, a black bandit-mask visor ' +
        'with glowing yellow eyes, round metal ears with antennae, a grinning mouth grille, and little ' +
        'rocket jets underneath. A raccoon pilot waves from a small window in its forehead',
    ],
    [
      'boss.3',
      'a cartoon space pirate galleon flying through space: a round wooden hull with orange rocket ' +
        'thrusters, purple sails, a crow\'s nest, and a raccoon pirate captain with an eye patch and a ' +
        'tricorn hat on the deck holding a telescope',
    ],
    [
      'boss.4',
      'a giant flying silver garbage-can spaceship with its lid tilted open like a hatch, banana peels ' +
        'and fish bones poking out, little rocket thrusters on the bottom, and a gleeful raccoon popping ' +
        'out of the top holding the lid',
    ],
    // World 2: Mama's Galaxy.
    [
      'boss.6',
      'a giant flying igloo spaceship made of ice blocks with a big snowball cannon on the front, little ' +
        'icicles hanging underneath, blue rocket jets, and a raccoon in a woolly bobble hat and a long ' +
        'striped scarf grinning out of the igloo door, holding a snowball',
    ],
    [
      'boss.7',
      'a giant round flying hot-tub spaceship made of dark volcanic rock with glowing orange lava ' +
        'bubbling inside it instead of water, orange rocket jets, and a raccoon in sunglasses and a ' +
        'flower shirt lounging in the lava tub with his arms out, very relaxed and smug',
    ],
    [
      'boss.8',
      'a giant friendly cartoon space jellyfish: a big glossy pink-and-purple bell shaped like a dome ' +
        'with glowing spots, long wavy ribbon tentacles trailing behind, and a raccoon pilot sitting ' +
        'inside the see-through bell at a little steering wheel, wearing goggles',
    ],
    [
      'boss.9',
      'a giant clunky robot spaceship built from space junk: a fridge for a body, a washing machine ' +
        'door for a window, a car tyre, a satellite dish for an ear, mismatched rocket jets, and a ' +
        'raccoon mechanic in overalls waving a wrench from the washing machine window',
    ],
    [
      'boss.10',
      "Mama Raccoon's giant pink-and-gold mothership shaped like a big round teapot with a spout at the " +
        'front, frilly lace trim, little heart-shaped windows and rocket jets, and Mama Raccoon herself ' +
        'leaning out of the top: a big plump mother raccoon in a flowery apron and curlers, hands on ' +
        'her hips, looking very cross but silly',
    ],
    [
      'boss.5',
      'the Raccoon King\'s giant purple-and-gold battle ship shaped like a crown with rocket engines, a ' +
        'big round glass window at the front, and in it a fat raccoon king in a red cape and a tiny ' +
        'golden crown, grinning cheekily',
    ],
  ].map(([id, what]) => ({
    id,
    aspect: '4:3',
    size: '1K',
    subject:
      `${what}. Seen from the side, the whole thing facing RIGHT, filling most of the picture. Big, ` +
      'silly and impressive, clearly a playful cartoon and NEVER scary: no teeth, no weapons, no spikes.',
    extra: NO_GREEN,
  })),

  // --- Stage hazards (second playtest: "not just ships but environmental stuff") ------
  {
    // Spins in the game, so lit flat. Also drawn small for the rocks it breaks into.
    id: 'asteroid',
    aspect: '1:1',
    size: '1K',
    subject:
      'ONE big lumpy cartoon space asteroid, roughly round, warm brown and tan rock with a few round ' +
      'craters and chunky bumps, a thick dark outline. Lit evenly from the front with NO highlight on one ' +
      'side and no shadow, so it looks right however it is turned. Friendly, not scary, no face.',
    extra: NO_GREEN,
  },
  {
    // Drawn spinning; the game adds a purple glow and the pull rings around it.
    id: 'blackhole',
    aspect: '1:1',
    size: '1K',
    subject:
      'ONE cartoon black hole seen straight on: a perfectly black round centre surrounded by a bright ' +
      'swirling spiral disc of purple, magenta and pale pink, the spiral arms curling inwards like a ' +
      'whirlpool, with tiny sparkly stars being sucked in. Round overall. Exciting and magical, not scary.',
    extra: NO_GREEN,
  },
  {
    // The head leads LEFT (the direction it flies); the game adds a long glowing tail too.
    id: 'megacomet',
    aspect: '16:9',
    size: '1K',
    subject:
      'ONE HUGE cartoon comet flying to the LEFT: a big round glowing rocky head at the LEFT, orange and ' +
      'yellow, wrapped in bright flames, with a wide fiery tail of orange, yellow and red flames streaming ' +
      'out behind it to the RIGHT and tapering off. Bold, exciting and fun, like a picture book.',
    extra: NO_GREEN,
  },

  // --- Power-ups ---------------------------------------------------------------------
  {
    id: 'powerup.motion',
    aspect: '1:1',
    size: '1K',
    sheet: { cols: 2, rows: 2, align: 'center', rowIds: ['items', 'items'] },
    subject: 'FOUR different shiny round cartoon power-up bubbles, each a glossy glowing orb with a symbol inside.',
    cells: [
      'a sky-blue orb with two short parallel bright blue laser bolts inside.',
      'a sunny-yellow orb with a big smiling golden star inside.',
      'a pink orb with a big glossy red heart inside.',
      'a purple orb with a round black cartoon bomb with a lit fuse inside.',
    ],
    extra: 'Each orb is perfectly round and the same size. ' + NO_GREEN,
  },

  // --- Copied from ../slingshot (already on disk, never regenerated) --------------------
  {
    id: 'boom.motion',
    aspect: '16:9',
    size: '2K',
    background: 'black',
    sheet: { cols: 4, rows: 2, align: 'center', rowIds: ['fx', 'fx'] },
    subject: 'ONE cartoon explosion, shown as an animation in eight stages.',
    cells: [
      'a small white-hot flash star.',
      'a bright yellow-white ball bursting outward with spiky edges.',
      'a big round fireball, yellow core, orange rim.',
      'the fireball at its biggest: orange with red edges and puffy billows.',
      'breaking up into separate orange puffs.',
      'deep red puffs spreading apart.',
      'dim dark-red embers, mostly faded.',
      'a few last tiny glowing sparks.',
    ],
  },
  {
    id: 'fart.motion',
    aspect: '16:9',
    size: '2K',
    background: 'magenta',
    sheet: { cols: 4, rows: 2, align: 'center', rowIds: ['clouds', 'clouds'] },
    subject:
      'EIGHT different cartoon fart clouds, one in each cell of a grid of 4 columns by 2 rows: EXACTLY ' +
      'eight clouds, no more and no fewer, each centred in its own cell with clear magenta space all ' +
      'around it. Each is a puffy, lumpy little cloud made of three to five round puffs, coloured a ' +
      'silly pale yellow-green with a slightly darker yellow-green outline, with two or three wavy ' +
      '"stink lines" rising from the top. Some are small and round, some long and trailing, one has a ' +
      'tiny cheeky face. Funny, not gross. No lines, borders or dividers between the cells.',
  },
];

// --- The world ----------------------------------------------------------------------------

const SPACE =
  'A FLAT side-on GAME BACKGROUND for a 2D side-scrolling space game, wide and calm, no ' +
  'characters, no spaceships, no text. Lots of open dark space in the middle band where the action ' +
  'happens; the interesting things sit near the top and bottom edges and far away. Soft and a little ' +
  'hazy so things in front of it stand out. Sprinkled with small soft stars.';

PIECES.push(
  {
    id: 'space.1',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Deep navy blue space; along the bottom edge the curve of a big friendly cream-coloured moon covered in round craters, and a small blue-and-white Earth far away in the top corner.`,
  },
  {
    id: 'space.2',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Violet space with a huge orange-and-yellow ringed planet low on the right edge, its rings sweeping across the lower part, and two tiny moons.`,
  },
  {
    id: 'space.3',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Dark blue space with a sparkly belt of pastel candy-coloured asteroids along the top and bottom edges, pink and yellow and sky blue, like floating sweets, and a bright comet tail streaking far away.`,
  },
  {
    id: 'space.4',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} A glowing pink, purple and blue nebula of soft swirling clouds, with clusters of bright twinkling stars being born, dreamy and magical.`,
  },
  {
    id: 'space.5',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Dark purple space; along the bottom edge a lumpy little grey planet covered in silly junk piles, old tyres, tin cans and lost socks, with a few tiny twinkling lights, and a big yellow sun far away in a corner.`,
  },
  // World 2: Mama's Galaxy.
  {
    id: 'space.6',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Icy blue space; along the bottom edge a snowy little planet with frosty hills and sparkly ice crystals, and a few small icy comets with pale blue tails far away near the top.`,
  },
  {
    id: 'space.7',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Warm dark red-brown space; along the bottom edge a rocky volcano planet with three cartoon volcanoes gently puffing smoke and glowing orange lava rivers, and a big orange sun far away near the top.`,
  },
  {
    id: 'space.8',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Deep violet space with soft glowing magenta and teal nebula clouds, and a few small friendly glowing space jellyfish drifting far away near the top and bottom edges.`,
  },
  {
    id: 'space.9',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Dusky grey-blue space; along the bottom edge a ring of floating space junk drifting past: old satellites, bent bicycle wheels, tin cans and toasters, and a big ringed planet far away near the top.`,
  },
  {
    id: 'space.10',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject: `${SPACE} Rich plum and pink space; along the bottom edge a huge cosy pink-and-gold space station shaped like a house with heart-shaped windows and lace curtains, and strings of fairy lights stretching across the far distance.`,
  },
  {
    // The real world, before the imagination kicks in: Calvin and Hobbes's
    // cardboard-box spaceship. The centre-top is left empty for the title.
    id: 'title',
    aspect: '16:9',
    size: '2K',
    background: 'none',
    subject:
      "The cover picture of a children's game, a sunny backyard lawn on a summer evening seen side-on, " +
      `soft golden light. In the lower half, sitting inside a big brown CARDBOARD BOX turned into a ` +
      `pretend spaceship, is ${ELLIE_LOOK}, wearing a metal kitchen colander upside down on her head as a ` +
      'space helmet and a coral-pink T-shirt, pointing up at the sky with a huge excited grin. The box ' +
      'has crayon-drawn dials and buttons on the side, paper-plate fins taped on, and a cardboard tube ' +
      'for a nose. A wooden fence and a tree behind. The TOP HALF of the picture is open evening sky, ' +
      'peach fading to deep blue with the first few stars and a crescent moon, left empty for a title. ' +
      'No text.',
  },
);

// --- Prompt assembly --------------------------------------------------------------

/**
 * Composed from named parts, never by editing a finished string (slingshot's
 * rule: tower-defense lost a whole background to a `.replace()` that silently
 * stopped matching). The two copied pieces keep slingshot's exact wording.
 */
export function promptFor(piece) {
  if (piece.background === 'magenta') {
    return [
      MAGENTA_BACKGROUND,
      piece.subject,
      'There is NO magenta or pink anywhere in the clouds themselves.',
      `${DRAW_STYLE}, clean crisp edges suitable for cutting out against pure magenta #FF00FF.`,
      MAGENTA_BACKGROUND,
    ].join(' ');
  }
  if (piece.background === 'black') {
    const { cols, rows } = piece.sheet;
    return [
      BLACK_BACKGROUND,
      `A grid of ${cols} columns by ${rows} rows: EXACTLY ${cols * rows} drawings, no more and no fewer,`,
      'each centred in its own cell with black space all around it, read left to right, top row first.',
      'No lines, borders or numbers between the cells.',
      `Subject: ${piece.subject}`,
      cellList(piece.cells),
      'Bold cartoon shapes like a picture book, not realistic. No text, no letters, no watermark.',
      BLACK_BACKGROUND,
    ].join(' ');
  }
  if (piece.background === 'none') {
    return `${piece.subject} ${DRAW_STYLE}. This is a full-bleed background image: it must fill the entire frame edge to edge, with no border and no chroma-key colour anywhere.`;
  }
  if (piece.sheet) {
    const { cols, rows } = piece.sheet;
    return [
      KEY_BACKGROUND,
      gridRules(cols, rows),
      `The subject: ${piece.subject}`,
      cellList(piece.cells),
      piece.extra ?? '',
      `${DRAW_STYLE}, ${CUT_OUT}`,
    ].join(' ');
  }
  return [
    KEY_BACKGROUND,
    `Subject: ${piece.subject}`,
    'A single centred subject filling most of the frame.',
    piece.extra ?? NO_GREEN,
    `${DRAW_STYLE}, ${CUT_OUT}`,
  ].join(' ');
}
