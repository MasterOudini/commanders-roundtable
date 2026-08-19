// `Reckless Rage` — "Reckless Rage deals 4 damage to target creature you
// don't control and 2 damage to target creature you control." TWO target
// clauses in one sentence — ⚠️ verify at land time that `targetParse` reads
// BOTH clauses confidently (parseTargetClauses(TEXT).length === 2 with the
// controller filters right); a one-clause read would prompt for one target
// and half-execute — that failure is a REFUSAL, not a workaround. Clause
// order is text order: [0] theirs takes 4, [1] mine takes 2. The spell is
// the source — no riders (Char's rule). Both entries in ONE DamageDealt;
// each is independently zone-checked (CR 608.2b does as much as it can when
// one target is gone). D192.

import { RECKLESS_RAGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  RECKLESS_RAGE,
  "Reckless Rage deals 4 damage to target creature you don't control and 2 damage to target creature you control.",
);

export const RECKLESS_RAGE_SCRIPT: CardScript = {
  oracleId: RECKLESS_RAGE.oracleId,
  name: RECKLESS_RAGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      const theirs = obj.targets[0];
      if (theirs && theirs.kind === 'card' && ctx.state.cards[theirs.id]?.zone.kind === 'battlefield') {
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: theirs.id },
          amount: 4,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      const mine = obj.targets[1];
      if (mine && mine.kind === 'card' && ctx.state.cards[mine.id]?.zone.kind === 'battlefield') {
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: mine.id },
          amount: 2,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
