/* Shared Gemini transport for assistant and image extraction. */
(function (root) {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  function create(fetcher) {
    return async function request(url, options) {
      if (url !== endpoint) throw Error('Invalid Google AI Studio endpoint.');
      const key = String(options.headers?.Authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!key || key === 'null') throw Error('Save your Google AI Studio API key before continuing.');
      const body = JSON.parse(options.body);
      let response;
      try {
        response = await fetcher(endpoint, {...options, body: JSON.stringify({...body, reasoning_effort: 'low', max_tokens: Math.max(4096, body.max_tokens || 0)})});
      } catch (_) { throw Error('Could not connect to Google AI Studio. Check your connection and retry.'); }
      if (!response.ok) {
        const errors = await response.clone().json().catch(() => ({}));
        if (response.status === 401 || errors.error?.message?.includes('API key not valid')) throw Error('Google rejected this API key. Replace it with a Google AI Studio key and save again.');
        if (response.status === 403) throw Error('Google denied access. Check the API key restrictions and Gemini API access for your project.');
        if (response.status === 404) throw Error('This Gemini model is unavailable to your project. Check model access in Google AI Studio.');
        if (response.status === 429) throw Error('Google AI Studio quota or rate limit reached. Check your project usage or wait before retrying.');
        if (response.status >= 500) throw Error('Google AI Studio is temporarily unavailable. Please try again later.');
        throw Error(`Google AI Studio could not process the request (HTTP ${response.status}).`);
      }
      const result = await response.clone().json();
      const choice = result.choices?.[0];
      if (choice?.finish_reason === 'length') throw Error('Gemini reached its response limit. Try a smaller image or a shorter question.');
      if (typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw Error('Gemini returned no usable response. Try a clearer image or rephrase your question.');
      return response;
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {create, endpoint};
  else root.FinTracker.gemini = {request:create((...args)=>root.fetch(...args)), endpoint};
})(globalThis);
