# Security

## Status

CLOISTRA is an unaudited demonstration. Do not use it to custody real value. The contracts enforce their confidential policy homomorphically on the FHEVM; the usual smart-contract risk still applies, and the FHE trust model additionally depends on the FHEVM host, ACL, relayer, and threshold-KMS infrastructure of the target network.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through a draft GitHub security advisory on this repository (Security → Advisories → New draft advisory) rather than a public issue, and allow reasonable time for analysis and a fix before disclosure.

Issues in the underlying FHEVM stack itself (`@fhevm/solidity`, the relayer, the KMS) should be reported upstream to [Zama's disclosure process](https://github.com/zama-ai/fhevm/security).

## Operational Notes

- Private keys and payout-provider credentials are server-side only; nothing secret ships to the frontend.
- The off-ramp listener must run outside the browser and pays out only after an authorized officer user-decryption confirms `moved > 0`.
- Decrypt rights are governed exclusively by on-chain ACL grants; no role can read a sealed value it was not granted.
