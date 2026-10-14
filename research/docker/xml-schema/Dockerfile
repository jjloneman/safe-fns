# The XML Schema adapter's image: the pinned Python image plus `xmlschema`,
# installed at build time so a run needs no network.
FROM python:3.15.0rc3-slim-bookworm@sha256:ea93de1a70a03fffd10ad8cfde8f4ba969fe2658f0578af02855d1d32f49e6c2

COPY requirements.txt /tmp/requirements.txt

# Exactly the hashed versions, and nothing they'd pull in unlisted.
RUN pip install --no-cache-dir --no-deps --require-hashes \
  --requirement /tmp/requirements.txt
