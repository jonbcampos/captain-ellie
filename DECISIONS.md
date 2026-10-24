# Decisions

What we decided, why, and what would make us revisit it. **Append to this; don't rewrite
history.** This is the sister log to the ones in `../slingshot`, `../flappy-unicorn`, `../runner`
and `../tower-defense`.

---

## 1. Up and down only, by relative drag

Agreed with Jonathan for round 1: the rocket sits at a fixed x and only moves vertically. The
finger can go down anywhere, and the ship moves by how far the finger moves from there, times
`SHIP.dragGain` (1.25). It never jumps to the finger.

- **Relative, not absolute.** Absolute ("the ship goes where the finger is") hides the ship under
  her thumb, and the first touch would teleport it.
- **A gain a little over 1**, so a thumb can sweep the whole band in about 190 px of travel
  (`verify()` checks it fits in the screen) without feeling twitchy.
- **Re-anchored at the edges.** Pushing past the top and then reversing responds at once, instead
  of first having to unwind the extra finger travel.
- **Smoothed** (`SHIP.follow`, exponential, 22/s): attached to the finger, without every tremble.

**Revisit if:** she wants to fly forward and back (round 2). The ship's x is a constant in
`config.ts`, and the collision code already uses it everywhere as a variable would.

## 2. Autofire, and a weapon level that only goes up

She never presses fire. Power-ups step the weapon 1 → 2 → 3 (laser, Super Laser, Star Power) and
it never goes down within a stage: losing a shield doesn't take away the thing she was proud of
catching, and a retry keeps it. A weapon gift caught at full power becomes a +500 star instead.

The laser sound plays on every other volley and very softly. At six volleys a second, full volume
would be a drone within ten seconds.

## 3. Only stink bubbles shoot at her, and they're slow

Raccoon ships don't fire bullets. Tooters and bosses toot **stink bubbles**: big, bright
yellow-green, haloed, wobbling, at 62 px/s. That's about eight seconds to cross the screen, and
`verify()` checks they are far slower than the ship can dodge. Their hitbox is half the drawn
size, and the ship's hitbox is a 7 px circle round the cockpit, so a graze is a miss.

Bumping into a raccoon ship also costs a shield (the ship goes poof either way).

## 4. Shields, hearts, checkpoints: a gentle failure

Three shields, up to five. Hearts come from gift saucers in every stage and as random drops (12% a
kill, 30% when she's down to one). Out of shields is "Oopsie!" and **Try again!**, which restarts
at the stage's halfway checkpoint, or at the boss once she's reached it, with full shields.

## 5. Bosses bob slowly, and every one falls to the base laser

The first tuning had bosses bobbing 70 px at 0.35 Hz. A laser takes most of a second to cross the
screen, and by then the boss had moved out of the way of three shots in four: `verify()` found the
last three bosses taking 51–80 s with the base laser and a bot that follows the boss perfectly. At
55 px and 0.2 Hz the same bot takes 15 s (stage 1) to 40 s (stage 5). Power-ups make it much
quicker; they must never be required.

Boss hp grows 45 → 130 and the attack clock shortens 2.8 → 2.0 s, adding spreads, aimed volleys,
one big slow toot and minion saucers. That's the only thing that really gets harder from stage to
stage.

## 6. The boss goes out with a chain of booms

Ellie loves the TNT in slingshot more than anything, so a boss doesn't just vanish: 3.2 s of
explosions all over it, closer together towards the end, then a MEGA BOOM. Every blast renews a
beat of slow motion (slingshot's `BOOM_SLOWMO`), shakes the screen and flashes white, and gets one
word from BOOM / KABOOM / BANG / KA-BLAM / POW. The mega bomb power-up gets the same treatment.

## 7. Spaceman Spiff: the real world is only the title

The title is the backyard: Ellie in a cardboard box with crayon dials and a colander helmet. BLAST
OFF goes to the stage picker (still over the backyard), and picking a stage plays the **warp**: the
backyard rushes in towards the box while a starburst blooms out of it, a white flash, then space at
warp speed with the real rocket flying in. It plays before every stage, not just the first,
because it's the best moment in the game and it's 2.2 s.

## 8. The backdrop drifts; it doesn't tile

Slingshot tiles its ground by mirroring every other copy. Done to a space backdrop, that put two
Earths side by side at every seam. A backdrop has landmarks and a ground strip doesn't. The
painting now drifts slowly back and forth across its own spare width, the way a far planet barely
moves, and three layers of procedural stars carry the sense of flying forward. It's dimmed 22% so
painted asteroids never read as things to dodge.

## 9. Ellie's sheet was drawn 4×3, and read that way

Asked for a 4×2 sheet (flying frames, then moods), the model drew 4×3, with a third row repeating
the moods. The manifest reads it as 4×3 and skips the third row (`rowIds: ['fly', 'mood',
'skip']`) instead of paying to redraw a sheet whose two real rows are exactly right.
`__game.checkArt()` counts four bands on it, because the surprised pose has wobble marks drawn
beside the ship. That was checked by eye, and the sheet is listed in `DETACHED`.

## 10. Copied from the siblings

`core/loop`, `viewport`, `rng` and `wakelock` are byte-identical copies of slingshot's. `input`
gained held arrow keys, `save` a new key, and `audio` a new effect list (the voice, music, take
and toot machinery is unchanged). `render/sprites.ts`, `dev/art.ts` and the generate, shrink and
icon scripts are slingshot's. The explosion flipbook (`boom.motion`) and the stink clouds
(`fart.motion`) are slingshot's paintings, copied rather than regenerated.

## 11. Sitting still has to lose (first playtest)

Ellie liked the ship a lot, but she "just plays and doesn't work at all". Measured: a ship that
never moves cleared all five stages with 0-2 hits. Every formation flew into the lasers along her
own row, the stink bubbles only aimed 60% of the way at her, and boss spreads were centred on the
boss, so a ship parked level with its middle sat in the gap.

What changed:

- **Comets** (`HUNTER`, `hunters()` in stages.ts): every 4-6.5 s, depending on the stage, a red
  arrow flashes at the right edge at her current height and 0.9 s later an orange comet streaks in
  along it. Lasers go through comets, so she has to move. The first try used zippers aimed at her
  instead, and the idle ship still won, because autofire pops anything flying along her row.
- **Everything else aims at her**: bubbles fully (`BUBBLE.aim` 1), boss spreads centred on her.
- **Losing costs something**: running out of shields resets the weapon to one laser
  (`LOSE_KEEPS_WEAPON`), and the rocket goes off in a proper KABOOM. Shields max 4 (was 5) and
  heart drops are halved.

`verify()` now holds both ends: a ship parked at the top, middle or bottom loses every stage (in
20-30 s), and a simple dodging bot clears every stage. It took no hits in 15 of 15 runs, so a
child who watches the screen wins.

**Revisit if:** she's losing a lot and not enjoying it. Spread the comets out first (the
`hunters()` interval per stage), then give hearts back.

## 12. Bosses are fights; waves move (Jonathan's first play)

"Way too easy. Especially the bosses... they die so fast you barely have to dodge one attack."
And: "I could easily get around and 100% them all. Things definitely need to speed up." Measured
with `__game.feel()` (the dodging bot, collecting power-ups like a kid): boss fights lasted
7-11 s with 2-5 attacks, and the waves fired 4-15 bubbles a minute.

**Bosses.** About 8x the health (380 → 680 across the stages), and three phases at 2/3 and 1/3
health. Each phase attacks faster (`BOSS.phaseSpeed`) and bobs faster, with a "HE'S MAD!" /
"SUPER MAD!" shake and a red glow. Four new moves:
- **charge**: shakes and glows at her height for 0.85 s ("LOOK OUT!"), then lunges along that row
  past her ship. While lunging only the boss's core bumps, so the edges of the band stay escapable.
- **wall**: a column of bubbles across the band with one gap, never at her current height.
- **rain**: a ripple of bubbles falling from the top. They drain away at the bottom instead of
  bouncing, after the first version left them rolling along the floor forever.
- **ring**: a burst in every direction.

A gift saucer flies in every 15 s during a fight, carrying the laser back if a retry took it.
Without that, a lost boss attempt meant two-plus minutes with the single laser.

**Waves.** Each stage now has `heat`: saucers shoot back (6%/s each in stage 1, 20%/s in
stage 5), an extra trio of saucers every 3-5 s, raccoons fly 15-50% faster and weave wider,
saucers and zippers get +1/+2 health from stage 2, tooters toot five times instead of three, and
the starfield scrolls faster.

**Result, by feel():** boss fights of 37-67 s with 19-37 attacks, 33-84 bubbles a minute, and the
dodging bot still clears every stage (3-7 hits, at most one loss). `verify()` holds a boss fight
to 30-90 s and 15+ attacks, a dodging ship to at most one loss, and a parked ship to losing every
stage (now within 15-31 s). The old "every boss falls to the base laser in 45 s" check became
150 s, because a retry with one laser is meant to be a struggle, just never hopeless.

**Revisit if:** Ellie can't get past a boss. Lower `hp` per stage first, then `BOSS.phaseSpeed`.

## 13. Stage hazards, and rain on a slant (Jonathan's second play)

"Not just ships but environmental stuff": a black hole that pulls you, a really big comet you
have to get to the bottom of the screen to avoid, and large asteroids that take a lot of shooting.

- **Asteroids** (`ENEMIES.asteroid`): big, slow, 24 hp (+4 per point of `heat.armor`), so about
  four seconds of steady single-laser fire. They block her row; she blasts through or flies round.
  Each breaks into three rocks that scatter up and down as they come (`ROCKS`, path `scatter`).
  Cracks show as they wear down.
- **Black holes** (`BLACK_HOLE`): drift across in about 18 s, pull the ship towards their height
  (at most 85 px/s, under half what the keys do and far under a finger), bend stink bubbles'
  paths and swallow lasers. Touching the core costs a shield. The pull is applied to the ship's
  target and fed into main.ts's drag anchor (`pullDY`), so she feels it under her finger rather
  than having it undone by the next drag sample. The first falloff (120 px) barely faded with
  height; at 70 px passing close is a fight and passing wide is easy.
- **Giant comets** (`BIG_COMET`): the top or bottom 64% of the band flashes red with "BIG COMET!
  GO DOWN!" (or UP) for 1.7 s, then a comet the size of the zone roars through it, sweeping away
  raccoons and bubbles. The strip left is 77 px (2.7 ships), and the worst-case crossing takes
  0.8 s of the 1.7 s warning.

Placed per stage in `hazards` (stages.ts), themed: Candy Comets gets three giant comets, Nebula
Nursery two black holes, the Raccoon King everything. All three are painted by Gemini (asteroid,
blackhole, megacomet), with drawn fallbacks.

**Rain.** Falling straight down was undodgeable ("not sure what she is supposed to do there other
than get hit"): the ship only moves up and down, so a drop falling down her own column passes
through every height. It now slants in from the top right. The first slant was too shallow and too
crowded, with drops crossing her column 22 px apart, each 26 px wide: a solid wall. Five drops, 70
px apart at a 0.75 slope, cross about 52 px apart, with real gaps.

**The bot had a bug that mattered.** `dodge()` started its look-ahead at "now", where every
candidate height still has the ship where it is. When she was already in danger, every option
scored the same and it froze, which is why it sat through whole charges and made the bosses read
as unfair. It now looks from 0.2 s ahead, scans the whole band (a giant comet's zone is wider than
any short hop), and sees asteroids, rocks, black holes and the comet zone. `verify()` adds three
fairness checks: a black hole can be out-flown, a giant comet leaves a reachable strip, and the
toughest asteroid breaks to a single laser long before it arrives.

**Result, by feel():** every stage cleared by the bot with 0-10 hits and at most one loss; boss
fights 45-88 s with 22-50 attacks, growing stage by stage.

## 14. World 2, quiet help, and the same game on every phone

"Now we need another set of stages." Then, after playing: "I worry too hard... she shot through
the first levels no problem. Now maybe she will try again a few times to get it... if we see her
losing again and again maybe up the quantity of hearts."

**World 2: Mama's Galaxy** (stages 6-10). The Raccoon King's losing line is "No fair! I'm telling
my mom!", so he did. Each stage adds a trick: Snowball Sam's bouncing snowballs, Volcano Planet's
**eruptions** (lava blobs arcing up from the bottom on the same dodgeable slant as the rain),
Jelly Jim's **mines** (they drift in, blink faster, and burst into a ring of six), Junkyard
Rings' **junk walls** (asteroid columns with one slot open: fly to it or blast a new one), and
Mama Raccoon in her teapot with all of it, voiced by her own lines (`m.*`, BossSpec.voice). New
Gemini art for five bosses and five backdrops, and a faster stage tune (music.space2). Stage
select is two rows, one per world. Snowball Sam's painting already faces left, so it isn't
mirrored (`facesLeft`).

**Help** (`HELP`, save.struggle). Losses on a stage since she last cleared it, remembered between
sessions. After one, hearts drop twice as often; after two, three times, plus an extra shield;
after three, four times, plus a heart floating in at the start. During a boss fight the gift
saucer brings a heart instead of a power-up whenever she's below full. Clearing the stage resets
it. Nothing on screen says "easy": it's just more hearts.

**The screen-width bug.** The frame is 480-640 virtual px wide depending on the phone, and the
game was tuned by accident on whatever window the dev console was in. On a narrow 16:9 frame
everything reaches her about 25% sooner, and the bot lost stages there that it won on a modern
phone. `GameState.pace()` now slows raccoons and bubbles in proportion on narrow frames (down to
0.8 at 480), so reaction time is the same everywhere. Rain and eruptions are anchored to the ship,
not the screen edge, so their gaps cross her column at the same heights on every phone.

**Tuning by many runs.** One bot run per stage was too noisy: small changes flipped a stage from
clear to four losses. `__game.feelMany()` plays every stage three times with different luck on a
narrow and a modern frame, and the balance is set on its averages. It's slow in a browser tab, so
it was run in Node: bundle `src/dev/verify.ts` with the esbuild that ships with Vite. Final
averages: world 1, 0-0.8 losses a stage; world 2, 0.7-1.5, building to Mama Raccoon; boss fights
47-107 s. Changes that got there: the charge winds up for 1.1 s (was 0.85) with a slimmer
mid-lunge hitbox; last-phase attacks a little slower (`phaseSpeed` 0.78); late bosses lighter;
Pirate Pete rains only in his last phase (early rain pinned one run in six against the edge); and
no boss rains straight into a five-way spread.

In isolation the charge is always dodgeable (40 of 40 starting heights). Its hits in play come
from charges overlapping bubbles already in flight, which is the intended challenge.

## 15. Drawing at most 60 times a second (2026-10-24)

"Every time she plays on my phone my phone definitely gets hot... this is the same for all games."
The simulation still steps 120 times a second, but `core/loop.ts` now draws a picture at most
60 times a second, whatever the screen's refresh rate: a 120Hz phone was drawing twice as often as
the game needed. Measured on a laptop, a frame of this game costs well under a millisecond to
draw, so the rate was the waste, not the drawing. The same loop file is shared by every game in
the set; a dev-only `__loop.render(alpha)` lets the console time one frame directly.
