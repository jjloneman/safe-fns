# The AssemblyScript adapter's image: the pinned Node image, which runs the
# driver (`adapters/assemblyscript.mts`), plus the AssemblyScript compiler
# from `adapters/assemblyscript/`'s lockfile, with the probes compiled in.
#
# - The driver is mounted, like Hermes's, but the probes are built here, so
#   the runner's `docker compose build` recompiles them after an edit.
#
# - Outside `/work`, where the read-only `adapters/` mount would hide the
#   installed compiler and the compiled probes.
FROM node:26.11.1-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567

WORKDIR /opt/assemblyscript

# The manifest, lockfile, and pnpm settings alone first, so editing a probe
# only rebuilds the compile layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# The pnpm that `packageManager` names, minus any `+sha…` integrity suffix.
RUN npm install --global "$(node --print "require('./package.json').packageManager.split('+')[0]")"

# Exactly the locked versions, under `pnpm-workspace.yaml`'s 7-day floor.
RUN pnpm install --frozen-lockfile

ENV PATH=/opt/assemblyscript/node_modules/.bin:$PATH

# `--bindings raw` exports an `instantiate` function rather than one instance,
# so the driver can replace an instance after an abort or trap.
COPY probes.ts ./
RUN asc probes.ts --outFile build/probes.wasm --bindings raw
