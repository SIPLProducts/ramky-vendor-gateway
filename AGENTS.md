# Project Architecture Rules

- Keep `vendors.credit_period_expected` as a deprecated legacy column; active application flows must not read or write it, preserving historical data without destructive migrations.
- Enforce Material Group for Vendors in both user interfaces and server-side buyer approval functions; Vendor Category remains optional.
- Use the shared checked function-invocation helper for server-side email calls so nested failures retain their safe response message.