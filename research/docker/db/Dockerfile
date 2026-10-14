# The database adapters' image: the pinned official Python image plus the
# drivers in `requirements.txt`, installed at build time so a run needs no
# network beyond its own database.
FROM python:3.15.0rc3-slim-bookworm@sha256:ea93de1a70a03fffd10ad8cfde8f4ba969fe2658f0578af02855d1d32f49e6c2

COPY docker/db/requirements.txt /tmp/requirements.txt

# Every package and its hash are pinned, so the install can't drift.
RUN pip install --no-cache-dir --require-hashes --requirement /tmp/requirements.txt
