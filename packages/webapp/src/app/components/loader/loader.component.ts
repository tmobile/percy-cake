import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {DOCUMENT} from '@angular/common';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent implements OnInit, OnDestroy {

  constructor(@Inject(DOCUMENT) private document: Document) {

  }

  ngOnInit() {
    this.document.body.classList.add('loading');
  }

  ngOnDestroy() {
    this.document.body.classList.remove('loading');
  }
}
