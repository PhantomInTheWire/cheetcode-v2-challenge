---
name: chromium-question-writer
description: Creates Chromium internals trivia questions from source code. Trigger when the user wants to create browser internals quiz questions, source-code-diving challenges, or Chromium trivia. The questions are designed to be ungrepable and require deep multi-subsystem understanding to answer.
license: MIT
metadata:
  author: cheetcode
  version: "1.0.0"
---

# Chromium Question Writer

Creates ungrepable trivia questions from Chromium source. Each question describes a user-visible scenario in plain language; the answer is an exact internal token (enum, constant, error code) buried 5+ layers deep.

**Source:** `/Users/ghost/chromium/src`
**Output:** `data/level2-questions.json`

```json
{
  "id": "l2_<next>",
  "question": "...",
  "answer": "exact token",
  "acceptableAnswers": ["exact token", "numeric_value", "variant"]
}
```

## Core Principle

Question describes the TOP of a call stack. Answer lives at the BOTTOM. Solver must traverse 5+ files across 5+ subsystem directories.

```
User-visible action (plain language)
  → blink / UI layer
    → IPC boundary (content/browser/)
      → Chrome feature (chrome/browser/<feature>/)
        → Shared component (components/)
          → THE ANSWER: enum/error/status at the deepest layer
```

## Process

### 1. Find the Answer (Bottom-Up)

Start from deep layers (`components/`, `services/`, `base/`, `chrome/updater/`, `chrome/browser/enterprise/`). Find an **enum value or constant** on an edge-case/failure path with a specific, non-obvious name.

### 2. Trace the Call Chain Upward

Find 5+ files from 5+ different directory prefixes leading from user action to the answer. Document path, line, and role for each.

### 3. Write the Question (Top-Down)

Describe the scenario from the user's perspective following the obfuscation rules below.

### 4. Verify Ungrepability (MANDATORY — see checklist)

### 5. Verify Depth

Confirm 5+ files from 5+ subsystem directories. If shorter, pick a different answer.

## Obfuscation Rules

**Never name any Web API, code symbol, function, class, enum, file, or module.**

**Describe all concepts using physical/real-world language:**

| Internal Term              | Use Instead                                |
| -------------------------- | ------------------------------------------ |
| clipboard                  | system buffer                              |
| IndexedDB                  | local database                             |
| service worker             | background helper process                  |
| gamepad                    | physical game controller                   |
| Safe Browsing              | safety database                            |
| enterprise policy          | organizational security rules              |
| DLP                        | data governance rules                      |
| content analysis connector | remote content inspection service          |
| interstitial               | warning barrier page                       |
| CRX                        | signed software package                    |
| Chrome updater             | software self-renewal mechanism            |
| group policy / GPO         | machine administrative configuration       |
| DM server                  | central device management server           |
| DM token                   | enrollment credentials                     |
| policy merge               | configuration rule precedence resolution   |
| cloud policy fetch         | administrative settings distribution       |
| device attestation         | hardware integrity proof                   |
| device trust signals       | security posture signals                   |
| watermark                  | visible ownership marking overlay          |
| Bluetooth                  | short-range wireless radio                 |
| iframe                     | embedded interactive frame                 |
| metered connection         | bandwidth-metered network                  |
| WebRTC                     | real-time media channel                    |
| certificate                | cryptographic credential                   |
| signing key rotation       | signing authority credential rotation      |
| policy validation          | configuration payload integrity check      |
| Secure Enclave             | tamper-resistant hardware key vault        |
| Keystone                   | legacy software update framework           |
| launchd / launch agent     | system's background job scheduler          |
| XPC / privileged helper    | elevated-privilege installation assistant  |
| MDM profile                | fleet-administered configuration profile   |
| Touch ID / LAContext       | device's biometric verification prompt     |
| Keychain                   | operating system's credential vault        |
| AVFoundation               | system's video acquisition subsystem       |
| NSUserDefaults             | application's persistent settings store    |
| SSO / Entra ID             | organization's federated identity provider |
| Keystone ticket            | legacy update registration record          |

**Stack multiple narrowing conditions** to force state-machine understanding — don't ask "what error on failure?", describe the exact scenario with 2-3 intersecting conditions.

**Avoid words that appear in source comments** near the answer.

## Hotspot Areas

### Enterprise

- `chrome/browser/enterprise/data_controls/` — DLP clipboard/paste/print
- `chrome/browser/enterprise/connectors/analysis/` — content scanning
- `chrome/browser/enterprise/connectors/device_trust/` — device attestation
- `chrome/browser/enterprise/data_protection/` — URL-based protection
- `chrome/browser/enterprise/reporting/` — event reporting
- `chrome/browser/enterprise/watermark/` — watermarking
- `chrome/browser/enterprise/platform_auth/` — SSO/Entra, URL session auth

### Policy

- `components/policy/core/common/cloud/` — cloud policy fetch/validate/store
- `components/policy/core/common/` — merge, schema validation
- `components/policy/proto/` — wire format

### Updater

- `chrome/updater/` — update checking, blocking, installation
- `components/update_client/` — protocol, states, errors

### Device Trust

- `components/enterprise/device_trust/` — attestation flow, key management
- `components/enterprise/device_attestation/` — attestation primitives

### macOS Objective-C (\*.mm) — bottom-of-stack platform edge cases

- `chrome/browser/enterprise/connectors/device_trust/key_management/core/mac/` — Secure Enclave ops
- `chrome/browser/enterprise/signals/device_info_fetcher_mac.mm` — device signals
- `chrome/updater/mac/setup/` — Keystone migration, wake tasks, launchd
- `chrome/updater/mac/keystone/` — legacy ksadmin/ksinstall compat
- `chrome/updater/mac/privileged_helper/` — XPC helper, authorization
- `chrome/updater/policy/mac/` — managed preferences
- `device/fido/mac/` — Touch ID, Secure Enclave FIDO
- `media/capture/video/apple/` — AVFoundation capture edge cases

## Output Format

```
QUESTION: [plain language scenario, zero code symbols]
ANSWER: [exact token]
CHAIN:
  File 1: [path:line] — [role]
  File 2: [path:line] — [role]
  File 3: [path:line] — [role]
  File 4: [path:line] — [role]
  File 5: [path:line] — [role]
GREP_CHECK: [all phrases checked, results]
```

## Quality Checklist

- [ ] Answer is a real, verified token in the Chromium source
- [ ] Zero code symbols in the question
- [ ] All concepts in physical/real-world language
- [ ] Chain spans 5+ files from 5+ directory prefixes
- [ ] Answer is unambiguous — one correct token
- [ ] Edge-case scenario, not happy path
- [ ] Reads as natural English

### Ungrepability Verification (MANDATORY)

A question solvable by grepping is a failed question.

1. Extract every **noun phrase**, **verb phrase**, and **adjective-noun pair** from the question
2. Grep each against `/Users/ghost/chromium/src/ --include="*.cc" --include="*.h" --include="*.mm"`
3. If ANY phrase hits within 50 lines of the answer → **rewrite**
4. Also grep **obvious single-word synonyms** a solver might try
5. Also grep **partial sub-phrases** (e.g., for "configuration delivery payload" also check "delivery payload")
6. Document all checked phrases in GREP_CHECK
