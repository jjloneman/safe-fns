# The `python` and `sqlite` adapters' image: the current stable Python, whose
# bundled SQLite is the one the `sqlite` column reports.
#
# - It's a Dockerfile rather than a Compose `image:` so Dependabot bumps it in
#   the same `research-dockerfiles` PR as every other 3.x Python
#   (`docker/db`, `docker/xml-schema`), and their results move together.
FROM python:3.14.8-slim-bookworm@sha256:48b13b003dda20b16f9442b8475aa05fe21bf6579a8c881db92ffb4d8fd20f83
