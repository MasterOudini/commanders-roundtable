// `Gimli, Counter of Kills` - a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIMLI_COUNTER_OF_KILLS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GIMLI_COUNTER_OF_KILLS, "Trample\nWhenever a creature an opponent controls dies, Gimli deals 1 damage to that creature's controller.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 1 damage to target player.", GIMLI_COUNTER_OF_KILLS.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 1 damage to target player.");

export const GIMLI_COUNTER_OF_KILLS_SCRIPT: CardScript = {
  oracleId: GIMLI_COUNTER_OF_KILLS.oracleId,
  name: GIMLI_COUNTER_OF_KILLS.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      perItem: (ctx, _self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      playerOf: (ctx, _self, _ev, item) => (item !== undefined ? (ctx.state.cards[item]?.controller ?? null) : null),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Gimli, Counter of Kills - ~ deals 1 damage to target player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
