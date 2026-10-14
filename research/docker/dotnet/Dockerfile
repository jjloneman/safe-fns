# The .NET adapter's image: the pinned official SDK image with CSharpier and
# the adapter compiled in, so a run needs no network.
#
# - One stage, not a build stage plus a runtime: the runner reports this
#   `FROM` as the image a column ran on, so it must be the one that runs.
FROM mcr.microsoft.com/dotnet/sdk:10.0.402-noble@sha256:0d99ebf1ccad15037b5c98c9fe8979d6b8dbac23812feae2277a0b277b5c5ffa

# No telemetry, banner, or first-run setup on any `dotnet` call.
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
  DOTNET_NOLOGO=1 \
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1

# The repo's path, so the `csharpier` and `dotnet-build` services, which mount
# the source over this copy, find the same tool manifest.
WORKDIR /work/research/adapters/dotnet

# CSharpier, at the tool manifest's exact version, into the NuGet cache.
COPY .config/dotnet-tools.json .config/
RUN dotnet tool restore

# The project file alone first, so its restore is cached until it changes.
COPY ResearchAdapter.csproj ./
RUN dotnet restore

# Then the sources. Warnings never fail this build: the analyzers are the
# `dotnet-build` lint's job, so an SDK bump can't block a run.
COPY *.cs ./
RUN dotnet build --no-restore --configuration Release \
  --output /opt/dotnet-adapter -p:TreatWarningsAsErrors=false

ENTRYPOINT ["dotnet", "/opt/dotnet-adapter/ResearchAdapter.dll"]
