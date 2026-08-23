// `Torch the Witness` — twice X damage, and then an INVESTIGATE gated on
// whether the damage was EXCESS.
//
// ⚠️ Excess is arithmetic this resolve can do, and doing it needs three facts.
// Lethal damage is the creature's DERIVED toughness minus the damage already
// marked on it (CR 120.4a), the source here is a SPELL so deathtouch never
// enters the sum, and both are read BEFORE the damage event — which is the
// only order available, since a resolve cannot see its own effects (D261's
// own Too Greedily refusal, from the other side).
// ⚠️ "Excess" is STRICTLY more than lethal: exactly lethal investigates
// nothing, which is the boundary the test pins. D261.

import { TORCH_THE_WITNESS } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TEXT = printed(
  TORCH_THE_WITNESS,
  'Torch the Witness deals twice X damage to target creature. If excess damage was dealt to that creature this way, investigate. (Create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
);

const CLUE = tokenRef('Clue|/||Artifact|');

export const TORCH_THE_WITNESS_SCRIPT: CardScript = {
  oracleId: TORCH_THE_WITNESS.oracleId,
  name: TORCH_THE_WITNESS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const amount = 2 * (obj.xValue ?? 0);
      if (amount <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];

      // A derived toughness is nullable (a printed * with nothing setting it),
      // and a creature with no toughness has no lethal threshold to exceed —
      // treating it as 0 makes ANY damage excess, which is the reading that
      // does not invent a Clue out of an unknown.
      const lethal = Math.max(0, (ctx.derive(target.id).toughness ?? 0) - card.damage);
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
      if (amount > lethal) {
        events.push({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CLUE.oracleId,
          printingId: CLUE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        });
      }
      return events;
    },
  },
};
