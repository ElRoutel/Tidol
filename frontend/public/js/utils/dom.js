export async function reloadScripts(container) {
  const scripts = container.querySelectorAll("script");
  for (const oldScript of scripts) {
    const newScript = document.createElement("script");
    if (oldScript.src) newScript.src = oldScript.src;
    else newScript.textContent = oldScript.textContent;
    document.body.appendChild(newScript);
    oldScript.remove();
  }
}
