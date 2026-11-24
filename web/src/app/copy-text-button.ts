import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

export interface ClipboardGateway {
  writeText?: (value: string) => Promise<void>;
}

export type CopyTextOutcome = 'copied' | 'unavailable';

export async function copyText(gateway: ClipboardGateway, value: string): Promise<CopyTextOutcome> {
  if (!gateway.writeText) return 'unavailable';
  try {
    await gateway.writeText(value);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}

@Component({
  selector: 'tfg-copy-text-button',
  template: `
    <div class="copy-text-action">
      <button type="button" class="button secondary" (click)="copy()">{{ label() }}</button>
      <span class="copy-text-status" aria-live="polite">{{ status() }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CopyTextButtonComponent {
  readonly value = input.required<string>();
  readonly label = input('Copy exact action');
  readonly status = signal('');

  async copy() {
    const browserNavigator = typeof navigator === 'undefined' ? undefined : navigator;
    const outcome = await copyText({
      writeText: browserNavigator?.clipboard?.writeText
        ? (value) => browserNavigator.clipboard.writeText(value)
        : undefined
    }, this.value());
    this.status.set(outcome === 'copied' ? 'Copied.' : 'Clipboard unavailable. Select the text above.');
  }
}
