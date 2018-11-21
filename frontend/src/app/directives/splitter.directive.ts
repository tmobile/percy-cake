import { Directive, Input, AfterViewInit } from '@angular/core';

import * as _ from 'lodash';
import * as Split from 'split.js';

@Directive({
  selector: '[appSplit]'
})
export class SplitDirective implements AfterViewInit {
  private _areas: string[] | null = null;
  private _sizes: number[] | null = null;
  private _minSizes: number[] | null = null;
  private _direction = 'horizontal';
  private _gutterHeight: number | string = null;
  private _gutterWidth: number | string = null;

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
  @Input() set gutterHeight(v: number|string) {
    this._gutterHeight = _.isNumber(v) ? `${v}px` : v;
  }
  @Input() set gutterWidth(v: number|string) {
    this._gutterWidth = _.isNumber(v) ? `${v}px` : v;
  }

  constructor() {}

  ngAfterViewInit() {
    const options: any = {sizes: this._sizes, direction: this._direction, snapOffset: 0};
    if (this._minSizes) {
      options.minSize = this._minSizes;
    }
    if (this._gutterHeight || this._gutterWidth) {
      const gutterStyles: any = {};
      if (this._gutterHeight) {
        gutterStyles.height = this._gutterHeight;
      }
      if (this._gutterWidth) {
        gutterStyles.width = this._gutterWidth;
      }
      options.gutterStyle = () => gutterStyles;
    }
    Split(this._areas, options);
  }
}
