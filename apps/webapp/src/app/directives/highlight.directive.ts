/** ========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/

import { Directive, Inject, Optional, ElementRef, HostBinding } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { animationFrameScheduler } from "rxjs";
import * as cheerio from "cheerio";
import { HIGHLIGHT_OPTIONS, HighlightOptions, Highlight, HighlightJS, HighlightResult } from "ngx-highlightjs";
import { YamlService } from "services/yaml.service";

/**
 * Extend the Highlight directive to color the variable reference specially.
 */
@Directive({
  selector: "[appHighlight]"
})
export class HighlightDirective extends Highlight {
  @HostBinding("class.hljs") hljsClass = true;

  /**
   * Construct the component.
   *
   * @param hljs The HighlightJS service
   * @param zone NgZone
   * @param yamlService the util service
   */
  constructor(private el: ElementRef, hljs: HighlightJS, sanitizer: DomSanitizer,
    @Optional() @Inject(HIGHLIGHT_OPTIONS) _options: HighlightOptions, yamlService: YamlService) {
    super(el, hljs, sanitizer, _options);

    this.highlighted.subscribe((res: HighlightResult) => {
      let code = res.value;

      if (res.language !== "yaml") {
        return;
      }

      const $ = cheerio.load(code);

      // fix tag category incorrectly assigned by highlightjs
      const numSpans = $("span.hljs-number");
      numSpans.each((_idx, span) => {
        if (
          !span.prev ||
          !span.prev.prev ||
          !(span.prev.prev as any).firstChild ||
          ((span.prev.prev as any).firstChild.data !== "!!int" &&
          (span.prev.prev as any).firstChild.data !== "!!float")
        ) {
          $(span)
            .removeClass("hljs-number")
            .addClass("hljs-attr");
        }
      });

      const stringSpans = $("span.hljs-string");
      stringSpans.each((_idx, span) => {
        const spanNode = $(span);

        // Check it really repsents a string value else correct the tag category
        if (
          !span.prev ||
          !span.prev.prev ||
          !(span.prev.prev as any).firstChild ||
          (span.prev.prev as any).firstChild.data !== "!!str"
        ) {
          spanNode.removeClass("hljs-string").addClass("hljs-attr");
          return;
        }

        // Highlight the color the variable reference
        const text = spanNode.text();
        const newSpan = yamlService.highlightVariable(text, spanNode);
        if (newSpan !== spanNode) {
          spanNode.replaceWith(newSpan);
        }
      });

      code = $.html();
      animationFrameScheduler.schedule(() =>
        this.el.nativeElement.innerHTML = code || ""
      );
    });
  }

  /**
   * Highlight the yaml code. We override this method to ensure a non-null code is passed in.
   *
   * @param code The yaml code
   * @param languages The yaml languages
   */
  highlightElement(code, languages) {
    super.highlightElement(code || "", languages);
  }
}
