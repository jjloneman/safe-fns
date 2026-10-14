# The .NET adapter's image: the pinned official SDK image plus CSharpier,
# restored at build time so a run needs no network.
FROM mcr.microsoft.com/dotnet/sdk:10.0.401-noble@sha256:e70cdb7f80b0348f5cb85f19a8f670fca061f033d57eed12fa003d58b0e06317

# No telemetry, banner, or first-run setup on any `dotnet` call.
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
  DOTNET_NOLOGO=1 \
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1

# Where the Compose mounts put the adapter (the repo is mirrored under
# `/work`); the mount hides this copy at run time, but the tool manifest it
# holds is the same file.
WORKDIR /work/research/adapters/dotnet

# Only the tool manifest, so editing the adapter never invalidates this
# layer's cache.
COPY .config/dotnet-tools.json .config/

# CSharpier, at the manifest's exact version, into the NuGet cache.
RUN dotnet tool restore

# Where every build writes, outside the read-only mount.
ENV RESEARCH_ARTIFACTS=/opt/research-artifacts

# The project's restore, which depends only on the project file, so a run
# goes straight to compiling.
COPY ResearchAdapter.csproj ./
RUN dotnet restore --artifacts-path "$RESEARCH_ARTIFACTS"
