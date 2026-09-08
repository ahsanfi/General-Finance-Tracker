// ============================================================
// AI FINANCE ASSISTANT
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  (function () {
    const GROQ_KEY = "mtracker_groq_key";
    const MINIMAX_KEY = "mtracker_minimax_key";
    const PROVIDER_KEY = "mtracker_ai_provider";
    let aiChatHistory = [];
    let currentProvider =
      localStorage.getItem("mtracker_ai_provider") || "groq";

    const panel = document.getElementById("ai-panel");
    const backdrop = document.getElementById("ai-backdrop");
    const messagesEl = document.getElementById("ai-messages");
    const inputEl = document.getElementById("ai-input");
    const sendBtn = document.getElementById("ai-send-btn");
    const keySetup = document.getElementById("ai-key-setup");
    const suggestEl = document.getElementById("ai-suggestions");

    function getKey(p) {
      p = p || currentProvider;
      return localStorage.getItem(p === "groq" ? GROQ_KEY : MINIMAX_KEY) || "";
    }

    window.aiSelectProvider = function (p) {
      currentProvider = p;
      localStorage.setItem(PROVIDER_KEY, p);
      const groqTab = document.getElementById("ai-tab-groq");
      const mmTab = document.getElementById("ai-tab-minimax");
      const groqSetup = document.getElementById("ai-setup-groq");
      const mmSetup = document.getElementById("ai-setup-minimax");
      if (!groqTab || !mmTab) return;
      if (p === "groq") {
        groqTab.style.cssText =
          "flex:1;padding:10px 0;font-size:.75rem;font-weight:700;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff";
        mmTab.style.cssText =
          "flex:1;padding:10px 0;font-size:.75rem;font-weight:700;background:rgba(255,255,255,.05);color:#94a3b8";
        if (groqSetup) {
          groqSetup.classList.remove("hidden");
          groqSetup.style.display = "flex";
        }
        if (mmSetup) {
          mmSetup.classList.add("hidden");
          mmSetup.style.display = "none";
        }
      } else {
        mmTab.style.cssText =
          "flex:1;padding:10px 0;font-size:.75rem;font-weight:700;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff";
        groqTab.style.cssText =
          "flex:1;padding:10px 0;font-size:.75rem;font-weight:700;background:rgba(255,255,255,.05);color:#94a3b8";
        if (mmSetup) {
          mmSetup.classList.remove("hidden");
          mmSetup.style.display = "flex";
        }
        if (groqSetup) {
          groqSetup.classList.add("hidden");
          groqSetup.style.display = "none";
        }
      }
    };

    function updateProviderBadge() {
      const badge = document.getElementById("ai-provider-badge");
      if (!badge) return;
      if (currentProvider === "groq") {
        badge.textContent = "Powered by Groq • Llama 3.3";
        badge.style.color = "rgba(167,139,250,.7)";
      } else {
        const mmSel = document.getElementById("ai-model-minimax");
        const mmName = mmSel ? mmSel.value : "MiniMax-M2.5";
        badge.textContent = `Powered by MiniMax \u2022 ${mmName}`;
        badge.style.color = "rgba(34,211,238,.7)";
      }
    }

    function openPanel() {
      panel.classList.remove("translate-x-full");
      backdrop.classList.remove("hidden");
      document
        .getElementById("ai-chat-btn")
        .classList.add("scale-0", "opacity-0", "pointer-events-none");
      updateProviderBadge();
      window.aiSelectProvider(currentProvider);
      const key = getKey();
      if (!key) {
        keySetup.classList.remove("hidden");
        keySetup.style.display = "flex";
        messagesEl.classList.add("hidden");
        suggestEl.classList.add("hidden");
      } else {
        keySetup.style.display = "none";
        keySetup.classList.add("hidden");
        messagesEl.classList.remove("hidden");
        suggestEl.classList.toggle("hidden", aiChatHistory.length > 0);
      }
      setTimeout(() => inputEl.focus(), 350);
    }

    function closePanel() {
      panel.classList.add("translate-x-full");
      backdrop.classList.add("hidden");
      document
        .getElementById("ai-chat-btn")
        .classList.remove("scale-0", "opacity-0", "pointer-events-none");
    }

    document.getElementById("ai-chat-btn").addEventListener("click", openPanel);
    document
      .getElementById("ai-close-btn")
      .addEventListener("click", closePanel);
    backdrop.addEventListener("click", closePanel);

    // API Key save
    document.getElementById("ai-key-save-btn").addEventListener("click", () => {
      const inputId =
        currentProvider === "groq" ? "ai-key-groq" : "ai-key-minimax";
      const keyInput = document.getElementById(inputId);
      const key = keyInput ? keyInput.value.trim() : "";
      if (!key) return;
      localStorage.setItem(
        currentProvider === "groq" ? GROQ_KEY : MINIMAX_KEY,
        key,
      );
      keySetup.style.display = "none";
      keySetup.classList.add("hidden");
      messagesEl.classList.remove("hidden");
      suggestEl.classList.remove("hidden");
      updateProviderBadge();
      const label = currentProvider === "groq" ? "Groq (Llama 3.3)" : "MiniMax";
      addMessage(
        "model",
        `Hi! I'm your AI Finance Assistant \U0001f44b Connected via **${label}**. Ask me anything about your spending, income, trends, or budgets!`,
      );
    });

    // Settings: re-show provider setup
    document.getElementById("ai-settings-btn").addEventListener("click", () => {
      window.aiSelectProvider(currentProvider);
      // Pre-fill existing keys
      const gInp = document.getElementById("ai-key-groq");
      const mInp = document.getElementById("ai-key-minimax");
      if (gInp) gInp.value = getKey("groq");
      if (mInp) mInp.value = getKey("minimax");
      keySetup.style.display = "flex";
      keySetup.classList.remove("hidden");
      messagesEl.classList.add("hidden");
      suggestEl.classList.add("hidden");
    });

    // Clear chat
    document.getElementById("ai-clear-btn").addEventListener("click", () => {
      aiChatHistory = [];
      messagesEl.innerHTML = "";
      suggestEl.classList.remove("hidden");
    });

    // Suggestions
    document.querySelectorAll(".ai-suggestion").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text =
          btn.textContent
            .replace(/^[^\s]+\s/, "")
            .replace("?", "")
            .trim() + "?";
        sendMessage(text.charAt(0).toUpperCase() + text.slice(1));
      });
    });

    // Auto-resize textarea
    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        triggerSend();
      }
    });
    sendBtn.addEventListener("click", triggerSend);

    function triggerSend() {
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = "";
      inputEl.style.height = "auto";
      sendMessage(text);
    }

    function addMessage(role, text, isLoading = false) {
      suggestEl.classList.add("hidden");
      const isUser = role === "user";
      const div = document.createElement("div");
      div.className = `flex gap-3 ${isUser ? "justify-end" : "justify-start"}`;

      const bubble = document.createElement("div");
      bubble.className = isUser
        ? "max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white leading-relaxed"
        : "max-w-[88%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-slate-200 leading-relaxed";
      bubble.style.background = isUser
        ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
        : "rgba(255,255,255,0.05)";
      bubble.style.border = isUser
        ? "none"
        : "1px solid rgba(255,255,255,0.08)";

      if (isLoading) {
        bubble.innerHTML =
          '<span class="inline-flex gap-1 items-center"><span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay:0ms"></span><span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay:150ms"></span><span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay:300ms"></span></span>';
        div.id = "ai-loading-bubble";
      } else {
        // Render simple markdown: **bold**, *italic*, newlines
        bubble.innerHTML = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(
            /`(.+?)`/g,
            '<code class="bg-black/40 px-1 rounded text-violet-300 text-xs font-mono">$1</code>',
          )
          .replace(/\n/g, "<br>");
      }

      div.appendChild(bubble);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function buildDataContext() {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const data = window.masterData || [];

      const header = `You are a personal finance assistant for MTracker app.
Today's date: ${todayStr}
Exchange rate: 1 USD = ${window.exchangeRate || 16000} IDR
Currency: Primary is IDR (Indonesian Rupiah).`;

      const instructions = `Instructions:
- Format IDR amounts with commas, e.g. IDR 1,234,567.
- "Last week" = Mon-Sun of the previous calendar week.
- Be concise and friendly. Say honestly if data is unavailable.`;

      if (currentProvider === "minimax") {
        // MiniMax M2 has 204,800 token context — send ALL transactions
        const allTx =
          data
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(
              (d) =>
                `${d.date}|${d.type}|${d.desc}|${d.cat}|${d.acc}|${d.curr}|${d.amt}`,
            )
            .join("\n") || "(none)";

        return `${header}

== ALL TRANSACTIONS (complete history) ==
Format: date|type|description|category|account|currency|amount
${allTx}

${instructions}
- You have the user's FULL transaction history. Use it for any time range or deep analysis.`;
      } else {
        // Groq: 12k TPM limit — send last 3 months raw + all-time monthly summary
        const cutoff3m = new Date(today);
        cutoff3m.setMonth(cutoff3m.getMonth() - 3);
        const cutoff3mStr = cutoff3m.toISOString().split("T")[0];

        const recentTx =
          data
            .filter((d) => d.date >= cutoff3mStr)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(
              (d) =>
                `${d.date}|${d.type}|${d.desc}|${d.cat}|${d.curr}|${d.amt}`,
            )
            .join("\n") || "(none)";

        const monthlySummary = {};
        data.forEach((d) => {
          const month = d.date.slice(0, 7);
          const key = `${month}|${d.type}|${d.cat}|${d.curr}`;
          monthlySummary[key] = (monthlySummary[key] || 0) + d.amt;
        });
        const summaryLines =
          Object.entries(monthlySummary)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([k, v]) => `${k}|${Math.round(v)}`)
            .join("\n") || "(none)";

        return `${header}

== RECENT TRANSACTIONS (last 3 months) ==
Format: date|type|description|category|currency|amount
${recentTx}

== MONTHLY SUMMARY (all time, aggregated) ==
Format: month|type|category|currency|total_amount
${summaryLines}

${instructions}
- For specific lookups, use RECENT TRANSACTIONS. For trends, use MONTHLY SUMMARY.`;
      }
    }

    async function sendMessage(text) {
      if (!getKey()) {
        openPanel();
        return;
      }

      aiChatHistory.push({ role: "user", text });
      addMessage("user", text);

      const loadingEl = addMessage("model", "", true);
      loadingEl.id = "ai-loading-bubble";
      sendBtn.disabled = true;

      try {
        const systemCtx = buildDataContext();
        // Provider-aware API call
        const isGroq = currentProvider === "groq";
        const endpoint = isGroq
          ? "https://api.groq.com/openai/v1/chat/completions"
          : "https://api.minimax.io/v1/chat/completions";
        const mmModelEl = document.getElementById("ai-model-minimax");
        const mmModel = mmModelEl ? mmModelEl.value : "MiniMax-M2.5";
        const model = isGroq ? "llama-3.3-70b-versatile" : mmModel;

        const messages = [
          { role: "system", content: systemCtx },
          ...aiChatHistory.map((m) => ({
            role: m.role === "model" ? "assistant" : m.role,
            content: m.text,
          })),
        ];

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getKey()}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.4,
            max_tokens: 1024,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const rawReply =
          data.choices?.[0]?.message?.content ||
          "Sorry, I couldn't generate a response.";
        // Strip <think>...</think> reasoning blocks (MiniMax M2 series shows chain-of-thought)
        const reply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

        document.getElementById("ai-loading-bubble")?.remove();
        addMessage("model", reply);
        aiChatHistory.push({ role: "model", text: reply });
      } catch (e) {
        document.getElementById("ai-loading-bubble")?.remove();
        const errMsg =
          e.message.includes("API_KEY_INVALID") || e.message.includes("400")
            ? "❌ Invalid API key. Click the 🔑 key icon to update it."
            : `❌ Error: ${e.message}`;
        addMessage("model", errMsg);
      } finally {
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }

    // Expose masterData and exchangeRate to window for the AI context builder
    // (they are defined inside DOMContentLoaded but we reference them via window)
  })();
}); // end DOMContentLoaded for AI module

// --- PULL TO REFRESH LOGIC ---
document.addEventListener("DOMContentLoaded", () => {
  let touchStartY = 0;
  let touchMoveY = 0;
  let isPulling = false;
  let isRefreshing = false;
  const ptrIndicator = document.getElementById("ptr-indicator");
  if (!ptrIndicator) return;

  const ptrIcon = document.getElementById("ptr-icon");
  const ptrText = document.getElementById("ptr-text");
  const PULL_THRESHOLD = 80;

  document.addEventListener(
    "touchstart",
    (e) => {
      if (
        e.target.closest(
          'dialog, [id$="-modal"], #mobile-trans-list, #ai-panel, input, textarea, select',
        ) ||
        document.querySelector("dialog[open]")
      )
        return;
      if (window.scrollY <= 0 && !isRefreshing) {
        touchStartY = e.touches[0].clientY;
        touchMoveY = touchStartY;
        isPulling = true;
      }
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!isPulling || isRefreshing) return;

      touchMoveY = e.touches[0].clientY;
      const pullDistance = touchMoveY - touchStartY;

      if (pullDistance > 0 && window.scrollY <= 0) {
        // Check if we can prevent default to stop browser native refresh
        if (e.cancelable) e.preventDefault();

        // Visual feedback
        const visualDist = Math.min(pullDistance * 0.4, 100);
        ptrIndicator.style.transform = `translateY(${visualDist - 64}px)`;

        if (pullDistance > PULL_THRESHOLD) {
          ptrIcon.classList.replace("fa-arrow-down", "fa-spinner");
          ptrIcon.classList.add("fa-spin");
          ptrText.textContent = "Release to refresh";
        } else {
          ptrIcon.classList.replace("fa-spinner", "fa-arrow-down");
          ptrIcon.classList.remove("fa-spin");
          ptrText.textContent = "Pull to refresh";
        }
      }
    },
    { passive: false },
  );

  document.addEventListener("touchend", (e) => {
    if (!isPulling || isRefreshing) return;
    isPulling = false;

    const pullDistance = touchMoveY - touchStartY;

    if (pullDistance > PULL_THRESHOLD && window.scrollY <= 0) {
      isRefreshing = true;
      ptrIndicator.style.transform = `translateY(16px)`;
      ptrText.textContent = "Refreshing...";

      // Try to find the local fetchData function by cheating and using the global reference if possible,
      // otherwise just fallback to location.reload()
      location.reload();
      // Note: Since fetchData is deeply scoped in app.js, the safest easiest way
      // to refresh all state in a simple app is just reloading the page.
      // If they are offline, it will just reload from cache.
    } else {
      resetPtr();
    }
  });

  function resetPtr() {
    ptrIndicator.style.transform = "translateY(-100%)";
    setTimeout(() => {
      if (isRefreshing) return;
      ptrIcon.classList.replace("fa-spinner", "fa-arrow-down");
      ptrIcon.classList.remove("fa-spin");
      ptrText.textContent = "Pull to refresh";
    }, 300);
  }
});
