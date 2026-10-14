# The Go adapter's image: the pinned official Go image with the standard
# library compiled into its build cache, so a run compiles only the adapter.
FROM golang:1.27.1-bookworm@sha256:8d48e12ec56735e9358640898b9d9b9fcca110612ed8a5567438c0a1baa24e66

# `GOTOOLCHAIN=local` stops `go` fetching the toolchain `go.mod` names, the
# cache lives outside the read-only mount, and `-buildvcs=false` skips
# stamping a version from `.git`, which isn't mounted.
ENV GOCACHE=/opt/go-cache \
  GOFLAGS=-buildvcs=false \
  GOTOOLCHAIN=local

# The cache is content-addressed, so a stale entry can never be reused.
RUN go build std
