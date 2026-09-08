/* Known image-capable models only; never send an image to a text-only fallback. */
(function (root) {
  const MODELS = ["qwen/qwen3.6-27b", "qwen/qwen3.8-27b"];
  function create(fetcher) {
    return async function request(endpoint, options) {
      if (endpoint !== "https://api.groq.com/openai/v1/chat/completions")
        return fetcher(endpoint, options);
      const body = JSON.parse(options.body);
      const token = String(options.headers?.Authorization || "")
        .replace(/^Bearer\s+/i, "")
        .trim();
      if (!token || token === "null")
        throw Error("Save your Groq API key in Settings before scanning.");
      for (const model of MODELS) {
        const payload = {
          ...body,
          model,
          reasoning_effort: "none",
          max_completion_tokens: Math.max(1024, body.max_tokens || 0),
        };
        delete payload.max_tokens;
        const response = await fetcher(endpoint, {
          ...options,
          body: JSON.stringify(payload),
        });
        if (response.ok) return response;
        const error = await response
          .clone()
          .json()
          .catch(() => ({}));
        const code = error.error?.code || "";
        if (
          response.status === 404 ||
          [
            "model_not_found",
            "model_decommissioned",
            "model_permission_blocked",
            "model_not_allowed",
          ].includes(code)
        )
          continue;
        if (response.status === 401)
          throw Error(
            "Groq rejected the API key. Replace it in Settings and save again.",
          );
        if (response.status === 403)
          throw Error(
            "Groq denied this request. Check your project model permissions and account access in Groq Console.",
          );
        if (response.status === 429)
          throw Error(
            "Groq rate or usage limit reached. Wait before scanning again, or check your Groq usage limits.",
          );
        if (response.status >= 500)
          throw Error(
            "Groq is temporarily unavailable. Your transaction has not been changed. Please try again later.",
          );
        throw Error(
          `Groq could not process this image (HTTP ${response.status}). Try a clear, smaller receipt image and check your Groq project settings.`,
        );
      }
      throw Error(
        "Neither supported Groq vision model is available to this key. Enable Qwen 3.6 or Qwen 3.8 model access in Groq Console, or choose another configured scanner provider. Your form has been kept.",
      );
    };
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = { create, MODELS };
  else
    root.FinTracker.groqVision = {
      request: create((...args) => root.fetch(...args)),
      model: MODELS[0],
    };
})(globalThis);
