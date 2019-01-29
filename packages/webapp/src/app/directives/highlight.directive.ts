import { Directive, NgZone, HostBinding } from '@angular/core';

import { Highlight, HighlightJS, HighlightResult } from 'ngx-highlightjs';
import * as cheerio from 'cheerio';

import { YamlService } from 'services/yaml.service';

/**
 * Extend the Highlight directive to color the variable reference specially.
 */
@Directive({
  selector: '[appHighlight]'
})
export class HighlightDirective extends Highlight {

  @HostBinding('class.hljs') hljsClass = true;
  @HostBinding('innerHTML') renderedCode: string;

  /**
   * Construct the component.
   * @param hljs The HighlightJS service
   * @param zone NgZone
   * @param yamlService the util service
   */
  constructor(hljs: HighlightJS, zone: NgZone, yamlService: YamlService) {
    super(hljs, zone);

    this.highlighted.subscribe((res: HighlightResult) => {
      const code = res.value;

      if (res.language !== 'yaml') {
        this.renderedCode = code;
        return;
      }

      const $ = cheerio.load(code);

      // fix tag category incorrectly assigned by highlightjs
      const numSpans = $('span.hljs-number');
      numSpans.each((_idx, span) => {
        if (
            !span.prev || !span.prev.prev || !span.prev.prev.firstChild ||
            (span.prev.prev.firstChild.data !== '!!int' && span.prev.prev.firstChild.data !== '!!float')
          ) {
          $(span).removeClass('hljs-number').addClass('hljs-attr');
        }
      });

      const stringSpans = $('span.hljs-string');
      stringSpans.each((_idx, span) => {
        const spanNode = $(span);

        // Check it really repsents a string value else correct the tag category
        if (!span.prev || !span.prev.prev || !span.prev.prev.firstChild || span.prev.prev.firstChild.data !== '!!str') {
          spanNode.removeClass('hljs-string').addClass('hljs-attr');
          return;
        }

        // Highlight the color the variable reference
        const text = spanNode.text();
        const newSpan = yamlService.highlightVariable(text, spanNode);
        if (newSpan !== spanNode) {
          spanNode.replaceWith(newSpan);
        }
      });

      this.renderedCode = $.html();
    });
  }

  /**
   * Highlight the yaml code. We override this method to ensure a non-null code is passed in.
   * @param code The yaml code
   * @param languages The yaml languages
   */
  highlightElement(code, languages) {
    super.highlightElement(code || '', languages);
  }
}
