package com.safefns.research;

import static java.util.Map.entry;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.core.SpringVersion;
import org.springframework.core.convert.ConversionService;
import org.springframework.core.convert.support.DefaultConversionService;
import org.springframework.util.NumberUtils;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriUtils;

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
    Map.ofEntries(
      entry(
        "isSafeEmpty",
        List.of(
          Probe.nullable(
            "!StringUtils.hasText(value)",
            String.class,
            value -> !StringUtils.hasText(value)
          ),
          Probe.any("ObjectUtils.isEmpty(value)", ObjectUtils::isEmpty)
        )
      ),
      entry(
        "lowerFirst",
        List.of(
          Probe.nullable(
            "StringUtils.uncapitalize(value)",
            String.class,
            StringUtils::uncapitalize
          ).alone()
        )
      ),
      entry(
        "safeDecodeUriComponent",
        List.of(
          Probe.typed("UriUtils.decode(value, UTF_8)", String.class, value ->
            UriUtils.decode(value, StandardCharsets.UTF_8)
          )
        )
      ),
      entry(
        "safeEncodeUriComponent",
        List.of(
          Probe.typed("UriUtils.encode(value, UTF_8)", String.class, value ->
            UriUtils.encode(value, StandardCharsets.UTF_8)
          )
        )
      ),
      entry(
        "safeParseBigInt",
        List.of(
          Probe.any(
            "conversionService.convert(value, BigInteger.class)",
            value -> CONVERSIONS.convert(value, BigInteger.class)
          ),
          Probe.typed(
            "NumberUtils.parseNumber(value, BigInteger.class)",
            String.class,
            value -> NumberUtils.parseNumber(value, BigInteger.class)
          )
        )
      ),
      entry(
        "safeParseBoolean",
        List.of(
          Probe.any("conversionService.convert(value, Boolean.class)", value ->
            CONVERSIONS.convert(value, Boolean.class)
          )
        )
      ),
      entry(
        "safeParseInt",
        List.of(
          Probe.any("conversionService.convert(value, Integer.class)", value ->
            CONVERSIONS.convert(value, Integer.class)
          ),
          Probe.typed(
            "NumberUtils.parseNumber(value, Integer.class)",
            String.class,
            value -> NumberUtils.parseNumber(value, Integer.class)
          )
        )
      ),
      entry(
        "safeParseNumber",
        List.of(
          Probe.any("conversionService.convert(value, Double.class)", value ->
            CONVERSIONS.convert(value, Double.class)
          )
        )
      ),
      entry(
        "safeParseString",
        List.of(
          Probe.any("conversionService.convert(value, String.class)", value ->
            CONVERSIONS.convert(value, String.class)
          )
        )
      ),
      entry(
        "trimBlank",
        List.of(
          Probe.nullable(
            "StringUtils.trimWhitespace(value)",
            String.class,
            StringUtils::trimWhitespace
          )
        )
      ),
      entry(
        "upperFirst",
        List.of(
          Probe.nullable(
            "StringUtils.capitalize(value)",
            String.class,
            StringUtils::capitalize
          ).alone()
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
