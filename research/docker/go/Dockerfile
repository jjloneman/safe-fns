# The Go adapter's image: the pinned official Go image with the adapter
# compiled in, so a run needs no network.
#
# - One stage, not a build stage plus a scratch image: the runner reports this
#   `FROM` as the image a column ran on, so it must be the one that runs.
FROM golang:1.27.2-bookworm@sha256:5cf287a799e6b94384bad13d16b14904c531f51ba65792237e122ce42b392f61

# `GOTOOLCHAIN=local` stops `go` fetching the toolchain `go.mod` names, and
# `-buildvcs=false` skips stamping a version from `.git`, which isn't copied.
ENV GOFLAGS=-buildvcs=false \
  GOTOOLCHAIN=local

# The repo's path, so the `gofmt` and `go-vet` services, which mount the source
# over this copy, reuse this build's cache.
WORKDIR /work/research/adapters/go

# The adapter uses only the standard library, so there's nothing to download
# before the sources.
COPY go.mod *.go ./
RUN go build -o /opt/go-adapter .

ENTRYPOINT ["/opt/go-adapter"]
