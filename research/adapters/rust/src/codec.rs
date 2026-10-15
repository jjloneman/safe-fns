//! The portable value format and adapter loop, for the Rust adapter.
//!
//! The twin of `scripts/research/codec.ts` and `research_codec.py`; the
//! `codec` case file checks that every twin decodes and re-encodes
//! identically.

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io::{self, Write};
use std::process;

use serde_json::{Map, Number, Value as Json, json};

/// The largest integer a JavaScript number holds exactly: 2^53 - 1.
///
/// Past it, an integer is encoded as `$bigint`, so the TS side never reads a
/// rounded number.
const MAX_SAFE_INTEGER: i64 = (1 << 53) - 1;

/// What one probe returns: a value, or the name of the error it raised.
pub type ProbeResult = Result<Value, String>;

/// One expression a tool offers for a function.
pub struct Probe {
    /// Whether the call can take these arguments at all; `n/a` otherwise.
    pub accepts: fn(&[Value]) -> bool,

    /// The expression, as the table header shows it.
    pub call: &'static str,

    /// Runs the expression on one case's decoded arguments.
    pub run: fn(&[Value]) -> ProbeResult,
}

/// A library or runtime, and its probes for each function.
pub struct Tool {
    /// The probes, keyed by the function name in a case file.
    pub functions: BTreeMap<&'static str, Vec<Probe>>,

    /// The locale its calls run under.
    pub locale: String,

    /// The display name.
    pub name: &'static str,

    /// The table tier.
    pub tier: u8,

    /// The version that actually ran.
    pub version: &'static str,
}

/// A decoded case value, in the closest type Rust has for it.
#[derive(Clone, Debug)]
pub enum Value {
    /// A JSON array.
    Array(Vec<Value>),

    /// A `$bigint` or an integer past `i64`, kept as its digits: Rust has no
    /// arbitrary-size integer.
    BigInt(String),

    /// A JSON boolean.
    Bool(bool),

    /// A number with a fraction or exponent, or a `$number`.
    Float(f64),

    /// A JSON number with neither a fraction nor an exponent.
    Int(i64),

    /// A JSON `null`.
    Null,

    /// A JSON object, or a `$object`.
    Object(BTreeMap<String, Value>),

    /// A JSON string.
    Str(String),

    /// A value Rust has no type for: `undefined` or a `$js` value.
    Unrepresentable,
}

/// Accept any arguments.
pub fn accepts_any(_args: &[Value]) -> bool {
    true
}

/// Report whether a value holds anything Rust can't express.
fn contains_unrepresentable(value: &Value) -> bool {
    match value {
        Value::Unrepresentable => true,
        Value::Array(items) => items.iter().any(contains_unrepresentable),
        Value::Object(entries) => {
            entries.values().any(contains_unrepresentable)
        }
        _ => false,
    }
}

/// Decode a value from the portable format.
///
/// A malformed tag is an `Err`, exactly where `decodeValue` throws.
fn decode(encoded: &Json) -> Result<Value, String> {
    match encoded {
        Json::Null => Ok(Value::Null),
        Json::Bool(flag) => Ok(Value::Bool(*flag)),
        Json::Number(number) => Ok(decode_number(number)),
        Json::String(text) => Ok(Value::Str(text.clone())),
        Json::Array(items) => items
            .iter()
            .map(decode)
            .collect::<Result<_, _>>()
            .map(Value::Array),
        Json::Object(entries) => decode_object(entries),
    }
}

/// Decode every value of an object, keeping its keys.
fn decode_entries(entries: &Map<String, Json>) -> Result<Value, String> {
    entries
        .iter()
        .map(|(key, item)| decode(item).map(|value| (key.clone(), value)))
        .collect::<Result<_, _>>()
        .map(Value::Object)
}

/// Read a JSON number as an `i64` when it has no fraction or exponent, as
/// Python does.
///
/// An integer past `i64` keeps its digits as a `BigInt`, which re-encodes as
/// `$bigint`, as a Python int that large does.
pub fn decode_number(number: &Number) -> Value {
    let digits = number.to_string();

    if digits.contains(['.', 'e', 'E']) {
        return Value::Float(number.as_f64().unwrap_or(f64::NAN));
    }

    match number.as_i64() {
        Some(integer) => Value::Int(integer),
        None => Value::BigInt(digits),
    }
}

/// Decode a plain object, or the one tag it holds.
fn decode_object(entries: &Map<String, Json>) -> Result<Value, String> {
    let Some(tag) = entries.keys().find(|key| key.starts_with('$')) else {
        return decode_entries(entries);
    };

    if entries.len() != 1 {
        return Err(format!("a tag must be an object's only key: {tag}"));
    }

    decode_tag(tag, &entries[tag])
}

/// Decode one tagged object, given its tag and payload.
fn decode_tag(tag: &str, payload: &Json) -> Result<Value, String> {
    match (tag, payload) {
        ("$bigint", Json::String(text)) => {
            let digits = text.strip_prefix('-').unwrap_or(text);

            if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit())
            {
                return Err(format!("not an integer: {text}"));
            }

            Ok(Value::BigInt(text.clone()))
        }
        ("$js", Json::String(_)) | ("$undefined", Json::Bool(true)) => {
            Ok(Value::Unrepresentable)
        }
        ("$number", Json::String(text)) => match text.as_str() {
            "-0" => Ok(Value::Float(-0.0)),
            "-Infinity" => Ok(Value::Float(f64::NEG_INFINITY)),
            "Infinity" => Ok(Value::Float(f64::INFINITY)),
            "NaN" => Ok(Value::Float(f64::NAN)),
            _ => Err(format!("not a special number: {text}")),
        },
        ("$object", Json::Object(entries)) => decode_entries(entries),
        _ => Err(format!("unknown tag or bad payload: {tag}")),
    }
}

/// Encode a value into the portable format.
fn encode(value: &Value) -> Json {
    match value {
        Value::Array(items) => Json::Array(items.iter().map(encode).collect()),
        Value::BigInt(digits) => json!({ "$bigint": digits }),
        Value::Bool(flag) => Json::Bool(*flag),
        Value::Float(number) => encode_float(*number),
        Value::Int(integer) => encode_int(*integer),
        Value::Null => Json::Null,
        Value::Object(entries) => encode_entries(entries),
        Value::Str(text) => Json::String(text.clone()),
        Value::Unrepresentable => json!({ "$repr": "unrepresentable" }),
    }
}

/// Encode a map, wrapped in `$object` when a key could pass for a tag.
fn encode_entries(entries: &BTreeMap<String, Value>) -> Json {
    let encoded: Map<String, Json> = entries
        .iter()
        .map(|(key, item)| (key.clone(), encode(item)))
        .collect();

    if encoded.keys().any(|key| key.starts_with('$')) {
        return json!({ "$object": encoded });
    }

    Json::Object(encoded)
}

/// Encode a float, tagging the values JSON can't hold.
fn encode_float(number: f64) -> Json {
    if number.is_nan() {
        return json!({ "$number": "NaN" });
    }

    if number.is_infinite() {
        let sign = if number > 0.0 {
            "Infinity"
        } else {
            "-Infinity"
        };

        return json!({ "$number": sign });
    }

    if number == 0.0 && number.is_sign_negative() {
        return json!({ "$number": "-0" });
    }

    json!(number)
}

/// Encode an int, as a bigint once a JavaScript number would lose it.
fn encode_int(integer: i64) -> Json {
    if integer.unsigned_abs() > MAX_SAFE_INTEGER.unsigned_abs() {
        return json!({ "$bigint": integer.to_string() });
    }

    json!(integer)
}

/// Stop the run with a message on stderr, as an uncaught error would.
fn fail(message: &str) -> ! {
    eprintln!("{message}");
    process::exit(1);
}

/// Read and parse one case file into its function name and encoded cases.
fn read_case_file(path: &str) -> (String, Vec<Vec<Json>>) {
    let text = fs::read_to_string(path)
        .unwrap_or_else(|error| fail(&format!("{path}: {error}")));
    let parsed: Json = serde_json::from_str(&text)
        .unwrap_or_else(|_| fail(&format!("{path} isn't valid JSON")));
    let function = parsed["function"].as_str().unwrap_or_default();
    let cases = parsed["cases"]
        .as_array()
        .map(|cases| {
            cases
                .iter()
                .map(|case| {
                    case["args"].as_array().cloned().unwrap_or_default()
                })
                .collect()
        })
        .unwrap_or_default();

    (function.to_owned(), cases)
}

/// Run the case files named on the command line and print the columns.
pub fn run_adapter(tools: &[Tool]) {
    let columns: Vec<Json> = env::args()
        .skip(1)
        .flat_map(|path| run_case_file(&path, tools))
        .collect();
    let output = json!({ "columns": columns });

    // Every outcome is already encoded, so only a closed stdout can fail.
    if writeln!(io::stdout(), "{output}").is_err() {
        fail("couldn't write the columns to stdout");
    }
}

/// Run every tool's probes over one case file.
fn run_case_file(path: &str, tools: &[Tool]) -> Vec<Json> {
    let (function, cases) = read_case_file(path);

    tools
        .iter()
        .flat_map(|tool| {
            let probes = tool.functions.get(function.as_str());

            probes.into_iter().flatten().map(|probe| {
                let outcomes: Vec<Json> = cases
                    .iter()
                    .map(|args| {
                        run_probe(args, probe).unwrap_or_else(|error| {
                            fail(&format!("{path}: {error}"))
                        })
                    })
                    .collect();

                json!({
                    "call": probe.call,
                    "function": function,
                    "locale": tool.locale,
                    "name": tool.name,
                    "outcomes": outcomes,
                    "tier": tool.tier,
                    "version": tool.version,
                })
            })
        })
        .collect()
}

/// Run one probe on one case's encoded arguments.
fn run_probe(args: &[Json], probe: &Probe) -> Result<Json, String> {
    let decoded = args.iter().map(decode).collect::<Result<Vec<_>, _>>()?;

    if decoded.iter().any(contains_unrepresentable)
        || !(probe.accepts)(&decoded)
    {
        return Ok(json!({ "kind": "n/a" }));
    }

    Ok(match (probe.run)(&decoded) {
        Ok(value) => json!({ "kind": "value", "value": encode(&value) }),
        Err(name) => json!({ "error": name, "kind": "error" }),
    })
}
