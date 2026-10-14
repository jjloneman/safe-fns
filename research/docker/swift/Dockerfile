# The Swift adapter's image: the pinned official Swift image with the adapter
# compiled in, so a run needs no network.
#
# - One stage: the runner reports this `FROM` as the image a column ran on, so
#   it must be the one that runs.
FROM swift:6.4.0-bookworm@sha256:7dac8560dab0523028235ce7aa79e59fdc68b861c6aca6c709f57c3187dd7f66

# The repo's path, so the `swift-format` service, which mounts the source over
# this copy, sees the same tree.
WORKDIR /work/research/adapters

# `-warnings-as-errors` turns "never mutated; consider changing to `let`" into
# a failed build, so immutability is checked, not just suggested.
COPY research_codec.swift swift.swift ./
RUN swiftc -parse-as-library -O -warnings-as-errors \
  -o /opt/swift-adapter research_codec.swift swift.swift

ENTRYPOINT ["/opt/swift-adapter"]
