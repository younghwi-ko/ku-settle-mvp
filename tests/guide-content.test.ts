import { describe, expect, it } from "vitest";
import { lifeGuideArticles } from "../app/data";
import { expandedLifeGuideArticles, getGuideLocaleCopy } from "../app/guide-content";

describe("life guide localization and sources", () => {
  const articles = [...lifeGuideArticles, ...expandedLifeGuideArticles];
  const locales = ["en", "ko", "ja", "zh-CN", "uz", "vi", "mn", "ms"] as const;

  it("has localized preparation sections for every guide", () => {
    for (const article of articles) {
      for (const locale of locales) {
        const copy = getGuideLocaleCopy(article, locale);
        expect(copy.title).toBeTruthy();
        expect(copy.checklist?.length).toBe(article.checklist.length);
        if (copy.steps) expect(copy.steps.length).toBeGreaterThan(0);
        if (copy.cautions) expect(copy.cautions.length).toBeGreaterThan(0);
      }
    }
    expect(getGuideLocaleCopy(lifeGuideArticles[0], "ko").checklist?.[0]).toBe("내 과정에 적용되는 페이지 확인");
  });

  it.each(["uz", "vi", "mn", "ms"] as const)("does not expose mixed-language %s guide copy", (locale) => {
    for (const article of articles) {
      const copy = getGuideLocaleCopy(article, locale);
      const text = [copy.title, copy.summary, copy.content, ...(copy.checklist ?? []), ...(copy.steps ?? []), ...(copy.cautions ?? [])].join(" ");
      expect(text).not.toMatch(/tarikhs|\bCheck KU’s|\bUse the university’s|\bPrepare for dormitory\b|\bofficial housing\b|\bунтраасанicial\b/i);
    }
  });

  it("only exposes verified source links and keeps content dates", () => {
    for (const article of articles) {
      expect(article.contentCheckedAt ?? article.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (article.officialUrl) expect(article.sourceName).toBeTruthy();
    }
    expect(expandedLifeGuideArticles.find((article) => article.id === "recycling-basics")?.officialUrl).toMatch(/^https:\/\//);
    expect(expandedLifeGuideArticles.find((article) => article.id === "sim-esim-options")?.officialUrl).toMatch(/^https:\/\//);
  });

  it("classifies verified extended guides as official-source content", () => {
    for (const id of ["sim-esim-options", "recycling-basics", "departure-shipping"]) {
      const article = expandedLifeGuideArticles.find((item) => item.id === id);
      expect(article?.contentOrigin).toBe("official-guide");
      expect(article?.sourceStatus).toBe("verified");
      expect(article?.officialUrl).toMatch(/^https:\/\//);
    }
  });
});
