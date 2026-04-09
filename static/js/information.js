document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("disease-letters");
  if (!container) {
    return;
  }
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(letter => {
    const btn = document.createElement("button");
    btn.type        = "button";
    btn.textContent = letter;
    container.appendChild(btn);
  });
});