// `Wicked // Cursed` - a double-faced ROLE token printing (D574, CR 303.7): one Aura token is one face of it (the face the
// Role table named - `TokenCreated.faceIndex`). Wicked: +1/+1, and "When this Aura is put into a graveyard from the
// battlefield, each opponent loses 1 life." (a leaves trigger that LOOKS BACK - the face is read before the move, where a
// token's face still stands). Cursed: base power and toughness 1/1 (CR 613.4b, the ptSet layer).

import { WICKED_CURSED_ROLE_TOKEN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';

const WICKED = 'Enchanted creature gets +1/+1.';
const WICKED_DIES = 'When this Aura is put into a graveyard from the battlefield, each opponent loses 1 life.';
const CURSED = 'Enchanted creature has base power and toughness 1/1.';

function printed(card: CardData, expected: readonly (readonly string[])[]): void {
  expected.forEach((lines, i) => {
    const actual = (card.faces[i]?.oracleText ?? '').split(String.fromCharCode(10));
    if (actual.join('|') !== lines.join('|')) {
      throw new Error(`${card.name} face ${i} reads "${actual.join(' / ')}" and its script was written for "${lines.join(' / ')}". Re-read the card before re-registering it (D90).`);
    }
  });
}
printed(WICKED_CURSED_ROLE_TOKEN, [['Enchant creature', WICKED, WICKED_DIES], ['Enchant creature', CURSED]]);

/** The Role's host, when this token is the face `face` of its printing. */
function hostOf(ctx: ScriptCtx, self: InstanceId, face: number): InstanceId | null {
  const me = ctx.state.cards[self];
  return me && (me.faceIndex ?? 0) === face ? me.attachedTo : null;
}

const DRAIN = vocabularyEffects('Each opponent loses 1 life.', WICKED_CURSED_ROLE_TOKEN.name);
const DRAIN_T = vocabularyTargets('Each opponent loses 1 life.');

export const WICKED_CURSED_ROLE_SCRIPT: CardScript = {
  oracleId: WICKED_CURSED_ROLE_TOKEN.oracleId,
  name: WICKED_CURSED_ROLE_TOKEN.name,
  statics: [
    {
      abilityId: 'wicked-pt',
      text: WICKED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 0) === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'cursed-base',
      text: CURSED,
      layer: 'ptSet',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => hostOf(ctx, self, 1) === candidate,
      modify: (chars) => {
        chars.power = 1;
        chars.toughness = 1;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'wicked-graveyard',
      text: WICKED_DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      // ⚠️ LOOKS BACK: asked of the state before the move, where the token is still the Wicked face (a card that leaves
      // the battlefield turns to its first face - a Cursed Role in the graveyard would read as Wicked after it).
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        (ctx.state.cards[self]?.faceIndex ?? 0) === 0 &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Wicked Role - each opponent loses 1 life',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, DRAIN, DRAIN_T),
    },
  ],
};
