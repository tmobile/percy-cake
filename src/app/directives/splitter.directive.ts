import { Directive, Input, AfterViewInit } from '@angular/core';

import Split from 'split.js';

@Directive({
  selector: '[appSplit]'
})
export class SplitDirective implements AfterViewInit {

  @Input() private splitAreas: string[];
  @Input() private splitSizes: number[];
  @Input() private splitMinSizes: number[];
  @Input() private gutterHeight: number;
  @Input() private gutterWidth: number;
  @Input() private splitDirection = 'horizontal';
  @Input() private splitFlexLayout = false;

  /**
   * Empty constructor.
   */
  constructor() { }

  /**
   * Split divs after view init.
   */
  ngAfterViewInit() {
    const options: any = { sizes: this.splitSizes, direction: this.splitDirection, snapOffset: 0 };
    if (this.splitMinSizes) {
      options.minSize = this.splitMinSizes;
    }

    if (this.gutterHeight || this.gutterWidth) {
      const gutterStyles: any = {};
      if (this.gutterHeight) {
        if (this.splitDirection === 'vertical') {
          options.gutterSize = this.gutterHeight;
        }
        gutterStyles.height = this.gutterHeight + 'px';
      }
      if (this.gutterWidth) {
        if (this.splitDirection === 'horizontal') {
          options.gutterSize = this.gutterWidth;
        }
        gutterStyles.width = this.gutterWidth + 'px';
      }
      options.gutterStyle = () => gutterStyles;
    }

    if (this.splitFlexLayout) {
      options.elementStyle = function (_dimension, size, gutterSize) {
        return {
          'flex-basis': 'calc(' + size + '% - ' + gutterSize + 'px)',
        };
      };
    }

    Split(this.splitAreas, options);
  }
}
