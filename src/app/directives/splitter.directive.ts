import { Directive, Input, AfterViewInit } from '@angular/core';

import Split from 'split.js';

@Directive({
  selector: '[appSplit]'
})
export class SplitDirective implements AfterViewInit {
  private _areas: string[] | null = null;
  private _sizes: number[] | null = null;
  private _minSizes: number[] | null = null;
  private _gutterHeight: number | null = null;
  private _gutterWidth: number | null = null;
  private _direction = 'horizontal';
  private _flexLayout = false;

  @Input() set splitFlexLayout(v: boolean) {
    this._flexLayout = v;
  }
  @Input() set splitAreas(v: string[]) {
    this._areas = v;
  }
  @Input() set splitSizes(v: number[]) {
    this._sizes = v;
  }
  @Input() set splitMinSizes(v: number[]) {
    this._minSizes = v;
  }
  @Input() set splitDirection(v: string) {
    this._direction = v;
  }
  @Input() set gutterHeight(v: number) {
    this._gutterHeight = v;
  }
  @Input() set gutterWidth(v: number) {
    this._gutterWidth = v;
  }

  constructor() { }

  ngAfterViewInit() {
    const options: any = { sizes: this._sizes, direction: this._direction, snapOffset: 0 };
    if (this._minSizes) {
      options.minSize = this._minSizes;
    }

    if (this._gutterHeight || this._gutterWidth) {
      const gutterStyles: any = {};
      if (this._gutterHeight) {
        if (this._direction === 'vertical') {
          options.gutterSize = this._gutterHeight;
        }
        gutterStyles.height = this._gutterHeight + 'px';
      }
      if (this._gutterWidth) {
        if (this._direction === 'horizontal') {
          options.gutterSize = this._gutterWidth;
        }
        gutterStyles.width = this._gutterWidth + 'px';
      }
      options.gutterStyle = () => gutterStyles;
    }

    if (this._flexLayout) {
      options.elementStyle = function (_dimension, size, gutterSize) {
        return {
          'flex-basis': 'calc(' + size + '% - ' + gutterSize + 'px)',
        };
      };
    }

    Split(this._areas, options);
  }
}
