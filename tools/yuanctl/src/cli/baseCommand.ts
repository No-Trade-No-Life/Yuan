import { Command, Option } from 'clipanion';
import type { GlobalOptions } from './context';

export abstract class YuanctlCommand extends Command {
  contextOpt = Option.String('-c,--context', {
    description: 'Use a specific context from config',
    required: false,
  });
  hostUrlOpt = Option.String('--host-url', {
    description: 'Override host URL from context',
    required: false,
  });
  selectorOpt = Option.String('--selector', { description: 'Label selector, field=value', required: false });
  fieldSelectorOpt = Option.String('--field-selector', {
    description: 'Field selector, field=value',
    required: false,
  });
  outputOpt = Option.String('-o,--output', { description: 'Default output format', required: false });
  forceConfirmOpt = Option.Boolean('--force-confirm', {
    description: 'Always prompt before mutating operations',
  });
  noHeadersOpt = Option.Boolean('--no-headers', { description: 'Omit headers in table output' });
  wideOpt = Option.Boolean('--wide', { description: 'Use wide table output' });

  protected get globalOptions(): GlobalOptions {
    return {
      context: this.contextOpt ?? undefined,
      hostUrl: this.hostUrlOpt ?? undefined,
      selector: this.selectorOpt ?? undefined,
      fieldSelector: this.fieldSelectorOpt ?? undefined,
      output: this.outputOpt ?? undefined,
      forceConfirm: this.forceConfirmOpt,
      noHeaders: this.noHeadersOpt,
      wide: this.wideOpt,
    };
  }
}
