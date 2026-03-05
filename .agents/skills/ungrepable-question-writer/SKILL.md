---
name: ungrepable-question-writer
description: "Creates extremely difficult, ungrepable source-code trivia questions from any large codebase. Use this skill whenever the user wants to generate source-code-diving challenges, internal trivia questions, or quiz content where the answer is a specific code token (enum, constant, error code) that cannot be found by grepping the question text. Works with any codebase \u2014 Chromium, Linux kernel, LLVM, Android, etc. Also trigger when the user says things like 'create questions', 'make trivia', 'source code quiz', 'code challenge', or 'ungrepable'."
license: MIT
metadata:
  author: cheetcode
  version: "2.0.0"
---

# Ungrepable Question Writer

Creates trivia questions from large codebases where the answer is an exact internal token (enum value, constant, error code) buried deep in the call stack, and **no phrase in the question text can lead a solver to the answer via grep**.

This skill is codebase-agnostic. Before writing questions, you need a **project configuration** that specifies the source path, output file, synonym table, hotspot areas, and file extensions. See `references/` for example configs (e.g., `references/chromium-config.md`).

## Setup: Project Configuration

Before generating questions, either load an existing config from `references/` or create one with the user. A config specifies:

```markdown
## Project: <Name>

Source: <absolute path to source root>
Output: <path to questions JSON file>
Extensions: <file extensions to search, e.g., _.cc, _.h, _.mm, _.py, \*.rs>
ID Prefix: <question ID prefix, e.g., "l2\_">

### Architecture Layers

<Describe the project's layer cake from user-facing down to internals.
The question describes the top; the answer lives at the bottom.>

### Synonym Table

| Internal Term | Use Instead |
| ------------- | ----------- |
| ...           | ...         |

### Hotspot Areas

<List directories/modules where interesting enums, constants, and
error codes live on edge-case paths.>
```

If the user names a project that has a config in `references/`, load it. Otherwise, help them create one by exploring their codebase's directory structure, identifying the architecture layers, and building a synonym table from domain-specific jargon found in the code.

## Core Principle

The question describes a **user-visible scenario at the top of a call stack**. The answer is an **exact code token at the bottom**, separated by 5+ files across 5+ distinct directory prefixes. The solver must understand how multiple subsystems connect to traverse from question to answer. Grepping any phrase from the question must not land within 50 lines of the answer.

```
User-visible action (described in plain/physical language)
  -> Interface / API layer
    -> IPC / boundary layer
      -> Feature / domain logic
        -> Shared library / platform primitive
          -> THE ANSWER: enum value, error code, or constant
```

## Process

### 1. Find the Answer (Bottom-Up)

Start from the deepest layers of the project (shared libraries, platform code, service layers). Find an **enum value or constant** that:

- Lives on an **edge-case or failure path** (not the happy path)
- Has a **specific, non-obvious name** (not generic like `kError` or `FAILURE`)
- Is **unambiguous** -- only one correct token answers the question

Use the project's hotspot areas to focus the search. Read `.h` / header / definition files for enum declarations, then trace which values appear in rare conditional branches.

### 2. Trace the Call Chain Upward

Starting from the answer token, find the chain of callers leading up to a user-visible action. The chain must span:

- **5+ files** from **5+ different directory prefixes** (e.g., `net/cert/`, `chrome/browser/ssl/`, `content/browser/`, `third_party/blink/renderer/`, `services/network/`)
- Each link should cross a meaningful boundary (IPC, abstraction layer, subsystem)

Document each file: path, line number, and role in the chain.

### 3. Write the Question (Top-Down)

Describe the scenario from the user's/operator's perspective. Follow these obfuscation rules strictly:

**Rule 1: Zero code symbols.** Never name any API, function, class, enum, file, module, or code identifier in the question text.

**Rule 2: Physical/real-world language only.** Replace every domain-specific or technical term with a plain-language synonym from the project's synonym table. If a term isn't in the table, invent a physical/real-world metaphor and add it to the table for future use.

**Rule 3: Stack narrowing conditions.** Don't ask "what error on failure?" -- describe the exact scenario with 2-3 intersecting conditions that force state-machine understanding. Each condition should eliminate a different set of candidate answers.

**Rule 4: Avoid source-adjacent language.** Don't use words that appear in source code comments near the answer. Paraphrase concepts so no substring of the question matches nearby comment text.

**Rule 5: Describe behavior, not implementation.** Talk about what the user sees or what happens, not how the code is structured internally.

### 4. Verify Ungrepability (MANDATORY)

A question solvable by grepping is a **failed question**. This step is non-negotiable.

1. Extract every **noun phrase**, **verb phrase**, and **adjective-noun pair** from the question
2. Grep each against the project source using the configured file extensions
3. If ANY phrase hits within 50 lines of the answer -> **rewrite that part of the question**
4. Also grep **obvious single-word synonyms** a solver might try
5. Also grep **partial sub-phrases** (e.g., for "configuration delivery payload" also check "delivery payload")
6. Document all checked phrases in GREP_CHECK

### 5. Verify Depth

Confirm the chain spans 5+ files from 5+ subsystem directories. If shorter, pick a different answer.

### 6. Verify Answer Exists

Grep the exact answer token in the source to confirm it's real and current. Record the file and line.

## Parallelization Strategy

When creating multiple questions, launch one sub-agent per question. Each agent:

- Targets a **different hotspot area** (no two agents explore the same subsystem)
- Owns its question end-to-end: answer discovery -> chain tracing -> question writing -> grep verification
- Returns results in the output format below

This prevents duplicates and maximizes coverage across the codebase.

## Output Format

Each question must be returned in this exact format:

```
QUESTION_ID: <id_prefix><number>
QUESTION: [plain language scenario, zero code symbols]
ANSWER: [exact token as it appears in source]
ACCEPTABLE_ANSWERS: [comma-separated: exact token, numeric value if applicable, common variants]
CHAIN:
  File 1: [path:line] -- [role in the chain]
  File 2: [path:line] -- [role]
  File 3: [path:line] -- [role]
  File 4: [path:line] -- [role]
  File 5: [path:line] -- [role]
GREP_CHECK: [all phrases checked, results]
```

The final JSON entry for storage:

```json
{
  "id": "<id_prefix><number>",
  "question": "...",
  "answer": "exact token",
  "acceptableAnswers": ["exact token", "numeric_value", "variant"]
}
```

## Quality Checklist

Every question must pass ALL of these:

- [ ] Answer is a real, verified token in the project source
- [ ] Zero code symbols in the question text
- [ ] All concepts expressed in physical/real-world language
- [ ] Chain spans 5+ files from 5+ directory prefixes
- [ ] Answer is unambiguous -- exactly one correct token
- [ ] Scenario is an edge case, not the happy path
- [ ] Reads as natural English (not stilted or robotic)
- [ ] Ungrepability verified: no question phrase hits within 50 lines of the answer
- [ ] All grep-checked phrases documented

## Building a New Synonym Table

When setting up a new project, build the synonym table by:

1. **Scan header files** in the hotspot areas for enum names, class names, and API names
2. **Identify jargon** -- any term a developer would recognize but a non-developer wouldn't
3. **Map each to a physical metaphor** -- think: what is this thing _like_ in the real world?
4. **Test the mapping** -- could someone reconstruct the original term from the synonym? If yes, the synonym is too close. Make it more oblique.

Good synonyms are **conceptually accurate but lexically distant**. "System buffer" for "clipboard" works because it's what a clipboard _is_, but the words share zero overlap. "Copy storage" would be too close -- "copy" appears in clipboard-related code everywhere.
