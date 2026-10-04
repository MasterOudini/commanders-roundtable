// `Tarrian's Soulcleaver` - a static attachedStatic, a cardPutIntoGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TARRIAN_S_SOULCLEAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TARRIAN_S_SOULCLEAVER, "Equipped creature has vigilance.\nWhenever another artifact or creature is put into a graveyard from the battlefield, put a +1/+1 counter on equipped creature.\nEquip {2}");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on equipped creature.", TARRIAN_S_SOULCLEAVER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on equipped creature.");

export const TARRIANS_SOULCLEAVER_SCRIPT: CardScript = {
  oracleId: TARRIAN_S_SOULCLEAVER.oracleId,
  name: TARRIAN_S_SOULCLEAVER.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && m.card !== self && (ctx.derive(m.card).typeLine.types.includes('Artifact') || ctx.derive(m.card).typeLine.types.includes('Creature')),
        ),
      label: () => "Tarrian's Soulcleaver - Put a +1/+1 counter on equipped creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("vigilance");
      },
    },
  ],
};
