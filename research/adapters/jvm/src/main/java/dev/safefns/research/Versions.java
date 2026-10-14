package dev.safefns.research;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

/** Reads the version of a library that actually ran, from its jar. */
final class Versions {

  private Versions() {}

  /**
   * Read a Maven-built jar's version from its `pom.properties`.
   *
   * @param group the Maven group id
   * @param artifact the Maven artifact id
   * @return the version, or `unknown` when the jar doesn't carry one
   */
  static String fromPom(String group, String artifact) {
    String resource =
      "/META-INF/maven/" + group + "/" + artifact + "/pom.properties";

    try (InputStream stream = Versions.class.getResourceAsStream(resource)) {
      if (stream == null) {
        return "unknown";
      }

      Properties properties = new Properties();
      properties.load(stream);

      return properties.getProperty("version", "unknown");
    } catch (IOException error) {
      return "unknown";
    }
  }
}
