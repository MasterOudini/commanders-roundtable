// `Wayspeaker Bodyguard` - a etb trigger vocab, a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAYSPEAKER_BODYGUARD } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(WAYSPEAKER_BODYGUARD, "When this creature enters, return target nonland permanent card with mana value 2 or less from your graveyard to your hand.\nFlurry — Whenever you cast your second spell each turn, tap target creature an opponent controls.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return target nonland permanent card with mana value 2 or less from your graveyard to your hand.", WAYSPEAKER_BODYGUARD.name);
const VOCAB_T_L0 = vocabularyTargets("Return target nonland permanent card with mana value 2 or less from your graveyard to your hand.");
const VOCAB_L1 = vocabularyEffects("Tap target creature an opponent controls.", WAYSPEAKER_BODYGUARD.name);
const VOCAB_T_L1 = vocabularyTargets("Tap target creature an opponent controls.");

export const WAYSPEAKER_BODYGUARD_SCRIPT: CardScript = {
  oracleId: WAYSPEAKER_BODYGUARD.oracleId,
  name: WAYSPEAKER_BODYGUARD.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Wayspeaker Bodyguard - Return target nonland permanent card with mana value 2 or less from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'secondSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Wayspeaker Bodyguard - Tap target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
