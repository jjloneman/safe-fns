# The Swift adapter's image: the pinned official Swift image with the adapter
# compiled in, so a run needs no network.
#
# - One stage: the runner reports this `FROM` as the image a column ran on, so
#   it must be the one that runs.
FROM swift:6.4.1-bookworm@sha256:966e0dce7a3b76b0533df99dd0d54b38ab989fa6592450f70a42f1a1e569c053

# The repo's path, so the `swift-format` service, which mounts the source over
# this copy, sees the same tree.
WORKDIR /work/research/adapters

# `-warnings-as-errors` turns "never mutated; consider changing to `let`" into
# a failed build, so immutability is checked, not just suggested.
COPY research_codec.swift swift.swift ./
RUN swiftc -parse-as-library -O -warnings-as-errors \
  -o /opt/swift-adapter research_codec.swift swift.swift

ENTRYPOINT ["/opt/swift-adapter"]
