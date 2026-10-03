// `Soul Stair Expedition` - a landfall trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUL_STAIR_EXPEDITION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOUL_STAIR_EXPEDITION, "Landfall — Whenever a land you control enters, you may put a quest counter on this enchantment.\nRemove three quest counters from this enchantment and sacrifice it: Return up to two target creature cards from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a quest counter on this enchantment.", SOUL_STAIR_EXPEDITION.name);
const VOCAB_T_L0 = vocabularyTargets("Put a quest counter on this enchantment.");
const VOCAB_A0 = vocabularyEffects("Return up to two target creature cards from your graveyard to your hand.", SOUL_STAIR_EXPEDITION.name);
const VOCAB_T_A0 = vocabularyTargets("Return up to two target creature cards from your graveyard to your hand.");

export const SOUL_STAIR_EXPEDITION_SCRIPT: CardScript = {
  oracleId: SOUL_STAIR_EXPEDITION.oracleId,
  name: SOUL_STAIR_EXPEDITION.name,
  activated: [
    {
      ref: `${SOUL_STAIR_EXPEDITION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'landfall-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Soul Stair Expedition - Put a quest counter on this enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
