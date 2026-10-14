# Debian's command-line tools: the shells, git, and systemd that
# `research/adapters/shell.py` drives with Debian's Python, and clang-format,
# the C / C++ formatter.
FROM debian:trixie-20261005-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f

# Install from the Debian snapshot the base image was built from, so a rebuild
# gets the same package versions instead of the suite's latest.
#
# - Debian's images record that snapshot in a comment above each `URIs:` line;
#   the `sed` swaps it in, so a base-image bump moves the snapshot with it,
#   and empties its hold space after each swap, so a stanza without one keeps
#   its own `URIs:`.
#
# - A snapshot's `Release` files are past their `Valid-Until` date by design,
#   so apt is told not to check it.
#
# - snapshot.debian.org rate-limits, so apt retries each download.
RUN sed --in-place --regexp-extended \
      --expression '/^# (http:\/\/snapshot\.debian\.org\/.*)$/{s//URIs: \1/;h;d}' \
      --expression '/^URIs:/{x;/^$/{x;b};p;s/.*//;x;d}' \
      /etc/apt/sources.list.d/debian.sources \
  && apt-get --option Acquire::Check-Valid-Until=false \
    --option Acquire::Retries=5 update \
  && apt-get --option Acquire::Retries=5 install --yes --no-install-recommends \
    clang-format \
    fish \
    git \
    python3 \
    systemd \
    zsh \
  && rm --recursive --force /var/lib/apt/lists/*
