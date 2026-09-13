// `Salvaging Station` - an activation vocab, a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SALVAGING_STATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SALVAGING_STATION, "{T}: Return target noncreature artifact card with mana value 1 or less from your graveyard to the battlefield.\nWhenever a creature dies, you may untap this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target noncreature artifact card with mana value 1 or less from your graveyard to the battlefield.", SALVAGING_STATION.name);
const VOCAB_T_A0 = vocabularyTargets("Return target noncreature artifact card with mana value 1 or less from your graveyard to the battlefield.");
const VOCAB_L1 = vocabularyEffects("Untap this artifact.", SALVAGING_STATION.name);
const VOCAB_T_L1 = vocabularyTargets("Untap this artifact.");

export const SALVAGING_STATION_SCRIPT: CardScript = {
  oracleId: SALVAGING_STATION.oracleId,
  name: SALVAGING_STATION.name,
  activated: [
    {
      ref: `${SALVAGING_STATION.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'aCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Salvaging Station - Untap this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
