# The JVM adapter's image: the pinned official Gradle image (Eclipse Temurin
# JDK 25) with the adapter compiled in, so a run needs no network.
#
# - One stage, not a build stage plus a JRE: the runner reports this `FROM` as
#   the image a column ran on, so it must be the one that runs.
FROM gradle:9.8.0-jdk25-noble@sha256:47cb7270db91b1a58742e19d9d6ca27387d953b1cfc67ee48ab567702e600135

WORKDIR /opt/jvm-adapter

# The build files alone first, so resolving the libraries and the Kotlin
# compiler is cached until a version changes, not on every adapter edit.
COPY build.gradle.kts settings.gradle.kts ./
RUN gradle --no-daemon --quiet resolveDependencies

COPY src ./src
RUN gradle --no-daemon --offline --quiet installDist

# `java` expands the classpath wildcard itself, so no shell or start script
# stands between the runner and the JVM.
ENTRYPOINT ["java", "-cp", "/opt/jvm-adapter/build/install/jvm-adapter/lib/*", "dev.safefns.research.Main"]
