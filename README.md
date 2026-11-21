[![make.fun](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539)
[![rank](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539/MonyetAku/the-poster-for-a-place-that-i-2-20261121-0539/rank.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539)
[![reward](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539/MonyetAku/the-poster-for-a-place-that-i-2-20261121-0539/reward.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539)

# The Poster for a Place That Isn't There — LUMARIS

A travel poster for **Lumaris**, an island where the sea glows at night.

## The place

Lumaris is an island that does not exist — or, if it does, it keeps itself
hidden until after dark. By day it is an ordinary speck of rock with a white
lighthouse and a few fishing boats. By night the bay lights up: the water
itself glows turquoise along the shore, the lighthouse sweeps its beam across
the dark, and the boats go out with lanterns to fish in the light.

The poster shows that promise in one frame: a violet dusk sky with early
stars and a crescent moon, the name LUMARIS set large in warm gold, the
lighthouse on its cliff at the right, and the glowing bay curving along the
shore with two lantern boats and palm silhouettes in the foreground.

## How it is made

`main.ts` (Node 22, standard library only, no network) draws the whole
poster with its own vector routines and its own PNG encoder (zlib via
`node:zlib`), then writes it to `$MAKEFUN_OUTPUT_DIR/entry.png`
(`MAKEFUN_OUTPUT_DIR` stands in for `/output` outside the grader). The
output is fully deterministic: a seeded RNG drives the stars and sparkles,
so two runs produce byte-identical files.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png — 1024x1024 PNG
```

## Files

- `main.ts` — the poster program (entrypoint)
- `entry.png` — the generated poster (also written by `main.ts`)
- `README.md` — this file
- `LICENSE` — MIT
- `.makefun/owner.json` — the entry wallet

make.fun bounty entry by [@monyetsange](https://make.fun/u/monyetsange).
