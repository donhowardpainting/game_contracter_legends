// Every conversation in Harbor's End, plus the scripted story beats.
import type { Game, Skill } from './game';
import * as C from './content';

export interface Choice { t: string; req?: [Skill, number]; cost?: number; go: (G: Game) => Script | void }
export interface Script { lines: string[]; choices?: Choice[]; then?: (G: Game) => Script | void }
const S = (lines: string[], then?: (G: Game) => Script | void, choices?: Choice[]): Script => ({ lines, then, choices });

/** which NPC a "talk to…" quest step points at (for the tracker arrow) */
export const STEP_NPC: Record<string, string> = {
  'mq1:0': 'gus', 'mq1:3': 'gus', 'mq2:0': 'mabel', 'mq2:4': 'mabel', 'mq3:0': 'rosa', 'mq3:4': 'rosa', 'mq4:0': 'silas', 'mq4:3': 'nell', 'mq5:3': 'nell',
  'mq6:0': 'vale', 'mq6:4': 'vale', 'mq7:3': 'nell', 'sq_tree:2': 'hattie', 'sq_boat:1': 'silas', 'sq_lamps:1': 'dev', 'sq_mural:1': 'ines', 'sq_tom:1': 'tom', 'sq_gus:0': 'gus',
};
export function stepNpc(G: Game, qid: string, step: number) { if (qid === 'mq6' && step === 4 && G.S.flags.vale_deal === 'refuse') return 'nell'; return STEP_NPC[qid + ':' + step]; }

const LESSON: Record<string, Skill> = { gus: 'carpentry', ines: 'painting', nell: 'engineering', tom: 'demolition', rosa: 'business', mabel: 'negotiation', silas: 'exploration' };
const LESSON_LINE: Record<string, string> = {
  gus: "gus: Crown up on a joist. Nail where the grain can't split. And never trust a board that's been stored flat. There — that's a year of mistakes I just saved you.",
  ines: "ines: Load the roller, don't drown it. Work wet edge to wet edge. And look at the wall from across the street — that's where everyone else sees it from.",
  nell: "nell: Every load wants to get to the ground. Your whole job is giving it a polite way down. Triangles don't argue. Rectangles do.",
  tom: "tom: You don't hit the wall. You hit the thing holding the wall up. Find the one nail that matters. Then introduce yourselves.",
  rosa: "rosa: Know your cost before you open your mouth. Pay your people first, your suppliers second, yourself third. And never, ever price a job hungry.",
  mabel: "mabel: People don't want to win, dear. They want to be heard. Repeat back what they said, slowly. You'll be amazed what they'll give you.",
  silas: "silas: There's a deer trail round every deadfall, loose planks under every dock, and stepping stones wherever a creek runs slow. The land tells you. You just have to shut up and look.",
};

function hub(G: Game, id: string, greet: string[], topics: { t: string; lines: string[] }[], extra: Choice[] = []): Script {
  const choices: Choice[] = [...extra];
  for (const tp of topics) choices.push({ t: tp.t, go: () => S(tp.lines, () => hub(G, id, [], topics, extra)) });
  const sk = LESSON[id];
  if (sk && !G.S.flags['lesson_' + id] && G.skillLv(sk) < 5) choices.push({ t: `Ask for a ${C.SKILL_INFO[sk].name} lesson`, cost: 50, go: () => { G.flag('lesson_' + id); G.addXp(sk, 30); return S([LESSON_LINE[id], `(${C.SKILL_INFO[sk].name} +30 XP)`]); } });
  choices.push({ t: 'Goodbye.', go: () => {} });
  return S(greet, undefined, choices);
}
const q = (G: Game, id: string) => C.qStep(G, id);
const hireChoice = (G: Game, id: string): Choice[] => {
  const c = C.CREW.find((x) => x.id === id)!;
  if (G.S.crew[id]?.hired || !C.qDone(G, c.need)) return [];
  return [{ t: `Offer ${C.npcName(id)} a place on the crew ($${c.wage}/day)`, req: ['business', 2], go: () => {
    if (C.crewCount(G) >= C.crewCap(G)) return S([`${id}: I'd say yes — but you can't make payroll for more hands yet. (Business Lv 4 for a bigger crew.)`]);
    G.S.crew[id] = { hired: true, assign: 'jobs' }; G.addXp('business', 25); G.addRep(2); G.snd.sfx('quest');
    G.ui.banner('Crew Hired', `${C.npcDef(id).name} joined Hollis & Co.`);
    return S([id === 'dev' ? "dev: Hollis and Co. Huh. 'And Co.' is me. I'm the Co. …Yeah. Yeah, I'm in." : id === 'ines' ? "ines: A crew. With health insurance? No? With lunch? …Okay, with lunch. I'm in." : "tom: Fine. But I pick the radio station.", '(Manage your crew from the Company Board at the shop.)']);
  } }];
};

// ───────────────────────── per-NPC conversations ─────────────────────────
const TALK: Record<string, (G: Game) => Script> = {
  gus: (G) => {
    const s = q(G, 'mq1');
    if (s === 0) return S([
      "gus: You must be Walt's kin. Got his jaw. I'm Gus — Brannigan Lumber, across Maple.",
      'gus: He left you the shop, the truck, and a town that crosses the street when it hears the name Hollis.',
      'you: Why? What did he do?',
      "gus: Depends who you ask. Ask me, he's the only man who told the truth around here. Ask anybody else… well. You'll hear.",
      "gus: Talk's cheap. Lumber ain't — but today it is. I dropped some boards by your wall. That rack fell over the winter he passed. Put it back up.",
      'gus: Hammer is [2]. Click the ghost boards to set them, then hit every glowing nail until it sits flush.',
      "gus: Then give that tired front wall a coat. Three gallons of tintable and Walt's old brush are on the bench — [3] for the brush, [C] picks the colour.",
    ], () => { G.S.inv.lumber += 6; G.S.inv.paint += 3; G.S.tools.paint = true; G.truck.refresh(); G.ui.refreshHotbar(); C.advance(G, 'mq1'); });
    if (s === 1 || s === 2) return S([s === 1 ? "gus: Rack first. Posts, then rails. Drive the nails home — a proud nail is a liar." : 'gus: Now the wall. A shop that looks dead stays dead. Hold the mouse down and roll.']);
    if (s === 3) return S([
      'gus: Huh. (He looks at the wall a long moment.)',
      'gus: Walt painted it that exact— no. No, his was uglier.',
      "gus: Here. Sixty bucks. Don't argue, it's for the rack. I'm going to borrow lumber off it.",
      "gus: You want real work? Mabel Okafor. Yellow house on Bay Road, east of Main. Her porch has been rotting since the Crown mess, and last week she asked me for 'a Hollis'. First person in fifteen years.",
      "gus: Take Walt's sledge — it's behind the bench. And take the truck. Keys are in it. They're always in it. Stand by the door and press [E].",
    ], () => { G.earn(60, 'lumber rack'); G.addRep(2); G.S.tools.sledge = true; G.ui.refreshHotbar(); C.advance(G, 'mq1'); C.startQuest(G, 'mq2'); applyHolds(G); });
    const extra: Choice[] = [];
    if (C.qDone(G, 'mq3') && q(G, 'sq_gus') < 0) extra.push({ t: 'You look worried, Gus.', go: () => { C.startQuest(G, 'sq_gus'); return gusDebt(G); } });
    else if (C.qActive(G, 'sq_gus')) extra.push({ t: 'About the yard…', go: () => gusDebt(G) });
    return hub(G, 'gus', [G.S.flags.postgame ? "gus: Morning, boss. Don't let it go to your head." : (G.S.trust.gus ?? 2) >= 5 ? 'gus: There he is. The yard smells like work again.' : "gus: Hollis. What'll it be?"], [
      { t: 'Tell me about Walt.', lines: ['gus: We came up together. He framed, I supplied. Forty years.', "gus: After the marina, the inquiry put it all on him. 'Builder negligence.' He never fought it. Just kept showing up at that shop every day with nothing on the books.", "gus: I asked him once why he didn't leave. He said, 'You don't walk off a job that isn't finished.'"] },
      { t: 'What happened to this town?', lines: ['gus: Chesapeake Crown happened. Marina, hotel, lofts. Big money from across the bay.', 'gus: Three projects, three failures, one winter. Folks lost deposits, pensions. The company dissolved like sugar.', "gus: Half the town moved off. The half that stayed stopped fixing things. What's the point of paint on a place with no future?"] },
    ], extra);
  },

  mabel: (G) => {
    const s = q(G, 'mq2');
    if (s === 0) return S([
      'mabel: Well. A Hollis on my walk. I taught your uncle in the fourth grade — he measured my desk while I was talking.',
      'mabel: This porch was meant to be rebuilt the spring of the Crown Marina. Then the marina went into the bay, and everything in this town just… stopped. Including my carpenter.',
      'you: I can start today.',
      "mabel: The railing first, dear. It's more mushroom than wood. Don't be gentle with it.",
      "mabel: You'll need boards from Gus for the new one — and whatever stain you think suits. I trust your eye. I shouldn't, but I do.",
    ], () => C.advance(G, 'mq2'));
    if (s >= 1 && s <= 3) return S([['mabel: Go on, hit it! I have waited fifteen years to hear that sound.', "mabel: Straight posts, level rails. Your uncle would check with a marble. I'm told there are tools for that now.", 'mabel: Oh, that colour will do nicely. Mind the edges.'][s - 1]]);
    if (s === 4) return S([
      "mabel: Oh. Oh, look at it. I'd forgotten the porch had a colour.",
      'mabel: Now — the bill. I must be honest with you: my pension is what it is. I can do one hundred and forty dollars, and a peach pie that has ruined better people than you.',
    ], undefined, [
      { t: "Take the $140 and the pie. That's the going rate for porches.", go: () => { G.earn(140, "Mabel's porch"); G.give('pie'); G.trust('mabel', 2); G.addRep(4); return mabelStory(G, 'mabel: Fair is fair. And fair is rarer than you would think.'); } },
      { t: 'Materials alone ran close to that. I need $260.', go: () => { G.earn(260, "Mabel's porch"); G.trust('mabel', -1); G.addRep(1); G.addXp('negotiation', 12); return mabelStory(G, "mabel: …Of course. You're running a business. Walt never could. (She counts it out in small bills.)"); } },
      { t: 'Keep your pension. Just tell the Garden Club who fixed your porch.', go: () => { G.earn(60, 'materials only'); G.give('pie'); G.trust('mabel', 3); G.addRep(10); G.addXp('negotiation', 25); return mabelStory(G, 'mabel: Tell them? Child, I am going to be INSUFFERABLE about it.'); } },
    ]);
    return hub(G, 'mabel', [G.S.flags.postgame ? 'mabel: I leave the porch light off now. I like to watch the big one come around.' : 'mabel: Hello, dear. Mind the peonies.'], [
      { t: 'What was Walt like as a boy?', lines: ['mabel: Quiet. Stubborn as a stripped screw. He once rebuilt the class birdhouse over a weekend because the roof pitch "bothered him".', 'mabel: He could not abide a thing done halfway. Remember that when people tell you he cut corners.'] },
      { t: 'What do you make of Councilman Vale?', lines: ['mabel: Preston was my student too. Bright. Always knew the answer the teacher wanted.', "mabel: That is not the same as knowing the answer, and it took me too long to see the difference."] },
      { t: "How was Harbor's End before?", lines: ['mabel: Loud! Crab boats at five, the cannery whistle at seven, children everywhere. The boardwalk had a carousel.', 'mabel: A town is a habit, dear. We fell out of the habit. You are reminding people.'] },
    ]);
  },

  rosa: (G) => {
    const s = q(G, 'mq3');
    if (s === 0) return S([
      "rosa: You're the Hollis kid. Mabel called. Twice. Sit — no, don't sit, that stool's broken. It's on the list too.",
      "rosa: Here's my problem. Summer people drive through, see a peeling shack on a dead wharf, and keep driving. I want a deck with tables on the water, and a front that says we are OPEN.",
      "rosa: You can't rip lumber on my wharf. Cut your boards at your shop — four of them — then frame the deck off my east side. Walt left a handsaw in that shop, I'd bet my fryer on it.",
      "rosa: And take my pressure washer. Salt, grease, gull… leavings. It ALL comes off before paint or it peels by August. Then Crab Shack Red. Don't get creative.",
    ], () => { G.S.tools.saw = true; G.S.tools.washer = true; G.toast('Received: hand saw [5] and pressure washer [6]', 'good'); G.ui.refreshHotbar(); C.advance(G, 'mq3'); });
    if (s >= 1 && s <= 3) return S([["rosa: Four boards. Measure twice. I'm not paying for firewood.", "rosa: Joists, then decking. I want to dance on it. I won't, but I want to be able to.", "rosa: Wash FIRST. I can tell. I'll know."][s - 1]]);
    if (s === 4) return S([
      '(Rosa stands on the new deck with her arms crossed — which, for Rosa, is a standing ovation.)',
      "rosa: Two-twenty, as agreed. And you eat free until Labor Day. Don't make it weird.",
      'rosa: You know who used to sit right there, before there was a deck? Preston Vale, and a man named Victor Crane. Chesapeake Crown. They would order nothing and talk for hours.',
      'rosa: Crane vanished the week the marina fell in. Preston got himself elected. Funny what the tide takes and what it leaves.',
      "rosa: Silas was on the water that night — my sister's husband, God rest her. He's on the pier most mornings. Ask him about your uncle's boathouse.",
      "rosa: Oh — and I pinned some jobs to that board outside your shop. People are asking for you by name now. You're a real business. Act like one.",
    ], () => { G.earn(220, 'Crab Pot deck & paint'); G.addRep(5); G.trust('rosa', 2); G.flag('contracts_open'); G.addXp('business', 20); C.advance(G, 'mq3'); C.startQuest(G, 'mq4'); G.toast('The Company Board at your shop is open: contracts, crew, property.', 'good'); });
    return hub(G, 'rosa', [G.S.flags['task:diner_deck'] ? 'rosa: Deck was full at lunch. FULL. I ran out of forks.' : "rosa: Kitchen's open. What do you need?"], [
      { t: 'Tell me about Vale and Crane.', lines: ['rosa: Crane was the money. Smooth, expensive watch, never finished a coffee. Preston was his errand boy — a clerk at Town Hall then.', "rosa: After the collapse there was an inquiry. Lasted nine days. Blamed your uncle, closed the file. Preston notarised half the paperwork himself.", 'rosa: I pour coffee for a living. You learn to notice who stops talking when you walk up.'] },
      { t: "How's business?", lines: ["rosa: Better since you showed up, and I hate that I just said that out loud.", "rosa: A town runs on small things working. A deck. A light. A door that shuts right. People can feel it."] },
    ]);
  },

  silas: (G) => {
    const s = q(G, 'mq4');
    if (s === 0) return S([
      'silas: Hollis. I wondered when one of you would walk out on this pier.',
      'silas: I was hauling pots off the point the night Crown Marina let go. Sounded like the bay clearing its throat. Forty slips, gone in the time it takes to say it.',
      "silas: Walt was standing on the seawall. And here's what I never told a soul: he wasn't surprised. He was heartbroken. There's a difference.",
      "silas: He kept a logbook in that boathouse yonder — every pour, every pile. After the inquiry he boarded the door himself and handed me the key. Said: 'Not until somebody asks the right question.'",
    ], undefined, [
      { t: "I'm asking. What really happened?", go: () => S(["silas: That's a question. Not sure it's the right one yet.", "silas: Tell you what. The Marguerite needs her hull done and my shoulder's finished. Do right by her and the key is yours.", "silas: Or take a sledge to those boards. Walt would have."], () => { C.advance(G, 'mq4'); C.startQuest(G, 'sq_boat'); }) },
      { t: "He trusted you to judge. So judge — you've seen my work.", req: ['negotiation', 2], go: () => S(["silas: …Damn. That's him. That's him exactly.", '(He works a brass key off a ring that has clearly not been opened in years.)', "silas: Go easy on the place. It's all that's left of how he thought."], () => { G.give('key'); G.addXp('negotiation', 20); G.trust('silas', 1); openBoathouse(G, 'You unlock the boathouse and pull the boards down from inside.'); C.advance(G, 'mq4'); }) },
      { t: "Keep the key. I'll find my own way in.", go: () => S(['silas: Hm. Hollis through and through.'], () => C.advance(G, 'mq4')) },
    ]);
    if (q(G, 'sq_boat') === 1) return S([
      '(Silas runs his palm down the hull and says nothing for a while.)',
      'silas: Marguerite picked her colour, you know. The first one. My wife, I mean — the boat came second and never forgot it.',
      "silas: Here. For the work. And the key, if you haven't already made kindling of that door.",
    ], () => { G.earn(150, 'the Marguerite'); G.trust('silas', 2); G.addRep(3); if (!G.S.flags['task:boathouse_boards']) { G.give('key'); openBoathouse(G, 'With the key, the boathouse door swings open.'); } C.advance(G, 'sq_boat'); });
    const extra: Choice[] = [];
    if (q(G, 'sq_boat') < 0 && C.qDone(G, 'mq3')) extra.push({ t: 'Your boat could use some paint, Captain.', go: () => { C.startQuest(G, 'sq_boat'); return S(["silas: She could. Wash the barnacles off first — stand on the pier, you'll reach. Pick her a good colour."]); } });
    return hub(G, 'silas', [G.S.flags.lit ? 'silas: Came in by the light last night. First time since I was a younger fool.' : 'silas: Tide waits on nobody. Talk fast.'], [
      { t: 'Tell me about the night of the collapse.', lines: ['silas: No storm to speak of. That was the strange part. Just a spring tide, a bit of chop.', 'silas: The piles went over like a man fainting — slow, then all at once. Sound ground does not do that. Mud does that.', 'silas: And the next morning there was a fresh survey on the inquiry table saying the ground was fine. Fresh as bread.'] },
      { t: 'Who was Marguerite?', lines: ["silas: My wife. Rosa's sister. Forty-one years.", "silas: She used to say a boat kept in paint will forgive you nearly anything. I let the paint go when she did.", '(He looks out at the water.) Might be I was wrong to.'] },
    ], extra);
  },

  nell: (G) => {
    if (q(G, 'mq4') === 3) return S([
      "nell: That's Walt's hand. I'd know it — he wrote my father every week of that job.",
      "nell: 'Thorn says the fill won't hold.' Thorn is my father. Elias Thorn, the surveyor. He told them the waterfront is dredge spoil dumped on mud. You could build a shed on it. Not a marina.",
      "nell: The survey at the inquiry said the ground was sound. It had his signature. He swore until the day he died he never signed it.",
      "nell: He kept field copies at his cabin, out past the west end of Maple Lane. I've never been able to make myself go. The trail's blocked now anyway, and the footbridge is out.",
      'nell: If that copy exists, it proves the survey was swapped. Would you—? Take the forest trail. Bring a saw.',
    ], () => { G.addXp('engineering', 15); G.trust('nell', 1); C.advance(G, 'mq4'); C.startQuest(G, 'mq5'); });
    if (q(G, 'mq5') === 3) return S([
      '(She reads it twice. Her hands are very steady, which seems to cost her something.)',
      'nell: Two metres of fill here. Four here. FOUR. They drove the piles three metres and called it bedrock.',
      "nell: But this is a field copy. A lawyer would call it an old man's notebook. The stamped original went to Crown's site office — in the cannery. If Crane kept it, it is still in there with the books.",
      "nell: Be careful. Preston Vale has been asking about you. When Preston asks about someone, he's deciding what they cost.",
    ], () => { G.addXp('engineering', 20); G.trust('nell', 1); C.advance(G, 'mq5'); C.startQuest(G, 'mq6'); });
    if (q(G, 'mq6') === 4 && G.S.flags.vale_deal === 'refuse') return S([
      "nell: He asked you to PAINT over it. Of course he did. There's a buyer coming — a resort group. If the Marlowe passes a walk-through, the whole point sells and the fill becomes somebody else's funeral.",
      "nell: You turned him down. I know what nine hundred dollars is to a shop like yours. I won't forget it.",
      "nell: The cannery. Whatever's in that office, we need it before the sale. The entrance has been buried since the roof beam dropped — Big Tom might help, if you can stand him.",
    ], () => { G.trust('nell', 2); G.addRep(3); C.advance(G, 'mq6'); C.startQuest(G, 'mq7'); });
    if (q(G, 'mq7') === 3) return S([
      "nell: The original. With the real numbers. And a second page — 'Revised per V.C.' Crane's initials.",
      'nell: And the notary on the forged copy…',
      'you: Preston Vale.',
      'nell: He was a clerk. Twenty-six. He notarised a forgery, and Crane paid him out of the insurance. It is all here. In columns.',
      "nell: Council meets on the Town Hall steps tonight, about the sale. Everyone will be there. Bring that ledger. Whatever is done with it — it should be you who does it. You're the Hollis.",
    ], () => { G.addXp('engineering', 20); C.advance(G, 'mq7'); C.startQuest(G, 'mq8'); applyHolds(G); });
    const extra: Choice[] = [];
    if (G.S.flags.sold_out && !G.S.flags.nell_scold) extra.push({ t: '(She is looking at you strangely.)', go: () => { G.flag('nell_scold'); return S(['nell: I walked past the Marlowe. Fresh paint over a cracked wall.', "nell: My father's signature was forged on a lie exactly that shape. I hope the money was good."]); } });
    if (C.qActive(G, 'mq7') && q(G, 'mq7') <= 1) extra.push({ t: 'Any advice about the cannery?', go: () => S(["nell: Crown's office was in the south-east corner. My father said Crane had a safe put in — and then had the room made smaller around it. Measure the wall from outside, then from inside.", "nell: And Crane was vain about local history. Bought the Founders' Anchor a new plaque just to put his company's name near it."]) });
    return hub(G, 'nell', [G.S.flags.lit ? "nell: My mother kept that light for thirty years. I'd forgotten what the shop looks like with it sweeping past the window." : 'nell: Tidewater Supply. If it cuts, fastens or measures, I have it.'], [
      { t: 'Tell me about your father.', lines: ['nell: He was the most careful man on the Eastern Shore. He once re-shot a whole boundary because a stake was out by the width of a pencil.', "nell: After the inquiry nobody would hire him. A surveyor is only worth his signature. They took it from him and wore it like a mask."] },
      { t: 'Why is the lighthouse dark?', lines: ["nell: Coast Guard decommissioned it the year after the marina. Said the harbour had no traffic worth a light.", "nell: The lamp still works. I check it every month. Nobody ever asked me to stop."] },
    ], extra);
  },

  vale: (G) => {
    const s = q(G, 'mq6');
    if (C.qActive(G, 'mq8') && !G.S.flags.ending) return meeting(G);
    if (s === 0) return S([
      "vale: There you are! The talk of the town. Mabel's porch, Rosa's deck — you have done more for morale in a month than I've managed in a decade.",
      'vale: I have an opportunity for you. Tidemark Resorts is sending a buyer to walk Marlowe Point. If they like what they see, they take the hotel, the cannery, the lot. Jobs. A tax base. A future.',
      'vale: The Marlowe simply needs to… present well. There are some settlement cracks along the ground floor. Cosmetic. A skim of filler, a coat of paint.',
      'vale: Nine hundred dollars. And my gratitude, which in this town is worth rather more.',
    ], undefined, [
      { t: 'Nine hundred to paint one wall? Done.', go: () => S(['vale: Wonderful. I knew you were practical. Walt, God rest him, was never practical.'], () => { G.flag('vale_deal', 'cosmetic'); C.advance(G, 'mq6'); }) },
      { t: "Those aren't settlement cracks. I'll do it — after I brace the foundation properly.", req: ['engineering', 2], go: () => S(['(A pause, exactly one breath too long.)', "vale: Bracing. How… thorough. That is your time, and I am paying for paint. But by all means."], () => { G.flag('vale_deal', 'right'); G.addXp('engineering', 15); C.advance(G, 'mq6'); }) },
      { t: "I don't cover cracks. I fix them, or I leave them alone.", go: () => S(["vale: That's a shame. Your uncle said something very like it once.", 'vale: Do look where it got him.'], () => { G.flag('vale_deal', 'refuse'); G.addRep(3); C.advance(G, 'mq6'); }) },
    ]);
    if (s === 4 && G.S.flags.vale_deal === 'cosmetic') return S([
      "vale: Flawless. You can't see a thing. Nine hundred, as promised — and do keep the brush.",
      '(As you count it, you notice Nell across the plaza. She has seen the wall. She does not wave.)',
    ], () => { G.earn(900, "Vale's job"); G.addRep(-6); G.trust('nell', -2); G.flag('sold_out'); C.advance(G, 'mq6'); C.startQuest(G, 'mq7'); });
    if (s === 4 && G.S.flags.vale_deal === 'right') return S([
      "vale: It's… very sturdy. The buyer may wonder why a sound building needs quite so much timber, but — no. No. Here. Five hundred. For the paint.",
      "(He is already looking past you. Across the plaza, Nell Thorn gives you a small, fierce nod.)",
    ], () => { G.earn(500, 'the Marlowe'); G.addRep(8); G.trust('nell', 2); G.addXp('engineering', 25); C.advance(G, 'mq6'); C.startQuest(G, 'mq7'); });
    if (G.S.flags.ending === 'deal') return S(['vale: (Quietly.) The transfer cleared this morning. The letter runs Thursday. I trust we are concluded.']);
    if (s > 0 && s < 4) return S(["vale: The buyer arrives soon. I do hope you're not the sort who lets a schedule slip."]);
    return S([s < 0 ? "vale: Ah — the new Hollis. Welcome home. A word of friendly advice: this town is finally ready to move forward. Best not to go digging in the mud." : 'vale: Busy, busy. Another time.']);
  },

  dev: (G) => {
    const s = q(G, 'sq_lamps');
    if (s === 1) return S([
      "dev: I saw them come on from my window. All five. I actually said 'whoa' out loud, alone, like a weirdo.",
      "dev: The supplier wouldn't deliver bulbs here. 'Not a serviceable address,' they said, about a whole TOWN. You just walked in and did it.",
      'dev: Here, for the bulbs. And listen — if you ever need a hand with a conscience and a multimeter…',
    ], () => { G.earn(90, 'Main Street lamps'); G.flag('lamps_fixed'); G.addRep(5); G.addXp('engineering', 30); G.trust('dev', 2); C.advance(G, 'sq_lamps'); G.syncWorld(); });
    const extra: Choice[] = hireChoice(G, 'dev');
    if (s < 0 && C.qDone(G, 'mq1')) extra.push({ t: "What's wrong with the street lamps?", go: () => { C.startQuest(G, 'sq_lamps'); return S(["dev: Five dead on Main, north to south. The wiring's fine — I've tested every pole. They just need bulbs, and I can't get any shipped.", 'dev: Nell stocks a few at Tidewater. Eight bucks each. I am, uh. Between invoices. If you swap them, I owe you one. A big one.']); } });
    return hub(G, 'dev', [G.S.crew.dev?.hired ? 'dev: Boss! I labelled the breaker panel at the shop. All of it. You are welcome.' : "dev: Patel Electric — if it sparks, I'm interested."], [
      { t: 'Why stay in a town this quiet?', lines: ["dev: My dad wired half these houses. I know which ones have the weird three-way switches because he thought they were funny.", "dev: Somebody's got to keep the lights on. Literally. It's on the van."] },
    ], extra);
  },

  ines: (G) => {
    const s = q(G, 'sq_mural');
    if (s === 1) return S([
      '(Ines stands in front of the wall for a long time, head tilted.)',
      "ines: You know what I love? You can see where you changed your mind. Right there. That's the honest part.",
      "ines: It says somebody lives here. That's all a mural has to say. Take this — and I mean it about the crew, if you're hiring.",
    ], () => { G.earn(120, 'garden mural'); G.addRep(5); G.addXp('painting', 40); G.trust('ines', 2); C.advance(G, 'sq_mural'); });
    const extra: Choice[] = hireChoice(G, 'ines');
    if (s < 0 && C.qDone(G, 'mq2')) extra.push({ t: 'That is a very grey wall.', req: ['painting', 2], go: () => { C.startQuest(G, 'sq_mural'); return S(["ines: It's the greyest wall in Maryland. I've primed it three times and lost my nerve three times.", "ines: You do it. Anything. Stripes, a sunset, a crab the size of a bus. Cover the whole thing, use every colour you own. I'll watch and pretend I'm supervising."]); } });
    return hub(G, 'ines', [G.S.crew.ines?.hired ? 'ines: I cut in the trim on the Finch place before breakfast. Purely for the joy of it.' : 'ines: Careful, wet paint. Somewhere. Probably.'], [
      { t: 'What brought you here?', lines: ['ines: Rent, at first. A whole cottage for the price of a parking space in Baltimore.', "ines: Then the light. Have you looked at the light here around six? It's ridiculous. It should be illegal."] },
    ], extra);
  },

  tom: (G) => {
    const s = q(G, 'sq_tom');
    if (s === 1) return S(["tom: Hm. You hit where it's weak instead of where it's loud. Most people never learn that.", "tom: Fine. You're alright. Here — salvage money."], () => { G.earn(80, 'crate salvage'); G.addXp('demolition', 30); G.trust('tom', 2); G.addRep(2); C.advance(G, 'sq_tom'); });
    const extra: Choice[] = hireChoice(G, 'tom');
    if (s < 0 && C.qDone(G, 'mq2')) extra.push({ t: 'I hear you take things apart.', go: () => { C.startQuest(G, 'sq_tom'); return S(['tom: I hear you put things together. We should not get along.', "tom: Those fish crates on the cannery wharf have been condemned since before you could shave. Show me you can swing, and we'll talk."]); } });
    if (q(G, 'mq7') === 0 && !G.S.flags['task:can_rubble']) {
      extra.push({ t: 'Clear the cannery rubble for me.', cost: 150, go: () => clearRubble(G, "tom: Hundred fifty. Stand back. Further. …Further than that.") });
      extra.push({ t: 'Sixty bucks and lunch at the Crab Pot. Rosa is doing the soft-shells.', req: ['negotiation', 2], cost: 60, go: () => { G.addXp('negotiation', 18); return clearRubble(G, 'tom: …With the remoulade? You fight dirty. Deal.'); } });
    }
    return hub(G, 'tom', [G.S.crew.tom?.hired ? "tom: Point me at it, boss." : 'tom: What.'], [
      { t: 'Did you work for Crown?', lines: ['tom: Drove piles on the marina. Nineteen years old.', "tom: I told the foreman the hammer was going in too easy. Like pushing a straw into pudding. He said, 'That's above your pay grade.'", 'tom: Been knocking things down ever since. Safer. Nobody lies to you about a thing you are destroying.'] },
    ], extra);
  },

  hattie: (G) => {
    const s = q(G, 'sq_tree');
    if (s === 2) return S([
      "hattie: IT HAS A RAILING. It has a SIGN. Aunt Mabel said you wouldn't put a railing because it wasn't in the drawing but I TOLD her you were a professional!",
      "hattie: Okay. Payment. This is my map of all the secret stuff in town. It's extremely accurate. I spent a whole placemat on it.",
    ], () => { G.give('map'); G.addXp('exploration', 30); G.addXp('carpentry', 15); G.addRep(4); G.trust('hattie', 3); C.advance(G, 'sq_tree'); });
    const extra: Choice[] = [];
    if (s < 0 && C.qDone(G, 'mq2')) extra.push({ t: 'Mabel said you have a commission for me?', go: () => { C.startQuest(G, 'sq_tree'); return S(["hattie: A CASTLE. In the oak. With a floor you can't fall through, that's very important, the last one had a floor you could fall through.", "hattie: I can't pay money because I'm nine. But I have something better than money. You'll see. It's a secret. It's a map."]); } });
    return hub(G, 'hattie', [G.S.flags.lit ? "hattie: The treehouse is ALSO a lighthouse now. I'm the keeper. You can be deputy keeper." : "hattie: Are you the one who fixes everything? Dad says you're the one who fixes everything."], [
      { t: "What's the best thing in town?", lines: ["hattie: Biscuit. He's the cat at the Crab Pot. He let me touch his ear ONCE.", "hattie: Second best is the pier at night, but I'm not allowed. Third best is you, probably. Don't tell Biscuit."] },
    ], extra);
  },
};

function mabelStory(G: Game, first: string): Script {
  return S([
    first,
    "mabel: Sit a moment. You ought to know what you've walked into.",
    'mabel: Fifteen years ago a company called Chesapeake Crown promised us a marina, a grand hotel, lofts in the old cannery. Your uncle was their builder.',
    "mabel: The first spring tide, the marina slid into the bay like a dropped plate. Then the hotel cracked. The paper said the builder cut corners — and Walt never said one word in his own defence.",
    'mabel: That silence. People filled it in themselves.',
    "mabel: I never believed it. A boy who measures his teacher's desk does not cut corners. Go and see Rosa at the Crab Pot — and tell her to stop putting Old Bay in the coleslaw.",
    'mabel: Oh, and my great-niece Hattie will have a commission for you. Heaven help you.',
  ], () => { C.advance(G, 'mq2'); C.startQuest(G, 'mq3'); });
}
function gusDebt(G: Game): Script {
  if (G.S.flags.gus_deal) return S(["gus: Yard's square with the bank, thanks to you. Your discount stands as long as I do."]);
  return S([
    "gus: It's nothing. …It's the note on the yard. I'm three payments behind, and the bank's board has Preston Vale on it. He'd love this corner lot in a sale.",
    "gus: Four hundred would square it. I'm not asking. I'm telling you why I look like this.",
  ], undefined, [
    { t: 'Here is the $400. Call it a deposit on lumber.', cost: 400, go: () => { G.flag('gus_deal'); G.trust('gus', 3); G.addRep(4); G.addXp('business', 30); C.advance(G, 'sq_gus'); return S(["gus: I— no. No, I'm not— (He takes it. His hand is shaking.)", 'gus: Fifteen percent off. Everything. Forever. And if you tell anyone I got misty I will deny it under oath.']); } },
    { t: "Rosa's deck is full every lunch. Let me set you up as her standing supplier.", req: ['negotiation', 2], go: () => { G.flag('gus_deal'); G.trust('gus', 2); G.trust('rosa', 1); G.addXp('negotiation', 30); G.addXp('business', 15); C.advance(G, 'sq_gus'); return S(['gus: A standing order. Monthly. …That covers the note with room to spare.', "gus: Walt could build anything but a deal. Where'd you get that from? Fifteen percent off, kid. For life."]); } },
    { t: "I can't right now, Gus.", go: () => S(['gus: Never asked you to. Forget I said it.']) },
  ]);
}
function clearRubble(G: Game, line: string): Script {
  return S([line], () => { G.ui.fade(1, () => { const t = G.task('can_rubble') as any; t.restore(1); G.S.flags['task:can_rubble'] = 1; G.openGate('cannery'); G.snd.sfx('smash'); G.sky.time += 1; G.ui.fade(0); G.toast('Big Tom cleared the cannery entrance.', 'good'); }); });
}
function openBoathouse(G: Game, msg: string) {
  const t = G.task('boathouse_boards');
  if (!t.done) { t.restore(1); G.S.flags['task:boathouse_boards'] = 1; G.snd.sfx('door'); G.toast(msg, 'good'); }
}

// ───────────────────────── the town meeting ─────────────────────────
function meeting(G: Game): Script {
  const after = (ending: string) => (g: Game) => {
    g.flag('ending', ending);
    for (const n of g.npcs) n.hold = null;
    if (ending !== 'deal') g.flag('vale_gone');
    applyHolds(g);
    C.startQuest(g, 'mq9');
    g.save(true);
  };
  const close = ['nell: The breach first. Then the light. Meet me there in the morning — and bring boards.'];
  const choices: Choice[] = [
    { t: 'Read the ledger aloud. All of it.', go: () => S([
      "you: 'Survey revised per V.C.' 'Notary fee, P. Vale — four thousand.' 'Insurance settlement — distributed.' And this is my uncle's stamp, on a page he never saw.",
      'gus: Fifteen years. FIFTEEN YEARS I told you people!',
      'mabel: Preston Vale. Look at me. …I taught you better than this.',
      'vale: I was twenty-six! Crane said it was a formality — he said engineers always exaggerate — (He stops. Nobody is listening to him any more.)',
      "silas: Sheriff's my nephew. He's on his way.",
      "nell: The sale is dead. But the fill is still there, and the breach gets wider every storm. We can't afford a marine contractor.",
      "rosa: We don't need one. We've got a Hollis.",
      ...close,
    ], (g) => { g.addRep(15); for (const id of ['gus', 'mabel', 'rosa', 'silas', 'nell']) g.S.trust[id] = Math.min(10, (g.S.trust[id] ?? 2) + 1); after('expose')(g); }) },
    { t: "Quietly, to Vale: 'Resign tonight. Fund the seawall. Or I read this aloud.'", req: ['negotiation', 3], go: () => S([
      '(You step close and show him exactly one page.)',
      'vale: …What do you want.',
      "you: Your resignation. The Crown escrow account — all of it — to the town. And a letter clearing Walt Hollis in Thursday's paper.",
      "vale: (Very quietly.) You're better at this than he was.",
      'vale: Friends — I, ah. For reasons of health, I am stepping down, effective tonight. And I am pleased to announce that a… private donor… will fund the full repair of the waterfront.',
      'nell: (Low.) You let him walk.',
      'you: I let the town get paid.',
      'nell: …I know. I just wanted to watch.',
      ...close,
    ], (g) => { g.earn(2500, 'Crown escrow, held in trust'); g.S.inv.lumber += 10; g.S.inv.concrete += 3; g.addRep(8); g.addXp('negotiation', 40); g.trust('nell', -1); after('deal')(g); }) },
  ];
  if (G.S.flags.sold_out) choices.push({ t: 'Say nothing. Keep the ledger closed.', go: () => S([
    '(You close the ledger.)',
    "nell: …You're not going to—",
    'nell: Then I will.',
    "(She takes Elias Thorn's field copy from her coat and reads it herself, voice shaking. It is enough. It was always going to be enough. It just should have been you.)",
    "vale: These are an old man's notes — this is —",
    'gus: Sit down, Preston.',
    ...close,
  ], (g) => { g.addRep(-12); g.trust('nell', -3); g.trust('gus', -2); g.trust('mabel', -2); after('silent')(g); }) });
  return S([
    "vale: —and so, friends, with Tidemark's generous offer, Harbor's End finally closes the book on a painful chapter—",
    'nell: Read them the book first, Preston.',
    '(The crowd turns. You are holding the ledger. It is heavier than it looks.)',
  ], undefined, choices);
}

// ───────────────────────── ambient barks ─────────────────────────
const BARKS: Record<string, string[]> = {
  gus: ['Measure twice.', "Smells like fresh pine. Good.", 'Walt would have liked this.', "Don't stack it wet."],
  mabel: ['The peonies are late this year.', 'Posture, dear.', "That's a Hollis, you know.", 'Lovely morning for it.'],
  rosa: ["Order up!", 'Who took my good spatula?', "Soft-shells are in.", 'Biscuit! Off the counter!'],
  silas: ['Wind is backing east.', 'Rockfish are running.', "Marguerite's riding low.", 'Hm.'],
  nell: ['Load path. Always the load path.', 'Level, plumb, square. In that order.', 'That breach is a foot wider.', 'Order came in.'],
  vale: ['Progress, friends!', 'So good to see you.', 'Tidemark sends its regards.', 'Lovely. Just lovely.'],
  dev: ['Is that… buzzing? That should not buzz.', 'Red to red. Usually.', 'Somebody labelled this wrong. It was me.', 'Lights on, Main Street!'],
  tom: ["That wall's coming down.", 'Pierogi Thursday.', 'Stand back.', 'Hm.'],
  ines: ['Look at that light.', 'Needs more yellow.', 'I should be painting this.', 'Wet edge, wet edge…'],
  hattie: ['Biscuit! Here, Biscuit!', "I'm a professional too.", 'Did you see the gulls?', "It's a CASTLE."],
};
export function bark(G: Game, id: string): string {
  const f = G.S.flags, w = G.sky.forceWeather ?? G.sky.weather;
  if (f.festival_day === G.sky.day) return ['Look at it turn!', "To Walt!", 'Best night in fifteen years.', "We've got a Hollis!", 'The light! The light is on!'][Math.floor(Math.random() * 5)];
  if (w === 'rain' && Math.random() < 0.4) return ["Proper rain, this.", 'Good for the garden.', 'Mind the breach in this.'][Math.floor(Math.random() * 3)];
  if (f.lit && Math.random() < 0.3) return 'You can see the light from my window now.';
  if (f['task:diner_deck'] && id !== 'rosa' && Math.random() < 0.15) return "Lunch on Rosa's new deck later?";
  const b = BARKS[id];
  return b[Math.floor(Math.random() * b.length)];
}
export function talk(G: Game, id: string): Script {
  const sc = TALK[id](G);
  if (!G.S.flags['met_' + id]) { G.flag('met_' + id); G.S.trust[id] = G.S.trust[id] ?? 2; }
  return sc;
}

// ───────────────────────── scripted beats ─────────────────────────
export function story(G: Game, id: string) {
  const p = G.player;
  switch (id) {
    case 'logbook':
      G.flag('got_logbook'); G.give('logbook'); G.addXp('exploration', 15);
      G.ui.note("WALT'S LOGBOOK", '"Mar. 3 — Thorn walked the line again. Says the whole waterfront is dredge fill on soft mud. Piles need to go twice as deep or not at all.\n\nMar. 9 — Told Crane. He laughed. Says the survey on file reads sound and I should build to the drawings.\n\nMar. 10 — It is not Thorn\'s survey on file.\n\nMar. 12 — I will not pour. They can use another builder. They cannot use my stamp.\n\nApr. 2 — They used my stamp."\n\nThe rest of the pages are blank.');
      break;
    case 'hatch':
      G.ui.fade(1, () => { openBoathouse(G, 'You slip under the dock, up through the floor, and kick the boards out from inside.'); p.teleport(-12, -45); G.addXp('exploration', 25); G.ui.fade(0); });
      break;
    case 'survey':
      G.flag('got_survey'); G.give('survey'); G.addXp('exploration', 15);
      G.ui.note('E. THORN — FIELD BOOK 14', 'Harbor\'s End waterfront, borings at 5 stations.\n\nSta. 1 — fill to 2 m\nSta. 2 — fill to 4 m\nSta. 3 — fill to 3 m\nSta. 4 — fill to 1 m\nSta. 5 — fill to 3 m\n\n"All piles to seat ONE METRE into firm clay below the fill. Nothing less. I have told Mr. Crane this in writing. — E.T."\n\nTucked in the back: a child\'s drawing of a lighthouse, signed NELL, AGE 7.');
      break;
    case 'deertrail': {
      const west = p.pos.x < -59.5;
      G.ui.fade(1, () => { p.teleport(west ? -56.5 : -62.6, west ? -14 : -14.2); if (!G.S.flags.logs_bypass) { G.flag('logs_bypass'); G.addXp('exploration', 20); G.toast('You shoulder through the laurel on an old deer trail.', 'good'); } G.ui.fade(0); });
      break;
    }
    case 'stones':
      G.openGate('stones'); G.flag('stones_open'); G.addXp('exploration', 20); G.snd.sfx('sparkle');
      G.toast('Old stepping stones, just under the surface. You can cross here now.', 'good');
      break;
    case 'safe':
      G.ui.prompt("CRANE'S SAFE", "A four-digit dial. Hanging crooked beside it: a framed photograph of the Founders' Anchor in the plaza, with a brass plate you can't quite read from here.", (code) => {
        if (code.trim() === '1911') { G.flag('got_ledger'); G.give('ledger'); G.snd.sfx('quest'); G.addXp('exploration', 20); G.ui.note('THE CROWN LEDGER', 'Inside: a sealed survey with Elias Thorn\'s true numbers — and a second, altered copy clipped behind it, marked "REVISED PER V.C."\n\nUnder both, a ledger in a neat accountant\'s hand:\n\n"Notary fee, P. Vale ............ $4,000"\n"Builder\'s stamp (W.H.) — obtained"\n"Insurance settlement — distributed"\n\nFifteen years of silence, in three columns.'); }
        else { G.snd.sfx('error'); G.toast("The handle doesn't budge. That plaque in the photo must mean something…", 'warn'); }
      });
      break;
    case 'light': finale(G); break;
  }
}

export function intro(G: Game) {
  G.gfx.grade.uniforms.fade.value = 1;
  G.sky.time = 6.1; G.sky.weather = 'clear';
  applyHolds(G);
  G.ui.fade(0);
  G.playCine([
    { from: [-10, 9, -78], to: [8, 7, -70], lookFrom: [0, 2, -45], lookTo: [14, 3, -46], dur: 8, text: "Harbor's End, Maryland. Once the busiest little waterfront on the Chesapeake." },
    { from: [-52, 16, -28], to: [-40, 13, -26], lookFrom: [-34, 5, -47], dur: 7.5, text: 'Then came Chesapeake Crown — a marina, a grand hotel, luxury lofts. Three projects. Three failures. One winter.' },
    { from: [40, 22, 0], to: [20, 18, 4], lookFrom: [22, 0, -16], lookTo: [4, 0, -10], dur: 8, text: 'The town blamed the builder. Walt Hollis never said a word in his own defence. He just kept opening his shop every morning, for fifteen years.' },
    { from: [-6, 12, 34], to: [-14, 9.5, 28], lookFrom: [-18, 1.5, 9], dur: 8.5, text: 'This spring he left that shop to you — along with a truck that barely runs, and a town that stopped believing in builders.' },
  ], () => { G.sky.time = 7.2; C.startQuest(G, 'mq1'); G.ui.dialogue(talk(G, 'gus')); });
}

function finale(G: Game) {
  const f = G.S.flags;
  G.ui.fade(1, () => {
    G.flag('lit'); G.flag('festival'); G.flag('festival_day', G.sky.day + (G.sky.time > 19.5 ? 0 : 0));
    G.sky.time = 20.6; G.sky.forceWeather = 'clear'; G.sky.weather = 'clear';
    G.syncWorld();
    applyHolds(G);
    G.player.teleport(2, -38.2);
    const boards = Math.max(40, Math.round(G.S.stats.earned / 20));
    const ending = f.ending === 'expose' ? "Preston Vale's trial was short. The Tidemark offer was withdrawn the next morning, and nobody in town could find it in themselves to mind." : f.ending === 'deal' ? "Preston Vale left for Florida on a Tuesday. The Crown escrow paid for the seawall, the boardwalk, and a new roof for the school. The letter clearing Walt ran on page one." : 'The truth came out anyway. It usually does. You were standing right there when it did — holding the proof, saying nothing. Some people in town remember that.';
    const people: string[] = [];
    const tr = (id: string) => G.S.trust[id] ?? 2;
    if (tr('mabel') >= 4) people.push('Mabel Okafor sat on her new porch with the door open, so the light could come in.');
    if (tr('gus') >= 4) people.push(f.gus_deal ? "Gus Brannigan hung a new sign at the yard: SUPPLIER TO HOLLIS & CO. He insists it was the sign-painter's idea." : 'Gus Brannigan stood at the end of the pier with his cap in his hand until the beam came around twice.');
    if (f['task:boat_paint']) people.push('Captain Reed took the Marguerite out past the point and came home by the light, the way he used to.');
    if (C.qDone(G, 'sq_tree')) people.push('Hattie Finch has declared the treehouse a lighthouse too. There are plans. In crayon.');
    people.push(tr('nell') >= 4 ? "Nell Thorn framed her father's survey and hung it in the shop window, where the whole town can read it." : 'Nell Thorn watched the lamp come on from the breach. She did not look at you. But she stayed.');
    G.snd.sfx('horn');
    G.ui.fade(0);
    G.playCine([
      { from: [40, 16, -30], to: [48, 15, -34], lookFrom: [58, 11, -51], dur: 7, text: "The lamp at Harbor's End had been dark for fifteen years.", on: () => C.firework(G) },
      { from: [-24, 8, -22], to: [20, 8, -22], lookFrom: [-10, 1.5, -38], lookTo: [22, 1.5, -38], dur: 10, text: `It took one summer, about ${boards} boards, and everyone you see here to light it again.` },
      { from: [0, 20, -10], to: [0, 14, -24], lookFrom: [0, 4, -60], dur: 9, text: ending },
      { from: [20, 7, 26], to: [8, 7, 26], lookFrom: [11, 2, 9], dur: 8, text: people[0] ?? '' },
      { from: [-12, 7, -28], to: [8, 6, -30], lookFrom: [2, 2, -52], dur: 8, text: people.slice(1, 3).join(' ') },
      { from: [30, 6, -24], to: [14, 6, -26], lookFrom: [12, 2, -15], dur: 8, text: people.slice(3).join(' ') },
      { from: [-8, 11, 30], to: [-14, 8, 26], lookFrom: [-18, 2, 9], dur: 9, text: "Walt Hollis's logbook has one more entry now. It is in your handwriting: \"Built right, or not at all.\"" },
      { from: [-30, 26, 10], to: [-10, 34, 20], lookFrom: [10, 0, -40], dur: 9, text: '' , on: (g) => g.ui.titleCard('CONTRACTOR LEGENDS', "Chapter One — Harbor's End", 'Thank you for building.') },
    ], () => {
      G.ui.titleCard('', '', '');
      G.flag('postgame'); G.sky.forceWeather = null;
      G.earn(1000, "the town's thanks"); G.addRep(20);
      for (const s of ['carpentry', 'painting', 'engineering', 'business'] as Skill[]) G.addXp(s, 40);
      if (!f['restored_hotel']) { for (const t of ['hotel_truss', 'hotel_shore', 'hotel_paint']) { const tk = G.task(t); if (f.vale_deal === 'cosmetic' && t === 'hotel_paint') tk.reset(); } C.startQuest(G, 'sq_hotel'); }
      G.ui.report("HARBOR'S END IS YOURS TO KEEP BUILDING", ['The story is complete — and the town is still here.', '', '• The festival runs all night. Walk the boardwalk.', '• New contracts arrive on the Company Board every morning.', '• Buy and renovate the houses on Gull Row.', '• The town has deeded you the Marlowe Hotel. Restore her.', '• Grow Hollis & Co. into a Master Builder.']);
      G.save(true);
    });
  });
}

// ───────────────────────── staging: who stands where for story scenes ─────────────────────────
export function applyHolds(G: Game) {
  const f = G.S.flags, npc = (id: string) => G.npcs.find((n) => n.def.id === id)!;
  const P = G.places;
  for (const n of G.npcs) n.hold = null;
  if (C.qStep(G, 'mq1') >= -1 && !C.qDone(G, 'mq1')) npc('gus').hold = { x: P.hq_door.x, z: P.hq_door.z, dir: 0 };
  if (C.qActive(G, 'mq8') && !f.ending) {
    const spots: Record<string, number[]> = { vale: [34, -9.8], nell: [31, -7.6], gus: [36.5, -7.4], mabel: [33, -6.8], rosa: [38, -7.9], silas: [29.4, -6.6], dev: [35.2, -6.2], tom: [39.6, -6.6], ines: [31.6, -5.8], hattie: [37.4, -5.9] };
    for (const id in spots) npc(id).hold = { x: spots[id][0], z: spots[id][1], dir: id === 'vale' ? 0 : 3 };
  }
  if (f.festival_day === G.sky.day) {
    const ids = ['gus', 'mabel', 'rosa', 'silas', 'nell', 'dev', 'tom', 'ines', 'hattie'];
    ids.forEach((id, i) => { const pl = P['fest' + (i + 1)]; npc(id).hold = { x: pl.x, z: pl.z, dir: 3 }; });
  }
  if (f.vale_gone) { const v = npc('vale'); v.hold = { x: 300, z: 300 }; v.pos.set(300, 0, 300); }
  C.applyLamps(G);
}

let meetT = 0, helpT = 0;
export function tick(G: Game) {
  const f = G.S.flags, p = G.player.pos;
  // the meeting begins when you walk up
  if (C.qActive(G, 'mq8') && !f.ending && !G.ui.blocking && Math.hypot(p.x - 34, p.z + 7) < 6.5) { meetT += 0.4; if (meetT > 0.8) { meetT = 0; G.ui.dialogue(meeting(G)); } }
  // the people you helped turn up to help with the seawall
  if (C.qStep(G, 'mq9') === 1) {
    const helpers = G.npcs.filter((n) => n.def.id !== 'vale' && (G.S.trust[n.def.id] ?? 2) >= 4 && n.def.id !== 'hattie');
    helpers.forEach((n, i) => { if (!n.hold) n.hold = { x: -25 + i * 1.7, z: -34.6 + (i % 2) * 0.8, dir: 3, anim: 'work' }; });
    if (!f.helpers_seen && helpers.length && Math.hypot(p.x + 20, p.z + 35) < 9) { G.flag('helpers_seen'); G.ui.dialogue(S([`(${helpers.length === 1 ? 'Someone is' : helpers.length + ' people are'} already at the breach when you arrive, sleeves rolled.)`, helpers.some((h) => h.def.id === 'gus') ? "gus: Don't just stand there. You're the one who knows what you're doing." : "nell: Don't just stand there. You're the Hollis.", '(Set the first pile. They will follow your lead.)'])); }
    helpT += 0.4;
    const t = G.task('seawall_build') as any;
    if (helpT > 5 && t.active && t.pieces.some((x: any) => x.state > 0) && helpers.length) { helpT = 0; const save = G.S.inv.lumber; G.S.inv.lumber = Math.max(1, save); const pos = t.auto(); G.S.inv.lumber = save; if (pos) G.fx.burst(pos, 6, { colors: ['#e8cf9a', '#fff6cf'], speed: 1.4, up: 1.2, life: 0.5, size: 0.07 }); }
  } else if (C.qStep(G, 'mq9') === 2 && !f.helpers_freed) { G.flag('helpers_freed'); applyHolds(G); G.flag('can_light', 0); }
  if (C.qStep(G, 'mq9') === 3 && !f.can_light) G.flag('can_light');
}
