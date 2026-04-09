const chatInput    = document.getElementById('chat-input');
const sendBtn      = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const heroSection  = document.getElementById('hero-section');
let history = [];
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendBtn.addEventListener('click', sendMessage);
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) {
    return;
  }
  heroSection.style.display = 'none';
  chatMessages.classList.add('visible');
  chatInput.value = '';
  appendMessage('user', message);
  history.push({ role: 'user', content: message });
  setInputDisabled(true);
  const typingEl = appendTypingIndicator();
  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: history.slice(0, -1) }),
    });
    const data = await response.json();
    typingEl.remove();
    if (!response.ok) {
      appendMessage(` Error: ${data.detail || 'Something went wrong.'}`);
      return;
    }
    const botReply = (data.response != null) ? String(data.response) : '_No response received._';
    appendMessage('bot', botReply);
    history.push({ role: 'assistant', content: botReply });
    if (history.length > 20) {
      history = history.slice(-20);
    }

  } 
  catch (err) {
    typingEl.remove();
    appendMessage('Network error. Make sure the server is running.');
  } 
  finally {
    setInputDisabled(false);
    chatInput.focus();
  }
}
function appendMessage(role, text) {
  const safeText = (text != null && text !== '') ? String(text) : '_Empty response._';
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;
  const avatar = document.createElement('div');
  avatar.className = `message-avatar ${role === 'user' ? 'user-avatar' : 'bot-avatar'}`;
  avatar.innerHTML = role === 'user'
    ? '<i class="fa-solid fa-user"></i>'
    : '<i class="fa-solid fa-stethoscope"></i>';
  const content = document.createElement('div');
  content.className = 'message-content markdown-body';
  content.innerHTML = marked.parse(safeText);
  content.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(content, {
      delimiters: [
        { left: "$$", right: "$$", display: true  },
        { left: "$",  right: "$",  display: false },
        { left: "\\[", right: "\\]", display: true  },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    });
  }
  wrapper.appendChild(avatar);
  wrapper.appendChild(content);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function appendTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message bot-message';
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar bot-avatar';
  avatar.innerHTML = '<i class="fa-solid fa-stethoscope"></i>';
  const content = document.createElement('div');
  content.className = 'message-content typing-indicator';
  content.innerHTML = '<span></span><span></span><span></span>';
  wrapper.appendChild(avatar);
  wrapper.appendChild(content);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrapper;
}
function setInputDisabled(disabled) {
  chatInput.disabled = disabled;
  sendBtn.disabled   = disabled;
  chatInput.placeholder = disabled
    ? 'Analyzing...'
    : 'Ask me anything about your projects';
}