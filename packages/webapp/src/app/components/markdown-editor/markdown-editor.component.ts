import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, Output, EventEmitter } from "@angular/core";
import { Subscription } from "rxjs";
import * as SimpleMDE from "simplemde";


@Component({
  selector: "app-markdown-editor",
  templateUrl: "./markdown-editor.component.html",
  styleUrls: ["./markdown-editor.component.scss"]
})
export class MarkdownEditorComponent implements OnInit, OnDestroy {

	@ViewChild("simplemde") textarea: ElementRef;

	@Input() content: string;
	@Output() contentChange = new EventEmitter<string>();

	private subscription = new Subscription();
	private simplemde: SimpleMDE;

  constructor() { }

  ngOnInit() {
  	this.initMdEditor();
  }

  ngOnDestroy() {
  	this.subscription.unsubscribe();
  }


  initMdEditor() {
  	const editorOptions = {
  		element: this.textarea.nativeElement,
  		spellChecker: false,
  		status: false,
  		toolbar: [
	      "bold",
	      "italic",
	      "heading",
	      "strikethrough",
	      "|",
	      "code",
	      "quote",
	      "ordered-list",
	      "unordered-list",
	      "|",
	      "link",
	      "image",
	      "table",
	      "horizontal-rule",
	      "|",
	      "guide",
	      "|"
	    ]
	  }

    this.simplemde = new SimpleMDE(editorOptions);
    this.simplemde.value(this.content);

    const sub = this.simplemde.codemirror.on("change", () => {
    	this.contentChange.emit(this.simplemde.value());
    });

    this.subscription.add(sub);
  }

}
