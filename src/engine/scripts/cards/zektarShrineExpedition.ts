// `Zektar Shrine Expedition` - a landfall trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZEKTAR_SHRINE_EXPEDITION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZEKTAR_SHRINE_EXPEDITION, "Landfall — Whenever a land you control enters, you may put a quest counter on this enchantment.\nRemove three quest counters from this enchantment and sacrifice it: Create a 7/1 red Elemental creature token with trample and haste. Exile it at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a quest counter on this enchantment.", ZEKTAR_SHRINE_EXPEDITION.name);
const VOCAB_T_L0 = vocabularyTargets("Put a quest counter on this enchantment.");
const VOCAB_A0 = vocabularyEffects("Create a 7/1 red Elemental creature token with trample and haste. Exile it at the beginning of the next end step.", ZEKTAR_SHRINE_EXPEDITION.name);
const VOCAB_T_A0 = vocabularyTargets("Create a 7/1 red Elemental creature token with trample and haste. Exile it at the beginning of the next end step.");

export const ZEKTAR_SHRINE_EXPEDITION_SCRIPT: CardScript = {
  oracleId: ZEKTAR_SHRINE_EXPEDITION.oracleId,
  name: ZEKTAR_SHRINE_EXPEDITION.name,
  activated: [
    {
      ref: `${ZEKTAR_SHRINE_EXPEDITION.oracleId}#a0`,
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
      label: () => "Zektar Shrine Expedition - Put a quest counter on this enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
