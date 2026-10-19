# The Hermes adapter's image: the pinned Node image, to run the driver, plus
# the Hermes CLI from its GitHub release.
#
# - Hermes ships no registry image, and its CLI build is x86_64-only, so the
#   Compose service sets `platform: linux/amd64` (emulated on arm64 hosts);
#   it lives there, not on `FROM`, so the runner reads the base image here.
#
# - The v0.13.0 release's binary reports itself as 0.12.0; the adapter
#   records the version the binary prints.
#
# - Dependabot can't follow a release download: bump the URL and checksum by
#   hand, from https://github.com/facebook/hermes/releases.
FROM node:26.11.1-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567

ADD --checksum=sha256:aead6eb0b8f563bb022354352eae32dad96c933330b6c1941b6db17674ca68ae https://github.com/facebook/hermes/releases/download/v0.13.0/hermes-cli-linux.tar.gz /tmp/hermes-cli-linux.tar.gz

# Only the VM-plus-compiler binary; the debugger and bytecode tools stay out.
RUN tar --extract --gzip --file /tmp/hermes-cli-linux.tar.gz \
  --directory /usr/local/bin ./hermes \
  && rm /tmp/hermes-cli-linux.tar.gz
