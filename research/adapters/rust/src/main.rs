//! The Rust adapter: runs each case file through the standard library.
//!
//! Usage: `research-adapter <case-file>...`, the `rust` Compose service.
//!
//! - A case decodes into the closest Rust type (`codec::Value`); a call that
//!   can't take that type reports `n/a` rather than converting it first.
//!
//! - `str::parse` is locale-independent, so every column reports the
//!   container's `LC_ALL` rather than a culture the call never consults.
//!
//! - `serde_json` is built with `arbitrary_precision`, which the codec needs;
//!   its JSON columns say so, since the feature keeps a number's digits.

mod codec;

use std::collections::BTreeMap;
use std::env;

use codec::{Probe, Tool, Value, accepts_any, decode_number, run_adapter};
use serde_json::{Number, Value as Json, json};
use url::Url;

/// Accept exactly two string arguments: a value and a base.
fn are_two_strings(args: &[Value]) -> bool {
    matches!(args, [Value::Str(_), Value::Str(_)])
}

/// The compiler that built the adapter, recorded by `build.rs`.
const VERSION: &str = env!("RUSTC_VERSION");

/// Format a `Display` value as its own type would.
fn display(args: &[Value]) -> String {
    match &args[0] {
        Value::Bool(flag) => flag.to_string(),
        Value::Float(number) => number.to_string(),
        Value::Int(integer) => integer.to_string(),
        _ => text(args).to_owned(),
    }
}

/// Convert parsed JSON into a case value, reading no `$` key as a tag.
///
/// A fraction or exponent past `f64` (`1e400`) keeps its digits in
/// `serde_json`'s `Number` and has no `f64`, so it's unrepresentable rather
/// than a float `serde_json` never produced.
fn from_json(parsed: &Json) -> Value {
    match parsed {
        Json::Number(number)
            if number.as_f64().is_none()
                && number.to_string().contains(['.', 'e', 'E']) =>
        {
            Value::Unrepresentable
        }
        Json::Array(items) => {
            Value::Array(items.iter().map(from_json).collect())
        }
        Json::Bool(flag) => Value::Bool(*flag),
        Json::Null => Value::Null,
        Json::Number(number) => decode_number(number),
        Json::Object(entries) => Value::Object(
            entries
                .iter()
                .map(|(key, item)| (key.clone(), from_json(item)))
                .collect(),
        ),
        Json::String(text) => Value::Str(text.clone()),
    }
}

/// Accept a first argument with an `is_empty`: a string, a vector, or a map.
fn has_is_empty(args: &[Value]) -> bool {
    matches!(args[0], Value::Array(_) | Value::Object(_) | Value::Str(_))
}

/// Accept a first argument whose type implements `Display`.
fn is_displayable(args: &[Value]) -> bool {
    matches!(
        args[0],
        Value::Bool(_) | Value::Float(_) | Value::Int(_) | Value::Str(_)
    )
}

/// Accept exactly one argument, a string.
fn is_lone_string(args: &[Value]) -> bool {
    matches!(args, [Value::Str(_)])
}

/// Accept a map first argument and a string second argument.
fn is_map_and_string(args: &[Value]) -> bool {
    matches!((&args[0], &args[1]), (Value::Object(_), Value::Str(_)))
}

/// Accept only a string first argument.
fn is_string(args: &[Value]) -> bool {
    matches!(args[0], Value::Str(_))
}

/// The JSON probes: `serde_json` parsing and serializing.
fn json_functions() -> [(&'static str, Vec<Probe>); 3] {
    [
        (
            "deepSortObject",
            vec![Probe {
                accepts: is_string,
                call: "serde_json::to_string(&serde_json::from_str::<Value>\
                       (value)?) (arbitrary_precision)",
                run: |args| stringify_json(&parse_json(text(args))?),
            }],
        ),
        (
            "safeJsonStringify",
            vec![Probe {
                accepts: accepts_any,
                call: "serde_json::to_string(&value) (arbitrary_precision)",
                run: |args| stringify_json(&to_json(&args[0])),
            }],
        ),
        (
            "safeParseJson",
            vec![Probe {
                accepts: is_string,
                call: "serde_json::from_str::<Value>(value) \
                       (arbitrary_precision)",
                run: |args| {
                    parse_json(text(args)).map(|parsed| from_json(&parsed))
                },
            }],
        ),
    ]
}

/// Parse JSON text with `serde_json::from_str`, naming its error by class.
fn parse_json(text: &str) -> Result<Json, String> {
    serde_json::from_str::<Json>(text)
        .map_err(|error| format!("serde_json::Error({:?})", error.classify()))
}

/// Parse a URL with `Url::parse`, naming its error by variant.
fn parse_url(text: &str) -> Result<Url, String> {
    Url::parse(text).map_err(|error| format!("ParseError::{error:?}"))
}

/// Serialize with `serde_json::to_string`, naming its error by class.
fn stringify_json(value: &Json) -> Result<Value, String> {
    serde_json::to_string(value)
        .map(Value::Str)
        .map_err(|error| format!("serde_json::Error({:?})", error.classify()))
}

/// The first argument's text; only called after `is_string` accepted it.
fn text(args: &[Value]) -> &str {
    match &args[0] {
        Value::Str(text) => text,
        _ => unreachable!("is_string accepted a non-string"),
    }
}

/// Convert a case value into `serde_json`'s own `Value`, as a caller builds
/// one; a non-finite float becomes `null`, as `serde_json` writes one.
fn to_json(value: &Value) -> Json {
    match value {
        Value::Array(items) => Json::Array(items.iter().map(to_json).collect()),
        Value::BigInt(digits) => serde_json::from_str::<Number>(digits)
            .map_or(Json::Null, Json::Number),
        Value::Bool(flag) => Json::Bool(*flag),
        Value::Float(number) => json!(number),
        Value::Int(integer) => json!(integer),
        Value::Null | Value::Unrepresentable => Json::Null,
        Value::Object(entries) => Json::Object(
            entries
                .iter()
                .map(|(key, item)| (key.clone(), to_json(item)))
                .collect(),
        ),
        Value::Str(text) => Json::String(text.clone()),
    }
}

/// List the probes the Rust standard library and its crates offer.
fn tools() -> Vec<Tool> {
    let mut functions = BTreeMap::from([
        (
            "codec",
            vec![Probe {
                accepts: accepts_any,
                call: "value",
                run: |args| Ok(args[0].clone()),
            }],
        ),
        (
            "isSafeEmpty",
            vec![Probe {
                accepts: has_is_empty,
                call: "value.is_empty()",
                run: |args| {
                    Ok(Value::Bool(match &args[0] {
                        Value::Array(items) => items.is_empty(),
                        Value::Object(entries) => entries.is_empty(),
                        _ => text(args).is_empty(),
                    }))
                },
            }],
        ),
        (
            "safeObjectHasOwn",
            vec![Probe {
                accepts: is_map_and_string,
                call: "map.contains_key(key)",
                run: |args| match (&args[0], &args[1]) {
                    (Value::Object(entries), Value::Str(key)) => {
                        Ok(Value::Bool(entries.contains_key(key)))
                    }
                    _ => {
                        unreachable!("is_map_and_string accepted another type")
                    }
                },
            }],
        ),
        (
            "safeParseBoolean",
            vec![Probe {
                accepts: is_string,
                call: "value.parse::<bool>()",
                run: |args| {
                    text(args)
                        .parse::<bool>()
                        .map(Value::Bool)
                        .map_err(|_| String::from("ParseBoolError"))
                },
            }],
        ),
        (
            "safeParseInt",
            vec![Probe {
                accepts: is_string,
                call: "value.parse::<i64>()",
                run: |args| {
                    text(args).parse::<i64>().map(Value::Int).map_err(|error| {
                        format!("ParseIntError({:?})", error.kind())
                    })
                },
            }],
        ),
        (
            "safeParseNumber",
            vec![Probe {
                accepts: is_string,
                call: "value.parse::<f64>()",
                run: |args| {
                    text(args)
                        .parse::<f64>()
                        .map(Value::Float)
                        .map_err(|_| String::from("ParseFloatError"))
                },
            }],
        ),
        (
            "safeParseString",
            vec![
                Probe {
                    accepts: is_displayable,
                    call: "value.to_string()",
                    run: |args| Ok(Value::Str(display(args))),
                },
                Probe {
                    accepts: is_string,
                    call: "value.trim()",
                    run: |args| Ok(Value::Str(text(args).trim().to_owned())),
                },
            ],
        ),
    ]);
    functions.extend(json_functions().into_iter().chain(url_functions()));

    vec![Tool {
        functions,
        locale: env::var("LC_ALL").unwrap_or_default(),
        name: "Rust",
        tier: 2,
        version: VERSION,
    }]
}

/// The URL probes: the `url` crate, a WHATWG URL parser.
fn url_functions() -> [(&'static str, Vec<Probe>); 1] {
    [(
        "safeParseUrl",
        vec![
            Probe {
                accepts: is_lone_string,
                call: "Url::parse(value)",
                run: |args| {
                    parse_url(text(args)).map(|url| Value::Str(url.into()))
                },
            },
            Probe {
                accepts: are_two_strings,
                call: "Url::parse(base)?.join(value)",
                run: |args| match args {
                    [Value::Str(value), Value::Str(base)] => parse_url(base)?
                        .join(value)
                        .map(|url| Value::Str(url.into()))
                        .map_err(|error| format!("ParseError::{error:?}")),
                    _ => unreachable!("are_two_strings accepted another type"),
                },
            },
        ],
    )]
}

/// Run the case files named on the command line.
fn main() {
    run_adapter(&tools());
}
