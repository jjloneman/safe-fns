//! The Rust adapter: runs each case file through the standard library.
//!
//! Usage: `research-adapter <case-file>...`, the `rust` Compose service.
//!
//! - A case decodes into the closest Rust type (`codec::Value`); a call that
//!   can't take that type reports `n/a` rather than converting it first.
//!
//! - `str::parse` is locale-independent, so every column reports the
//!   container's `LC_ALL` rather than a culture the call never consults.

mod codec;

use std::collections::BTreeMap;
use std::env;

use codec::{Probe, Tool, Value, accepts_any, run_adapter};

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

/// Accept a map first argument and a string second argument.
fn is_map_and_string(args: &[Value]) -> bool {
    matches!((&args[0], &args[1]), (Value::Object(_), Value::Str(_)))
}

/// Accept only a string first argument.
fn is_string(args: &[Value]) -> bool {
    matches!(args[0], Value::Str(_))
}

/// The first argument's text; only called after `is_string` accepted it.
fn text(args: &[Value]) -> &str {
    match &args[0] {
        Value::Str(text) => text,
        _ => unreachable!("is_string accepted a non-string"),
    }
}

/// List the probes the Rust standard library offers.
fn tools() -> Vec<Tool> {
    let functions = BTreeMap::from([
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
            "safeParseInteger",
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

    vec![Tool {
        functions,
        locale: env::var("LC_ALL").unwrap_or_default(),
        name: "Rust",
        tier: 2,
        version: VERSION,
    }]
}

/// Run the case files named on the command line.
fn main() {
    run_adapter(&tools());
}
