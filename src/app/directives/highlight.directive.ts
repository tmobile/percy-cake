import { Directive, NgZone, HostBinding } from '@angular/core';

import { Highlight, HighlightJS } from 'ngx-highlightjs';
import * as cheerio from 'cheerio';

import { UtilService } from 'services/util.service';

@Directive({
  selector: '[appHighlight]'
})
export class HighlightDirective extends Highlight {

  @HostBinding('class.hljs') hljsClass = true;
  @HostBinding('innerHTML') renderedCode: string;

  constructor(hljs: HighlightJS, zone: NgZone, utilService: UtilService) {
    super(hljs, zone);

    this.highlighted.subscribe((res) => {
      const code = res.value;
      const $ = cheerio.load(code);

      const spans = $('span.hljs-string');

      spans.each((_idx, span) => {
        // Check it really repsents a string value
        if (!span.prev || !span.prev.prev || !span.prev.prev.firstChild || span.prev.prev.firstChild.data !== '!!str') {
          return;
        }

        const spanNode = $(span);
        const text = spanNode.text();
        const newSpan = utilService.highlightVariable(text, spanNode);
        if (newSpan !== spanNode) {
          spanNode.replaceWith(newSpan);
        }
      });

      this.renderedCode = $.html();
    });
  }

}
