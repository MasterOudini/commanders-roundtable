// `Dread Presence` - a creatureEnters trigger drawLose, a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAD_PRESENCE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(DREAD_PRESENCE, "Whenever a Swamp you control enters, choose one —\n• You draw a card and you lose 1 life.\n• This creature deals 2 damage to any target and you gain 2 life.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "You draw a card and you lose 1 life.", targets: vocabularyTargets("You draw a card and you lose 1 life.") },
  { text: "This creature deals 2 damage to any target and you gain 2 life.", targets: vocabularyTargets("~ deals 2 damage to any target and you gain 2 life.") },
];

const VOCAB_L0_m1 = vocabularyEffects("~ deals 2 damage to any target and you gain 2 life.", DREAD_PRESENCE.name);
const VOCAB_T_L0_m1 = vocabularyTargets("~ deals 2 damage to any target and you gain 2 life.");

export const DREAD_PRESENCE_SCRIPT: CardScript = {
  oracleId: DREAD_PRESENCE.oracleId,
  name: DREAD_PRESENCE.name,
  triggers: [
    {
      abilityId: 'creatureEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Dread Presence - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
