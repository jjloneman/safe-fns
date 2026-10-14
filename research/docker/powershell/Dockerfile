# The PowerShell adapter's image: the pinned .NET SDK image, which ships
# PowerShell (Microsoft no longer publishes PowerShell's own image), plus
# PSScriptAnalyzer for `format.ps1`, installed at build time so a run needs no
# network.
FROM mcr.microsoft.com/dotnet/sdk:10.0.402-noble@sha256:0d99ebf1ccad15037b5c98c9fe8979d6b8dbac23812feae2277a0b277b5c5ffa

# An exact version at least 7 days old, per the repo's moratorium; PSGallery
# fails a download now and then, so the install retries.
RUN pwsh -NoLogo -NoProfile -NonInteractive -Command \
  "foreach (\$attempt in 1..3) { \
    try { \
      Install-PSResource -Name PSScriptAnalyzer -Version 1.25.0 \
        -Scope AllUsers -TrustRepository -ErrorAction Stop; \
      break \
    } catch { \
      if (\$attempt -eq 3) { throw }; \
      Start-Sleep -Seconds 10 \
    } \
  }"

COPY format.ps1 /opt/research/format.ps1
