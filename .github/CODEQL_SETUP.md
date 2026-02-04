# CodeQL Setup Instructions

## Issue

The repository's default CodeQL setup was configured to analyze C# (csharp), but this repository contains only TypeScript/JavaScript code. This caused the CodeQL workflow to fail with the error: "No source files found".

## Solution

This repository now includes an advanced CodeQL workflow (`.github/workflows/codeql.yml`) that properly analyzes JavaScript/TypeScript code.

## Required Manual Step

A repository administrator needs to **switch from default to advanced setup** in the repository settings:

1. Go to **Settings** → **Security** → **Code security and analysis**
2. Find the **CodeQL analysis** section
3. Click the "..." menu next to "Default" setup
4. Select **Switch to advanced**
5. Confirm the switch

Once this is done, the new workflow file will be used instead of the default setup, and CodeQL will properly analyze the JavaScript/TypeScript codebase.

## What Changed

- Created `.github/workflows/codeql.yml` to analyze JavaScript/TypeScript
- Configured to run on:
  - Push to main branch
  - Pull requests to main branch
  - Weekly schedule (Mondays)
- Uses `security-and-quality` query suite for comprehensive analysis

## Verification

After switching to advanced setup, verify that:
1. The C# CodeQL analysis no longer runs
2. The new JavaScript CodeQL analysis runs successfully
3. No "No source files found" errors occur
