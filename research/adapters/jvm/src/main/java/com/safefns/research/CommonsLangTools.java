package com.safefns.research;

import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.BooleanUtils;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.math.NumberUtils;

/** Apache Commons Lang. */
final class CommonsLangTools {

  /** The probes, keyed by function. */
  static final Tool TOOL = new Tool(
    Map.of(
      "isSafeEmpty",
      List.of(
        Probe.any("ObjectUtils.isEmpty(value)", ObjectUtils::isEmpty),
        Probe.nullable(
          "StringUtils.isBlank(value)",
          String.class,
          StringUtils::isBlank
        )
      ),
      "safeParseBoolean",
      List.of(
        Probe.nullable(
          "BooleanUtils.toBoolean(value)",
          String.class,
          BooleanUtils::toBoolean
        ),
        Probe.nullable(
          "BooleanUtils.toBooleanObject(value)",
          String.class,
          BooleanUtils::toBooleanObject
        )
      ),
      "safeParseInteger",
      List.of(
        Probe.nullable(
          "NumberUtils.createInteger(value)",
          String.class,
          NumberUtils::createInteger
        ),
        Probe.nullable(
          "NumberUtils.toInt(value)",
          String.class,
          NumberUtils::toInt
        )
      ),
      "safeParseNumber",
      List.of(
        Probe.nullable(
          "NumberUtils.createNumber(value)",
          String.class,
          NumberUtils::createNumber
        ),
        Probe.nullable(
          "NumberUtils.toDouble(value)",
          String.class,
          NumberUtils::toDouble
        )
      ),
      "safeParseString",
      List.of(
        Probe.nullable(
          "StringUtils.stripToNull(value)",
          String.class,
          StringUtils::stripToNull
        ),
        Probe.nullable(
          "StringUtils.trimToNull(value)",
          String.class,
          StringUtils::trimToNull
        )
      )
    ),
    "Commons Lang",
    2,
    Versions.fromPom("org.apache.commons", "commons-lang3")
  );

  private CommonsLangTools() {}
}
