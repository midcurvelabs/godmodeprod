import { supabase } from "../lib/supabase";
import { callModel } from "../lib/router";

interface TopicInput {
  id: string;
  title: string;
  context: string;
  angle: string;
  sources: Array<{ url: string; title: string }>;
}

interface ResearchBriefPayload {
  topics: TopicInput[];
  episodeContext?: string;
  guestMode?: boolean;
  guestName?: string;
  guestBio?: string;
  showId: string;
  episodeId: string;
}

// --- Stage 1: Facts (Grok 4 Fast — native web + X access) ---

const FACTS_PROMPT = `You are a podcast research fact-finder for a tech/web3/AI podcast.

Your job: for each topic, pull FRESH, REAL, VERIFIABLE facts using your live web and X access. Do NOT fabricate numbers or dates. If you cannot find a verifiable fact, say so.

For each topic, output a JSON object with these fields:
- topic_title: the topic name
- what_happened: 2-3 sentences on what actually happened and when (use real dates)
- data_points: array of 3-5 specific, verifiable data points with numbers. Include the source URL for each.
- key_quotes: array of 1-3 real quotes from people directly involved (with attribution)
- related_links: array of 2-4 useful source URLs with titles

Output ONLY valid JSON: { "facts": [ ... ] }`;

// --- Stage 2: Synthesis (Sonnet 4.6 — reasoning + prose) ---

const SYNTH_PROMPT = `You are a podcast research synthesist for a tech/web3/AI podcast called "God Mode Pod".

You will receive verified facts for each topic. Your job: turn facts into a debate-ready brief the hosts can run with.

For each topic, output a JSON object with these fields:
- topic_title: the topic name
- what_happened: 2-3 sentences (use the facts provided; do not invent new ones)
- core_thesis: the central argument or position to explore
- steel_man: the strongest case FOR this position
- straw_man: the weakest/most common counterargument to knock down
- analogy: the best analogy to explain this to a smart non-expert
- data_points: the verified data points passed in (keep them verbatim, with sources)
- sample_dialogue: a snippet of how hosts might naturally discuss this (2-3 exchanges)
- connecting_threads: array of 2-3 links to other topics, broader trends, or past episodes

Output ONLY valid JSON: { "sections": [ ... ] }`;

// --- Single-stage fallback (Sonnet 4.6 only) ---

const SINGLE_PROMPT = `You are a podcast research assistant for a tech/web3/AI podcast called "God Mode Pod".

Your job is to produce comprehensive research briefs for each topic that will be discussed on the show.

For each topic, output a JSON object with these fields:
- topic_title: the topic name
- what_happened: 2-3 sentences on what happened and why it matters now
- core_thesis: the central argument or position to explore
- steel_man: the strongest case FOR this position
- straw_man: the weakest/most common counterargument to knock down
- analogy: the best analogy to explain this to a smart non-expert
- data_points: array of 3 specific, verifiable data points with numbers
- sample_dialogue: a snippet of how hosts might naturally discuss this (2-3 exchanges)
- connecting_threads: array of 2-3 links to other topics, broader trends, or past episodes

Output ONLY valid JSON: { "sections": [ ... ] }`;

export async function execute(
  payload: ResearchBriefPayload
): Promise<Record<string, unknown>> {
  const topicList = payload.topics
    .map(
      (t, i) =>
        `${i + 1}. **${t.title}**\n   Context: ${t.context || "None provided"}\n   Angle: ${t.angle || "None provided"}\n   Sources: ${t.sources?.map((s) => s.url).join(", ") || "None"}`
    )
    .join("\n\n");

  let userPromptBase = `Research these ${payload.topics.length} topics for the upcoming episode:\n\n${topicList}`;

  if (payload.episodeContext) {
    userPromptBase += `\n\nEpisode framing: ${payload.episodeContext}`;
  }

  if (payload.guestMode && payload.guestName) {
    userPromptBase += `\n\nThis is a guest episode with ${payload.guestName}. Bio: ${payload.guestBio || "Not provided"}. Include guest-specific research: prior interviews, greatest hits, deep questions, and flagged contradictions.`;
  }

  // Fetch show context
  const { data: showContextRows } = await supabase
    .from("show_context")
    .select("context_type, content")
    .eq("show_id", payload.showId);

  const context = {
    show_slug: "",
    soul: {} as Record<string, unknown>,
    hosts: {} as Record<string, unknown>,
    brand: {} as Record<string, unknown>,
    workflow: {} as Record<string, unknown>,
    assets_path: "",
    episode_number: 0,
    episode_id: payload.episodeId,
  };

  if (showContextRows) {
    for (const row of showContextRows) {
      const ct = row.context_type as string;
      if (ct === "soul") context.soul = row.content as Record<string, unknown>;
      else if (ct === "hosts") context.hosts = row.content as Record<string, unknown>;
      else if (ct === "brand") context.brand = row.content as Record<string, unknown>;
      else if (ct === "workflow") context.workflow = row.content as Record<string, unknown>;
    }
  }

  // Two-stage is the default; set RESEARCH_BRIEF_SINGLE_STAGE=1 to fall back.
  const singleStage = process.env.RESEARCH_BRIEF_SINGLE_STAGE === "1";

  let briefContent: Record<string, unknown>;

  if (singleStage) {
    const response = await callModel("research-brief", {
      systemPrompt: SINGLE_PROMPT,
      userPrompt: userPromptBase,
      context,
    });
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      briefContent = jsonMatch ? JSON.parse(jsonMatch[0]) : { sections: [] };
    } catch {
      briefContent = { raw: response, sections: [] };
    }
  } else {
    // Stage 1: Grok pulls facts
    const factsResponse = await callModel("research-brief-facts", {
      systemPrompt: FACTS_PROMPT,
      userPrompt: userPromptBase,
      context,
    });

    let factsData: Record<string, unknown>;
    try {
      const jsonMatch = factsResponse.match(/\{[\s\S]*\}/);
      factsData = jsonMatch ? JSON.parse(jsonMatch[0]) : { facts: [] };
    } catch {
      factsData = { facts: [] };
    }

    // Stage 2: Sonnet synthesizes
    const synthPrompt = `Original topic briefs:\n\n${topicList}\n\n--- VERIFIED FACTS (from live web/X search) ---\n${JSON.stringify(factsData, null, 2)}\n--- END FACTS ---\n\nTurn these into debate-ready briefs. Keep the data_points verbatim.`;

    const synthResponse = await callModel("research-brief-synth", {
      systemPrompt: SYNTH_PROMPT,
      userPrompt: synthPrompt,
      context,
    });

    let synthParseError: string | null = null;
    try {
      const jsonMatch = synthResponse.match(/\{[\s\S]*\}/);
      briefContent = jsonMatch ? JSON.parse(jsonMatch[0]) : { sections: [] };
    } catch (e) {
      synthParseError = e instanceof Error ? e.message : String(e);
      briefContent = { raw: synthResponse, sections: [] };
    }

    // Attach raw facts for provenance
    briefContent._facts_stage = factsData;

    // Fail loudly if synth produced no usable sections — otherwise we'd
    // silently save an empty brief and the UI would render "No research brief
    // generated yet" with no explanation. Common cause: synth response
    // truncated by max_tokens so the JSON never closes.
    const parsedSections = (briefContent as { sections?: unknown[] }).sections;
    if (!Array.isArray(parsedSections) || parsedSections.length === 0) {
      const tail = synthResponse.slice(-200).replace(/\s+/g, " ");
      throw new Error(
        `Research brief synth returned no parseable sections` +
          (synthParseError ? ` (parse error: ${synthParseError})` : ``) +
          `. Response likely truncated — raise max_tokens in lib/models.ts. ` +
          `Response tail: "...${tail}"`
      );
    }
  }

  // Save to database
  const { data: brief } = await supabase
    .from("research_briefs")
    .insert({
      episode_id: payload.episodeId,
      content: briefContent,
      status: "completed",
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Update episode status
  await supabase
    .from("episodes")
    .update({ status: "research_ready", updated_at: new Date().toISOString() })
    .eq("id", payload.episodeId);

  return { briefId: brief?.id, sections: (briefContent as { sections?: unknown[] }).sections?.length || 0 };
}
