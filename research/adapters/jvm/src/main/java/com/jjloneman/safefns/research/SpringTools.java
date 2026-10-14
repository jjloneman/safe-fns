package com.jjloneman.safefns.research;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.core.SpringVersion;
import org.springframework.core.convert.ConversionService;
import org.springframework.core.convert.support.DefaultConversionService;
import org.springframework.util.NumberUtils;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;

/**
 * Spring Framework's core utilities.
 *
 * <p>Its `String`-to-`Boolean` converter is package-private, so the probes
 * reach it the way Spring does: through the default conversion service.
 */
final class SpringTools {

  private static final ConversionService CONVERSIONS =
    DefaultConversionService.getSharedInstance();

  /** The probes, keyed by function. */
  static final Tool TOOL = new Tool(
    Map.of(
      "isSafeEmpty",
      List.of(
        Probe.nullable(
          "!StringUtils.hasText(value)",
          String.class,
          value -> !StringUtils.hasText(value)
        ),
        Probe.any("ObjectUtils.isEmpty(value)", ObjectUtils::isEmpty)
      ),
      "safeParseBoolean",
      List.of(
        Probe.any("conversionService.convert(value, Boolean.class)", value ->
          CONVERSIONS.convert(value, Boolean.class)
        )
      ),
      "safeParseInteger",
      List.of(
        Probe.any("conversionService.convert(value, Integer.class)", value ->
          CONVERSIONS.convert(value, Integer.class)
        ),
        Probe.typed(
          "NumberUtils.parseNumber(value, Integer.class)",
          String.class,
          value -> NumberUtils.parseNumber(value, Integer.class)
        )
      ),
      "safeParseNumber",
      List.of(
        Probe.any("conversionService.convert(value, Double.class)", value ->
          CONVERSIONS.convert(value, Double.class)
        )
      ),
      "safeParseString",
      List.of(
        Probe.any("conversionService.convert(value, String.class)", value ->
          CONVERSIONS.convert(value, String.class)
        )
      )
    ),
    "Spring",
    2,
    // Read from the jar's manifest, which a repackaged jar can drop.
    Objects.requireNonNullElse(SpringVersion.getVersion(), "unknown")
  );

  private SpringTools() {}
}
