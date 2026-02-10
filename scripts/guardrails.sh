#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"
ALLOWLIST_FILE="$ROOT_DIR/scripts/guardrails-allowlist.txt"
PRIORITY_LIST_FILE="$ROOT_DIR/documentation/PRIORITY_LIST.md"

PATTERN='(from\s+"openai"|from\s+"@google/genai"|import\(\s*"openai"\s*\)|import\(\s*"@google/genai"\s*\)|new\s+OpenAI\b|new\s+GoogleGenAI\b|chat\.completions\.create|responses\.create|models\.generateContent\(|models\.embedContent\(|embeddings\.create\(|generateContent\()'

LEGACY_SECTION_HEADER="CRITICAL: Direct LLM calls bypass hardened executor"

TRACKED_SOURCE_FILES=""
TRACKED_SOURCE_FILES_TXT=""
TRACKED_ALL_FILES=""
TRACKED_ALL_FILES_TXT=""

cleanup() {
  [[ -n "$TRACKED_SOURCE_FILES" ]] && rm -f "$TRACKED_SOURCE_FILES" || true
  [[ -n "$TRACKED_SOURCE_FILES_TXT" ]] && rm -f "$TRACKED_SOURCE_FILES_TXT" || true
  [[ -n "$TRACKED_ALL_FILES" ]] && rm -f "$TRACKED_ALL_FILES" || true
  [[ -n "$TRACKED_ALL_FILES_TXT" ]] && rm -f "$TRACKED_ALL_FILES_TXT" || true
}

trap cleanup EXIT

TRACKED_SOURCE_FILES="$(mktemp)"
TRACKED_SOURCE_FILES_TXT="$(mktemp)"
TRACKED_ALL_FILES="$(mktemp)"
TRACKED_ALL_FILES_TXT="$(mktemp)"

git -C "$ROOT_DIR" ls-files -z -- '*.ts' '*.tsx' '*.js' '*.mjs' '*.cjs' > "$TRACKED_SOURCE_FILES"
git -C "$ROOT_DIR" ls-files -- '*.ts' '*.tsx' '*.js' '*.mjs' '*.cjs' > "$TRACKED_SOURCE_FILES_TXT"
git -C "$ROOT_DIR" ls-files -z > "$TRACKED_ALL_FILES"
git -C "$ROOT_DIR" ls-files > "$TRACKED_ALL_FILES_TXT"

collect_matches() {
  if command -v rg >/dev/null 2>&1; then
    xargs -0 -r rg -n --no-messages -e "$PATTERN" < "$TRACKED_SOURCE_FILES" || true
  else
    xargs -r grep -nE "$PATTERN" < "$TRACKED_SOURCE_FILES_TXT" || true
  fi
}

load_legacy_llm_files() {
  local legacy=()
  if [[ -f "$PRIORITY_LIST_FILE" ]]; then
    local in_section=0
    while IFS= read -r line; do
      if [[ "$line" == "## $LEGACY_SECTION_HEADER" ]]; then
        in_section=1
        continue
      fi
      if [[ $in_section -eq 1 && "$line" == "## "* ]]; then
        break
      fi
      if [[ $in_section -eq 1 && "$line" == -* ]]; then
        local extracted
        extracted=$(printf '%s' "$line" | sed -n 's/.*`\\([^`]*\\)`.*/\\1/p')
        if [[ -n "$extracted" ]]; then
          legacy+=("$extracted")
        fi
      fi
    done < "$PRIORITY_LIST_FILE"
  fi
  printf '%s\n' "${legacy[@]}"
}

is_allowlisted() {
  local file="$1"

  if [[ "$file" == server/ai/* ]]; then
    return 0
  fi

  if [[ "$file" == server/* && -f "$PRIORITY_LIST_FILE" ]]; then
    if grep -Fq "\`$file\`" "$PRIORITY_LIST_FILE"; then
      LEGACY_MATCHES+=("$file")
      return 0
    fi
  fi

  if [[ ${#LEGACY_SERVER_LLM_FILES[@]} -gt 0 ]]; then
    for legacy in "${LEGACY_SERVER_LLM_FILES[@]}"; do
      if [[ "$file" == "$legacy" ]]; then
        LEGACY_MATCHES+=("$file")
        return 0
      fi
    done
  fi

  if [[ -f "$ALLOWLIST_FILE" ]]; then
    while IFS= read -r entry; do
      [[ -z "$entry" ]] && continue
      [[ "$entry" =~ ^# ]] && continue
      if [[ "$file" == "$entry" ]]; then
        return 0
      fi
    done < "$ALLOWLIST_FILE"
  fi

  return 1
}

validate_allowlist() {
  if [[ -f "$ALLOWLIST_FILE" ]]; then
    while IFS= read -r entry; do
      [[ -z "$entry" ]] && continue
      [[ "$entry" =~ ^# ]] && continue
      if [[ "$entry" == server/* ]]; then
        echo "Guardrails error: server/** not allowed in allowlist: $entry"
        exit 1
      fi
      if [[ "$entry" != docs/* && "$entry" != tests/* && "$entry" != scripts/* ]]; then
        echo "Guardrails error: allowlist entry must be under docs/, tests/, or scripts/: $entry"
        exit 1
      fi
    done < "$ALLOWLIST_FILE"
  fi
}

scan_secrets() {
  local failed=0
  local patterns=(
    "PRIVATE_KEY:BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY"
    "JWT_SECRET:JWT_SECRET\\s*[:=]\\s*[A-Za-z0-9_\\-\\.=+/]{32,}"
    "BEARER_TOKEN:Bearer\\s+[A-Za-z0-9\\-_=\\.]{20,}"
    "API_KEY:sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\\-_]{20,}"
  )

  for pattern in "${patterns[@]}"; do
    local label="${pattern%%:*}"
    local regex="${pattern#*:}"
    local matches=""

    if command -v rg >/dev/null 2>&1; then
      matches=$(xargs -0 -r rg -n --no-messages -e "$regex" < "$TRACKED_ALL_FILES" || true)
    else
      matches=$(xargs -r grep -nE "$regex" < "$TRACKED_ALL_FILES_TXT" || true)
    fi

    if [[ -n "$matches" ]]; then
      echo "Guardrails secret scan match ($label):"
      printf '%s\n' "$matches"
      failed=1
    fi
  done

  if [[ $failed -eq 1 ]]; then
    echo "Guardrails failed: potential secrets detected in tracked files."
    exit 1
  fi
}

validate_allowlist

LEGACY_SERVER_LLM_FILES=()
LEGACY_MATCHES=()
while IFS= read -r legacy_file; do
  [[ -z "$legacy_file" ]] && continue
  LEGACY_SERVER_LLM_FILES+=("$legacy_file")
done < <(load_legacy_llm_files)

violations=()
while IFS= read -r match; do
  [[ -z "$match" ]] && continue
  file="${match%%:*}"
  if ! is_allowlisted "$file"; then
    violations+=("$match")
  fi
done < <(collect_matches)

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "Guardrails failed: direct model/LLM calls found outside server/ai (or allowlist)."
  printf '%s\n' "${violations[@]}"
  exit 1
fi

if [[ ${#LEGACY_MATCHES[@]} -gt 0 ]]; then
  echo "Guardrails warning: legacy direct LLM calls are allowed only while tracked in documentation/PRIORITY_LIST.md."
  printf '%s\n' "${LEGACY_MATCHES[@]}"
fi

scan_secrets

echo "Guardrails passed: no unauthorized direct model/LLM calls found and no secrets detected."
