# The database adapters' image: the pinned official Python image plus the
# drivers in `requirements.txt`, installed at build time so a run needs no
# network beyond its own database.
FROM python:3.14.8-slim-bookworm@sha256:48b13b003dda20b16f9442b8475aa05fe21bf6579a8c881db92ffb4d8fd20f83

COPY docker/db/requirements.txt /tmp/requirements.txt

# Every package and its hash are pinned, so the install can't drift.
RUN pip install --no-cache-dir --require-hashes --requirement /tmp/requirements.txt
