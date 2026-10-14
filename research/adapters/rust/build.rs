//! Records the compiler's version, so every column names the Rust that ran.

use std::env;
use std::process::Command;

fn main() {
    let rustc = env::var("RUSTC").unwrap_or_else(|_| String::from("rustc"));
    let output = Command::new(rustc)
        .arg("--version")
        .output()
        .expect("rustc --version runs");
    let version = String::from_utf8(output.stdout).expect("UTF-8 output");

    // `rustc 1.99.0 (abc123 2026-09-25)` → `1.99.0`.
    let number = version.split_whitespace().nth(1).unwrap_or("unknown");

    println!("cargo:rustc-env=RUSTC_VERSION={number}");
    println!("cargo:rerun-if-env-changed=RUSTC");
}
