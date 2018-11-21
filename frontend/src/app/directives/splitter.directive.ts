import { Directive, Input, AfterViewInit } from '@angular/core';

import * as Split from 'split.js';

@Directive({
  selector: '[appSplit]'
})
export class SplitDirective implements AfterViewInit {
  private _areas: string[] | null = null;
  private _sizes: number[] | null = null;
  private _minSizes: number[] | null = null;
  private _direction = 'horizontal';
  private _gutterHeight: number | null = null;

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

  constructor() {}

  ngAfterViewInit() {
    const options: any = {sizes: this._sizes, direction: this._direction};
    if (this._minSizes) {
      options.minSize = this._minSizes;
    }
    if (this._gutterHeight) {
      options.gutterStyle = () => ({'width': '10px', 'height': this._gutterHeight + 'px'});
    }
    Split(this._areas, options);
  }
}
