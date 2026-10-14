# The Ruby adapter's image: the pinned official Ruby image plus the gems in
# `Gemfile.lock` (Rails' ActiveModel, and syntax_tree for formatting),
# installed at build time so a run needs no network.
FROM ruby:4.0.7-slim-bookworm@sha256:ff110532f77ece9a77d75159600193852442509aa5f1314beb3c99dc4b3298b4

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
