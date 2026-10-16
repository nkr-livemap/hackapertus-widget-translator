.PHONY: run build

# Translate one widget catalog with Apertus and run the deterministic checks.
# Env: LLM_NAME (default swiss-ai/Apertus-v1.5-8B), LLM_BASE_URL (OpenAI-compatible, default https://hackapertus.livemap.sh/v1), LLM_API_KEY.
# Without LLM_API_KEY the runner does a dry run (checks only) so the pipeline still runs end to end.
CATALOG ?= widgets/welcome/strings
LOCALE ?= fr

build:
	docker build -t ari-widget-translator .

run: build
	mkdir -p out
	docker run --rm -e LLM_NAME -e LLM_BASE_URL -e LLM_API_KEY -v "$(CURDIR)/out:/app/out" ari-widget-translator --catalog $(CATALOG) --locale $(LOCALE)
