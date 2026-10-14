# The `python311` adapter's image: the last Python with `distutils`, for
# `strtobool`.
#
# - It's a Dockerfile rather than a Compose `image:` only so Dependabot sees it
#   as its own dependency: every `python:` pin in `research/compose.yaml` is one
#   dependency there, so a hold on 3.11 would freeze `python` and `sqlite` too.
#
# - Its Dependabot entry ignores 3.12 and later.
FROM python:3.11.17-slim-bookworm@sha256:0a310eeecf4e1f5a0743f9a6520c90c88d089c903ca5fd283f501e3a805f5f89
