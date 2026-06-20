// Client for the stateless AI plan-generation service (docs/04 §4.3).
// Throws on misconfiguration, timeout, or non-2xx — callers fall back to the
// deterministic generator.
import { env } from "../config.js";

async function postAi(path, body) {
  if (!env.aiService?.url) {
    throw new Error("AI service not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiService.timeoutMs);
  try {
    const res = await fetch(`${env.aiService.url}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": env.aiService.key ?? "",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`AI service responded ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function fetchWorkoutPlan(profile, exerciseCatalog) {
  return postAi("/v1/plans/workout", { profile, exerciseCatalog });
}

export function fetchNutritionPlan(profile) {
  return postAi("/v1/plans/nutrition", { profile });
}
