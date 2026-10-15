package com.safefns.research;

import java.io.StringReader;
import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import javax.xml.validation.Schema;
import javax.xml.validation.ValidatorHandler;
import org.apache.xerces.impl.Version;
import org.apache.xerces.jaxp.SAXParserFactoryImpl;
import org.apache.xerces.jaxp.validation.XMLSchemaFactory;
import org.apache.xerces.xs.PSVIProvider;
import org.apache.xerces.xs.datatypes.XSDecimal;
import org.apache.xerces.xs.datatypes.XSDouble;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;
import org.xml.sax.XMLReader;
import org.xml.sax.helpers.DefaultHandler;

/**
 * XML Schema 1.0's built-in types, as Apache Xerces-J decodes them.
 *
 * <p>Xerces is the reference XSD 1.0 processor, and the spec's `whiteSpace`
 * facet normalizes exactly tab, LF, CR, and space
 * (https://www.w3.org/TR/xmlschema-2/#rf-whiteSpace), as Xerces does.
 *
 * <ul>
 *   <li>Its last release, 2.12.2, dates from 2022; it's still the reference
 *       implementation, not an oversight.
 *   <li>The classes are Xerces's own, not the JDK's internal copy, whose PSVI
 *       API `java.xml` doesn't export; the PSVI is what exposes the decoded
 *       value rather than only accept or reject.
 * </ul>
 */
final class XmlSchemaTools {

  /** Makes the namespace-aware SAX parser each case is read with. */
  private static final SAXParserFactoryImpl PARSER_FACTORY = newParserFactory();

  /** The schema whose elements name the built-in types (`xml-schema.xsd`). */
  private static final Schema SCHEMA = loadSchema();

  /** The probes, keyed by function. */
  static final Tool TOOL = new Tool(
    Map.of(
      "safeParseBoolean",
      List.of(typeProbe("boolean")),
      "safeParseInteger",
      List.of(typeProbe("integer")),
      "safeParseNumber",
      List.of(typeProbe("double")),
      "safeParseString",
      List.of(typeProbe("string"), typeProbe("token"))
    ),
    "XML Schema 1.0",
    3,
    Version.getVersion()
  );

  /**
   * Characters XML 1.0 content can't carry unchanged, so their cases are
   * `n/a`.
   *
   * <p>Most C0 controls are forbidden outright, and `\r` is normalized to
   * `\n`; either way the outcome would be the XML parser's, not the type's. A
   * surrogate pair is one code point here, so only a lone surrogate matches.
   */
  private static final Pattern XML_UNSAFE = Pattern.compile(
    "[\\x00-\\x08\\x0B-\\x1F\\x{D800}-\\x{DFFF}\\x{FFFE}\\x{FFFF}]"
  );

  private XmlSchemaTools() {}

  /**
   * Keeps the decoded value of the element that just validated, and fails on
   * any validation error.
   *
   * <p>JAXP's default handler already throws on an error; setting this one
   * makes it explicit that an invalid value never reaches `endElement`.
   */
  private static final class ActualValueHandler extends DefaultHandler {

    /** The validator, which knows each element's PSVI. */
    private final PSVIProvider psvi;

    /** The last element's decoded value. */
    private Object actualValue;

    ActualValueHandler(final PSVIProvider psvi) {
      this.psvi = psvi;
    }

    @Override
    public void endElement(
      final String uri,
      final String localName,
      final String qualifiedName
    ) {
      actualValue = psvi.getElementPSVI().getSchemaValue().getActualValue();
    }

    @Override
    public void error(final SAXParseException error) throws SAXException {
      throw error;
    }
  }

  /**
   * Decode a value as the content of one of the schema's elements.
   *
   * @param element the element, named for its built-in type
   * @param value the element's text
   * @return the decoded value, as a plain Java value
   * @throws Exception the parser's or validator's error, for invalid content
   */
  private static Object decodeAs(final String element, final String value)
    throws Exception {
    final ValidatorHandler validator = SCHEMA.newValidatorHandler();
    final ActualValueHandler handler = new ActualValueHandler(
      (PSVIProvider) validator
    );

    validator.setContentHandler(handler);
    validator.setErrorHandler(handler);

    final XMLReader reader = PARSER_FACTORY.newSAXParser().getXMLReader();
    reader.setContentHandler(validator);

    reader.parse(
      new InputSource(
        new StringReader(
          "<" + element + ">" + escape(value) + "</" + element + ">"
        )
      )
    );

    return toPlainValue(handler.actualValue);
  }

  /**
   * Escape text as `xml.sax.saxutils.escape` does, so the Python column's
   * documents are the same.
   *
   * @param text the text
   * @return the text with `&`, `<`, and `>` escaped
   */
  private static String escape(final String text) {
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }

  /**
   * Accept only a string XML can carry as element content, unchanged.
   *
   * @param args the case's decoded arguments
   * @return whether the first is such a string
   */
  private static boolean isXmlText(final List<Object> args) {
    return (
      args.get(0) instanceof final String text &&
      !XML_UNSAFE.matcher(text).find()
    );
  }

  /**
   * Load the schema from the resource beside the classes.
   *
   * @return the schema
   * @throws IllegalStateException when the bundled schema doesn't load
   */
  private static Schema loadSchema() {
    try {
      return new XMLSchemaFactory().newSchema(
        XmlSchemaTools.class.getResource("/xml-schema.xsd")
      );
    } catch (final SAXException error) {
      throw new IllegalStateException("xml-schema.xsd doesn't load", error);
    }
  }

  /**
   * Make the parser factory, namespace-aware as the validator expects.
   *
   * @return the factory
   */
  private static SAXParserFactoryImpl newParserFactory() {
    final SAXParserFactoryImpl factory = new SAXParserFactoryImpl();
    factory.setNamespaceAware(true);

    return factory;
  }

  /**
   * Map Xerces's own number types to the plain values the codec encodes.
   *
   * <p>An integer becomes a `Long` where it fits, since the codec always tags
   * a `BigInteger` as `$bigint`, while the Python column's `int` is a plain
   * number up to 2^53.
   *
   * @param actual the PSVI's actual value
   * @return the plain value; a `Boolean` or `String` is already one
   */
  private static Object toPlainValue(final Object actual) {
    if (actual instanceof final XSDecimal decimal) {
      final BigInteger integer = decimal.getBigInteger();

      return integer.bitLength() < Long.SIZE ? integer.longValue() : integer;
    }

    if (actual instanceof final XSDouble number) {
      return number.getValue();
    }

    return actual;
  }

  /**
   * Build the probe that decodes a case as one built-in type.
   *
   * @param element the element, named for its built-in type
   * @return the probe
   */
  private static Probe typeProbe(final String element) {
    return new Probe(
      XmlSchemaTools::isXmlText,
      "decode(<" + element + ">value</" + element + ">)",
      false,
      args -> decodeAs(element, (String) args.get(0))
    );
  }
}
