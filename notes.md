Running from tests/

npx @microsoft/vally-cli eval --eval-spec ../evals/azure-deploy/eval.yaml --skill-dir ../output/skills --output-dir ./results --verbose

npx @microsoft/vally-cli eval --eval-spec ../evals/azure-ai/eval.yaml --skill-dir ../output/skills --output-dir ./results --executor-plugin ../../tests/vally/vally-executor --verbose

npx @microsoft/vally-cli eval --eval-spec ../evals/suiteA/eval.yaml --executor-plugin ../../tests/vally/vally-executor.ts --verbose

npx @microsoft/vally-cli eval --eval-spec ../evals/suiteA/eval.yaml --output-dir ./results --executor-plugin ../../tests/vally/vally-executor.ts --verbose

npx @microsoft/vally-cli eval --eval-spec ../evals/azure-ai/eval.yaml --output-dir ./results --executor-plugin ../../tests/vally/vally-executor.ts --verbose