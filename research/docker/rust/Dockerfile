# The Rust adapter's image: the pinned official Rust image plus rustfmt,
# Clippy, and the adapter's locked dependencies, fetched and compiled at build
# time so a run needs no network.
FROM rust:1.99.0-slim-bookworm@sha256:2c3a22f0a5533ea2dd5a16627bc841228151faa2d4de2644ac9987e4a2f1f2fa

# The slim image ships only rustc, Cargo, and the standard library.
RUN rustup component add clippy rustfmt

# Outside the read-only mount, so a run can write its build; prebuilt below,
# so a run compiles only the adapter itself.
ENV CARGO_TARGET_DIR=/opt/research-target

# Where the Compose mounts put the adapter (the repo is mirrored under
# `/work`); the mount hides this copy at run time.
WORKDIR /work/research/adapters/rust

# Only the manifest and lockfile, plus an empty entry point, so editing the
# adapter never invalidates this layer's cache.
COPY Cargo.toml Cargo.lock ./

# Both the build and Clippy's check of every locked dependency, so neither the
# adapter nor the `clippy` formatter compiles them again.
#
# - The placeholder crate's own artifacts are cleaned, since Cargo judges a
#   path crate by mtime: a mounted source older than this build could
#   otherwise pass for fresh and run the placeholder.
RUN mkdir src \
  && echo "fn main() {}" > src/main.rs \
  && cargo build --locked \
  && cargo clippy --locked \
  && cargo clean --package research-adapter \
  && rm -r src
