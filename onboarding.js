(() => {
  "use strict";

  const openChatGPT = document.querySelector("#openChatGPT");
  const openSettings = document.querySelector("#openSettings");
  const finish = document.querySelector("#finish");

  openChatGPT.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://chatgpt.com/" });
  });
  openSettings.addEventListener("click", () => chrome.runtime.openOptionsPage());
  finish.addEventListener("click", () => window.close());
})();
