package com.safefns.research;

import java.util.List;
import java.util.Map;

/**
 * A library or runtime, and its probes for each function.
 *
 * @param functions probes keyed by the function name in a case file
 * @param name the display name
 * @param tier the table tier
 * @param version the version that actually ran
 */
public record Tool(
  Map<String, List<Probe>> functions,
  String name,
  int tier,
  String version
) {}
