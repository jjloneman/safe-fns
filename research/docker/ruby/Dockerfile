# The Ruby adapter's image: the pinned official Ruby image plus the gems in
# `Gemfile.lock` (Rails' ActiveModel, and syntax_tree for formatting),
# installed at build time so a run needs no network.
FROM ruby:3.4.11-slim-bookworm@sha256:22165c5f904d76a8a02fbdd419d0269481369523fd66978232d16c88099730e2

WORKDIR /gems

COPY Gemfile Gemfile.lock ./

# `json` builds a native extension; RubyGems downloads retry, so a blip
# doesn't fail the build.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends build-essential \
  && bundle config set --global frozen true \
  && bundle install --retry 3 \
  && apt-get purge --yes --auto-remove build-essential \
  && rm --recursive --force /var/lib/apt/lists/*
