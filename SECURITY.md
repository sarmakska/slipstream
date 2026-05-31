# Security policy

I take the security of slipstream seriously and I appreciate every responsible
disclosure.

## Reporting a vulnerability

Please email me at security@sarmalinux.com with a description of the issue, the
steps to reproduce it, and the impact you believe it has. Do not open a public
issue for a security problem.

I commit to acknowledging your report within 7 days. After that I will keep you
updated on my assessment and the fix timeline, and I will credit you in the
release notes once a fix ships, unless you would rather stay anonymous.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | yes       |
| < 0.1   | no        |

## Scope

slipstream runs shell commands that you or your skills define, including
verification gates. Treat the commands in a skill as code you are about to run.
Review any skill from a third party before you load it, the same way you would
review a dependency.
