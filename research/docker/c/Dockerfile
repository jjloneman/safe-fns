# The C / C++ adapter's image: the pinned official GCC image with the C++
# probes compiled in, so a run needs no network.
#
# - One stage: the runner reports this `FROM` as the image a column ran on, so
#   it must be the one that runs, and its libstdc++ is the one the probes use.
#
# - `c.py` drives glibc through `ctypes` and loads `/opt/cxx_probes.so`; it
#   runs on the image's Debian Python, beside the Python codec it imports.
FROM gcc:16.1.0-trixie@sha256:d8dec2859f964120119abd1380563247bf02c5d64f5bcdea496dbace1f48c6f0

ENV PYTHONDONTWRITEBYTECODE=1

# The repo's path, so the `clang-format` and `ruff` services, which mount the
# source, see the same tree.
WORKDIR /work/research/adapters

COPY c.py cxx_probes.cpp research_codec.py ./
RUN g++ -std=c++20 -O2 -Wall -Wextra -Werror -shared -fPIC \
  -o /opt/cxx_probes.so cxx_probes.cpp

ENTRYPOINT ["python3", "/work/research/adapters/c.py"]
