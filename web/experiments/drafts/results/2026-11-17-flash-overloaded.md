# 17 Nov 2026: v8 and the hints prompt on Flash (morning)

Script: `v8-vs-hints.exp.ts`, the four answer sets below, one request at a time, 13 s apart.

| Model | Result |
|---|---|
| gemini-3.6-flash | 7 of 8 failed: 503 "high demand" or no answer in 60 s |
| gemini-3.5-flash | 6 of 6 failed: 503 or no answer in 60 s |
| gemini-2.5-flash | 404: listed for the key, but retired ("no longer available") |
| gemini-3.7-flash | 8 of 8 failed: 503 or no answer in 60 s |

The one answer (3.6 Flash, hints prompt, 5.4 s), for moment "How blue the sky was", place "Hyde Park, the birds around", felt "Dreamy", other "Both nature and pubs etc were great":

```
How blue the sky was over Hyde Park,
with all the birds around us.
A dreamy mix of nature and pubs.
```

Owner's verdict: not an Instagram caption, still the answers reworded. Led to v9 (answers as hints, places as hashtags), tested on Lite first.

Answer sets used:
1. moment "Bus rides under blue skies", place "Hyde Park, beautiful lake", felt "Peaceful but also lively", other "Camden , sunset, punk"
2. moment "Sunset in camden, full on punk", place "Hyde Park, beautiful lake", felt "Peaceful but also lively", other "The blue skies, the bus rides"
3. moment "How blue the sky was", place "Hyde Park, the birds around", felt "Dreamy", other "Both nature and pubs etc were great"
4. moment "missed the last train so we walked home", felt "tired but laughing the whole way"
