// Harbor's End: its people, the quest line, and the business layer.
import * as THREE from 'three';
import type { Game, Skill } from './game';
import type { NpcDef } from './npc';
import { Task, BuildTask, DemoTask, PaintTask } from './work';
import * as PX from '../art/pixel';
import * as D from './dialogue';

export { talk, bark, story, intro } from './dialogue';

// ───────────────────────── people ─────────────────────────
export const NPCS: NpcDef[] = [
  { id: 'gus', name: 'Gus Brannigan', role: 'Lumberyard owner', home: 'lumber_office',
    spec: { skin: '#e0a984', hair: '#9a9488', hairStyle: 'short', hat: 'cap', hatColor: '#3f6b55', shirt: '#b5463c', style: 'flannel', pants: '#4a4f66', beard: '#b9b3a6' },
    sched: [{ h: 0, at: 'lumber_office', in: true }, { h: 6.3, at: 'lumber_office' }, { h: 9, at: 'lumber_yard', act: 'work' }, { h: 12, at: 'diner_door' }, { h: 13, at: 'lumber_yard', act: 'work' }, { h: 17.5, at: 'lumber_office' }, { h: 19, at: 'pier_mid' }, { h: 20.8, at: 'lumber_office', in: true }] },
  { id: 'mabel', name: 'Mabel Okafor', role: 'Retired schoolteacher', home: 'mabel_in',
    spec: { skin: '#8a5a3c', hair: '#d9d5c8', hairStyle: 'bun', shirt: '#6d4a6e', style: 'dress', accent: '#e9d8a6', pants: '#6d4a6e', glasses: true, shoes: '#3a2a2a' },
    sched: [{ h: 0, at: 'mabel_in', in: true }, { h: 7, at: 'mabel_garden', act: 'work' }, { h: 10, at: 'mabel_porch' }, { h: 12.5, at: 'plaza' }, { h: 14, at: 'gazebo' }, { h: 16.5, at: 'mabel_porch' }, { h: 20, at: 'mabel_in', in: true }] },
  { id: 'rosa', name: 'Rosa Delgado', role: 'Owner of the Crab Pot', home: 'diner_counter',
    spec: { skin: '#c98e68', hair: '#2a2230', hairStyle: 'pony', shirt: '#3f8f8c', style: 'apron', accent: '#f4efe2', pants: '#3a3b4a' },
    sched: [{ h: 0, at: 'diner_counter' }, { h: 9.5, at: 'diner_door' }, { h: 11, at: 'diner_counter' }, { h: 15, at: 'diner_door' }, { h: 16.2, at: 'diner_counter' }] },
  { id: 'silas', name: 'Capt. Silas Reed', role: 'Waterman', home: 'boat',
    spec: { skin: '#d9a07a', hair: '#e6e2d6', hairStyle: 'short', hat: 'captain', hatColor: '#27395c', shirt: '#27395c', style: 'suit', accent: '#e2c15a', pants: '#4a4f66', beard: '#e6e2d6' },
    sched: [{ h: 0, at: 'boat', in: true }, { h: 5.5, at: 'pier_end', act: 'work' }, { h: 11, at: 'diner_door' }, { h: 12.5, at: 'pier_mid' }, { h: 15, at: 'boat', act: 'work' }, { h: 18, at: 'pier_end' }, { h: 21, at: 'boat', in: true }] },
  { id: 'nell', name: 'Nell Thorn', role: 'Tidewater Supply · engineer', home: 'tidewater_door',
    spec: { skin: '#f0c4a0', hair: '#b5532f', hairStyle: 'bun', shirt: '#e9e2cf', style: 'overalls', accent: '#e2c15a', pants: '#3f6b6a', glasses: true },
    sched: [{ h: 0, at: 'tidewater_door', in: true }, { h: 7.3, at: 'tidewater_door' }, { h: 12, at: 'plaza' }, { h: 13, at: 'tidewater_door' }, { h: 17.5, at: 'lighthouse' }, { h: 19.3, at: 'breach' }, { h: 20.6, at: 'tidewater_door', in: true }] },
  { id: 'vale', name: 'Preston Vale', role: 'Town councilman', home: 'townhall_steps',
    spec: { skin: '#edc3a2', hair: '#3a3038', hairStyle: 'short', shirt: '#3a3f58', style: 'suit', accent: '#9a3d46', pants: '#2e3248', shoes: '#1d1a2b' },
    sched: [{ h: 0, at: 'townhall_steps', in: true }, { h: 8.5, at: 'townhall_steps' }, { h: 11, at: 'hotel_front' }, { h: 12.5, at: 'diner_door' }, { h: 13.5, at: 'townhall_side' }, { h: 17, at: 'model_front' }, { h: 18.5, at: 'townhall_steps', in: true }] },
  { id: 'dev', name: 'Dev Patel', role: 'Electrician', home: 'patel_door',
    spec: { skin: '#b07a52', hair: '#1f1a24', hairStyle: 'short', hat: 'hardhat', hatColor: '#f0d264', shirt: '#4f7fa8', style: 'vest', accent: '#e9a23a', pants: '#3a3b4a' },
    sched: [{ h: 0, at: 'patel_door', in: true }, { h: 7, at: 'patel_door', act: 'work' }, { h: 10, at: 'lamp_main', act: 'work' }, { h: 12, at: 'diner_door' }, { h: 13, at: 'plaza', act: 'work' }, { h: 16, at: 'patel_door' }, { h: 20, at: 'patel_door', in: true }] },
  { id: 'tom', name: 'Big Tom Kowalski', role: 'Demolition man', home: 'gull_east',
    spec: { skin: '#e0a984', hair: '#5d4a3a', hairStyle: 'bald', shirt: '#56607a', style: 'tee', pants: '#4b4436', beard: '#5d4a3a', shoes: '#2e2a2a' },
    sched: [{ h: 0, at: 'gull_east', in: true }, { h: 7, at: 'cannery_front' }, { h: 12, at: 'diner_door' }, { h: 13, at: 'breach_side', act: 'work' }, { h: 17, at: 'pier_mid' }, { h: 20, at: 'gull_east', in: true }] },
  { id: 'ines', name: 'Ines Carvalho', role: 'Painter & muralist', home: 'ines_door',
    spec: { skin: '#c98e68', hair: '#3a2230', hairStyle: 'long', hat: 'beanie', hatColor: '#cf847f', shirt: '#ecd27e', style: 'tee', pants: '#3f8f8c', accent: '#cf847f' },
    sched: [{ h: 0, at: 'ines_door', in: true }, { h: 8, at: 'mural', act: 'work' }, { h: 12, at: 'diner_door' }, { h: 13.5, at: 'mural', act: 'work' }, { h: 17, at: 'park' }, { h: 19, at: 'ines_door', in: true }] },
  { id: 'hattie', name: 'Hattie Finch', role: 'Age nine and three-quarters', home: 'finch_door',
    spec: { skin: '#f0c4a0', hair: '#d9a441', hairStyle: 'pony', shirt: '#cf5a5a', style: 'tee', pants: '#4a6a94', accent: '#8cc9b4', kid: true },
    sched: [{ h: 0, at: 'finch_door', in: true }, { h: 8, at: 'oak' }, { h: 11, at: 'park' }, { h: 13, at: 'oak' }, { h: 15.5, at: 'pier_mid' }, { h: 17, at: 'mabel_porch' }, { h: 19, at: 'finch_door', in: true }] },
];
export const npcName = (id: string) => NPCS.find((n) => n.id === id)?.name.replace('Capt. ', '').split(' ')[0] ?? id;
export const npcDef = (id: string) => NPCS.find((n) => n.id === id)!;

// ───────────────────────── skills ─────────────────────────
export const SKILL_INFO: Record<Skill, { name: string; icon: string; desc: string; perks: string[] }> = {
  carpentry: { name: 'Carpentry', icon: 'hammer', desc: 'Framing, decking, cutting to the line.', perks: ['Nail Gun certified — buy one at Tidewater and sink nails in one shot.', 'Heavy swing — hammer nails in two hits. Circular Saw unlocked.', 'Framing crew lead — bigger build contracts on the company board.', "Master's eye — much wider tolerance on every saw cut."] },
  painting: { name: 'Painting', icon: 'roller', desc: 'Prep, wash, cut in, roll out.', perks: ['Loaded roller — noticeably wider strokes.', 'Airless Sprayer unlocked at Tidewater.', 'No waste — every gallon covers 40% more.', 'Signature finish — clients tip 25% on paint work.'] },
  engineering: { name: 'Engineering', icon: 'doc', desc: 'Loads, soils, and heavy iron.', perks: ['Heavy equipment — operate the skid steer.', 'Structural insight — propose real fixes in conversation.', 'Draft assist — the drafting board shows stress hints.', 'Stamped & sealed — premium engineering contracts.'] },
  demolition: { name: 'Demolition', icon: 'sledge', desc: 'Taking things apart on purpose.', perks: ['Heavy Sledge unlocked at Tidewater.', 'Salvager — recover lumber from what you tear down.', 'Wrecking form — every swing hits harder.', 'Surgical — demolition contracts pay 25% more.'] },
  business: { name: 'Business', icon: 'coin', desc: 'Payroll, accounts, growth.', perks: ['Payroll — hire your first crew member.', 'Bulk accounts — 15% off materials. Buy property.', 'Room to grow — run a three-person crew.', 'A name people trust — crew jobs earn 30% more.'] },
  negotiation: { name: 'Negotiation', icon: 'heart', desc: 'Reading people. Fair deals.', perks: ['Haggle — push a contract price up before signing.', 'Silver tongue — new options in tense conversations.', 'Preferred customer — 20% off tools.', 'Closer — your haggling never backfires.'] },
  exploration: { name: 'Exploration', icon: 'star', desc: 'Knowing every corner of town.', perks: ['Trailwise — spot hidden paths and loose boards. Sprint longer.', 'Scavenger — find hidden caches of materials.', 'Mapmaker — every landmark shown on the map.', 'Local legend — the town tells stories about you.'] },
};

export const ITEMS: Record<string, { name: string; icon: string; desc: string }> = {
  key: { name: 'Boathouse Key', icon: 'key', desc: "Silas kept it on his own ring for fifteen years." },
  logbook: { name: "Walt's Logbook", icon: 'doc', desc: '"Thorn says the fill won\'t hold. Crane says pour anyway. I won\'t put my stamp on it." — W.H.' },
  survey: { name: 'Thorn Survey (field copy)', icon: 'doc', desc: 'Fill depths along the waterfront: Sta.1 — 2 m · Sta.2 — 4 m · Sta.3 — 3 m · Sta.4 — 1 m · Sta.5 — 3 m. "Piles must seat 1 m into firm clay."' },
  ledger: { name: 'Crown Ledger & Sealed Survey', icon: 'doc', desc: "Proof: Crane and Vale buried the survey, forged Walt's stamp and collected the insurance." },
  map: { name: "Hattie's Treasure Map", icon: 'star', desc: 'Crayon on a paper placemat. Surprisingly accurate.' },
  tape: { name: "Walt's Tape Measure", icon: 'hammer', desc: 'Worn smooth. "Measure twice" is scratched into the case.' },
  pie: { name: "Mabel's Peach Pie", icon: 'heart', desc: 'Still warm. Worth more than the invoice.' },
};

// ───────────────────────── shops ─────────────────────────
export interface ShopItem { id: string; name: string; icon: string; price: number; desc: string; kind: 'mat' | 'tool'; req?: [Skill, number]; qty?: number }
export const SHOP: Record<string, ShopItem[]> = {
  lumber: [
    { id: 'lumber', name: 'Lumber (board)', icon: 'lumber', price: 6, desc: 'Framing-grade pine. One board per piece you build.', kind: 'mat', qty: 1 },
    { id: 'lumber5', name: 'Lumber (bundle of 6)', icon: 'lumber', price: 32, desc: 'A strapped bundle. Loads onto the truck.', kind: 'mat', qty: 6 },
    { id: 'nails', name: 'Box of nails (30)', icon: 'nails', price: 5, desc: 'Galvanised. The coast eats anything else.', kind: 'mat', qty: 30 },
    { id: 'paint', name: 'Paint (1 gallon)', icon: 'paint', price: 22, desc: 'Tintable exterior. Pick the colour when you roll it.', kind: 'mat', qty: 1 },
    { id: 'concrete', name: 'Concrete (bag)', icon: 'concrete', price: 15, desc: 'For piles and footings.', kind: 'mat', qty: 1 },
  ],
  tools: [
    { id: 'roller', name: '18-inch Roller', icon: 'roller', price: 75, desc: 'Half again as wide as Walt\'s old roller. Walls go fast.', kind: 'tool' },
    { id: 'washer', name: 'Pressure Washer', icon: 'washer', price: 180, desc: "Strips grime so paint will actually stick.", kind: 'tool' },
    { id: 'nailgun', name: 'Nail Gun', icon: 'nailgun', price: 220, desc: 'One trigger pull per nail. Hold to rapid-fire.', kind: 'tool', req: ['carpentry', 2] },
    { id: 'heavySledge', name: 'Heavy Sledge', icon: 'sledge', price: 150, desc: 'Twice the hit. Twice the satisfaction.', kind: 'tool', req: ['demolition', 2] },
    { id: 'circsaw', name: 'Circular Saw', icon: 'circsaw', price: 260, desc: 'Fast, forgiving cuts at the bench and in the woods.', kind: 'tool', req: ['carpentry', 3] },
    { id: 'sprayer', name: 'Airless Sprayer', icon: 'sprayer', price: 420, desc: 'Lays down paint in great soft clouds.', kind: 'tool', req: ['painting', 3] },
    { id: 'skid', name: 'Skid Steer (used)', icon: 'skid', price: 1400, desc: 'Shoves rubble like it is nothing. Delivered to the lumberyard.', kind: 'tool', req: ['engineering', 2] },
    { id: 'tuneup', name: 'Truck Tune-up', icon: 'truck', price: 350, desc: "New plugs, new belts. Walt's truck gets its legs back.", kind: 'tool' },
    { id: 'bulbs', name: 'Street-lamp bulb', icon: 'bulb', price: 8, desc: 'For the dark lamps on Main Street.', kind: 'mat', qty: 1 },
  ],
};
export function priceOf(G: Game, it: ShopItem) {
  let p = it.price;
  if (it.kind === 'mat' && it.id !== 'bulbs') { if (G.skillLv('business') >= 3) p *= 0.85; if (G.S.flags.gus_deal) p *= 0.85; }
  if (it.kind === 'tool' && G.skillLv('negotiation') >= 4) p *= 0.8;
  return Math.max(1, Math.round(p));
}
export function buy(G: Game, it: ShopItem): boolean {
  const S = G.S;
  if (it.req && G.skillLv(it.req[0]) < it.req[1]) { G.toast(`Requires ${SKILL_INFO[it.req[0]].name} Lv ${it.req[1]}.`, 'warn'); return false; }
  if (it.kind === 'tool' && S.tools[it.id]) { G.toast('You already own that.', 'warn'); return false; }
  if (!G.spend(priceOf(G, it))) return false;
  G.snd.sfx('coin');
  if (it.kind === 'tool') {
    S.tools[it.id] = true;
    
    if (it.id === 'tuneup') G.truck.maxSpeed = 16.5;
    if (it.id === 'skid') { G.skid.group.visible = true; G.toast('The skid steer is waiting in the lumberyard.', 'good'); }
    G.player.refreshLook();
  } else {
    const k = it.id === 'lumber5' ? 'lumber' : it.id;
    (S.inv as any)[k] += it.qty ?? 1;
    G.truck.refresh();
  }
  G.ui.refreshHotbar();
  return true;
}

// ───────────────────────── quests ─────────────────────────
export interface StepDef { text: string | ((G: Game) => string); at?: string; tasks?: string[]; until?: (G: Game) => any }
export interface QuestDef { id: string; title: string; main?: boolean; desc: string; steps: StepDef[] }
const F = (G: Game, k: string) => G.S.flags[k];
const T = (...ids: string[]) => (G: Game) => ids.every((i) => F(G, 'task:' + i));

export const QUESTS: QuestDef[] = [
  { id: 'mq1', main: true, title: 'A Roof Over Your Head', desc: "Uncle Walt's shop is yours now — such as it is.", steps: [
    { text: 'Talk to Gus Brannigan outside the shop', at: 'hq_door' },
    { text: 'Equip the hammer [2] — set the boards, then drive the glowing nails', tasks: ['hq_rack'], until: T('hq_rack') },
    { text: 'Equip the roller [3], choose a colour [C], then hold the mouse and roll paint onto the shop front', tasks: ['hq_paint'], until: T('hq_paint') },
    { text: 'Show Gus your work', at: 'hq_door' } ] },
  { id: 'mq2', main: true, title: 'First Client', desc: "Mabel Okafor's porch on Bay Road has been waiting fifteen years for a carpenter.", steps: [
    { text: 'Visit Mabel Okafor at the yellow house on Bay Road', at: 'mabel_porch' },
    { text: 'Tear out the rotten railing with the sledgehammer [4]', tasks: ['mabel_demo'], until: T('mabel_demo') },
    { text: (G) => `Build the new railing & steps — 9 boards (you have ${G.S.inv.lumber}). Lumber is sold at Brannigan's; bring the truck`, tasks: ['mabel_build'], until: T('mabel_build') },
    { text: 'Stain the porch deck (paint is sold at Brannigan\'s)', tasks: ['mabel_paint'], until: T('mabel_paint') },
    { text: 'Talk to Mabel', at: 'mabel_porch' } ] },
  { id: 'mq3', main: true, title: 'The Crab Pot', desc: "Rosa Delgado wants her diner to look alive again.", steps: [
    { text: 'Meet Rosa Delgado at the Crab Pot on the wharf', at: 'diner_door' },
    { text: 'Equip the saw [5] and cut 4 deck boards at the sawhorses beside your shop', tasks: ['hq_saw'], until: T('hq_saw') },
    { text: 'Frame and deck the seating area beside the diner', tasks: ['diner_deck'], until: T('diner_deck') },
    { text: 'Pressure-wash [6] the diner front, then paint it Crab Shack Red', tasks: ['diner_paint'], until: T('diner_paint') },
    { text: 'Talk to Rosa', at: 'diner_door' } ] },
  { id: 'mq4', main: true, title: 'What the Tide Left', desc: "Walt kept a logbook. It never left his boathouse.", steps: [
    { text: 'Find Captain Silas Reed on the town pier', at: 'pier_mid' },
    { text: "Get into Walt's boathouse — break the boards, or find another way", tasks: ['boathouse_boards'], at: 'boathouse_door', until: (G) => F(G, 'task:boathouse_boards') },
    { text: "Find Walt's logbook inside the boathouse", at: 'boathouse_door', until: (G) => F(G, 'got_logbook') },
    { text: 'Show the logbook to Nell Thorn at Tidewater Supply', at: 'tidewater_door' } ] },
  { id: 'mq5', main: true, title: "The Surveyor's Daughter", desc: "Elias Thorn's field copy of the survey should still be in his cabin in the western woods.", steps: [
    { text: 'Follow the forest trail west and get past the fallen trees (saw [5])', tasks: ['trail_logs'], at: 'logs', until: (G) => F(G, 'task:trail_logs') || F(G, 'logs_bypass') },
    { text: 'Cross the creek — rebuild the footbridge on the drafting board', tasks: ['bridge_truss'], at: 'bridge', until: (G) => F(G, 'task:bridge_truss') || G.player.pos.x < -74 },
    { text: "Search Elias Thorn's cabin", at: 'cabin_door', until: (G) => F(G, 'got_survey') },
    { text: 'Bring the survey to Nell', at: 'tidewater_door' } ] },
  { id: 'mq6', main: true, title: "Vale's Offer", desc: 'Councilman Vale has a job for you at the condemned Marlowe Hotel.', steps: [
    { text: 'Meet Councilman Vale (Town Hall by day, the Marlowe around noon)', at: 'townhall_steps' },
    { text: 'Design real bracing for the Marlowe on the drafting board', tasks: ['hotel_truss'], until: (G) => F(G, 'vale_deal') !== 'right' || F(G, 'task:hotel_truss') },
    { text: 'Shore up the foundation — 6 timbers', tasks: ['hotel_shore'], until: (G) => F(G, 'vale_deal') !== 'right' || F(G, 'task:hotel_shore') },
    { text: (G) => (F(G, 'vale_deal') === 'cosmetic' ? 'Paint over the cracks on the Marlowe facade' : 'Finish with a fresh coat on the Marlowe facade'), tasks: ['hotel_paint'], until: (G) => F(G, 'vale_deal') === 'refuse' || F(G, 'task:hotel_paint') },
    { text: (G) => (F(G, 'vale_deal') === 'refuse' ? 'Tell Nell what Vale asked you to do' : 'Report back to Vale'), at: 'townhall_steps' } ] },
  { id: 'mq7', main: true, title: 'The Cannery', desc: "The original survey and Crown's books were last seen in the cannery office.", steps: [
    { text: 'Clear the rubble blocking the cannery — sledge, skid steer, or ask Big Tom', tasks: ['can_rubble'], at: 'cannery_front', until: T('can_rubble') },
    { text: 'Search the cannery office. Something about that back wall…', tasks: ['can_wall'], at: 'cannery_in', until: T('can_wall') },
    { text: 'Open the safe', at: 'cannery_in', until: (G) => F(G, 'got_ledger') },
    { text: 'Bring the ledger to Nell', at: 'tidewater_door' } ] },
  { id: 'mq8', main: true, title: 'Town Meeting', desc: 'Fifteen years of silence end tonight on the Town Hall steps.', steps: [
    { text: 'Go to the Town Hall steps — the town is gathering', at: 'townhall_steps', until: (G) => F(G, 'ending') } ] },
  { id: 'mq9', main: true, title: 'Hold Back the Tide', desc: 'Build it right. Then light the lamp.', steps: [
    { text: "Lay out the piles at the breach using Thorn's survey", tasks: ['seawall_piles'], at: 'breach', until: T('seawall_piles') },
    { text: (G) => `Rebuild the seawall — you need 3 boards and 1 bag of concrete (have ${G.S.inv.lumber} / ${G.S.inv.concrete})`, tasks: ['seawall_build'], at: 'breach', until: T('seawall_build') },
    { text: 'Repaint the lighthouse in Lighthouse White', tasks: ['lighthouse_paint'], at: 'lighthouse', until: T('lighthouse_paint') },
    { text: 'Climb the lighthouse and relight the lamp', at: 'lighthouse', until: (G) => F(G, 'lit') } ] },
  // side quests
  { id: 'sq_tree', title: 'A Castle in the Oak', desc: 'Hattie Finch has blueprints. In crayon.', steps: [
    { text: "Build Hattie's treehouse in the big oak — 8 boards", tasks: ['treehouse'], until: T('treehouse') },
    { text: 'Paint the treehouse sign any colour you like', tasks: ['treehouse_paint'], until: T('treehouse_paint') },
    { text: 'Tell Hattie it is ready', at: 'oak' } ] },
  { id: 'sq_boat', title: 'The Marguerite', desc: "Silas's boat hasn't seen paint since his wife passed.", steps: [
    { text: 'From the pier, pressure-wash the hull of the Marguerite, then paint it', tasks: ['boat_paint'], at: 'boat', until: T('boat_paint') },
    { text: 'Talk to Captain Silas', at: 'pier_mid' } ] },
  { id: 'sq_lamps', title: 'Lights on Main', desc: 'Five street lamps on Main Street have been dark for years.', steps: [
    { text: (G) => `Replace the bulbs in the dark lamps on Main Street (${lampsFixed(G)}/5) — bulbs are sold at Tidewater`, until: (G) => lampsFixed(G) >= 5 },
    { text: 'Tell Dev Patel', at: 'patel_door' } ] },
  { id: 'sq_mural', title: 'Colour for the Garden', desc: 'Ines wants the grey garden wall to say something.', steps: [
    { text: 'Paint a mural on the garden wall — any colours, cover the whole wall ([C] changes colour)', tasks: ['mural'], at: 'mural', until: T('mural') },
    { text: 'Show Ines', at: 'mural' } ] },
  { id: 'sq_tom', title: 'Condemned', desc: "Big Tom doesn't hire on with anyone who can't swing.", steps: [
    { text: 'Smash the condemned fish crates on the cannery wharf', tasks: ['tom_crates'], at: 'cannery_front', until: T('tom_crates') },
    { text: 'Talk to Big Tom' } ] },
  { id: 'sq_gus', title: "Brannigan's Ledger", desc: "Gus is three payments behind — to a bank Vale sits on the board of.", steps: [{ text: 'Decide how to help Gus (talk to him)' }] },
  { id: 'sq_hotel', title: 'Queen of the Point', desc: 'The town has deeded the Marlowe to your company. Bring her back.', steps: [
    { text: 'Design the bracing for the Marlowe', tasks: ['hotel_truss'], until: T('hotel_truss') },
    { text: 'Shore up the foundation', tasks: ['hotel_shore'], until: T('hotel_shore') },
    { text: 'Paint the Marlowe', tasks: ['hotel_paint'], until: T('hotel_paint') } ] },
];
export const quest = (id: string) => QUESTS.find((q) => q.id === id)!;
export const qStep = (G: Game, id: string) => { const q = G.S.quests[id]; return !q ? -1 : q.done ? 99 : q.step; };
export const qActive = (G: Game, id: string) => { const s = qStep(G, id); return s >= 0 && s < 99; };
export const qDone = (G: Game, id: string) => qStep(G, id) === 99;
export const lampsFixed = (G: Game) => [0, 1, 2, 3, 4].filter((i) => G.S.flags['lamp' + i]).length;

function enterStep(G: Game, id: string, activate = true) {
  const q = quest(id), st = q.steps[G.S.quests[id].step];
  if (st?.tasks && activate) for (const t of st.tasks) G.task(t)?.setActive(true);
}
export function startQuest(G: Game, id: string) {
  if (G.S.quests[id]) return;
  G.S.quests[id] = { step: 0, done: false };
  const q = quest(id);
  G.ui.banner(q.main ? 'New Chapter' : 'New Side Job', q.title);
  G.snd.sfx('quest');
  enterStep(G, id);
  if (q.main || !G.S.flags.track) G.S.flags.track = id;
  G.ui.refreshQuest();
}
export function advance(G: Game, id: string) {
  const qs = G.S.quests[id];
  if (!qs || qs.done) return;
  const q = quest(id), st = q.steps[qs.step];
  if (st.tasks) for (const t of st.tasks) { const tk = G.task(t); if (tk && !tk.done) tk.setActive(false); }
  qs.step++;
  if (qs.step >= q.steps.length) {
    qs.done = true;
    G.ui.banner(q.main ? 'Chapter Complete' : 'Side Job Complete', q.title);
    G.snd.sfx('level');
    if (G.S.flags.track === id) { const next = QUESTS.find((x) => qActive(G, x.id)); G.S.flags.track = next?.id; }
  } else { enterStep(G, id); G.snd.sfx('select'); }
  G.ui.refreshQuest();
  G.save(true);
}
export function tickQuests(G: Game) {
  for (const q of QUESTS) {
    const qs = G.S.quests[q.id];
    if (!qs || qs.done) continue;
    const st = q.steps[qs.step];
    if (st.until && st.until(G)) advance(G, q.id);
  }
  // contract completion
  const c = G.S.contracts.active;
  if (c && c.tasks.every((t) => G.S.flags['task:' + t])) finishContract(G);
  // property renovations
  for (const p of PROPS) { const ps = G.S.props[p.id]; if (ps?.owned && !ps.restored && p.tasks.every((t) => G.S.flags['task:' + t])) { ps.restored = true; G.syncWorld(); G.ui.banner('Renovation Complete', `${p.name} now earns $${p.rent} a day.`); G.snd.sfx('level'); G.addRep(6); G.addXp('business', 30); G.fx.burst({ x: p.x, y: 3, z: p.z }, 60, { colors: ['#ffe08a', '#fff6cf', '#8fd8c8', '#cf847f'], speed: 5, up: 5, life: 1.6, size: 0.12, glow: true }); } }
  if (qDone(G, 'sq_hotel') && !G.S.flags.restored_hotel) { G.flag('restored_hotel'); G.syncWorld(); G.ui.banner('The Marlowe Reopens', 'The Queen of the Point has her lights on again.'); G.addRep(20); }
  // festival fireworks
  if (G.S.flags.festival_day === G.sky.day && G.sky.night > 0.6 && Math.random() < 0.25) firework(G);
  D.tick(G);
}
export function firework(G: Game) {
  const cols = [['#ff8f7a', '#ffd08a'], ['#8fd8c8', '#e6fff6'], ['#f0e08a', '#fff6cf'], ['#c8a0f0', '#f0d8ff']][Math.floor(Math.random() * 4)];
  const p = new THREE.Vector3(-30 + Math.random() * 70, 14 + Math.random() * 8, -62 - Math.random() * 16);
  G.fx.burst(p, 70, { colors: cols, speed: 9, up: 1.5, life: 1.8, size: 0.26, gravity: 3, drag: 1.4, glow: true, spread: 0.1 });
  G.snd.sfx('firework');
}
export function resumeQuests(G: Game) {
  for (const q of QUESTS) if (qActive(G, q.id)) enterStep(G, q.id);
  const c = G.S.contracts.active;
  if (c) for (const t of c.tasks) G.task(t)?.setActive(true);
  for (const p of PROPS) if (G.S.props[p.id]?.owned && !G.S.props[p.id].restored) for (const t of p.tasks) G.task(t)?.setActive(true);
  if (!G.S.contracts.offers.length) rollOffers(G);
  if (G.S.tools.tuneup) G.truck.maxSpeed = 16.5;
  D.applyHolds(G);
  G.ui.refreshQuest();
}
export function onTaskDone(G: Game, t: Task) {
  if (t.id === 'hq_paint') G.addRep(1);
  void t;
}

// ───────────────────────── contracts ─────────────────────────
export interface Offer { id: string; title: string; client: string; desc: string; tasks: string[]; pay: number; skill: Skill; needs: string; tier: number; haggled?: number }
const POOL: Offer[] = [
  { id: 'c_fence', title: 'Bay Road Fence', client: 'mabel', desc: "The neighbourhood fence along Bay Road blew down in the last nor'easter.", tasks: ['c_fence'], pay: 150, skill: 'carpentry', needs: '6 boards, 12 nails', tier: 0 },
  { id: 'c_walk', title: 'Boardwalk Stain', client: 'rosa', desc: 'Salt has stripped the boardwalk by the diner. A fresh coat of stain before the season.', tasks: ['c_walk'], pay: 170, skill: 'painting', needs: '~2 gallons of paint', tier: 0 },
  { id: 'c_shed', title: 'Garden Shed Rebuild', client: 'ines', desc: 'The community garden shed is a hazard. Tear it down and frame a new one.', tasks: ['c_shed_demo', 'c_shed_build'], pay: 260, skill: 'demolition', needs: 'Sledge · 7 boards', tier: 0 },
  { id: 'c_patel', title: 'Patel Electric Facelift', client: 'dev', desc: "Dev's shopfront needs washing and a confident new colour.", tasks: ['c_patel'], pay: 230, skill: 'painting', needs: 'Pressure washer · ~2 gallons', tier: 1 },
  { id: 'c_hall', title: 'Town Hall Wash & Paint', client: 'vale', desc: 'The council wants the Town Hall front spotless. Paid from public funds, on time for once.', tasks: ['c_hall'], pay: 340, skill: 'painting', needs: 'Pressure washer · ~3 gallons', tier: 1 },
  { id: 'c_rack', title: 'Lumberyard Racking', client: 'gus', desc: 'Gus needs a proper cantilever rack framed up in the yard.', tasks: ['c_rack'], pay: 280, skill: 'carpentry', needs: '9 boards, 16 nails', tier: 1 },
  { id: 'c_wreck', title: 'Beach Wreck Clearance', client: 'silas', desc: "Half a skiff washed up on Driftwood Beach. Break it up before the kids find it.", tasks: ['c_wreck'], pay: 210, skill: 'demolition', needs: 'Sledge', tier: 0 },
  { id: 'c_gazebo', title: 'Gazebo Green Refresh', client: 'mabel', desc: 'The Garden Club wants the gazebo deck re-stained for the summer concerts.', tasks: ['c_gazebo'], pay: 190, skill: 'painting', needs: '~1 gallon of paint', tier: 0 },
];
export function rollOffers(G: Game) {
  const C = G.S.contracts, R = PX.rng(C.seed++ * 977 + G.sky.day);
  const tier = tierFor(G).i;
  const pool = POOL.filter((o) => o.tier <= tier && o.id !== C.active?.id);
  const out: Offer[] = [];
  while (out.length < 3 && pool.length) { const o = pool.splice(Math.floor(R() * pool.length), 1)[0]; out.push({ ...o, pay: Math.round((o.pay * (0.9 + R() * 0.3) * (1 + tier * 0.12)) / 5) * 5 }); }
  C.offers = out;
}
export function acceptOffer(G: Game, o: Offer) {
  const C = G.S.contracts;
  if (C.active) { G.toast('Finish your current contract first.', 'warn'); return; }
  C.active = o; C.offers = C.offers.filter((x) => x.id !== o.id);
  for (const t of o.tasks) { const tk = G.task(t); tk.reset(); tk.setActive(true); }
  G.snd.sfx('quest');
  G.ui.banner('Contract Signed', o.title);
  G.ui.refreshQuest();
}
export function haggle(G: Game, o: Offer): string {
  if (o.haggled !== undefined) return 'You already negotiated this one.';
  const lv = G.skillLv('negotiation');
  if (lv < 2) return 'Requires Negotiation Lv 2.';
  const ok = lv >= 5 || Math.random() < 0.45 + lv * 0.1 + (G.S.trust[o.client] ?? 2) * 0.03;
  if (ok) { o.haggled = 1; o.pay = Math.round((o.pay * 1.22) / 5) * 5; G.addXp('negotiation', 14); G.snd.sfx('coin'); return `${npcName(o.client)} agrees to $${o.pay}.`; }
  o.haggled = 0; o.pay = Math.round((o.pay * 0.92) / 5) * 5; G.addXp('negotiation', 5); G.snd.sfx('error');
  return `${npcName(o.client)} bristles — the offer drops to $${o.pay}.`;
}
function finishContract(G: Game) {
  const C = G.S.contracts, o = C.active!;
  C.active = null; C.done++;
  let pay = o.pay;
  if (o.skill === 'painting' && G.skillLv('painting') >= 5) pay *= 1.25;
  if (o.skill === 'demolition' && G.skillLv('demolition') >= 5) pay *= 1.25;
  G.earn(pay, o.title);
  G.addRep(3); G.addXp('business', 20); G.trust(o.client, 0.5);
  G.S.stats.jobs++;
  G.ui.banner('Contract Complete', `${o.title} — paid $${Math.round(pay)}`);
  G.ui.refreshQuest();
}

// ───────────────────────── crew & property ─────────────────────────
export const CREW: { id: string; wage: number; earn: number; blurb: string; need: string }[] = [
  { id: 'dev', wage: 45, earn: 95, blurb: 'Wires anything. Hums while he works.', need: 'sq_lamps' },
  { id: 'ines', wage: 40, earn: 90, blurb: 'Cuts a line you could shave with.', need: 'sq_mural' },
  { id: 'tom', wage: 55, earn: 115, blurb: 'A wrecking ball with opinions about pierogi.', need: 'sq_tom' },
];
export const crewCap = (G: Game) => (G.skillLv('business') >= 4 ? 3 : G.skillLv('business') >= 2 ? 1 : 0);
export const crewCount = (G: Game) => Object.values(G.S.crew).filter((c) => c.hired).length;
export const PROPS: { id: string; name: string; price: number; rent: number; tasks: string[]; x: number; z: number }[] = [
  { id: 'bung1', name: '1 Gull Row', price: 600, rent: 55, tasks: ['bung1_demo', 'bung1_build', 'bung1_paint'], x: -34, z: 33 },
  { id: 'bung2', name: '2 Gull Row', price: 750, rent: 65, tasks: ['bung2_demo', 'bung2_build', 'bung2_paint'], x: -22, z: 33 },
  { id: 'bung3', name: '3 Gull Row', price: 900, rent: 75, tasks: ['bung3_demo', 'bung3_build', 'bung3_paint'], x: -10, z: 33 },
  { id: 'model', name: 'The Crown Model Home', price: 1800, rent: 150, tasks: ['model_demo', 'model_build', 'model_paint'], x: 45, z: 8 },
];
export function buyProp(G: Game, id: string) {
  const p = PROPS.find((x) => x.id === id)!;
  if (G.skillLv('business') < 3) { G.toast('Requires Business Lv 3.', 'warn'); return; }
  if (!G.spend(p.price)) return;
  G.S.props[id] = { owned: true, restored: false };
  for (const t of p.tasks) G.task(t).setActive(true);
  G.ui.banner('Property Acquired', `${p.name} — renovate it to start collecting rent.`);
  G.snd.sfx('quest'); G.addXp('business', 25);
}
export const TIERS = ['Apprentice', 'Hollis & Co. — Licensed Contractor', 'Harbor Builders', "Harbor's End Construction Co.", 'Master Builder'];
export function tierFor(G: Game): { i: number; name: string; next: string } {
  const S = G.S, crew = crewCount(G), props = Object.values(S.props).filter((p) => p.restored).length;
  let i = 0;
  if (qDone(G, 'mq3')) i = 1;
  if (i >= 1 && S.rep >= 25 && crew >= 1) i = 2;
  if (i >= 2 && S.rep >= 50 && (props >= 1 || crew >= 3)) i = 3;
  if (i >= 3 && S.flags.postgame && (S.flags.restored_hotel || props >= 3)) i = 4;
  const next = ['Finish the Crab Pot job.', 'Reputation 25 and one crew member.', 'Reputation 50 and a renovated property (or a crew of three).', 'Finish the story, then restore the Marlowe or three properties.', 'You built this town back.'][i];
  return { i, name: TIERS[i], next };
}
export function newDay(G: Game) {
  const S = G.S, lines: string[] = [];
  let net = 0;
  for (const c of CREW) {
    const cs = S.crew[c.id];
    if (!cs?.hired) continue;
    if (cs.assign === 'jobs') { const e = Math.round(c.earn * (1 + S.rep / 200) * (G.skillLv('business') >= 5 ? 1.3 : 1)); net += e - c.wage; lines.push(`${npcName(c.id)} ran small jobs: +$${e}, wage −$${c.wage}`); }
    else { net -= c.wage; lines.push(`${npcName(c.id)} worked alongside you: wage −$${c.wage}`); }
  }
  for (const p of PROPS) if (S.props[p.id]?.restored) { net += p.rent; lines.push(`Rent, ${p.name}: +$${p.rent}`); }
  if (S.flags.restored_hotel) { net += 320; lines.push('The Marlowe Hotel: +$320'); }
  S.money = Math.max(0, S.money + net);
  if (net > 0) S.stats.earned += net;
  rollOffers(G);
  for (const k of Object.keys(S.flags)) if (k.startsWith('lesson_')) delete S.flags[k];
  if (S.flags.festival_day && S.flags.festival_day < G.sky.day) for (const n of G.npcs) n.hold = null;
  if (lines.length) G.ui.report(`Morning Report — Day ${G.sky.day}`, [...lines, '', `Net: ${net >= 0 ? '+' : '−'}$${Math.abs(net)}`]);
}

// ───────────────────────── discovery ─────────────────────────
export const LANDMARKS: { id: string; name: string; x: number; z: number; r: number }[] = [
  { id: 'pier', name: 'Town Pier', x: 0.5, z: -52, r: 7 }, { id: 'point', name: 'Marlowe Point', x: -34, z: -41, r: 7 }, { id: 'breach', name: 'The Breach', x: -20, z: -35, r: 5 },
  { id: 'cannery', name: 'The Old Cannery', x: 40, z: -41, r: 7 }, { id: 'light', name: 'Lighthouse Point', x: 58, z: -45, r: 6 }, { id: 'plaza', name: "Founders' Plaza", x: 21, z: -10, r: 6 },
  { id: 'yard', name: 'Brannigan Lumber', x: -26, z: -14, r: 8 }, { id: 'green', name: 'Gazebo Green', x: -38, z: 10, r: 6 }, { id: 'gull', name: 'Gull Row', x: -22, z: 41, r: 8 },
  { id: 'garden', name: 'Community Garden', x: 41, z: 35, r: 6 }, { id: 'cabin', name: "Thorn's Cabin", x: -80, z: -15, r: 7 }, { id: 'pond', name: "Miller's Pond", x: -62, z: 13, r: 6 },
  { id: 'marsh', name: 'Heron Marsh', x: 46, z: 50, r: 8 }, { id: 'beach', name: 'Driftwood Beach', x: -60, z: -39, r: 7 },
];
export function discover(G: Game) {
  const p = G.player.pos, found = G.S.stats.found;
  for (const l of LANDMARKS) if (!found.includes(l.id) && Math.hypot(p.x - l.x, p.z - l.z) < l.r) {
    found.push(l.id);
    G.ui.banner('Discovered', l.name);
    G.snd.sfx('sparkle');
    G.addXp('exploration', 12);
  }
}

// ───────────────────────── cinematics ─────────────────────────
export interface Shot { from: number[]; to: number[]; lookFrom: number[]; lookTo?: number[]; dur: number; text?: string; on?: (G: Game) => void }

// ───────────────────────── extra world dressing owned by the story ─────────────────────────
export function setupWorld(G: Game) {
  const K = G.kit, P = G.places;
  P.lamp_main = { x: 4.8, z: -10 }; P.gull_east = { x: 30, z: 42 }; P.breach_side = { x: -14, z: -34.2 }; P.diner_counter = { x: 13, z: -46.8 };
  P.fest1 = { x: -6, z: -38 }; P.fest2 = { x: 6, z: -38.4 }; P.fest3 = { x: 12, z: -37.6 }; P.fest4 = { x: 18, z: -38.2 }; P.fest5 = { x: 24, z: -37.8 }; P.fest6 = { x: -12, z: -37.6 }; P.fest7 = { x: 30, z: -38 }; P.fest8 = { x: 0.5, z: -44 }; P.fest9 = { x: 36, z: -37.7 }; P.fest10 = { x: -18, z: -37.9 };
  const rot = PX.rotten(6);
  // Tom's test
  G.addTask(new DemoTask(G, 'tom_crates', 'Smash the condemned crates', [{ x: 44, y: 0, z: -41.4, w: 1, h: 1, d: 1, hp: 3 }, { x: 45.2, y: 0, z: -41.6, w: 1.1, h: 1.1, d: 1.1, hp: 3 }, { x: 44.6, y: 1.05, z: -41.5, w: 0.9, h: 0.9, d: 0.9, hp: 2 }, { x: 46.6, y: 0, z: -41.3, w: 1.2, h: 0.9, d: 1, hp: 3 }], { tex: rot, collide: true }));
  // contract sites
  const fence: any[] = [];
  for (let i = 0; i < 4; i++) fence.push({ x: 7 + i * 3.5, y: 0, z: 26.3, w: 0.16, h: 1.3, d: 0.16, nails: 0 });
  fence.push({ x: 12.25, y: 0.4, z: 26.3, w: 10.6, h: 0.14, d: 0.1, nails: 4 }, { x: 12.25, y: 1.0, z: 26.3, w: 10.6, h: 0.14, d: 0.1, nails: 4 });
  G.addTask(new BuildTask(G, 'c_fence', 'Rebuild the Bay Road fence', fence));
  G.addTask(new PaintTask(G, 'c_walk', 'Stain the boardwalk', [{ x: 12, y: 0.035, z: -38.2, w: 12, h: 2.6, floor: true }], { pattern: 'plank' }));
  G.addTask(new PaintTask(G, 'c_gazebo', 'Stain the gazebo approach', [{ x: -38, y: 0.045, z: 14.6, w: 5, h: 2.4, floor: true }], { pattern: 'plank' }));
  G.addTask(new DemoTask(G, 'c_shed_demo', 'Demolish the old garden shed', [{ x: 47, y: 0, z: 29.5, w: 2.6, h: 2, d: 0.2, hp: 3 }, { x: 45.7, y: 0, z: 28.4, w: 0.2, h: 2, d: 2.2, hp: 2 }, { x: 48.3, y: 0, z: 28.4, w: 0.2, h: 2, d: 2.2, hp: 2 }, { x: 47, y: 2, z: 28.4, w: 3, h: 0.2, d: 2.6, hp: 2 }], { tex: rot, collide: false }));
  G.addTask(new BuildTask(G, 'c_shed_build', 'Frame the new garden shed', [{ x: 45.7, y: 0, z: 29.5, w: 0.16, h: 2.1, d: 0.16, nails: 1 }, { x: 48.3, y: 0, z: 29.5, w: 0.16, h: 2.1, d: 0.16, nails: 1 }, { x: 47, y: 2.1, z: 29.5, w: 2.9, h: 0.16, d: 0.16, nails: 2 }, { x: 47, y: 0.05, z: 29.5, w: 2.9, h: 0.14, d: 0.14, nails: 2 }, { x: 47, y: 1.0, z: 29.55, w: 2.6, h: 0.9, d: 0.06, nails: 3 }, { x: 46.4, y: 0.1, z: 29.55, w: 1.2, h: 0.9, d: 0.06, nails: 2 }, { x: 47.6, y: 0.1, z: 29.55, w: 1.2, h: 0.9, d: 0.06, nails: 2 }]));
  G.addTask(new PaintTask(G, 'c_patel', 'Wash & paint Patel Electric', [{ x: 12, y: 0.35 + 1.6, z: 36.03, w: 8, h: 3.2 }], { wash: true, pattern: 'plain' }));
  G.addTask(new PaintTask(G, 'c_hall', 'Wash & paint Town Hall', [{ x: 34, y: 0.35 + 1.4, z: -12.47, w: 14, h: 2.8 }], { wash: true, pattern: 'plain', color: 0 }));
  const rack: any[] = [];
  for (let i = 0; i < 3; i++) rack.push({ x: -34 + i * 2.6, y: 0, z: -11.5, w: 0.2, h: 2.6, d: 0.2, nails: 0 });
  for (let j = 0; j < 3; j++) rack.push({ x: -31.4, y: 0.6 + j * 0.8, z: -11.4, w: 5.6, h: 0.16, d: 0.16, nails: 3 });
  for (let i = 0; i < 3; i++) rack.push({ x: -34 + i * 2.6, y: 2.5, z: -11, w: 0.14, h: 0.14, d: 1.2, nails: 0 });
  G.addTask(new BuildTask(G, 'c_rack', 'Frame the lumber rack', rack));
  G.addTask(new DemoTask(G, 'c_wreck', 'Break up the wrecked skiff', [{ x: -62, y: 0, z: -40.6, w: 3, h: 0.8, d: 0.2, hp: 3 }, { x: -62.4, y: 0, z: -41.5, w: 2.4, h: 0.6, d: 0.2, hp: 2 }, { x: -60.6, y: 0, z: -41, w: 0.2, h: 0.9, d: 1.2, hp: 2 }, { x: -63.6, y: 0, z: -41, w: 0.6, h: 0.5, d: 1.4, hp: 2 }], { tex: PX.planks('#7f8f98', 9) }));
  // dark lamps on Main Street
  const dark = K.lamps.filter((l) => l.broken);
  dark.forEach((l, i) => G.addInteract({ id: 'lampfix' + i, x: l.x, z: l.z, r: 1.7, label: 'Replace the bulb', when: () => qActive(G, 'sq_lamps') && !G.S.flags['lamp' + i], act: () => {
    if (G.S.inv.bulbs < 1) { G.toast('You need a street-lamp bulb from Tidewater Supply.', 'warn'); return; }
    G.S.inv.bulbs--; G.flag('lamp' + i); l.broken = false; G.snd.sfx('sparkle'); G.addXp('engineering', 7);
    G.fx.burst({ x: l.x, y: 3.2, z: l.z }, 16, { colors: ['#ffe08a', '#fff6cf'], speed: 2, up: 1, life: 0.8, size: 0.09, glow: true });
    G.toast(`Lamp restored (${lampsFixed(G)}/5)`, 'good');
  } }));
  G.sceneFlags.darkLamps = dark;
  // hidden caches
  const caches: { x: number; z: number; lv: number; text: string; give: (G: Game) => void }[] = [
    { x: -66, z: -40.4, lv: 1, text: 'Sun-bleached driftwood, straight as a rule. +4 lumber', give: (g) => (g.S.inv.lumber += 4) },
    { x: -41.5, z: 5.5, lv: 1, text: 'A coffee can of coins behind the gazebo. +$45', give: (g) => (g.S.money += 45) },
    { x: -62.5, z: 16, lv: 3, text: 'A sealed bucket by the pond: nails, dry as the day they were bought. +40 nails', give: (g) => (g.S.inv.nails += 40) },
    { x: 39, z: 50, lv: 3, text: 'Two unopened gallons under a marsh blind. +2 paint', give: (g) => (g.S.inv.paint += 2) },
    { x: 50.5, z: -54.5, lv: 3, text: 'Bags of concrete stacked dry behind the cannery. +3 concrete', give: (g) => (g.S.inv.concrete += 3) },
    { x: -88, z: -34, lv: 2, text: "Wedged in a stump: a tape measure with W.H. on the case.", give: (g) => { g.give('tape'); g.addXp('carpentry', 30); } },
  ];
  caches.forEach((c, i) => {
    G.addInteract({ id: 'cache' + i, x: c.x, z: c.z, r: 1.8, label: 'Search', when: () => { const ok = !G.S.flags['cache' + i] && (G.skillLv('exploration') >= c.lv || G.has('map')); if (ok && Math.random() < 0.06 && Math.hypot(G.player.pos.x - c.x, G.player.pos.z - c.z) < 30) G.fx.one(c.x + (Math.random() - 0.5), 0.3, c.z + (Math.random() - 0.5), 0, 1.2, 0, '#fff6cf', { colors: [], life: 1, size: 0.09, gravity: -0.5, glow: true }); return ok; },
      act: () => { G.flag('cache' + i); c.give(G); G.toast(c.text, 'good'); G.snd.sfx('sparkle'); G.addXp('exploration', 10); G.truck.refresh(); } });
  });
  for (let i = 0; i < 5; i++) if (G.S.flags['lamp' + i] && dark[i]) dark[i].broken = false;
}
/** call after loading so per-lamp fixes persist */
export function applyLamps(G: Game) { const dark = G.sceneFlags.darkLamps as any[]; dark?.forEach((l, i) => (l.broken = !G.S.flags['lamp' + i] && !G.S.flags.lamps_fixed)); }
