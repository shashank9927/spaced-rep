(function () {
  try {
    var theme = localStorage.getItem("recallcode-theme");
    document.documentElement.dataset.theme = theme === "dark" || theme === "light" ? theme : "dark";
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
})();
