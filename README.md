# Ari Widget Translator

Hack Apertus 2026, Online Hack, **Track 2B (Own Project)**. Team LiveMap: Norbert Kremer, Claudio Romano, Ewan Jones, Tomas Witek, Luboš Matejčík.

Ari (myari.app) is a city companion app for Zurich built from small widgets. Each widget ships its copy as a typed string catalog in English and German. The Widget Translator takes a catalog to French or Italian: an LLM translates, deterministic checks guard placeholders, ICU plural branches, widget markers and Swiss spelling, an LLM review flags uncertain keys, a team member corrects while two live preview frames show the widget in both languages, and the result lands as a pull request. This repository holds the Apertus path of that work.

## Where to look

| What | Where |
| --- | --- |
| Technical report | [`track_2b/technical_report.md`](track_2b/technical_report.md), as PDF [`track_2b/LiveMap_Report.pdf`](track_2b/LiveMap_Report.pdf) |
| Demo video (100 s) | [Loom](https://www.loom.com/share/56a72cc55a18426584e47c989df2a541), same file in [`track_2b/docs/ari-apertus-demo.mp4`](track_2b/docs/ari-apertus-demo.mp4) |
| Standalone Apertus runner | [`track_2b/src/translate.mjs`](track_2b/src/translate.mjs): one system message, structured JSON output, the same checks as the product workflow |
| Dataset | [`track_2b/data/catalogs.json`](track_2b/data/catalogs.json): 9 catalogs, 1 002 keys, English and German source strings |
| Challenge description | [`track_2b/README.md`](track_2b/README.md) (unchanged from the Hack Apertus template) |

The product integration (translator page, Mastra workflow, widget runtime) lives in the private Ari monorepo `livemapai/frontend`, pull request #3432, merged 16.10.2026. The report describes it; access for code review is available on request.

## Run it

```bash
cd track_2b
make run                                                    # welcome -> fr; dry run without a key
LLM_API_KEY=... make run CATALOG=widgets/zurich-galleries/strings LOCALE=it
```

Environment: `LLM_NAME` (default `swiss-ai/Apertus-v1.5-8B`), `LLM_BASE_URL` (OpenAI-compatible, default `https://hackapertus.livemap.sh/v1`), `LLM_API_KEY`. Docker only, no GPU on the judge's machine. Without a key the runner executes the checks against the German reference so the pipeline still completes end to end. Results go to `track_2b/out/<catalog>.<locale>.json` with a status per key (OK, warning, error, uncertain) and a summary line.

## License

Source code: Apache License 2.0 (see [`LICENSE`](LICENSE)). Report, documentation and video: CC-BY-4.0. `data/catalogs.json`: CDLA-Permissive-2.0.
