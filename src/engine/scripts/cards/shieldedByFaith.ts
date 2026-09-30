// `Shielded by Faith` - a static attachedStatic, a anyCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHIELDED_BY_FAITH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHIELDED_BY_FAITH, "Enchant creature\nEnchanted creature has indestructible.\nWhenever a creature enters, you may attach this Aura to that creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Attach this Aura to target creature.", SHIELDED_BY_FAITH.name);
const VOCAB_T_L2 = vocabularyTargets("Attach this Aura to target creature.");

export const SHIELDED_BY_FAITH_SCRIPT: CardScript = {
  oracleId: SHIELDED_BY_FAITH.oracleId,
  name: SHIELDED_BY_FAITH.name,
  triggers: [
    {
      abilityId: 'anyCreatureEnters-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      perItem: (ctx, _self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Shielded by Faith - Attach this Aura to target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("indestructible");
      },
    },
  ],
};
