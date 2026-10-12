/**
 * BRIEF: бизнес-контекст проекта.
 *
 * Этот файл — единственное место, где описана семантика бизнеса.
 * Меняешь содержимое — меняются:
 *  • AI-промпты (analyze-performance, recommend, generate-briefs)
 *  • Парсер имён объявлений
 *  • Лейблы потоков в UI
 *  • Тон / запретные слова при генерации брифов
 *
 * Числовые пороги (CPL/CPQL/red flags) хранятся отдельно — в БД `app_settings`,
 * чтобы менять без передеплоя. Редактируется через Supabase Studio
 * либо через миграцию `011_app_settings.sql` (там seed).
 */

export interface BriefConfig {
  business: {
    /** Внутреннее короткое имя (для логов, заголовков). */
    name: string;
    /** Описание продукта 1-2 предложения. */
    product: string;
    /** ISO 639-1 язык контента: 'ru', 'en', 'de', ... */
    language: string;
    /** Кто целевая аудитория. */
    audience: string;
  };

  /**
   * Контекст, который вставляется в системные промпты Claude.
   * Сюда — длинный текст, всё что AI должен знать про бизнес.
   * Используется в /api/ai/analyze-performance, recommend, generate-briefs.
   */
  ai_context: string;

  /**
   * Потоки лидов = разрезы аналитики и Meta-аккаунты.
   * Минимум один. Каждый flow имеет код (для парсинга имён) и Meta ad account.
   */
  flows: Array<{
    code: string;            // 'com', 'gov', 'b2c', ...
    label: string;           // UI-лейбл, "Коммерческий"
    description?: string;    // подсказка для контекста
    meta_account_env: string; // имя env-переменной с ID аккаунта, напр. "META_AD_ACCOUNT_ID_COM"
  }>;

  /**
   * Воронка лидов — стадии и средний цикл сделки.
   * cycle_days_max используется для red flag low_roas (порог возраста).
   */
  funnel: {
    stages: string[];        // ['lead', 'qual_lead', 'transaction']
    cycle_days_min: number;
    cycle_days_max: number;
  };

  /**
   * Параметры креативной матрицы. Кол-во и имена параметров определяют
   * формат имени объявления и интерпретацию кодов.
   */
  creative_matrix: {
    /**
     * Параметры. Порядок важен — он определяет формат имени.
     * letter — короткий префикс кода (P, H, B, A).
     * label — UI-название.
     */
    params: Array<{
      key: "persona" | "hook" | "body" | "angle" | string; // используется как paramType
      letter: string;          // 'P', 'H', 'B', 'A'
      label: string;           // 'Персона', 'Хук', 'Боди', 'Энгл'
      color: string;           // hex для UI
    }>;
    formats: string[];         // 'UGC', 'STATIC', 'ANIMATION', 'HUMAN', 'MIXED'
    /**
     * Регулярка для парсинга имени объявления.
     * Group order должен совпадать с params[*].letter + затем format + flow.
     * Пример для P-H-B-A-FORMAT-FLOW:
     *   ^P(\d+)-H(\d+)-B(\d+)-A(\d+)-(UGC|STATIC|ANIMATION|HUMAN|MIXED)-(COM|GOV)$
     */
    name_pattern_template: string; // см. buildNameRegex() в lib/naming.ts
  };

  /**
   * Голос бренда — попадает в промпты при генерации брифов/сценариев.
   */
  brand_voice: {
    tone: string;
    forbidden_words?: string[];
    style_notes?: string;
    /**
     * Правила транслитерации / произношения для диалогов и voice-over.
     * Каждая строка — одно правило. Например:
     *   "SternMeister пишем как ШтернМастер"
     *   "DATEV произносится как дАтэв (ударение на первый слог)"
     * Если пусто — секция в промпте не выводится.
     */
    dialogue_rules?: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//                     ТЕКУЩАЯ КОНФИГУРАЦИЯ — SternMeister
// При форке проекта под другую компанию — меняй только эту константу.
// ─────────────────────────────────────────────────────────────────────────────

export const brief: BriefConfig = {
  business: {
    name: "Annuity Educator",
    product: "Lead generation for annuities: we run Meta ads that attract retirees interested in annuities, then pass the leads to partner agents who handle the sale",
    language: "en",
    audience: "US retirees and pre-retirees who may be interested in buying an annuity",
  },

  ai_context: `
Annuity Educator is a lead-generation business. We run Meta ads aimed at retirees who might want to buy an annuity.
We do NOT sell annuities ourselves. Our product is the lead: a person who raised their hand and left contact details.
Leads are handed over to partner agents, who contact them and do the actual selling.

Goal of every creative: get the right person to submit the lead form, and keep lead quality high
(leads that the partners can actually reach and talk to), not just drive cheap clicks.
Audience: retirees and people close to retirement. Content language: English only.
Metrics: CPL (cost per lead) and CPQL (cost per qualified lead).
  `.trim(),

  flows: [
    {
      code: "main",
      label: "Main",
      description: "Single Meta ad account (Annuity Educator_1)",
      meta_account_env: "META_AD_ACCOUNT_ID_MAIN",
    },
  ],

  funnel: {
    stages: ["lead", "qual_lead", "transaction"],
    cycle_days_min: 7,
    cycle_days_max: 30,
  },

  creative_matrix: {
    params: [
      { key: "persona", letter: "P", label: "Persona", color: "#48B8D0" },
      { key: "hook",    letter: "H", label: "Hook",    color: "#C490D1" },
      { key: "body",    letter: "B", label: "Body",    color: "#6EC8A0" },
      { key: "angle",   letter: "A", label: "Angle",   color: "#FF8B5A" },
    ],
    formats: ["UGC", "STATIC", "ANIMATION", "HUMAN", "MIXED"],
    name_pattern_template: "P{n}-H{n}-B{n}-A{n}-FORMAT-FLOW",
  },

  brand_voice: {
    tone: "Clear, respectful and plain-spoken; no hype.",
    forbidden_words: [],
    style_notes: "Write for retirees: simple words, no jargon. Do not promise guaranteed returns or specific income.",
    dialogue_rules: [],
  },
};
