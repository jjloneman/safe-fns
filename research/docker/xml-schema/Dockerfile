# The XML Schema adapter's image: the pinned Python image plus `xmlschema`,
# installed at build time so a run needs no network.
#
# - The same stable Python as `docker/db/`, not the `python` service's release
#   candidate, so the results never rest on a pre-release interpreter.
FROM python:3.14.8-slim-bookworm@sha256:48b13b003dda20b16f9442b8475aa05fe21bf6579a8c881db92ffb4d8fd20f83

COPY requirements.txt /tmp/requirements.txt

# Exactly the hashed versions, and nothing they'd pull in unlisted.
RUN pip install --no-cache-dir --no-deps --require-hashes \
  --requirement /tmp/requirements.txt
