# ktfmt, which has no official image: the pinned Temurin JDK plus ktfmt's
# release jar from Maven Central, checked against its published SHA-256.
#
# - A JDK, not a JRE: ktfmt loads `javac`'s `com.sun.source` classes.
#
# - Dependabot bumps the `FROM` line only; bump `KTFMT_VERSION` and the
#   checksum by hand, to a release at least 7 days old.
FROM eclipse-temurin:26.0.2.1_1-jdk-noble@sha256:3c5ccd0bde683b3d760127a75189c0d9ad7b80de53ebb184ef3e525dd44c2c94

ARG KTFMT_VERSION=0.64

ADD --checksum=sha256:5b3d5286fd2defcc7dc8e28c21ddf156cc6b2d8682bdcd929ce4333e7a6201f2 https://repo1.maven.org/maven2/com/facebook/ktfmt/${KTFMT_VERSION}/ktfmt-${KTFMT_VERSION}-with-dependencies.jar /opt/ktfmt/ktfmt.jar

# The flag silences a warning about the Kotlin compiler's `sun.misc.Unsafe`.
ENTRYPOINT ["java", "--sun-misc-unsafe-memory-access=allow", "-jar", "/opt/ktfmt/ktfmt.jar"]
