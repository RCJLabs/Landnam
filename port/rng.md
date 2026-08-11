# The RNG contract

*Phase 7 item 2. This directory holds the things a second implementation of
Landnám's simulation must agree with THIS one about. Nothing in it is loaded
by the game — it is a contract, and `test/rngport.test.ts` is the half of it
that runs here.*

Every world, every event, every blow in this game comes out of one seeded
generator in `src/rng.ts`. There is no other source of randomness:
`Math.random` is banned project-wide. So the seed *is* the world, and a port
that reproduces the algorithm to within one bit reproduces nothing at all —
every existing seed becomes a different country, and the port's own tests
pass the whole time, because they are self-consistent too.

That is the failure this file exists to prevent. It is cheap now and
miserable later.

## The artifact

`port/rng-fixture.json` is generated from `src/rng.ts` and committed. It
holds absolute values — hashes, raw draws, helper outputs — as **integers**,
never decimals, because a decimal is somewhere two languages can print the
same number differently.

Assert against it in the port. `test/rngport.test.ts` asserts against it
here, which means this repo can no longer change the generator by accident:
edit one constant in `src/rng.ts` and that test fails, which is a thing no
other test in the suite could see. (Checked by doing it — a one-digit change
to the FNV prime, and the test fails as it should.)

To extend the fixture legitimately, run the test; on mismatch it prints the
regenerated JSON to stdout for you to write back over the file. If it fails
and you did **not** mean to touch the generator, stop: that is a save-and-
world-breaking change, not a test to update.

## The algorithm, exactly

### 1. Hash the seed string — FNV-1a over UTF-16 code units

```js
let h = 0x811c9dc5;
for (let i = 0; i < text.length; i++) {
  h ^= text.charCodeAt(i);
  h = Math.imul(h, 0x01000193);
}
return h >>> 0;
```

**This is the single most likely place a port silently diverges.**
`charCodeAt` yields **UTF-16 code units**, not bytes and not code points.

Measured rather than warned about — the same string hashed three ways:

| seed | UTF-16 units *(correct)* | UTF-8 bytes | code points |
| --- | --- | --- | --- |
| `landnam` | 4186577160 | 4186577160 | 4186577160 |
| `Þórr` | 1670707610 | 153305670 | 1670707610 |
| `ríki` | 3351336560 | 644708977 | 3351336560 |
| `😀` | 3409036472 | 866293256 | 105948959 |

Read the first row and then the rest. **Every ASCII seed agrees under all
three**, which is why this bug survives testing: the game's own seeds are
`raven-skerry-317` and `curve-0`, and they will never catch it. The Norse
seeds catch a UTF-8 port. And **only the emoji catches a code-point port** —
it is one code point and two code units, and it is the sole case in the
fixture that separates those two readings. All four are in there on purpose;
none of them is decoration.

`Math.imul(a, b)` is a 32-bit multiply returning a **signed** 32-bit result:
`(int32_t)((uint32_t)a * (uint32_t)b)`.

### 2. mulberry32

```js
let a = seed >>> 0;
function next() {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

Note carefully: `| 0` produces a **signed** 32-bit value, and `>>>` is an
**unsigned** shift applied to that value's unsigned reinterpretation. Doing
the whole thing in `uint32_t` and using `>>` gives the same bits — which is
why the reference below is written that way — but mixing the two in the same
expression is where a hand-translation goes wrong.

`next()` returns the raw uint32 divided by `2**32`, which is exact in a
double. The fixture stores the **uint32**; recover `next()` by dividing, and
recover the uint32 from a `next()` by multiplying back.

### 3. Stream and derive names are built by string concatenation

```
stream(seed, name)      →  makeRng(`${seed}#${name}`)
rng.derive(label)       →  makeRng(`${seed}::${label}`)
```

The delimiters `#` and `::` are part of the contract, and so are the stream
names themselves — `worldgen`, `party`, `events`, `combat`, `colony`, `saga`.
**Renaming a stream or changing a derive label silently changes every
existing seed.** Derive chains concatenate, so `makeRng('root').derive('a')
.derive('b')` is `makeRng('root::a::b')`; a port may build the string
directly.

### 4. The helpers, and how many draws each consumes

| helper | definition | draws |
| --- | --- | --- |
| `next()` | as above | 1 |
| `int(min, max)` | `min + floor(next() * (max - min + 1))` — both ends inclusive | 1 |
| `float(min, max)` | `min + next() * (max - min)` | 1 |
| `chance(p)` | `next() < p` | 1 |
| `roll(count, sides)` | sum of `count` calls of `int(1, sides)` | `count` |
| `pick(items)` | `items[int(0, items.length - 1)]` | 1 |
| `shuffle(items)` | Fisher-Yates **descending**: `for i = len-1; i > 0; i--` swap `i` with `int(0, i)` | `len - 1` |
| `weighted(items, w)` | one draw: `next() * total`, then walk the list subtracting each `max(0, w)`, returning the first item that takes the running value below zero | 1 |

The draw COUNT matters as much as the value. A port whose `roll(2, 6)` takes
one draw instead of two stays in step for exactly one call and then every
subsequent number in that stream is different.

`weighted` clamps negative weights to zero, and falls back to `pick` when the
total is not positive — which consumes a draw from `pick` **in addition** to
none of its own, since the `next() * total` line is not reached.

## Reference implementation

The full version is `port/rng_reference.cpp`, which prints every pinned
value in fixture order. **It was compiled and run against the fixture, not
merely written next to it** — g++ 13.3, 174 of 174 values matching, hashes
and raw draws and streams and derive chains and `int` over five ranges and
`roll`. If your port disagrees with it, one of you is wrong and the JSON is
the authority.

```
g++ -O2 -o rng_reference port/rng_reference.cpp && ./rng_reference > cpp.txt
```

then compare, in whatever is to hand:

```python
import json
f = json.load(open('port/rng-fixture.json'))
want = [('H', h) for _, h in f['hash']]
want += [('D', d) for _, ds in f['draws'] for d in ds]
want += [('S', d) for _, _, ds in f['streams'] for d in ds]
want += [('V', d) for _, _, ds in f['derives'] for d in ds]
want += [('I', v) for g in f['helpers']['int'] for v in g]
want += [('R', v) for g in f['helpers']['roll'] for v in g]
got = [(t, int(v)) for t, v in (l.split() for l in open('cpp.txt'))]
print(sum(1 for a, b in zip(want, got) if a != b), 'mismatches of', len(want))
```

The core of it, deliberately plain — no cleverness to mistranslate:

```cpp
#include <cstdint>
#include <string>
#include <vector>
#include <cmath>

// FNV-1a over UTF-16 code units. `units` must be the seed re-encoded as
// UTF-16 — see the note above; this is not optional and not cosmetic.
uint32_t hashString(const std::vector<uint16_t>& units) {
    uint32_t h = 0x811c9dc5u;
    for (uint16_t u : units) {
        h ^= u;
        h = h * 0x01000193u;   // wraps, matching Math.imul
    }
    return h;
}

struct Rng {
    uint32_t a;
    explicit Rng(uint32_t seed) : a(seed) {}

    uint32_t nextU32() {
        a = a + 0x6d2b79f5u;
        uint32_t t = (a ^ (a >> 15)) * (1u | a);
        t = (t + (t ^ (t >> 7)) * (61u | t)) ^ t;
        return t ^ (t >> 14);
    }

    // The double every helper is defined in terms of.
    double next() { return nextU32() / 4294967296.0; }

    int32_t intInclusive(int32_t lo, int32_t hi) {
        return lo + (int32_t)std::floor(next() * (double)(hi - lo + 1));
    }

    int32_t roll(int count, int sides) {
        int32_t sum = 0;
        for (int i = 0; i < count; ++i) sum += intInclusive(1, sides);
        return sum;
    }
};
```

The `(1u | a)` and `(61u | t)` are ORs with the *current* value, not
constants — a common transcription slip, and one the fixture catches on the
very first draw.

## What is NOT pinned here, and should be

This file locks the generator. It does not lock **what the game asks it
for** — the order in which systems draw, and the derive labels they use.
Those are just as load-bearing: `worldgen` drawing one extra number moves
every subsequent hex.

That is item 1's job in the Phase 7 list (run both implementations on the
same seed and the same action list, and diff the resulting `GameState`). This
fixture is the floor under it: if the generators disagree, a state diff tells
you nothing, because everything disagrees.
