import { Directive, NgZone, HostBinding } from '@angular/core';

import { Highlight, HighlightJS } from 'ngx-highlightjs';
import * as cheerio from 'cheerio';

import { percyConfig } from 'config';
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

      spans.each((idx, span) => {
        // Check it really repsents a string value
        if (!span.prev || !span.prev.prev || !span.prev.prev.firstChild || span.prev.prev.firstChild.data !== '!!str') {
          return;
        }

        const text = span.firstChild.data;

        // Find out the variable token, wrap it in '<span class="yaml-var">${tokenName}</span>'
        let leftIdx = 0;
        let foundAny = false;
        let regExpResult;
        const regExp = utilService.createRegExp();
        const newSpan = $('<span class="hljs-string"></span>');
        while (regExpResult = regExp.exec(text)) {
          foundAny = true;
          const tokenName = regExpResult[1];

          // Append left side plus variable substitute prefix
          newSpan.append($('<span></span>').text(text.slice(leftIdx, regExpResult.index) + percyConfig.variableSubstitutePrefix));
          // Append variable token name
          newSpan.append($('<span class="yaml-var"></span>').text(tokenName));
          // Update index
          leftIdx = regExpResult.index + percyConfig.variableSubstitutePrefix.length + tokenName.length;
        }

        if (foundAny) {
          // Append string left
          newSpan.append($('<span></span>').text(text.slice(leftIdx)));
          // Replace with new span
          $(span).replaceWith(newSpan);
        }
      });

      this.renderedCode = $.html();
    });
  }

}
