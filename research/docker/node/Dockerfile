# The Node adapter's image: the pinned official Node image plus the libraries
# in `research/package.json`, installed at build time so a run needs no network.
FROM node:26.9.0-bookworm-slim@sha256:582460f614631b59b824ac6020533b9bf339c7fdf3a6d7db31abb6b4065f0212

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
