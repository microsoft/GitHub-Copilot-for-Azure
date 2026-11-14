"""Validate and filter reviewed catalog inputs without network, identity or writes."""

import argparse
import json
from pathlib import Path
import sys
from urllib.parse import parse_qsl, urlsplit


MAX_BYTES = 1_048_576
MAX_ENTRIES = 100


class InputError(ValueError):
    pass


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InputError("Duplicate JSON field; review the input schema.")
        result[key] = value
    return result


def checked_string(value, field):
    if not isinstance(value, str) or not value.strip() or len(value) > 2048:
        raise InputError(f"{field} must be a nonempty reviewed string of at most 2048 characters.")
    if any(ord(character) < 32 for character in value):
        raise InputError(f"{field} must not contain control characters.")
    return value


def validate_entry(entry):
    required = {"name", "toolEntityId", "serverUrl", "managedOAuth", "userEntraToken", "scopes"}
    optional = {"connectorName", "audience"}
    if not isinstance(entry, dict) or not required <= entry.keys() or entry.keys() - required - optional:
        raise InputError("Entry fields do not match the reviewed-input schema; exclude credentials and raw responses.")
    for field in ("name", "toolEntityId", "serverUrl"):
        checked_string(entry[field], field)
    for field in ("managedOAuth", "userEntraToken"):
        if type(entry[field]) is not bool:
            raise InputError(f"{field} must be an explicit reviewed boolean; support is never inferred.")
    try:
        endpoint = urlsplit(entry["serverUrl"])
    except ValueError as error:
        raise InputError("serverUrl is not a valid reviewed HTTPS URL.") from error
    if (endpoint.scheme != "https" or not endpoint.hostname or endpoint.username
            or endpoint.password or endpoint.fragment):
        raise InputError("serverUrl must be HTTPS without credentials or a fragment.")
    if any(key.casefold() != "api-version" for key, _ in parse_qsl(endpoint.query, keep_blank_values=True)):
        raise InputError("serverUrl query may contain only api-version; exclude tokens and secret-bearing URLs.")
    if not isinstance(entry["scopes"], list) or len(entry["scopes"]) > 50:
        raise InputError("scopes must be a reviewed list of at most 50 strings.")
    for scope in entry["scopes"]:
        checked_string(scope, "scope")
    for field, needed in (("connectorName", entry["managedOAuth"]),
                          ("audience", entry["userEntraToken"])):
        if needed or field in entry:
            checked_string(entry.get(field), field)
    return entry


def read_inputs(path):
    try:
        with Path(path).open("rb") as stream:
            raw = stream.read(MAX_BYTES + 1)
    except OSError as error:
        raise InputError("Cannot read the approved catalog input file; check its path and permissions.") from error
    if len(raw) > MAX_BYTES:
        raise InputError("Reviewed catalog input exceeds the 1 MiB limit; supply a bounded subset.")
    try:
        value = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise InputError("Reviewed catalog input must be valid UTF-8 JSON; raw content is not echoed.") from error
    if not isinstance(value, dict) or set(value) != {"schema_version", "coverage", "entries"}:
        raise InputError("Expected schema_version, coverage and entries; no raw catalog response is accepted.")
    if type(value["schema_version"]) is not int or value["schema_version"] != 1:
        raise InputError("Unsupported reviewed catalog schema_version.")
    if value["coverage"] not in ("complete", "partial"):
        raise InputError("coverage must explicitly be complete or partial for the reviewed input scope.")
    entries = value["entries"]
    if not isinstance(entries, list) or not entries or len(entries) > MAX_ENTRIES:
        raise InputError("entries must contain 1 to 100 reviewed records; empty evidence is not supported availability.")
    names = set()
    for entry in entries:
        validate_entry(entry)
        name = entry["name"].casefold()
        if name in names:
            raise InputError("Duplicate entry name; resolve ambiguous reviewed inputs.")
        names.add(name)
    return value


def select_inputs(value, name="", auth_filter=None):
    entries = [entry for entry in value["entries"]
               if name.casefold() in entry["name"].casefold()
               and (auth_filter is None or entry[auth_filter])]
    if not entries:
        raise InputError("No matching reviewed input. This does not prove incompatibility; obtain supported catalog evidence or reviewed inputs.")
    return {"status": "reviewed-inputs" if value["coverage"] == "complete" else "partial-reviewed-inputs",
            "coverage": value["coverage"], "availability": "unverified", "entries": entries}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name_substring", nargs="?", default="")
    parser.add_argument("--name", default="")
    parser.add_argument("--input-file", required=True)
    parser.add_argument("--reviewed-inputs", action="store_true")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--managed-oauth", action="store_true")
    group.add_argument("--user-entra-token", action="store_true")
    args = parser.parse_args(argv)
    if not args.reviewed_inputs:
        parser.error("--reviewed-inputs is required after reviewing sanitized inputs; no catalog is fetched.")
    if args.name and args.name_substring:
        parser.error("Supply only one name filter.")
    auth_filter = "managedOAuth" if args.managed_oauth else "userEntraToken" if args.user_entra_token else None
    try:
        result = select_inputs(read_inputs(args.input_file), args.name or args.name_substring, auth_filter)
    except InputError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    if result["coverage"] == "partial":
        print("warning: partial reviewed input scope; omitted tools remain unknown.", file=sys.stderr)
    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
