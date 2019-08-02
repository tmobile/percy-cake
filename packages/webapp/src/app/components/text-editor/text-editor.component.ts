import { Component, OnInit, OnDestroy, OnChanges, Input, TemplateRef, SimpleChanges, ViewChild, ContentChild } from "@angular/core";
import { FormControl, Validators } from "@angular/forms";
import { combineLatest, Subscription } from "rxjs";
import { map } from "rxjs/operators";
import { Store, select } from "@ngrx/store";
import { MatInput } from "@angular/material";
import * as _ from "lodash";

import * as appStore from "store";
import { FileContentChange } from "store/actions/editor.actions";
import { percyConfig } from "config";
import { ConfigFile } from "models/config-file";
import { NotEmpty } from "services/validators";



@Component({
  selector: "app-text-editor",
  templateUrl: "./text-editor.component.html",
  styleUrls: ["./text-editor.component.scss"]
})
export class TextEditorComponent implements OnInit, OnChanges, OnDestroy {

  @Input() editMode: boolean;
  @Input() file: ConfigFile;
  @Input() isPercyrcFile: boolean;
  @Input() isViewOnly = false;

  @ContentChild("buttonsTemplate") buttonsTemplate: TemplateRef<any>;

  fileContent: string;
  fileEditorContent: string;
  showFileEditor = false;

  sub: Subscription;

  filename = new FormControl("", [
    NotEmpty,
    Validators.pattern(percyConfig.filenameRegex)
  ]);
  fileNameInput: MatInput;

  @ViewChild("fileNameInput")
  set _fileNameInput(_input: MatInput) {
    const first = !this.fileNameInput && _input;
    this.fileNameInput = _input;

    if (!this.filename.value && this.filename.enabled && first) {
      setImmediate(() => {
        this.fileNameInput.focus();
      });
    }
  }

  constructor(
    private store: Store<appStore.AppState>
  ) { }

  ngOnInit() {
    if (!this.editMode) {
      this.showFileEditor = true;
    }
    
    this.sub = combineLatest(
      this.filename.valueChanges,
      this.store.pipe(select(appStore.backendState))
    )
      .pipe(
        map(([_value, bs]) => {
          if (!(this.editMode || this.isPercyrcFile)) {
            if (
              this.filename.invalid &&
              !this.filename.hasError("alreadyExists")
            ) {
              return;
            }

            // Check whether the file name already exists
            if (
              _.find(bs.files.entities, {
                fileName: this.getFileName(),
                applicationName: this.file.applicationName
              })
            ) {
              this.filename.setErrors({ alreadyExists: true });
            } else {
              this.filename.setErrors(undefined);
            }
          }
        })
      )
      .subscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["file"]) {
      const { draftContent, originalContent } = this.file;
      this.fileContent = draftContent || originalContent;
      this.fileEditorContent = this.fileContent;
    }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }


  /*
    submit new file content
   */
  onSubmitChange() {
    this.store.dispatch(new FileContentChange(this.fileEditorContent));
    this.showFileEditor = false;
  }

  /**
   * returns the filename as validation result,
   * if filename is invalid (for a new file), then it returns null and focuses on the filename input
   * @return validation result.
   */
  validate() {
    let fileName = this.file.fileName;
    let valid = true;

    if (this.isPercyrcFile) {
      fileName = ".percyrc";
    } else if (!this.editMode) {
      if (this.filename.invalid) {
        this.fileNameInput.focus();
        valid = false;
      } else {
        // md file when its valid
        fileName = this.getFileName();
      }
    }

    return {
      file: { ...this.file, fileName },
      valid
    };
  }

  /**
   * Get normalized file name, only for markdown files
   * @returns normalized file name.
   */
  getFileName() {
    const name = _.trim(this.filename.value);
    return name.match(/\.[m|M][d|D]$/) ? name : name + ".md";
  }

}