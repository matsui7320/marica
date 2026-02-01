import { Game } from './Game';

try {
  const game = new Game();
  game.start().catch((e) => {
    console.error(e);
    showError(e);
  });
} catch (e) {
  console.error(e);
  showError(e);
}

function showError(e: unknown) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#111;color:#f44;font-family:monospace;padding:20px;z-index:9999;white-space:pre-wrap;font-size:14px;';
  div.textContent = 'Error:\n' + String(e) + '\n\n' + ((e as Error)?.stack ?? '');
  document.body.appendChild(div);
}
