// `Ior Ruin Expedition` - a landfall trigger vocab, an activation drawN
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IOR_RUIN_EXPEDITION } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(IOR_RUIN_EXPEDITION, "Landfall — Whenever a land you control enters, you may put a quest counter on this enchantment.\nRemove three quest counters from this enchantment and sacrifice it: Draw two cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a quest counter on this enchantment.", IOR_RUIN_EXPEDITION.name);
const VOCAB_T_L0 = vocabularyTargets("Put a quest counter on this enchantment.");

export const IOR_RUIN_EXPEDITION_SCRIPT: CardScript = {
  oracleId: IOR_RUIN_EXPEDITION.oracleId,
  name: IOR_RUIN_EXPEDITION.name,
  activated: [
    {
      ref: `${IOR_RUIN_EXPEDITION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
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
      label: () => "Ior Ruin Expedition - Put a quest counter on this enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
