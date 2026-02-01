import { Kart } from '../kart/Kart';
import { KART_COLORS } from '../constants';
import { positionSuffix, formatTime } from '../utils/math';

export class ResultsScreen {
  private container: HTMLElement;
  private el: HTMLDivElement | null = null;

  constructor() {
    this.container = document.getElementById('ui-overlay')!;
  }

  show(karts: Kart[], raceTime: number): Promise<void> {
    return new Promise((resolve) => {
      this.el = document.createElement('div');
      this.el.className = 'results-screen';

      const sorted = [...karts].sort((a, b) => a.racePosition - b.racePosition);

      let tableHtml = '';
      for (const kart of sorted) {
        const pos = kart.racePosition;
        const colorHex = '#' + KART_COLORS[kart.index].toString(16).padStart(6, '0');
        const name = kart.isPlayer ? 'YOU' : `RACER ${kart.index + 1}`;
        const time = kart.finished ? formatTime(kart.finishTime) : 'DNF';
        const rowClass = kart.isPlayer ? 'player-row' : '';
        const posClass = pos <= 3 ? `pos-${pos}` : '';

        tableHtml += `<tr class="${rowClass} ${posClass}">
          <td>${pos}${positionSuffix(pos)}</td>
          <td><span style="color:${colorHex};font-size:16px">●</span> ${name}</td>
          <td>${time}</td>
        </tr>`;
      }

      const playerPos = karts[0].racePosition;
      let title: string;
      let titleClass: string;
      if (playerPos === 1) {
        title = 'VICTORY!';
        titleClass = 'victory';
      } else if (playerPos <= 3) {
        title = playerPos === 2 ? 'GREAT RACE!' : 'GOOD JOB!';
        titleClass = 'good';
      } else {
        title = `${playerPos}${positionSuffix(playerPos)} PLACE`;
        titleClass = 'other';
      }

      this.el.innerHTML = `
        <div class="results-title ${titleClass}">${title}</div>
        <table class="results-table">${tableHtml}</table>
        <div class="results-continue">PRESS ENTER TO CONTINUE</div>
      `;

      const handleDismiss = () => {
        document.removeEventListener('keydown', onKey);
        this.el?.removeEventListener('click', handleDismiss);
        this.hide();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Enter' || e.code === 'Space') handleDismiss();
      };

      // Delay input acceptance to prevent accidental skip
      setTimeout(() => {
        document.addEventListener('keydown', onKey);
        this.el?.addEventListener('click', handleDismiss);
      }, 1000);

      this.el.style.pointerEvents = 'auto';
      this.container.appendChild(this.el);
    });
  }

  hide(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
