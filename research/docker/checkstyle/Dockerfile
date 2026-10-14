# Checkstyle, which has no official image: the pinned Temurin JRE plus the
# release's self-contained jar from GitHub, checked against its SHA-256.
#
# - Dependabot bumps the `FROM` line only; bump `CHECKSTYLE_VERSION` and the
#   checksum by hand, to a release at least 7 days old.
FROM eclipse-temurin:26.0.2.1_1-jre-noble@sha256:3ed5e2e03c80f8a4901f81ef30e7becd19012e32ab6e036b255ee52fdcabac30

ARG CHECKSTYLE_VERSION=14.3.0

ADD --checksum=sha256:754e218ab1fcabb1e1c5f8530e9d3aa37636806c22987bb279dd907a6ee749b2 https://github.com/checkstyle/checkstyle/releases/download/checkstyle-${CHECKSTYLE_VERSION}/checkstyle-${CHECKSTYLE_VERSION}-all.jar /opt/checkstyle/checkstyle.jar

ENTRYPOINT ["java", "-jar", "/opt/checkstyle/checkstyle.jar"]
