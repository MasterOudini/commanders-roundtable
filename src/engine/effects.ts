// Turning a parsed effect into EVENTS — the last step of "the spell actually
// does something".
//
// ⚠️ EVENTS ONLY, never a mutation. That is the same contract the card-script
// API states for itself: an effect returns what happened, and `apply` is the one
// function that changes state. It is also what keeps a resolving Lightning Bolt
// replayable — the log carries the outcome, not an instruction to recompute one.
//
// ⚠️ Called ONLY for a face whose `effectMode` is `auto`, i.e. every sentence of
// it was understood. A partly-understood card never reaches here; it becomes the
// prompt bar's one-click offer instead, marked manual in the log. See
// `effectParse.ts` for why half-executing is the failure that matters.

import { derive, type DeriveCache } from './derive';
import { shuffle, type RngState } from './rng';
import type { EngineDeps } from './loop';
import type { EventBody, ResolvedDamage } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { EffectSpec } from './types/oracle';
import type { GameState, StackObject, TargetChoice } from './types/state';
// Every line here has a CARD as its subject ("Lightning Bolt counters Negate."),
// so none of them changes person for the reader and none needs parts.
import { narrated } from './narrate';
import { drawFromTop } from './setup';

/** The thing a clause is pointed at, already checked for still being there. */
type Aim =
  | { readonly kind: 'card'; readonly id: InstanceId; readonly controller: PlayerId; readonly owner: PlayerId }
  | { readonly kind: 'player'; readonly id: PlayerId }
  | { readonly kind: 'stack'; readonly id: string };

function aimOf(state: GameState, choice: TargetChoice | undefined): Aim | null {
  if (!choice) return null;
  if (choice.kind === 'player') {
    return state.players[choice.id] && !state.players[choice.id]?.hasLost
      ? { kind: 'player', id: choice.id }
      : null;
  }
  if (choice.kind === 'stack') {
    return state.stack.some((s) => s.id === choice.id) ? { kind: 'stack', id: choice.id } : null;
  }
  const card = state.cards[choice.id];
  if (!card) return null;
  return { kind: 'card', id: choice.id, controller: card.controller, owner: card.owner };
}

/**
 * The picks clause `clause` of `obj`'s face is aimed at (D299): the entries of
 * `targets` the cast assigned to it when it recorded `targetSlots`, else the
 * one at `targets[clause]` — abilities, triggers, the assisted path and every
 * log written before slots existed, read exactly as before.
 */
function picksFor(obj: StackObject, clause: number): readonly TargetChoice[] {
  const slots = obj.targetSlots;
  if (slots !== undefined) return obj.targets.filter((_, k) => slots[k] === clause);
  const one = obj.targets[clause];
  return one === undefined ? [] : [one];
}

/**
 * Every event one resolving object's effects produce.
 *
 * ⚠️ A clause whose target has gone is SKIPPED, not guessed at. CR 608.2b only
 * fizzles the whole spell when EVERY target is illegal — a two-target spell that
 * lost one still resolves for the other, and the one that went is simply not
 * affected.
 */
export function effectEvents(
  state: GameState,
  deps: EngineDeps,
  obj: StackObject,
  effects: readonly EffectSpec[],
  cache?: DeriveCache,
): EventBody[] {
  return effectResult(state, deps, obj, effects, cache).events;
}

/**
 * The same thing, plus the RNG if any clause consumed randomness.
 *
 * ⚠️ **TWO ENTRY POINTS RATHER THAN ONE CHANGED SIGNATURE, and the reason is the
 * rule it protects.** The RNG advances ONLY through a recorded `rngAfter`
 * (`reducer.ts`), so a caller that took the events and dropped the `rng` would
 * replay to a DIFFERENT board than it played — silently, and only for the cards
 * that use randomness. Callers that cannot thread it keep the narrow function,
 * which is why `effectEvents` still exists and still returns an array; the ones
 * that can use this and are checked by `tsc`.
 */
export function effectResult(
  state: GameState,
  deps: EngineDeps,
  obj: StackObject,
  effects: readonly EffectSpec[],
  cache?: DeriveCache,
): { events: EventBody[]; rng?: RngState } {
  const out: EventBody[] = [];
  // ⚠️ Threaded through the loop and returned ONCE at the end, never read from
  // `state` per clause: two clauses that each drew from `state.rng` would draw
  // the SAME numbers, because nothing between them advanced it.
  let rng: RngState | undefined;
  const controller = obj.controller;
  const source = obj.card ?? obj.source;
  // One allocator for every instance this resolution creates. See `createToken`.
  let nextInstance = state.counters.instance;

  /**
   * D299 — ONE STEP PER (CLAUSE, PICK). A counted clause ("destroy up to two
   * target creatures") runs its body once per pick, a bare clause once, a
   * `self` clause once with no aim. A clause whose picks have all left runs
   * once as `missing` so the narration below still says so; an OPTIONAL
   * clause ("up to one") the player declared no target for is not missing
   * anything — it was legal to choose none — and is skipped without a word.
   */
  const steps: { effect: EffectSpec; aim: Aim | null; missing: boolean }[] = [];
  for (const effect of effects) {
    if (effect.self) {
      steps.push({ effect, aim: null, missing: false });
      continue;
    }
    const picks = picksFor(obj, effect.targetIndex);
    const aims = picks.map((c) => aimOf(state, c)).filter((a): a is Aim => a !== null);
    if (aims.length === 0) {
      if (!(effect.optional === true && picks.length === 0)) steps.push({ effect, aim: null, missing: true });
      continue;
    }
    for (const aim of aims) steps.push({ effect, aim, missing: false });
  }

  for (const { effect, aim, missing } of steps) {
    /**
     * ⚠️ **A SKIPPED CLAUSE SAYS SO.** CR 608.2b is right that the spell still
     * resolves when only SOME of its targets are gone — only an all-illegal
     * spell is countered on resolution — but for a milestone this branch was a
     * bare `continue`, and a spell that resolves having done nothing, with the
     * log reading only "Mind Rot resolves.", is indistinguishable from a bug.
     *
     * ⚠️ IT COST FOUR HOURS TO PROVE THAT, and on a card that turned out to be
     * working: D137's investigation read "cast, resolves, nothing happened" and
     * spent the whole time inside the engine, because the log offered no way to
     * tell "your target left" from "this effect is broken". The line below is
     * the difference between those two, and it is the reason it exists.
     *
     * A CARD is the subject, so no parts and no person (see the file header).
     */
    if (missing) {
      out.push(
        narrated(
          `${obj.label} — no legal target left for “${effect.text}”`,
          obj.controller,
          obj.identity,
        ),
      );
      continue;
    }

    switch (effect.kind) {
      case 'damage': {
        if (!aim || aim.kind === 'stack' || !source) break;
        out.push({ t: 'DamageDealt', damages: [damageTo(state, deps, source, aim, effect.amount, cache)] });
        break;
      }

      case 'destroy': {
        if (aim?.kind !== 'card') break;
        // ⚠️ Indestructible is a Tier-2 keyword the engine already knows, and
        // "destroy" is precisely the word it answers. Skipping the check would
        // make the app wrong about a keyword it advertises.
        const d = derive(state, deps.oracle, deps.scripts, aim.id, cache);
        if (d.keywords.has('indestructible')) {
          out.push(
            narrated(
              `${obj.label} cannot destroy ${d.name} — it is indestructible.`,
              obj.controller,
              obj.identity,
            ),
          );
          break;
        }
        out.push(moveTo(aim.id, 'graveyard', aim.owner));
        break;
      }

      case 'exile': {
        if (aim?.kind !== 'card') break;
        // Exile is not destruction: indestructible does not save it (CR 701.10a).
        out.push(moveTo(aim.id, 'exile', aim.owner));
        break;
      }

      case 'bounce': {
        if (aim?.kind !== 'card') break;
        out.push(moveTo(aim.id, 'hand', aim.owner));
        break;
      }

      case 'counter': {
        if (aim?.kind !== 'stack') break;
        const victim = state.stack.find((s) => s.id === aim.id);
        if (!victim) break;
        out.push({ t: 'SpellCountered', stackId: victim.id });
        // A countered SPELL goes to its owner's graveyard; an ability just ceases.
        // D307 - a spell cast by flashback goes to exile instead (CR 702.34a).
        if (victim.card) {
          const vc = state.cards[victim.card];
          if (vc) out.push(moveFromStack(victim.card, victim.castFrom?.kind === 'graveyard' ? 'exile' : 'graveyard', vc.owner));
        }
        out.push(narrated(`${obj.label} counters ${victim.label}.`, obj.controller, obj.identity));
        break;
      }

      case 'pump': {
        if (aim?.kind !== 'card') break;
        out.push({
          t: 'PtModifiedUntilEndOfTurn',
          card: aim.id,
          power: effect.power,
          toughness: effect.toughness,
          // D194 — the keyword rider. Spread-conditional so a plain pump
          // emits the exact pre-D194 event, hash-identical on replay.
          ...(effect.keywords.length > 0 ? { keywords: effect.keywords } : {}),
        });
        break;
      }

      case 'massPump': {
        // D301 - every creature the controller controls, as the board derives
        // NOW (a Levitation-granted type counts; a face-down 2/2 is a creature).
        // One carrier entry per creature, the same shape the targeted pump emits.
        for (const inst of Object.values(state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== controller) continue;
          if (!derive(state, deps.oracle, deps.scripts, inst.id, cache).typeLine.types.includes('Creature')) continue;
          out.push({
            t: 'PtModifiedUntilEndOfTurn',
            card: inst.id,
            power: effect.power,
            toughness: effect.toughness,
            ...(effect.keywords.length > 0 ? { keywords: effect.keywords } : {}),
          });
        }
        break;
      }

      case 'tap': {
        if (aim?.kind !== 'card') break;
        if (state.cards[aim.id]?.tapped) break;
        out.push({ t: 'PermanentsTapped', cards: [aim.id] });
        break;
      }

      case 'untap': {
        if (aim?.kind !== 'card') break;
        if (!state.cards[aim.id]?.tapped) break;
        out.push({ t: 'PermanentsUntapped', cards: [aim.id] });
        break;
      }

      case 'draw': {
        out.push(...drawEvents(state, controller, effect.amount));
        break;
      }

      case 'gainLife': {
        const p = state.players[controller];
        if (!p) break;
        out.push({ t: 'LifeChanged', player: controller, delta: effect.amount, to: p.life + effect.amount });
        break;
      }

      case 'loseLife': {
        // D295: `self` is the controller ("You lose 3 life."); otherwise the aimed player.
        const who = effect.self ? controller : aim?.kind === 'player' ? aim.id : null;
        if (!who) break;
        const p = state.players[who];
        if (!p) break;
        out.push({ t: 'LifeChanged', player: who, delta: -effect.amount, to: p.life - effect.amount });
        break;
      }

      /**
       * D295 - the TARGET'S CONTROLLER. The aim is a permanent or a spell on
       * the stack; `state` is the snapshot BEFORE this batch applies, so the
       * permanent the previous sentence destroyed still answers for its
       * controller (CR 608.2h - last known information).
       */
      case 'controllerLosesLife':
      case 'controllerDraws': {
        // "Its" is the spell's FIRST target (the sentence before named it); the
        // sentence itself consumes no target slot, so `aim` is null here.
        const first = aimOf(state, picksFor(obj, 0)[0]);
        const who =
          first?.kind === 'card'
            ? state.cards[first.id]?.controller
            : first?.kind === 'stack'
              ? state.stack.find((s) => s.id === first.id)?.controller
              : undefined;
        if (!who) break;
        if (effect.kind === 'controllerDraws') {
          out.push(...drawEvents(state, who, effect.amount));
          break;
        }
        const p = state.players[who];
        if (!p) break;
        out.push({ t: 'LifeChanged', player: who, delta: -effect.amount, to: p.life - effect.amount });
        break;
      }

      case 'noop':
        // D295 - the D192 vacuity sentence (named in `effectParse`): a restriction
        // on a mechanism this engine does not have, so nothing happens - by design.
        break;

      /**
       * CR 701.8a — and THE PLAYER CHOOSES, which is why this case can produce
       * a prompt where every other one produces only events. See D137.
       *
       * ⚠️ **THREE OUTCOMES, and only the third asks anything.** An empty hand
       * discards nothing; a hand no bigger than the effect goes to the graveyard
       * whole, because there is no choice left to make and a prompt with one
       * legal answer is a click that teaches the player nothing; anything larger
       * raises `chooseFromZone`.
       *
       * ⚠️ **THE PROMPT IS EMITTED, NOT THE DISCARD.** The cards move when the
       * answer comes back — so a resolution that ends here leaves the spell
       * fully resolved (it is already in the graveyard, `resolveTop` put it
       * there in this same batch) with the discard outstanding. That is D136's
       * shape exactly: the engine cannot suspend a fold, so the question comes
       * last and its consequence arrives with the answer.
       *
       * ⚠️ **ONE PROMPT PER RESOLUTION.** A second `AwaitingSet` in the same
       * batch would silently overwrite the first, so a spell with two discard
       * clauses would ask about one and drop the other — half-execution. No card
       * in this vocabulary can print two (each is a whole anchored sentence
       * naming one target), and the guard is here so that stays true rather than
       * being true by luck.
       */
      /**
       * CR 400.7. The card goes to its OWNER — `aim.owner`, never the caster.
       *
       * ⚠️ **A GRAVEYARD IS PUBLIC AND SHARED, so "your graveyard" is a
       * targeting restriction and not an ownership one.** By the time the spell
       * resolves the target is just a card id; `targetAllowed` is what kept it
       * to the caster's own graveyard (D138), and re-deciding it here from the
       * caster would send a stolen card to the wrong hand.
       */
      case 'returnFromGraveyard': {
        if (aim?.kind !== 'card') break;
        // ⚠️ NOT `moveTo` — that helper hardcodes `from: battlefield`, which is
        // right for its four callers (destroy, exile, bounce) and wrong here.
        // A `from` that does not match where the card actually is leaves it in
        // BOTH zones, and `assertInvariants` catches it as exactly that.
        out.push({
          t: 'CardsMoved',
          moves: [
            {
              card: aim.id,
              from: { kind: 'graveyard', player: aim.owner },
              to: { kind: 'hand', player: aim.owner },
            },
          ],
        });
        break;
      }

      /**
       * ⚠️ The controller is the CASTER (CR 400.7a — "under your control" is the
       * default for a reanimation spell), and the destination is a battlefield
       * `ZoneRef` naming them. That is also what makes the entry funnel work on
       * it: `withEntersTapped` reads `move.to.player` to decide whose board the
       * permanent is arriving on, so a move that named the owner instead would
       * ask "do YOU control two other lands" of the wrong seat (D135).
       */
      case 'reanimate': {
        if (aim?.kind !== 'card') break;
        out.push({
          t: 'CardsMoved',
          moves: [
            {
              card: aim.id,
              from: { kind: 'graveyard', player: aim.owner },
              to: { kind: 'battlefield', player: controller },
            },
          ],
        });
        break;
      }

      /**
       * CR 701.16 — look at the top N, keep some, the rest go somewhere. D141.
       *
       * ⚠️ **THE REVEAL IS WHAT MAKES THE PROMPT ANSWERABLE.** `CardsRevealed`
       * marks the cards `revealedTo` the controller, which is precisely what
       * `project.ts` turns into `view.peek` (D114) — the one exception to "a
       * library is a count, full stop". So the client can list the candidates
       * from its own view and the prompt ships no ids, exactly as the discard
       * prompt does for a hand. `redactEvent` strips the ids for everyone else.
       *
       * ⚠️ **FEWER CARDS THAN THE SPELL LOOKS AT IS NORMAL**, not an error — a
       * library near the bottom simply has fewer. The take is clamped, and if
       * the whole remaining library fits in the hand there is no choice to make
       * and no prompt: the same "a question with one legal answer" rule the
       * discard case follows.
       */
      case 'lookAtTop': {
        const look = effect.look;
        if (!look) break;
        const library = state.zones.library[controller] ?? [];
        if (library.length === 0) break;
        // The TOP of a library is the END of the array (`drawFromTop`).
        const top = library.slice(Math.max(0, library.length - effect.amount));
        out.push({ t: 'CardsRevealed', cards: top, to: [controller] });
        const take = Math.min(look.take, top.length);
        /**
         * ⚠️ **TAKE NOTHING IS A REAL FORM** (`Index`, D142): look at five and
         * put them back in an order of your choosing. It skips the pick prompt
         * entirely and goes straight to the ordering one — and a single card has
         * a single sequence, so it skips that too.
         */
        if (take === 0) {
          if (top.length > 1) {
            out.push({
              t: 'AwaitingSet',
              awaiting: {
                kind: 'orderCards',
                player: controller,
                zone: 'library',
                destination: look.rest === 'topOrdered' ? 'top' : 'bottom',
                count: top.length,
                label: obj.label,
              },
            });
          } else {
            out.push({ t: 'CardsRevealed', cards: top, to: [] });
          }
          break;
        }
        if (take >= top.length) {
          out.push({
            t: 'CardsMoved',
            moves: top.map((card) => ({
              card,
              from: { kind: 'library' as const, player: controller },
              to: { kind: 'hand' as const, player: controller },
            })),
          });
          break;
        }
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: controller,
            zone: 'library',
            rest: look.rest,
            count: take,
            label: obj.label,
          },
        });
        break;
      }

      case 'discard': {
        if (aim?.kind !== 'player') break;
        const hand = state.zones.hand[aim.id] ?? [];
        if (hand.length === 0) break;
        if (hand.length <= effect.amount) {
          out.push({
            t: 'CardsMoved',
            moves: hand.map((card) => ({
              card,
              from: { kind: 'hand' as const, player: aim.id },
              to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? aim.id },
            })),
          });
          break;
        }
        // ⚠️ AT RANDOM ASKS NOBODY (CR 701.8b). The cards are taken here, from
        // the SEEDED generator threaded through the log — the only source of
        // randomness this engine has, and the reason D137 refused this wording
        // rather than approximating it.
        if (effect.atRandom) {
          const draw = shuffle(rng ?? state.rng, hand);
          rng = draw.next;
          const taken = draw.value.slice(0, effect.amount);
          out.push({
            t: 'CardsMoved',
            moves: taken.map((card) => ({
              card,
              from: { kind: 'hand' as const, player: aim.id },
              to: { kind: 'graveyard' as const, player: state.cards[card]?.owner ?? aim.id },
            })),
          });
          break;
        }
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: aim.id,
            zone: 'hand',
            // A discard leaves the unchosen where they are, so there is no
            // destination for "the rest" to go to.
            rest: null,
            count: effect.amount,
            label: obj.label,
          },
        });
        break;
      }

      /**
       * CR 701.18 / 701.42 — scry and surveil (D195). The reveal is what makes
       * the prompt answerable, exactly as `lookAtTop`'s comment says: the cards
       * become `revealedTo` the controller, `view.peek` lists them, and the
       * prompt ships no ids. ⚠️ Unlike a look, scry 1 STILL asks — top or
       * bottom is a real choice at any count — and an empty library scries
       * nothing (CR 701.18b's degenerate case).
       *
       * ⚠️ A `thenDraw` rider is NOT emitted here: the draw must see the
       * library AS REORDERED, so it rides the awaiting and the ANSWER handler
       * emits it against the post-choice state.
       */
      case 'scry':
      case 'surveil': {
        const library = state.zones.library[controller] ?? [];
        const n = Math.min(effect.amount, library.length);
        if (n === 0) break;
        const top = library.slice(library.length - n);
        out.push({ t: 'CardsRevealed', cards: top, to: [controller] });
        if (out.some((e) => e.t === 'AwaitingSet')) break;
        out.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'scryChoice',
            player: controller,
            count: n,
            toGraveyard: effect.kind === 'surveil',
            thenDraw: effect.thenDraw,
            label: obj.label,
          },
        });
        break;
      }

      /**
       * ⚠️ THE EVENT HAS EXISTED SINCE D107 and was reached only by the Tier-3
       * counter tool and by the two built-in replacements. Nothing had to be
       * added to the log, the reducer or the hash — the whole of this primitive
       * is a vocabulary that can SAY it. See D130.
       *
       * ⚠️ Battlefield only. A counter on a card in a graveyard is a number
       * nothing reads, and `clearBattlefieldFields` wipes it on the next move
       * anyway — so emitting one would be a log line that says something
       * happened when nothing did. Targeting already restricts a `target
       * creature` to the battlefield (D91); this is the second lock, on the side
       * that writes rather than the side that aims.
       *
       * ⚠️ LETHALITY IS STILL THE SBA'S JOB, exactly as it is for damage (D90).
       * `Scar` puts a `-1/-1` counter on a 1/1 and emits nothing else; layer 7d
       * makes it 0/0 and `checkStateBasedActions` bins it on the next pass. A
       * second "is this lethal" here would eventually disagree with combat.
       */
      /**
       * ⚠️ THE PRINTING IS ON THE SPEC, resolved at build time (D133). Nothing
       * is looked up here, and that is deliberate: a token whose description
       * the table could not name never reached `effectMode: 'auto'`, so this
       * case cannot be asked to create something it has no card for.
       *
       * ⚠️ Instance ids are allocated from ONE counter across every effect this
       * object produces. Two token clauses in one spell each starting from
       * `state.counters.instance + 1` would name the same card twice, and the
       * reducer would overwrite the first with the second — one token, silently.
       */
      case 'createToken': {
        if (!effect.token) break;
        for (let n = 0; n < effect.amount; n++) {
          nextInstance++;
          out.push({
            t: 'TokenCreated',
            card: `c${nextInstance}`,
            oracleId: effect.token.oracleId,
            printingId: effect.token.printingId,
            controller,
            owner: controller,
            turnNumber: state.turn.turnNumber,
          });
        }
        break;
      }

      case 'putCounters':
      case 'removeCounters': {
        if (aim?.kind !== 'card' || effect.counterKind === null) break;
        if (state.cards[aim.id]?.zone.kind !== 'battlefield') break;
        const delta = effect.kind === 'putCounters' ? effect.amount : -effect.amount;
        if (delta === 0) break;
        out.push({
          t: 'CountersChanged',
          changes: [{ card: aim.id, kind: effect.counterKind, delta }],
        });
        break;
      }
    }
  }
  // ⚠️ `rng` is omitted entirely when nothing drew, not set to `state.rng`.
  // `log.ts` records `rngBefore`/`rngAfter` only when a batch carries one, and a
  // no-op advance on every spell would put two identical states on every event.
  return rng === undefined ? { events: out } : { events: out, rng };
}

/**
 * Build the damage record, reusing the SAME shape combat damage uses so infect,
 * wither, deathtouch, lifelink and the commander tally behave identically.
 *
 * ⚠️ `isCommanderDamage` is FALSE here even when the source is a commander:
 * CR 903.10a counts only COMBAT damage toward the 21. A Bolt from your commander
 * is not commander damage, and counting it would kill people early in a way that
 * is very hard to argue with after the fact.
 */
function damageTo(
  state: GameState,
  deps: EngineDeps,
  source: InstanceId,
  aim: Aim,
  amount: number,
  cache?: DeriveCache,
): ResolvedDamage {
  const d = state.cards[source] ? derive(state, deps.oracle, deps.scripts, source, cache) : null;
  const infect = d?.keywords.has('infect') ?? false;
  const wither = d?.keywords.has('wither') ?? false;
  const applyAs = aim.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal';
  return {
    source,
    target: aim.kind === 'player' ? { kind: 'player', id: aim.id } : { kind: 'card', id: (aim as { id: InstanceId }).id },
    amount,
    deathtouch: d?.keywords.has('deathtouch') ?? false,
    lifelinkTo: d?.keywords.has('lifelink') ? state.cards[source]?.controller ?? null : null,
    isCommanderDamage: false,
    viaTrample: 0,
    toxic: d?.toxicAmount ?? 0,
    applyAs,
  };
}

function moveTo(card: InstanceId, kind: 'graveyard' | 'exile' | 'hand', player: PlayerId): EventBody {
  return {
    t: 'CardsMoved',
    moves: [{ card, from: { kind: 'battlefield', player: null }, to: { kind, player } }],
  };
}

// ⚠️ Exported since D170 (the `drawEvents` precedent): a card script that
// counters a spell must move the card by THE one rule, not a copy of it.
export function moveFromStack(card: InstanceId, kind: 'graveyard' | 'exile', player: PlayerId): EventBody {
  return {
    t: 'CardsMoved',
    moves: [{ card, from: { kind: 'stack', player: null }, to: { kind, player } }],
  };
}

/**
 * Draw N, or lose on the next state-based action if the library cannot pay.
 *
 * ⚠️ Drawing from an empty library does NOT lose the game here — it sets the
 * flag and the SBA does it (CR 704.5b). Doing it inline would skip the pass that
 * every other loss goes through.
 *
 * ⚠️ EXPORTED FOR THE CARD SCRIPTS (M6.4a, D158), and only for them: a shipped
 * ETB draw (`Wall of Omens`) must route through THE one draw rule, or the
 * empty-library flag would be re-derived in `scripts/cards/` and eventually
 * disagree with this copy about what an empty library means.
 */
export function drawEvents(state: GameState, player: PlayerId, count: number): EventBody[] {
  const library = state.zones.library[player] ?? [];
  // ⚠️ The SAME helper the draw step and the mulligan use. A second "take N off
  // the top" would eventually disagree about which end of the array is the top,
  // and the disagreement would only show up as a shuffled-looking library.
  const out: EventBody[] = [...drawFromTop(player, count, library)];
  const marker = drewCardsMarker(player, out);
  if (marker) out.push(marker);
  if (library.length < count) out.push({ t: 'DrewFromEmptyLibrary', player });
  return out;
}

/**
 * The `DrewCards` marker for a REAL draw (CR 121), derived from the moves the
 * draw just produced — never recomputed from the library, so the ids and
 * their DRAW ORDER cannot drift from what actually moved. Returns null when
 * nothing was drawn (an empty library draws no cards; the loss flag travels
 * separately).
 *
 * ⚠️ Called at exactly TWO sites — here and the turn's draw step — and never
 * by `drawFromTop` itself, which the opening hands share: an opening hand is
 * not a draw an ability can watch, and an Impulse-style take must stay
 * indistinguishable from silence (D179's discriminator is the whole point).
 */
export function drewCardsMarker(player: PlayerId, events: readonly EventBody[]): EventBody | null {
  const ids: InstanceId[] = [];
  for (const e of events) {
    if (e.t !== 'CardsMoved') continue;
    for (const m of e.moves) {
      if (m.from.kind === 'library' && m.to.kind === 'hand') ids.push(m.card);
    }
  }
  return ids.length > 0 ? { t: 'DrewCards', player, cards: ids } : null;
}
