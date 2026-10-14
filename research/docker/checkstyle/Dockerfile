# Checkstyle, which has no official image: the pinned Temurin JRE plus the
# release's self-contained jar from GitHub, checked against its SHA-256.
#
# - Dependabot bumps the `FROM` line only; bump `CHECKSTYLE_VERSION` and the
#   checksum by hand, to a release at least 7 days old.
FROM eclipse-temurin:25.0.4.1_1-jre-noble@sha256:d9a39a23634650173f1e2bbc176227af9728587ecf0f4b62d53e9355cd7a19ab

ARG CHECKSTYLE_VERSION=14.3.0

ADD --checksum=sha256:754e218ab1fcabb1e1c5f8530e9d3aa37636806c22987bb279dd907a6ee749b2 https://github.com/checkstyle/checkstyle/releases/download/checkstyle-${CHECKSTYLE_VERSION}/checkstyle-${CHECKSTYLE_VERSION}-all.jar /opt/checkstyle/checkstyle.jar

ENTRYPOINT ["java", "-jar", "/opt/checkstyle/checkstyle.jar"]
