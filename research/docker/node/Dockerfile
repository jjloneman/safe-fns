# The Node adapter's image: the pinned official Node image plus the libraries
# in `research/package.json`, installed at build time so a run needs no network.
#
# - The `base` stage is the plain Node image, which the `sources` service
#   builds alone (`target: base`), so the two can't pin different Node images.
FROM node:26.10.0-bookworm-slim@sha256:3ffc19ea878019d9e9ae8971732ad4a03cda44f167107173174b60ed7c65bed3 AS base

# The Node adapter's own stage, and the default target: `base` plus the
# libraries, which the `node` service gets and `sources` doesn't. Either way the
# runner reports the first `FROM`, the pinned image, as the column's image.
FROM base

# Where the Compose mounts put `research/` (the repo is mirrored under
# `/work`), so the adapter's imports find `node_modules` beside it.
WORKDIR /work/research

# Only the manifest, lockfile, and pnpm settings; the adapters and cases are
# mounted at run time, so editing them never invalidates this layer's cache.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# The pnpm that `packageManager` names, minus any `+sha…` integrity suffix, so
# the image can't drift from the pinned version; a test keeps that field equal
# to the root `package.json`'s.
RUN npm install --global "$(node --print "require('./package.json').packageManager.split('+')[0]")"

# Exactly the locked versions, under `pnpm-workspace.yaml`'s 7-day floor;
# `--prod` skips the type packages only an editor needs.
RUN pnpm install --frozen-lockfile --prod
