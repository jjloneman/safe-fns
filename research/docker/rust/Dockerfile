# The Rust adapter's image: the pinned official Rust image plus rustfmt and
# Clippy, with the adapter compiled in, so a run needs no network.
#
# - One stage, not a build stage plus a slim runtime: the runner reports this
#   `FROM` as the image a column ran on, so it must be the one that runs.
FROM rust:1.99.0-slim-bookworm@sha256:2c3a22f0a5533ea2dd5a16627bc841228151faa2d4de2644ac9987e4a2f1f2fa

# The slim image ships only rustc, Cargo, and the standard library.
RUN rustup component add clippy rustfmt

# Outside the source directory, so the `clippy` service, which mounts the
# source over this copy, reuses the compiled crates.
ENV CARGO_TARGET_DIR=/opt/research-target

WORKDIR /work/research/adapters/rust

# The manifest and lockfile alone first, with a placeholder entry point, so
# the locked crates are fetched and compiled (and Clippy-checked) once, until
# a version changes.
#
# - The placeholder's own artifacts are cleaned, since Cargo judges a path
#   crate by mtime: a copied source older than this build could otherwise pass
#   for fresh and leave the placeholder in place.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
  && echo "fn main() {}" > src/main.rs \
  && cargo build --locked \
  && cargo clippy --locked \
  && cargo clean --package research-adapter \
  && rm -r src

# Then the sources, compiled offline against the crates built above.
COPY build.rs ./
COPY src ./src
RUN cargo build --locked --offline

ENTRYPOINT ["/opt/research-target/debug/research-adapter"]
