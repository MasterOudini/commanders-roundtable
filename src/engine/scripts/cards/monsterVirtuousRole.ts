// `Monster // Virtuous` - a double-faced ROLE token printing (D574, CR 303.7): one Aura token is one face of it (the face
// the Role table named - `TokenCreated.faceIndex`). Monster: +1/+1 and trample. Virtuous: +1/+1 for each enchantment its
// controller controls - COUNTED at each derive (CR 613.4c), the Role itself among them, a phased-out one not (D573/D574);
// the count reads the PRINTED faces (D317 - deriving inside a derive is unbounded recursion).

import { MONSTER_VIRTUOUS_ROLE_TOKEN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { inPlay } from '../../zones';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';

const MONSTER = 'Enchanted creature gets +1/+1 and has trample.';
const VIRTUOUS = 'Enchanted creature gets +1/+1 for each enchantment you control.';

function printed(card: CardData, expected: readonly (readonly string[])[]): void {
  expected.forEach((lines, i) => {
    const actual = (card.faces[i]?.oracleText ?? '').split(String.fromCharCode(10));
    if (actual.join('|') !== lines.join('|')) {
      throw new Error(`${card.name} face ${i} reads "${actual.join(' / ')}" and its script was written for "${lines.join(' / ')}". Re-read the card before re-registering it (D90).`);
    }
  });
}
printed(MONSTER_VIRTUOUS_ROLE_TOKEN, [['Enchant creature', MONSTER], ['Enchant creature', VIRTUOUS]]);

/** The Role's host, when this token is the face `face` of its printing. */
function hostOf(ctx: ScriptCtx, self: InstanceId, face: number): InstanceId | null {
  const me = ctx.state.cards[self];
  return me && (me.faceIndex ?? 0) === face ? me.attachedTo : null;
}

/** The enchantments the Role's controller controls, in play. */
function enchantments(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const id of inPlay(ctx.state)) {
    const inst = ctx.state.cards[id];
    if (!inst || inst.controller !== me.controller) continue;
    const card = ctx.oracle.byPrinting(inst.printingId);
    const face = card ? (card.faces[inst.faceIndex ?? 0] ?? card.faces[0]) : undefined;
    if (face && face.typeLine.types.includes('Enchantment')) n++;
  }
  return n;
}

export const MONSTER_VIRTUOUS_ROLE_SCRIPT: CardScript = {
  oracleId: MONSTER_VIRTUOUS_ROLE_TOKEN.oracleId,
  name: MONSTER_VIRTUOUS_ROLE_TOKEN.name,
  statics: [
    {
      abilityId: 'monster-pt',
      text: MONSTER,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 0) === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'monster-kw',
      text: MONSTER,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 0) === candidate,
      modify: (chars) => {
        chars.keywords.add('trample');
      },
    },
    {
      abilityId: 'virtuous-pt',
      text: VIRTUOUS,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 1) === candidate,
      modify: (chars, ctx, self) => {
        const n = enchantments(ctx, self);
        if (chars.power !== null) chars.power += n;
        if (chars.toughness !== null) chars.toughness += n;
      },
    },
  ],
};
