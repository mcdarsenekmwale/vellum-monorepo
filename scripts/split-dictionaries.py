#!/usr/bin/env python3
"""Split the monolithic web-app dictionaries.ts into per-locale files.

Reads:  apps/web-app/src/lib/i18n/dictionaries.ts
Writes: packages/shared-i18n/dictionaries/base.<lang>.ts  (one per locale)
        packages/shared-i18n/dictionaries/index.ts        (barrel export)

For the EN dictionary the new namespaces (navigation, home, discover, compose,
profile, emptyStates) are populated with real English values. For every other
locale the same namespaces are added but every value is replaced with a
`__TODO_<LANG>_<key>` marker so missing translations are obvious at runtime.
"""

import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(
    REPO_ROOT, "apps", "web-app", "src", "lib", "i18n", "dictionaries.ts"
)
OUT_DIR = os.path.join(REPO_ROOT, "packages", "shared-i18n", "dictionaries")

# Locale order matches the existing DICTIONARIES registry and the LocaleTag union.
LOCALES = [
    "en", "fr", "es", "de", "it", "pt", "nl", "sv", "da",
    "fi", "no", "pl", "cs", "hu", "ro", "bg", "uk", "el",
    "ar", "he", "fa", "tr", "hi", "id", "ms", "th", "zh",
    "ja", "ko", "vi", "ru",
]

# New namespaces to append to every dictionary. Keys are authoritative; the EN
# values are the canonical source strings. Interpolation tokens like
# {{count}} / {{date}} are preserved verbatim.
NEW_NAMESPACES = {
    "navigation": {
        "home": "Home",
        "discover": "Discover",
        "compose": "Compose",
        "notifications": "Notifications",
        "profile": "Profile",
        "settings": "Settings",
        "back": "Back",
        "search": "Search",
        "saved": "Saved",
        "highlights": "Highlights",
    },
    "home": {
        "forYou": "For you",
        "trending": "Trending",
        "latest": "Latest",
        "articlesFound": "{{count}} articles found",
        "readMore": "Read more",
        "continueReading": "Continue reading",
        "featuredAuthor": "Featured author",
        "exploreCategories": "Explore categories",
        "noArticles": "No articles",
        "startExploring": "Start exploring",
        "suggestedAuthors": "Suggested authors",
        "followAll": "Follow all",
    },
    "discover": {
        "title": "Discover",
        "searchPlaceholder": "Search articles, authors, topics\u2026",
        "categories": "Categories",
        "popular": "Popular",
        "newAuthors": "New authors",
        "trendingTopics": "Trending topics",
        "noResults": "No results",
        "tryDifferentSearch": "Try a different search",
        "browseAll": "Browse all",
    },
    "compose": {
        "title": "Compose",
        "newArticle": "New article",
        "bodyPlaceholder": "Start writing your story\u2026",
        "publish": "Publish",
        "saveDraft": "Save draft",
        "preview": "Preview",
        "addCover": "Add cover",
        "addTags": "Add tags",
        "selectCategory": "Select category",
        "wordCount": "{{count}} words",
        "minWords": "Minimum words",
        "titlePlaceholder": "Title",
        "publishedSuccess": "Published successfully",
        "draftSaved": "Draft saved",
        "publishError": "Failed to publish",
    },
    "profile": {
        "articles": "Articles",
        "followers": "Followers",
        "following": "Following",
        "reading": "Reading",
        "likes": "Likes",
        "replies": "Replies",
        "editProfile": "Edit profile",
        "follow": "Follow",
        "unfollow": "Unfollow",
        "bio": "Bio",
        "bioPlaceholder": "Tell us about yourself\u2026",
        "joinDate": "Joined {{date}}",
        "viewProfile": "View profile",
        "noArticles": "No articles",
        "noHighlights": "No highlights",
    },
    "emptyStates": {
        "noArticles": "No articles yet",
        "noNotifications": "No notifications",
        "noResults": "No results",
        "nothingHere": "Nothing here yet",
        "startWriting": "Start writing",
        "signInToContinue": "Sign in to continue",
        "signInToComment": "Sign in to comment",
        "pleaseTryAgain": "Please try again",
        "noItems": "No items",
        "addSomething": "Add something",
        "noSavedArticles": "No saved articles",
        "noFollowers": "No followers",
        "noFollowing": "No following",
    },
}

# Matches `const EN_DICT: NamespaceDict = {` and `export const EN_DICT: ... = {`.
# Group 1 = optional "export" keyword, Group 2 = uppercase lang code (e.g. "EN").
DICT_RE = re.compile(
    r"(?:export\s+)?const\s+([A-Z]+)_DICT\s*:\s*NamespaceDict\s*=\s*\{"
)


def find_dict_end(content, open_brace_idx):
    """Return index of the `}` that closes the dict opened at open_brace_idx.

    Walks the string tracking brace depth while skipping TS string literals
    (single/double/template) and // and /* */ comments, so braces inside
    interpolation tokens like "{{count}}" or within string values do not break
    matching.
    """
    depth = 0
    i = open_brace_idx
    n = len(content)
    while i < n:
        c = content[i]
        # Line comment
        if c == "/" and i + 1 < n and content[i + 1] == "/":
            while i < n and content[i] != "\n":
                i += 1
            continue
        # Block comment
        if c == "/" and i + 1 < n and content[i + 1] == "*":
            i += 2
            while i + 1 < n and not (content[i] == "*" and content[i + 1] == "/"):
                i += 1
            i += 2
            continue
        # String literals (single, double, template)
        if c in ('"', "'", "`"):
            quote = c
            i += 1
            while i < n:
                ch = content[i]
                if ch == "\\":
                    i += 2
                    continue
                if ch == quote:
                    i += 1
                    break
                i += 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise RuntimeError("Unbalanced braces while scanning dictionary body")


def format_value(value):
    """Escape and double-quote a string for emission as a TS string literal."""
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return '"' + escaped + '"'


def format_namespace(ns_name, kv, lang_code):
    """Format one namespace block as TS source."""
    upper = lang_code.upper()
    lines = ["  " + ns_name + ": {"]
    for key, value in kv.items():
        if lang_code == "en":
            val_str = format_value(value)
        else:
            val_str = format_value("__TODO_" + upper + "_" + key)
        lines.append("    " + key + ": " + val_str + ",")
    lines.append("  },")
    return "\n".join(lines)


def parse_dicts(content):
    """Return list of (lang_code, const_name, body) tuples in source order."""
    entries = []
    for m in DICT_RE.finditer(content):
        const_name = m.group(1)  # e.g. "EN"
        lang_code = const_name.lower()
        open_brace_idx = m.end() - 1  # index of the `{`
        close_brace_idx = find_dict_end(content, open_brace_idx)
        body = content[open_brace_idx + 1 : close_brace_idx]
        entries.append((lang_code, const_name, body))
    return entries


def write_dict_file(lang_code, const_name, body):
    """Write one base.<lang>.ts file."""
    ns_blocks = []
    for ns_name, kv in NEW_NAMESPACES.items():
        ns_blocks.append(format_namespace(ns_name, kv, lang_code))
    new_block = "\n".join(ns_blocks)

    # Body already ends with a trailing newline (after the last `},`). Make the
    # new namespaces start on their own line, and leave a trailing newline.
    if not body.endswith("\n"):
        body = body + "\n"
    new_body = body + new_block + "\n"

    header = (
        "// " + const_name + " dictionary.\n"
        "// Auto-generated from apps/web-app/src/lib/i18n/dictionaries.ts by scripts/split-dictionaries.py.\n"
        "// New namespaces (navigation, home, discover, compose, profile, emptyStates) appended by the script.\n"
        "\n"
        'import { NamespaceDict } from "../types";\n'
        "\n"
    )
    body_decl = "export const " + const_name + "_DICT: NamespaceDict = {" + new_body + "};\n"
    out_path = os.path.join(OUT_DIR, "base." + lang_code + ".ts")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(header + body_decl)
    print("Wrote " + out_path)


def write_barrel(entries):
    """Write dictionaries/index.ts that re-exports every dict and DICTIONARIES."""
    lines = [
        "// Auto-generated by scripts/split-dictionaries.py. Do not edit by hand.",
        "",
        'import { NamespaceDict, LocaleTag } from "../types";',
        "",
    ]
    for lang_code, const_name, _ in entries:
        lines.append('import { ' + const_name + '_DICT } from "./base.' + lang_code + '";')
    lines.append("")
    lines.append("export const DICTIONARIES: Record<LocaleTag, NamespaceDict> = {")
    for lang_code, const_name, _ in entries:
        lines.append("  " + lang_code + ": " + const_name + "_DICT,")
    lines.append("};")
    lines.append("")
    lines.append("export {")
    for _, const_name, _ in entries:
        lines.append("  " + const_name + "_DICT,")
    lines.append("};")
    lines.append("")
    barrel_path = os.path.join(OUT_DIR, "index.ts")
    with open(barrel_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("Wrote " + barrel_path)


def main():
    with open(SOURCE, "r", encoding="utf-8") as f:
        content = f.read()

    os.makedirs(OUT_DIR, exist_ok=True)

    entries = parse_dicts(content)

    if len(entries) != len(LOCALES):
        print(
            "WARNING: expected " + str(len(LOCALES)) + " dicts, found " + str(len(entries)),
            file=sys.stderr,
        )

    seen = [e[0] for e in entries]
    missing = [loc for loc in LOCALES if loc not in seen]
    if missing:
        print("WARNING: missing locales: " + ", ".join(missing), file=sys.stderr)

    for lang_code, const_name, body in entries:
        write_dict_file(lang_code, const_name, body)

    write_barrel(entries)

    print(
        "Done. Generated " + str(len(entries)) + " dictionary files in " + OUT_DIR
    )


if __name__ == "__main__":
    main()
