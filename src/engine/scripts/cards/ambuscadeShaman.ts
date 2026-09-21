// `Ambuscade Shaman` - a selfOrAnotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AMBUSCADE_SHAMAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AMBUSCADE_SHAMAN, "Whenever this creature or another creature you control enters, that creature gets +2/+2 until end of turn.\nDash {3}{B} (You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target creature gets +2/+2 until end of turn.", AMBUSCADE_SHAMAN.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gets +2/+2 until end of turn.");

export const AMBUSCADE_SHAMAN_SCRIPT: CardScript = {
  oracleId: AMBUSCADE_SHAMAN.oracleId,
  name: AMBUSCADE_SHAMAN.name,
  triggers: [
    {
      abilityId: 'selfOrAnotherCreatureEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Creature')),
        ),
      label: () => "Ambuscade Shaman - Target creature gets +2/+2 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
