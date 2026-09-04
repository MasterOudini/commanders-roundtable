// `Disciple of the Sun` - returnToHand on "return target permanent card with mana value 3 or less from your graveyard to your hand": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { DISCIPLE_OF_THE_SUN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(DISCIPLE_OF_THE_SUN, "Lifelink\nWhen this creature enters, return target permanent card with mana value 3 or less from your graveyard to your hand.");
const TEXT = PRINTED.split('\n')[1] as string;

export const DISCIPLE_OF_THE_SUN_SCRIPT: CardScript = {
  oracleId: DISCIPLE_OF_THE_SUN.oracleId,
  name: DISCIPLE_OF_THE_SUN.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => "Disciple of the Sun - return target permanent card with mana value 3 or less from your graveyard to your hand",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'hand', player: card.owner } }] }];
      },
    },
  ],
};
