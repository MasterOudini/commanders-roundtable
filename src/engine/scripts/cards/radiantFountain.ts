// `Radiant Fountain` — Land, "When this land enters, you gain 2 life." plus
// `{T}: Add {C}.` — the mana line is the engine's already (parseManaProduction
// models it), so this script owes exactly the trigger sentence and claims
// exactly that line (M6.4a, D158).

import { RADIANT_FOUNTAIN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(RADIANT_FOUNTAIN, 'When this land enters, you gain 2 life.\n{T}: Add {C}.');
/** The trigger line alone — the def's claim must be ONE printed line (D90). */
const TEXT = PRINTED.split('\n')[0] as string;

export const RADIANT_FOUNTAIN_SCRIPT: CardScript = {
  oracleId: RADIANT_FOUNTAIN.oracleId,
  name: RADIANT_FOUNTAIN.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      // Its OWN entry, from anywhere that is not the battlefield — a land put
      // from a graveyard or a library "enters" exactly as one played from hand.
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Radiant Fountain — gain 2 life',
      // ⚠️ `obj.controller` — who controlled it as the trigger fired (CR
      // 603.3d), not a live lookup that would miss a change of hands.
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
