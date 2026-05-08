#!/bin/bash

INPUT=$(cat)

CWD=$(echo "$INPUT" | jq -r '.cwd')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId')

# Check for existing bicep files
BICEP_EXISTS="false"
if find "$CWD" -name "*.bicep" -o -name "*.bicepparam" 2>/dev/null | grep -q .; then
  BICEP_EXISTS="true"
fi

# Check for existing terraform files
TERRAFORM_EXISTS="false"
if find "$CWD" -name "*.tf" -o -name "*.tfvars" 2>/dev/null | grep -q .; then
  TERRAFORM_EXISTS="true"
fi

# Check for existing azure.yaml file
AZURE_YAML_EXISTS="false"
if find "$CWD" -name "azure.yaml" 2>/dev/null | grep -q .; then
  AZURE_YAML_EXISTS="true"
fi

# Detect existing code files and their languages
LANGUAGES=""
if find "$CWD" -name "*.py" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}python, "
fi
if find "$CWD" -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}javascript/typescript, "
fi
if find "$CWD" -name "*.cs" -o -name "*.csproj" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}csharp, "
fi
if find "$CWD" -name "*.java" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}java, "
fi
if find "$CWD" -name "*.go" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}go, "
fi
if find "$CWD" -name "*.rs" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}rust, "
fi
if find "$CWD" -name "*.rb" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}ruby, "
fi
if find "$CWD" -name "*.php" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}php, "
fi
if find "$CWD" -name "*.cpp" -o -name "*.c" -o -name "*.h" 2>/dev/null | grep -q .; then
  LANGUAGES="${LANGUAGES}c/cpp, "
fi
# Remove trailing comma and space
LANGUAGES=$(echo "$LANGUAGES" | sed 's/, $//')

CODE_EXISTS="false"
if [ -n "$LANGUAGES" ]; then
  CODE_EXISTS="true"
fi

# Write results to file
{
  echo "session_id: $SESSION_ID"
  echo "existing_bicep_files: $BICEP_EXISTS"
  echo "existing_terraform_files: $TERRAFORM_EXISTS"
  echo "existing_azure_yaml: $AZURE_YAML_EXISTS"
  echo "existing_code: $CODE_EXISTS"
  echo "languages: $LANGUAGES"
} > existing_iac_files.txt
