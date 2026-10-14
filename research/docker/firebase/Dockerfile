# The Firebase emulators' image: the pinned official Node image, the JRE the
# emulators need, and `firebase-tools` from this directory's lockfile, with
# the emulator jars fetched at build time so a run needs no network.
#
# - Python runs the `firebase-adapter` service from this same image, so the
#   adapter can read the installed `firebase-tools` version.
FROM node:26.10.0-trixie-slim@sha256:930557a230abacbc3f4fd9b8648abf8f4bee1e17cb72195dcdfb2f709bc85b33

# `firebase-tools` 15 needs Java 21 or newer.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    openjdk-21-jre-headless \
    python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/firebase

COPY docker/firebase/package.json docker/firebase/pnpm-lock.yaml docker/firebase/pnpm-workspace.yaml ./

# The pnpm that `packageManager` names, minus any `+sha…` integrity suffix.
RUN npm install --global "$(node --print "require('./package.json').packageManager.split('+')[0]")"

# Exactly the locked versions, under `pnpm-workspace.yaml`'s 7-day floor.
RUN pnpm install --frozen-lockfile --prod

ENV PATH=/opt/firebase/node_modules/.bin:$PATH

# The jars `emulators:start` would otherwise download on every first start.
RUN firebase setup:emulators:database && firebase setup:emulators:firestore

COPY docker/firebase/firebase.json ./

# A `demo-` project needs no credentials and never reaches a real backend.
CMD ["firebase", "emulators:start", "--only", "database,firestore", "--project", "demo-research"]
