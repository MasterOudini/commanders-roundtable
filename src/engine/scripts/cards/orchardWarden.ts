// `Orchard Warden` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORCHARD_WARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORCHARD_WARDEN, "Whenever another Treefolk creature you control enters, you may gain life equal to that creature's toughness.");

const VOCAB_L0 = vocabularyEffects("Gain life equal to target creature's toughness.", ORCHARD_WARDEN.name);
const VOCAB_T_L0 = vocabularyTargets("Gain life equal to target creature's toughness.");

export const ORCHARD_WARDEN_SCRIPT: CardScript = {
  oracleId: ORCHARD_WARDEN.oracleId,
  name: ORCHARD_WARDEN.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      perItem: (ctx, self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && ctx.derive(m.card).typeLine.subtypes.includes('Treefolk'),
        ),
      label: () => "Orchard Warden - Gain life equal to target creature's toughness.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
