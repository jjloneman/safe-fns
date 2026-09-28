# 🔒 Security policy

## 🎯 Supported versions

safe-fns is pre-stable (`0.x`), so only the latest release gets security fixes.

## 📣 Reporting a vulnerability

**Please don't open a public issue for a security problem.** Report it privately instead:

1. Go to the repo's [Security tab](https://github.com/jjloneman/safe-fns/security).
2. Choose **Report a vulnerability**.
3. Describe the problem, and include a proof of concept if you have one.

- Only the maintainer can see the report.
- You'll get a reply once it has been triaged.
- Once a fix is released, the advisory is published and you're credited, unless you'd rather not be.

## 🧭 What counts

- A function that throws, hangs, or leaks data on some input counts. Every export promises to be total.
- A problem in a dev dependency that never ships in the package does not. Report it upstream instead.
  - The package has no runtime dependencies.
